"""
反向代理服务
处理到各子系统的请求转发
"""
import requests
from flask import Response, request, stream_with_context
from urllib.parse import urljoin, urlparse
import logging
from config.settings import Config

logger = logging.getLogger(__name__)

class ProxyService:
    """反向代理服务类"""
    
    def __init__(self):
        self.subsystems = Config.SUBSYSTEMS
        self.timeout = Config.PROXY_TIMEOUT
        self.retries = Config.PROXY_RETRIES
    
    def forward_request(self, system_name, path, flask_request):
        """
        转发请求到指定子系统
        
        Args:
            system_name: 子系统名称
            path: 请求路径
            flask_request: Flask请求对象
            
        Returns:
            Flask Response对象
        """
        try:
            if system_name not in self.subsystems:
                return Response("子系统不存在", status=404)
            
            target_url = self._build_target_url(system_name, path)
            
            # 构建请求参数
            request_kwargs = self._build_request_kwargs(flask_request, target_url)
            
            # 发送请求
            response = self._send_request(**request_kwargs)
            
            # 构建Flask响应
            return self._build_flask_response(response)
            
        except requests.exceptions.ConnectionError:
            logger.error(f"无法连接到子系统 {system_name}")
            return Response(f"子系统 {system_name} 暂时不可用", status=503)
        except requests.exceptions.Timeout:
            logger.error(f"请求子系统 {system_name} 超时")
            return Response(f"请求超时", status=504)
        except Exception as e:
            logger.error(f"代理请求失败: {str(e)}")
            return Response("代理请求失败", status=500)
    
    def _build_target_url(self, system_name, path):
        """构建目标URL"""
        base_url = self.subsystems[system_name]['url']
        if path:
            return urljoin(base_url + '/', path)
        return base_url
    
    def _build_request_kwargs(self, flask_request, target_url):
        """构建请求参数"""
        # 复制请求头，排除一些不需要的头
        headers = {}
        for key, value in flask_request.headers:
            if key.lower() not in ['host', 'content-length']:
                headers[key] = value
        
        # 构建请求参数
        kwargs = {
            'method': flask_request.method,
            'url': target_url,
            'headers': headers,
            'params': flask_request.args,
            'timeout': self.timeout,
            'allow_redirects': False,
            'stream': True
        }
        
        # 处理请求体
        if flask_request.method in ['POST', 'PUT', 'PATCH']:
            if flask_request.is_json:
                kwargs['json'] = flask_request.get_json()
            elif flask_request.form:
                kwargs['data'] = flask_request.form
                if flask_request.files:
                    files = {}
                    for key, file in flask_request.files.items():
                        files[key] = (file.filename, file.stream, file.content_type)
                    kwargs['files'] = files
            else:
                kwargs['data'] = flask_request.get_data()
        
        return kwargs
    
    def _send_request(self, **kwargs):
        """发送HTTP请求"""
        for attempt in range(self.retries):
            try:
                response = requests.request(**kwargs)
                return response
            except requests.exceptions.RequestException as e:
                if attempt == self.retries - 1:
                    raise
                logger.warning(f"请求失败，正在重试 ({attempt + 1}/{self.retries}): {str(e)}")
    
    def _build_flask_response(self, response):
        """构建Flask响应对象"""
        # 复制响应头
        headers = {}
        for key, value in response.headers.items():
            if key.lower() not in ['content-encoding', 'content-length', 'transfer-encoding']:
                headers[key] = value
        
        # 处理流式响应
        if response.headers.get('content-type', '').startswith('text/event-stream'):
            def generate():
                for chunk in response.iter_content(chunk_size=1024):
                    if chunk:
                        yield chunk
            
            return Response(
                stream_with_context(generate()),
                status=response.status_code,
                headers=headers
            )
        
        # 普通响应
        return Response(
            response.content,
            status=response.status_code,
            headers=headers
        )
    
    def get_system_info(self, system_name):
        """获取子系统信息"""
        return self.subsystems.get(system_name)
    
    def get_all_systems(self):
        """获取所有子系统信息"""
        return self.subsystems