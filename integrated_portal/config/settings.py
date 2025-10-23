"""
统一门户应用配置
"""
import os
from datetime import timedelta

class Config:
    """基础配置类"""
    
    # Flask应用配置
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'integrated-portal-secret-key-2024'
    DEBUG = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'
    HOST = os.environ.get('HOST', '0.0.0.0')
    PORT = int(os.environ.get('PORT', 9000))
    
    # 子系统配置
    SUBSYSTEMS = {
        'writing': {
            'name': '智能文件撰写系统',
            'description': '公文/文章自动生成与辅助写作',
            'icon': '📝',
            'url': 'http://localhost:9000/writing',
            'path': '/writing',
            'color': '#4CAF50'
        },
        'qa_sys': {
            'name': '业务查询系统',
            'description': '房产局审批处业务智能问答',
            'icon': '🏢',
            'url': '/qa_sys',
            'path': '/qa_sys',
            'color': '#17a2b8'
        },
        'case2pg': {
            'name': '数据处理系统',
            'description': '智能文件处理与数据库查询',
            'icon': '📊',
            'url': 'http://localhost:9000/case2pg',
            'path': '/case2pg',
            'color': '#FF9800'
        },
        'censor': {
            'name': '文件审查系统',
            'description': '智能文件和合同审查',
            'icon': '🔍',
            'url': 'http://localhost:9000/censor',
            'path': '/censor',
            'color': '#9C27B0'
        }
    }
    
    # 代理配置
    PROXY_TIMEOUT = 30  # 代理请求超时时间（秒）
    PROXY_RETRIES = 3   # 代理请求重试次数
    
    # 健康检查配置
    HEALTH_CHECK_INTERVAL = 60  # 健康检查间隔（秒）
    HEALTH_CHECK_TIMEOUT = 15   # 健康检查超时时间（秒）
    
    # 日志配置
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
    LOG_FILE = os.environ.get('LOG_FILE', 'logs/portal.log')
    
    # 静态文件配置
    STATIC_FOLDER = 'static'
    TEMPLATE_FOLDER = 'templates'

class DevelopmentConfig(Config):
    """开发环境配置"""
    DEBUG = True
    LOG_LEVEL = 'DEBUG'

class ProductionConfig(Config):
    """生产环境配置"""
    DEBUG = False
    LOG_LEVEL = 'WARNING'

# 配置映射
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}