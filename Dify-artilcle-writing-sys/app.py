# app.py
from flask import Flask, render_template, request, redirect, url_for, flash, Response, stream_with_context, jsonify
from flask_cors import CORS
import os
import enum
import requests
import json
import zipfile
import xml.etree.ElementTree as ET

app = Flask(__name__)
# 配置CORS，允许来自localhost:9000的跨域请求
CORS(app, origins=['http://localhost:9000', 'http://127.0.0.1:9000'])

# Dify API配置（建议用环境变量管理）
DIFY_API_BASE_URL = 'http://localhost/v1'
DIFY_API_TOKEN = os.environ.get('DIFY_API_TOKEN', 'app-TnwFScShFVqoY0Y7kZl3Wr67')

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

def extract_docx_text(file_path):
    """
    提取docx文档的文本内容，并转换为规范的markdown格式
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
            
            # 提取段落和样式信息
            paragraphs = root.findall('.//w:p', namespaces)
            text_content = []
            
            for para in paragraphs:
                # 检查段落样式
                pPr = para.find('.//w:pPr', namespaces)
                is_heading = False
                heading_level = 1
                
                if pPr is not None:
                    # 检查是否为标题样式
                    pStyle = pPr.find('.//w:pStyle', namespaces)
                    if pStyle is not None:
                        style_val = pStyle.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val', '')
                        if 'heading' in style_val.lower() or 'title' in style_val.lower():
                            is_heading = True
                            # 尝试从样式名中提取级别
                            if 'heading1' in style_val.lower() or 'title1' in style_val.lower():
                                heading_level = 1
                            elif 'heading2' in style_val.lower() or 'title2' in style_val.lower():
                                heading_level = 2
                            elif 'heading3' in style_val.lower() or 'title3' in style_val.lower():
                                heading_level = 3
                            else:
                                heading_level = 2  # 默认二级标题
                
                # 提取段落文本，保持文本的连续性
                text_elements = para.findall('.//w:t', namespaces)
                para_text = ''.join([elem.text for elem in text_elements if elem.text])
                
                if para_text.strip():
                    # 根据内容特征判断是否为标题
                    if not is_heading:
                        # 改进的标题识别规则
                        stripped_text = para_text.strip()
                        
                        # 检查是否为标题格式
                        title_patterns = [
                            r'^[一二三四五六七八九十]+、',  # 一、二、三、
                            r'^（[一二三四五六七八九十]+）',  # （一）（二）
                            r'^\d+\.',  # 1. 2. 3.
                            r'^##?\d+',  # #1 ##2
                        ]
                        
                        # 检查是否以冒号结尾且长度较短
                        is_title_like = (
                            len(stripped_text) < 80 and 
                            (stripped_text.endswith('：') or stripped_text.endswith(':'))
                        )
                        
                        # 检查是否匹配标题模式
                        import re
                        matches_pattern = any(re.match(pattern, stripped_text) for pattern in title_patterns)
                        
                        if is_title_like or matches_pattern:
                            is_heading = True
                            # 根据内容确定标题级别
                            if any(keyword in stripped_text for keyword in ['一、', '二、', '三、', '四、', '五、']):
                                heading_level = 2
                            elif any(keyword in stripped_text for keyword in ['（一）', '（二）', '（三）', '（四）', '（五）']):
                                heading_level = 3
                            elif re.match(r'^\d+\.', stripped_text):
                                heading_level = 3
                            else:
                                heading_level = 2
                    
                    # 格式化输出
                    if is_heading:
                        # 清理标题中的特殊字符，确保格式规范
                        clean_title = para_text.strip().rstrip('：:')
                        # 确保标题符号后有空格
                        markdown_title = '#' * heading_level + ' ' + clean_title
                        text_content.append(markdown_title)
                    else:
                        # 普通段落，清理多余的空白字符
                        clean_para = ' '.join(para_text.split())
                        if clean_para:
                            text_content.append(clean_para)
            
            # 后处理：规范化markdown格式
            result = []
            for i, line in enumerate(text_content):
                if line.startswith('#'):
                    # 标题前后加空行，但避免重复空行
                    if i > 0 and result and result[-1] != '':
                        result.append('')
                    result.append(line)
                    # 标题后加空行
                    if i < len(text_content) - 1:
                        result.append('')
                else:
                    # 普通段落
                    result.append(line)
                    # 段落后加空行
                    if i < len(text_content) - 1 and not text_content[i + 1].startswith('#'):
                        result.append('')
            
            # 最终清理：移除多余的连续空行
            final_lines = []
            prev_empty = False
            for line in result:
                if line == '':
                    if not prev_empty:
                        final_lines.append(line)
                    prev_empty = True
                else:
                    final_lines.append(line)
                    prev_empty = False
            
            final_result = '\n'.join(final_lines).strip()
            print(f"提取的文档内容长度: {len(final_result)}")
            print(f"提取的文档内容前200字符: {final_result[:200]}")
            return final_result if final_result else None
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

@app.route('/', methods=['GET'])
def index():
    return render_template('index.html', result=None)

@app.route('/upload', methods=['POST'])
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
            
            # 如果是docx文件，提取文本内容
            if file.filename.lower().endswith('.docx'):
                print(f"开始提取 {field} 的文档内容...")
                extracted_text = extract_docx_text(temp_path)
                if extracted_text:
                    file_contents[field] = extracted_text
                    print(f"{field} 文档内容提取成功，长度: {len(extracted_text)}")
                else:
                    file_contents[field] = "无法提取文档内容"
                    print(f"{field} 文档内容提取失败")
            else:
                print(f"{field} 不是docx文件，跳过内容提取")
            
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
                flash(f'{field} 文件上传失败: {e}')
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                return redirect(url_for('index'))
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

@app.route('/stream_chat', methods=['POST'])
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

@app.route('/generate_ppt', methods=['POST'])
def generate_ppt():
    """PPT生成接口，使用指定的Dify API key，获取完整结果后提取SVG"""
    data = request.get_json()
    inputs = data.get('inputs')
    user_id = data.get('user_id')
    sys_query = data.get('sys_query')
    conversation_id = data.get('conversation_id', '')
    
    if not inputs or not user_id or not sys_query:
        return jsonify({'error': '参数缺失'}), 400
    
    # PPT生成专用的API token
    PPT_API_TOKEN = os.environ.get('PPT_API_TOKEN', 'app-r3zuSHgMkB2m139TZnwEyHKr')
    
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
        print(f"Dify响应状态码: {response.status_code}")
        print(f"Dify响应内容: {response.text[:500]}...")
        
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

if __name__ == '__main__':
    app.run(debug=True, port=5055)