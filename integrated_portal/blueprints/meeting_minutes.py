# -*- coding: utf-8 -*-
from flask import Blueprint, render_template, request, jsonify, Response, stream_with_context
import os
import requests
import json
import tempfile
import uuid
from datetime import datetime
import logging

# 检查音频处理依赖
try:
    from pydub import AudioSegment
    AUDIO_PROCESSING_AVAILABLE = True
except ImportError:
    AUDIO_PROCESSING_AVAILABLE = False
    logging.warning("pydub not available. Audio processing features will be disabled.")

# 使用Blueprint整合"会议纪要系统"到统一门户
meeting_minutes_bp = Blueprint(
    'meeting_minutes', __name__,
    template_folder='templates',
    static_folder='static',
    static_url_path='/meeting_minutes/static'
)

# Dify API配置
DIFY_API_BASE_URL = os.environ.get('DIFY_API_BASE_URL', 'http://localhost/v1')
DIFY_API_TOKEN = os.environ.get('DIFY_MEETING_MINUTES_TOKEN', 'app-dRc69RGQ1nCmo4d3aQuPb3Pa')

# 支持的音频格式
SUPPORTED_AUDIO_FORMATS = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.wma']
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB

# 临时文件存储目录
TEMP_DIR = os.path.join(tempfile.gettempdir(), 'meeting_minutes')
os.makedirs(TEMP_DIR, exist_ok=True)

@meeting_minutes_bp.route('/static/temp/<filename>')
def serve_temp_file(filename):
    """提供临时音频文件的访问"""
    from flask import send_from_directory
    return send_from_directory(TEMP_DIR, filename)

@meeting_minutes_bp.route('/')
def index():
    """会议纪要系统主页"""
    return render_template('meeting_minutes.html', 
                         audio_processing_available=AUDIO_PROCESSING_AVAILABLE,
                         supported_formats=SUPPORTED_AUDIO_FORMATS)

@meeting_minutes_bp.route('/upload_audio', methods=['POST'])
def upload_audio():
    """上传音频文件到Dify"""
    try:
        if 'audio_file' not in request.files:
            return jsonify({'error': '没有选择文件'}), 400
        
        file = request.files['audio_file']
        if file.filename == '':
            return jsonify({'error': '没有选择文件'}), 400
        
        # 检查文件大小
        file.seek(0, 2)  # 移动到文件末尾
        file_size = file.tell()
        file.seek(0)  # 重置到文件开头
        
        if file_size > MAX_FILE_SIZE:
            return jsonify({'error': f'文件大小超过限制 ({MAX_FILE_SIZE // (1024*1024)}MB)'}), 400
        
        # 检查文件格式
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in SUPPORTED_AUDIO_FORMATS:
            return jsonify({'error': f'不支持的音频格式。支持的格式: {", ".join(SUPPORTED_AUDIO_FORMATS)}'}), 400
        
        # 上传文件到Dify
        upload_url = f"{DIFY_API_BASE_URL}/files/upload"
        headers = {
            'Authorization': f'Bearer {DIFY_API_TOKEN}'
        }
        
        # 准备文件数据
        file.seek(0)  # 重置文件指针
        files = {
            'file': (file.filename, file.stream, file.content_type)
        }
        data = {
            'user': f'meeting_minutes_user_{datetime.now().strftime("%Y%m%d_%H%M%S")}'
        }
        
        # 发送上传请求到Dify
        response = requests.post(upload_url, headers=headers, files=files, data=data)
        
        if response.status_code not in [200, 201]:
            logging.error(f"Dify upload failed: {response.status_code}, {response.text}")
            return jsonify({'error': f'文件上传到Dify失败: {response.status_code}'}), 500
        
        upload_result = response.json()
        
        # 获取音频信息（可选）
        audio_info = {}
        if AUDIO_PROCESSING_AVAILABLE:
            try:
                # 重新读取文件以获取音频信息
                file.seek(0)
                temp_filename = f"{upload_result['id']}{file_ext}"
                temp_path = os.path.join(TEMP_DIR, temp_filename)
                with open(temp_path, 'wb') as temp_file:
                    temp_file.write(file.read())
                
                audio = AudioSegment.from_file(temp_path)
                audio_info = {
                    'duration': len(audio) / 1000,  # 转换为秒
                    'channels': audio.channels,
                    'frame_rate': audio.frame_rate,
                    'sample_width': audio.sample_width
                }
                
                # 保留临时文件供后续音频处理使用
                logging.info(f"Saved temp file for processing: {temp_filename}")
            except Exception as e:
                logging.warning(f"Failed to get audio info: {e}")
        
        return jsonify({
            'success': True,
            'dify_file_id': upload_result['id'],
            'filename': upload_result['name'],
            'file_size': upload_result['size'],
            'mime_type': upload_result['mime_type'],
            'extension': upload_result['extension'],
            'created_at': upload_result['created_at'],
            'audio_info': audio_info
        })
        
    except Exception as e:
        logging.error(f"Upload error: {e}")
        return jsonify({'error': f'上传失败: {str(e)}'}), 500

@meeting_minutes_bp.route('/process_audio', methods=['POST'])
def process_audio():
    """处理音频文件（裁剪、压缩等）"""
    if not AUDIO_PROCESSING_AVAILABLE:
        return jsonify({'error': '音频处理功能不可用，请安装pydub'}), 400
    
    try:
        data = request.get_json()
        file_id = data.get('file_id')
        start_time = data.get('start_time', 0)  # 秒
        end_time = data.get('end_time')  # 秒
        compress = data.get('compress', False)
        
        if not file_id:
            return jsonify({'error': '缺少文件ID'}), 400
        
        # 查找原始文件
        original_files = [f for f in os.listdir(TEMP_DIR) if f.startswith(file_id) or file_id in f]
        if not original_files:
            # 如果找不到文件，尝试使用file_id作为完整文件名查找
            all_files = os.listdir(TEMP_DIR)
            logging.error(f"Cannot find file with ID: {file_id}, available files: {all_files}")
            return jsonify({'error': f'找不到原始文件，文件ID: {file_id}'}), 404
        
        original_file = os.path.join(TEMP_DIR, original_files[0])
        
        # 加载音频
        audio = AudioSegment.from_file(original_file)
        
        # 裁剪音频
        if end_time:
            audio = audio[start_time * 1000:end_time * 1000]
        elif start_time > 0:
            audio = audio[start_time * 1000:]
        
        # 压缩音频（降低比特率）
        if compress:
            # 转换为MP3格式并降低比特率
            processed_filename = f"{file_id}_processed.mp3"
        else:
            processed_filename = f"{file_id}_processed.mp3"
        
        processed_path = os.path.join(TEMP_DIR, processed_filename)
        
        # 导出处理后的音频
        export_params = {"format": "mp3"}
        if compress:
            export_params["bitrate"] = "64k"
        
        audio.export(processed_path, **export_params)
        
        # 获取处理后的文件信息
        processed_size = os.path.getsize(processed_path)
        
        return jsonify({
            'success': True,
            'processed_file_id': f"{file_id}_processed",
            'processed_filename': processed_filename,
            'processed_size': processed_size,
            'duration': len(audio) / 1000
        })
        
    except Exception as e:
        logging.error(f"Audio processing error: {e}")
        return jsonify({'error': f'音频处理失败: {str(e)}'}), 500

@meeting_minutes_bp.route('/upload_processed_audio', methods=['POST'])
def upload_processed_audio():
    """将处理后的音频文件上传到Dify"""
    try:
        data = request.get_json()
        processed_file_id = data.get('processed_file_id')
        
        if not processed_file_id:
            return jsonify({'error': '缺少处理后的文件ID'}), 400
        
        # 查找处理后的文件
        processed_files = [f for f in os.listdir(TEMP_DIR) if f.startswith(processed_file_id)]
        if not processed_files:
            return jsonify({'error': '找不到处理后的文件'}), 404
        
        processed_file_path = os.path.join(TEMP_DIR, processed_files[0])
        
        # 上传到Dify
        with open(processed_file_path, 'rb') as f:
            files = {
                'file': (processed_files[0], f, 'audio/mpeg')
            }
            
            headers = {
                'Authorization': f'Bearer {DIFY_API_TOKEN}'
            }
            
            response = requests.post(
                f'{DIFY_API_BASE_URL}/files/upload',
                files=files,
                headers=headers,
                timeout=300
            )
            
            if response.status_code == 201:
                result = response.json()
                return jsonify({
                    'success': True,
                    'dify_file_id': result.get('id'),
                    'filename': processed_files[0],
                    'message': '处理后的音频文件上传成功'
                })
            else:
                return jsonify({
                    'success': False,
                    'error': f'Dify上传失败: {response.text}'
                }), response.status_code
                
    except Exception as e:
        logging.error(f"Processed audio upload error: {e}")
        return jsonify({'error': f'处理后音频上传失败: {str(e)}'}), 500

@meeting_minutes_bp.route('/generate_minutes', methods=['POST'])
def generate_minutes():
    """调用Dify工作流生成会议纪要"""
    try:
        data = request.get_json()
        file_id = data.get('file_id')
        participants_count = data.get('participants_count', 2)  # 默认2人参与
        additional_info = data.get('additional_info', '')
        
        if not file_id:
            return jsonify({'error': '缺少文件ID'}), 400
        
        def generate():
            try:
                # 准备Dify API请求
                url = f"{DIFY_API_BASE_URL}/chat-messages"
                headers = {
                    'Authorization': f'Bearer {DIFY_API_TOKEN}',
                    'Content-Type': 'application/json'
                }
                
                # 构建请求数据 - 根据工作流配置修正参数结构
                payload = {
                    'inputs': {
                        'sound_files': 
                            {
                                'type': 'audio',
                                'transfer_method': 'local_file',
                                'upload_file_id': file_id
                            },
                        'Nunber_fo_participants': participants_count
                    },
                    'query': '请分析这个音频文件并生成会议纪要',
                    'response_mode': 'streaming',
                    'user': f'meeting_minutes_user_{datetime.now().strftime("%Y%m%d_%H%M%S")}'
                }
                
                # 发送请求到Dify
                response = requests.post(url, headers=headers, json=payload, stream=True)
                
                if response.status_code != 200:
                    yield f"data: {json.dumps({'error': f'Dify API错误: {response.status_code}'})}\n\n"
                    return
                
                # 流式返回结果
                for line in response.iter_lines():
                    if line:
                        line_str = line.decode('utf-8')
                        if line_str.startswith('data: '):
                            yield f"{line_str}\n\n"
                        
            except Exception as e:
                logging.error(f"Dify API error: {e}")
                yield f"data: {json.dumps({'error': f'生成会议纪要失败: {str(e)}'})}\n\n"
        
        return Response(stream_with_context(generate()), mimetype='text/event-stream')
        
    except Exception as e:
        logging.error(f"Generate minutes error: {e}")
        return jsonify({'error': f'生成会议纪要失败: {str(e)}'}), 500

@meeting_minutes_bp.route('/cleanup_temp', methods=['POST'])
def cleanup_temp():
    """清理临时文件"""
    try:
        data = request.get_json()
        file_id = data.get('file_id')
        
        if file_id:
            # 删除特定文件
            temp_files = [f for f in os.listdir(TEMP_DIR) if f.startswith(file_id)]
            for temp_file in temp_files:
                try:
                    os.remove(os.path.join(TEMP_DIR, temp_file))
                except:
                    pass
        else:
            # 清理所有超过1小时的临时文件
            current_time = datetime.now().timestamp()
            for filename in os.listdir(TEMP_DIR):
                file_path = os.path.join(TEMP_DIR, filename)
                if os.path.isfile(file_path):
                    file_time = os.path.getmtime(file_path)
                    if current_time - file_time > 3600:  # 1小时
                        try:
                            os.remove(file_path)
                        except:
                            pass
        
        return jsonify({'success': True})
        
    except Exception as e:
        logging.error(f"Cleanup error: {e}")
        return jsonify({'error': f'清理失败: {str(e)}'}), 500

@meeting_minutes_bp.route('/health')
def health_check():
    """健康检查接口"""
    return jsonify({
        'status': 'healthy',
        'audio_processing_available': AUDIO_PROCESSING_AVAILABLE,
        'temp_dir': TEMP_DIR,
        'timestamp': datetime.now().isoformat()
    })