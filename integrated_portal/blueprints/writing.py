
# -*- coding: utf-8 -*-
from flask import Blueprint, render_template, render_template_string, request, redirect, url_for, flash, Response, stream_with_context, jsonify
import os
import requests
import json
import zipfile
import xml.etree.ElementTree as ET

# 使用Blueprint整合“智能文件撰写系统”到统一门户
writing_bp = Blueprint(
    'writing', __name__,
    template_folder=os.path.abspath(os.path.join(os.path.dirname(__file__), '../../Dify-artilcle-writing-sys/templates')),
    static_folder=os.path.abspath(os.path.join(os.path.dirname(__file__), '../../Dify-artilcle-writing-sys/static')),
    static_url_path='static'
)
# Dify API配置（建议用环境变量管理）
DIFY_API_BASE_URL = os.environ.get('DIFY_API_BASE_URL', 'http://localhost/v1')
DIFY_API_TOKEN = os.environ.get('DIFY_API_TOKEN', 'app-C8SM64mhiX4oOqAXlsDei8Qu')

# 文件类型映射
EXT_TYPE_MAP = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'text/plain': 'txt',
    'text/markdown': 'markdown',
    'text/html': 'html',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/xml': 'xml',
    'application/epub+zip': 'epub',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/amr': 'amr',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/mpeg': 'mpeg',
    'audio/mpga': 'mpga',
}
EXT_FILETYPE_MAP = {
    'pdf': 'document', 'doc': 'document', 'docx': 'document', 'txt': 'document', 'md': 'document', 'markdown': 'document', 'html': 'document',
    'xls': 'document', 'xlsx': 'document', 'ppt': 'document', 'pptx': 'document', 'xml': 'document', 'epub': 'document',
    'csv': 'document', 'eml': 'document', 'msg': 'document',
    'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image', 'webp': 'image', 'svg': 'image',
    'mp3': 'audio', 'm4a': 'audio', 'wav': 'audio', 'webm': 'audio', 'amr': 'audio', 'mpga': 'audio',
    'mp4': 'video', 'mov': 'video', 'mpeg': 'video',
}

def guess_type(file):
    mime = getattr(file, 'mimetype', None)
    ext = EXT_TYPE_MAP.get(mime)
    if not ext:
        ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    return EXT_FILETYPE_MAP.get(ext, 'custom')

def file_to_dify_input(file, file_id):
    file_type = guess_type(file)
    return {
        'type': file_type,
        'upload_file_id': file_id,
        'transfer_method': 'local_file'
    }

def extract_txt_text(file_path):
    """
    提取txt文件的文本内容
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read().strip()
            print(f"提取的TXT文件内容长度: {len(content)}")
            print(f"提取的TXT文件内容前100字符: {content[:100]}")
            return content if content else None
    except UnicodeDecodeError:
        # 如果UTF-8解码失败，尝试其他编码
        try:
            with open(file_path, 'r', encoding='gbk') as f:
                content = f.read().strip()
                print(f"使用GBK编码提取的TXT文件内容长度: {len(content)}")
                print(f"使用GBK编码提取的TXT文件内容前100字符: {content[:100]}")
                return content if content else None
        except Exception as e:
            print(f"使用GBK编码提取txt文本时出错: {e}")
            return None
    except Exception as e:
        print(f"提取txt文本时出错: {e}")
        return None

def extract_docx_text(file_path):
    """
    提取docx文档的文本内容
    """
    try:
        with zipfile.ZipFile(file_path, 'r') as docx:
            # 读取document.xml文件
            xml_content = docx.read('word/document.xml')
            root = ET.fromstring(xml_content)
            
            # 定义命名空间
            namespaces = {
                'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
            }
            
            # 提取所有文本
            text_elements = root.findall('.//w:t', namespaces)
            text_content = []
            
            for element in text_elements:
                if element.text:
                    text_content.append(element.text)
            
            result = '\n'.join(text_content).strip()
            print(f"提取的文档内容长度: {len(result)}")
            print(f"提取的文档内容前100字符: {result[:100]}")
            return result if result else None
    except Exception as e:
        print(f"提取docx文本时出错: {e}")
        return None


def filter_nones(obj):
    if isinstance(obj, dict):
        return {k: filter_nones(v) for k, v in obj.items() if v is not None}
    elif isinstance(obj, list):
        return [filter_nones(i) for i in obj if i is not None]
    else:
        return obj

@writing_bp.route('/', methods=['GET'])
def index():
    # 避免与门户 index.html 模板冲突，直接读取原子系统模板内容渲染
    tpl_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../Dify-artilcle-writing-sys/templates/index.html'))
    with open(tpl_path, 'r', encoding='utf-8') as f:
        content = f.read()
    return render_template_string(content, result=None)

@writing_bp.route('/upload', methods=['POST'])
def upload():
    print("=== /upload 接口被调用 ===")
    # 处理多文件上传和参数
    user_id = request.form.get('user_id', 'demo_user')
    print(f"用户ID: {user_id}")
    
    files = {}
    file_contents = {}  # 存储文件内容
    file_fields = ['origin_article', 'imitate_article', 'Superior_docs']
    
    print(f"检查的文件字段: {file_fields}")
    print(f"请求中的文件: {list(request.files.keys())}")
    
    for field in file_fields:
        file = request.files.get(field)
        if file:
            print(f"找到文件字段 {field}: {file.filename}")
            temp_path = os.path.join('static', file.filename)
            file.save(temp_path)
            
            # 根据文件类型提取文本内容
            if file.filename.lower().endswith('.docx'):
                print(f"开始提取 {field} 的DOCX文档内容...")
                extracted_text = extract_docx_text(temp_path)
                if extracted_text:
                    file_contents[field] = extracted_text
                    print(f"{field} DOCX文档内容提取成功，长度: {len(extracted_text)}")
                else:
                    file_contents[field] = "无法提取DOCX文档内容"
                    print(f"{field} DOCX文档内容提取失败")
            elif file.filename.lower().endswith('.txt'):
                print(f"开始提取 {field} 的TXT文件内容...")
                extracted_text = extract_txt_text(temp_path)
                if extracted_text:
                    file_contents[field] = extracted_text
                    print(f"{field} TXT文件内容提取成功，长度: {len(extracted_text)}")
                else:
                    file_contents[field] = "无法提取TXT文件内容"
                    print(f"{field} TXT文件内容提取失败")
            else:
                print(f"{field} 不是支持的文档格式，跳过内容提取")
            
            try:
                url = f"{DIFY_API_BASE_URL}/files/upload"
                headers = {"Authorization": f"Bearer {DIFY_API_TOKEN}"}
                with open(temp_path, 'rb') as f:
                    files_data = {'file': (file.filename, f, file.mimetype)}
                    data = {'user': user_id}
                    resp = requests.post(url, headers=headers, files=files_data, data=data)
                    resp.raise_for_status()
                    file_info = resp.json()
                    file_id = file_info['id']
                files[field] = file_to_dify_input(file, file_id)
            except Exception as e:
                # flash在统一门户中未必使用，这里保持原逻辑
                try:
                    flash(f'{field} 文件上传失败: {e}')
                except Exception:
                    pass
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                return redirect(url_for('writing.index'))
            if os.path.exists(temp_path):
                os.remove(temp_path)
        else:
            files[field] = None
            file_contents[field] = None
    # 组装inputs
    inputs = {
        'query': request.form.get('query', ''),
        'if_rewriter': request.form.get('if_rewriter', ''),
        'origin_article': files['origin_article'],
        'if_database': request.form.get('if_database', ''),
        'keyword_database': request.form.get('keyword_database', ''),
        'if_online_search': request.form.get('if_online_search', ''),
        'online_search_topic': request.form.get('online_search_topic', ''),
        'if_imitate_writing': request.form.get('if_imitate_writing', ''),
        'imitate_article': files['imitate_article'],
        'Superior_docs': files['Superior_docs']
    }
    # 过滤None
    inputs = filter_nones(inputs)
    sys_query = request.form.get('sys_query', '')
    
    print("=== 构建响应数据 ===")
    print(f"inputs: {inputs}")
    print(f"file_contents: {file_contents}")
    
    response_data = {
        'inputs': inputs,
        'user_id': user_id,
        'sys_query': sys_query,
        'file_contents': file_contents  # 添加文件内容到响应中
    }
    
    print(f"最终响应数据: {response_data}")
    
    return Response(json.dumps(response_data, ensure_ascii=False), mimetype='application/json')

@writing_bp.route('/stream_chat', methods=['POST'])
def stream_chat():
    data = request.get_json()
    inputs = data.get('inputs')
    user_id = data.get('user_id')
    sys_query = data.get('sys_query')
    conversation_id = data.get('conversation_id', '')
    if not inputs or not user_id or not sys_query:
        return jsonify({'error': '参数缺失'}), 400
    def event_stream():
        try:
            url = f"{DIFY_API_BASE_URL}/chat-messages"
            headers = {
                "Authorization": f"Bearer {DIFY_API_TOKEN}",
                "Content-Type": "application/json"
            }
            payload = {
                "query": sys_query,
                "inputs": inputs,
                "user": user_id,
                "response_mode": "streaming",
                "conversation_id": conversation_id
            }
            with requests.post(url, headers=headers, json=payload, stream=True, timeout=120) as resp:
                for line in resp.iter_lines():
                    if line:
                        if line.startswith(b'data:'):
                            content = line[5:].decode('utf-8').strip()
                            yield f"data: {content}\n\n"
        except Exception as e:
            yield f"data: [ERROR] {str(e)}\n\n"
    return Response(stream_with_context(event_stream()), mimetype='text/event-stream')

@writing_bp.route('/generate_ppt', methods=['POST'])
def generate_ppt():
    """PPT生成接口，使用指定的Dify API key，获取完整结果后提取SVG"""
    data = request.get_json()
    inputs = data.get('inputs')
    user_id = data.get('user_id')
    sys_query = data.get('sys_query')
    conversation_id = data.get('conversation_id', '')

    if not inputs or not user_id or not sys_query:
        return jsonify({'error': '参数缺失'}), 400

    PPT_API_TOKEN = os.environ.get('PPT_API_TOKEN', 'app-Dzut5URd5JGAAa1BFxkqpAdF')

    try:
        url = f"{DIFY_API_BASE_URL}/chat-messages"
        headers = {
            "Authorization": f"Bearer {PPT_API_TOKEN}",
            "Content-Type": "application/json"
        }
        payload = {
            "query": sys_query,
            "inputs": inputs,
            "user": user_id,
            "response_mode": "blocking",
            "conversation_id": conversation_id
        }

        response = requests.post(url, headers=headers, json=payload, timeout=300)
        response.raise_for_status()

        result = response.json()

        # 从结果中提取answer内容并清理think标签
        raw_answer = result.get('answer', '')
        import re
        clean_answer = re.sub(r'<think>.*?</think>', '', raw_answer, flags=re.DOTALL)

        return jsonify({'answer': clean_answer})

    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Dify API调用失败: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'处理失败: {str(e)}'}), 500
