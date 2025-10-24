"""
统一门户应用主入口
集成四个子系统的Web门户
"""
from flask import Flask, render_template, request, redirect, url_for, jsonify, send_from_directory
import requests
import os
from urllib.parse import urljoin, urlparse
import logging
from datetime import datetime

from config.settings import Config
from services.proxy_service import ProxyService
from services.health_check import HealthCheckService
from services.service_manager import service_manager
from utils.logger import setup_logger
from blueprints.writing import writing_bp
from blueprints.case2pg import case2pg_bp
from blueprints.censor import censor_bp
from blueprints.qa_sys import qa_sys_bp
from blueprints.meeting_minutes import meeting_minutes_bp

# 设置日志
logger = setup_logger(__name__)

def create_app():
    """应用工厂函数"""
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # 初始化服务
    proxy_service = ProxyService()
    # 覆盖writing系统的模板和静态资源路径，让门户内使用子系统原模板
    app.template_folder = Config.TEMPLATE_FOLDER
    app.static_folder = Config.STATIC_FOLDER

    health_service = HealthCheckService()

    # 注册蓝图：智能文件撰写系统在统一门户下以 /writing 前缀提供
    app.register_blueprint(writing_bp, url_prefix='/writing')
    
    # 注册蓝图：数据处理系统在统一门户下以 /case2pg 前缀提供
    app.register_blueprint(case2pg_bp, url_prefix='/case2pg')
    
    # 注册蓝图：文件审查系统在统一门户下以 /censor 前缀提供
    app.register_blueprint(censor_bp, url_prefix='/censor')
    
    # 注册蓝图：业务查询系统在统一门户下以 /qa_sys 前缀提供
    app.register_blueprint(qa_sys_bp, url_prefix='/qa_sys')
    
    # 注册蓝图：会议纪要系统在统一门户下以 /meeting_minutes 前缀提供
    app.register_blueprint(meeting_minutes_bp, url_prefix='/meeting_minutes')
    
    @app.route('/')
    def index():
        """主页面"""
        return render_template('index.html')
    
    @app.route('/accessibility-test')
    def accessibility_test():
        """无障碍功能测试页面"""
        return render_template('accessibility_test.html')
    
    @app.route('/health')
    def health_check():
        """健康检查接口"""
        try:
            status = health_service.check_all_services()
            return jsonify(status)
        except Exception as e:
            logger.error(f"健康检查失败: {str(e)}")
            return jsonify({"error": "健康检查失败"}), 500
    
    @app.route('/health/<service_name>')
    def health_check_service(service_name):
        """单个服务健康检查"""
        try:
            status = health_service.check_service(service_name)
            return jsonify(status)
        except Exception as e:
            logger.error(f"服务 {service_name} 健康检查失败: {e}")
            return jsonify({'error': f'服务 {service_name} 健康检查失败'}), 500
    
    @app.route('/api/systems')
    def get_systems():
        """获取系统列表"""
        try:
            systems = {}
            for name, config in Config.SUBSYSTEMS.items():
                systems[name] = {
                    'name': config['name'],
                    'description': config['description'],
                    'icon': config['icon'],
                    'color': config['color'],
                    'url': config['path']
                }
            return jsonify(systems)
        except Exception as e:
            logger.error(f"获取系统列表失败: {e}")
            return jsonify({'error': '获取系统列表失败'}), 500
    
    # 服务管理API端点
    @app.route('/api/services/status')
    def get_all_services_status():
        """获取所有服务状态"""
        try:
            status = service_manager.get_all_services_status()
            return jsonify({
                'success': True,
                'services': status
            })
        except Exception as e:
            logger.error(f"获取服务状态失败: {e}")
            return jsonify({
                'success': False,
                'message': f'获取服务状态失败: {str(e)}'
            }), 500
    
    @app.route('/api/services/<service_name>/status')
    def get_service_status(service_name):
        """获取单个服务状态"""
        try:
            if service_name not in service_manager.services:
                return jsonify({
                    'success': False,
                    'message': f'未知服务: {service_name}'
                }), 404
            
            status = service_manager.get_service_status(service_name)
            return jsonify({
                'success': True,
                'status': status
            })
        except Exception as e:
            logger.error(f"获取服务 {service_name} 状态失败: {e}")
            return jsonify({
                'success': False,
                'message': f'获取服务状态失败: {str(e)}'
            }), 500
    
    @app.route('/api/services/<service_name>/start', methods=['POST'])
    def start_service(service_name):
        """启动服务"""
        try:
            if service_name not in service_manager.services:
                return jsonify({
                    'success': False,
                    'message': f'未知服务: {service_name}'
                }), 404
            
            success = service_manager.start_service(service_name)
            if success:
                return jsonify({
                    'success': True,
                    'message': f'服务 {service_name} 启动成功'
                })
            else:
                return jsonify({
                    'success': False,
                    'message': f'服务 {service_name} 启动失败'
                }), 500
        except Exception as e:
            logger.error(f"启动服务 {service_name} 失败: {e}")
            return jsonify({
                'success': False,
                'message': f'启动服务失败: {str(e)}'
            }), 500
    
    @app.route('/api/services/<service_name>/stop', methods=['POST'])
    def stop_service(service_name):
        """停止服务"""
        try:
            if service_name not in service_manager.services:
                return jsonify({
                    'success': False,
                    'message': f'未知服务: {service_name}'
                }), 404
            
            success = service_manager.stop_service(service_name)
            if success:
                return jsonify({
                    'success': True,
                    'message': f'服务 {service_name} 停止成功'
                })
            else:
                return jsonify({
                    'success': False,
                    'message': f'服务 {service_name} 停止失败'
                }), 500
        except Exception as e:
            logger.error(f"停止服务 {service_name} 失败: {e}")
            return jsonify({
                'success': False,
                'message': f'停止服务失败: {str(e)}'
            }), 500
    
    @app.route('/api/services/<service_name>/reset-stats', methods=['POST'])
    def reset_service_stats(service_name):
        """重置服务统计信息"""
        try:
            if service_name not in service_manager.services:
                return jsonify({
                    'success': False,
                    'message': f'未知服务: {service_name}'
                }), 404
            
            service_manager.reset_service_stats(service_name)
            return jsonify({
                'success': True,
                'message': f'服务 {service_name} 统计信息已重置'
            })
        except Exception as e:
            logger.error(f"重置服务 {service_name} 统计信息失败: {e}")
            return jsonify({
                'success': False,
                'message': f'重置统计信息失败: {str(e)}'
            }), 500
    
    @app.route('/api/writing/launch', methods=['POST'])
    def launch_writing_system():
        """启动智能文件撰写系统并返回状态"""
        try:
            # 启动writing服务
            success = service_manager.start_service('writing')
            
            if success:
                # 等待服务启动完成
                import time
                time.sleep(2)  # 给服务一些启动时间
                
                # 检查服务是否真正启动成功
                status = service_manager.get_service_status('writing')
                if status.get('status') == 'running':
                    return jsonify({
                        'success': True,
                        'message': '智能文件撰写系统启动成功',
                        'service_url': 'http://localhost:9000/writing'
                    })
                else:
                    return jsonify({
                        'success': False,
                        'message': '服务启动失败，请检查系统状态'
                    }), 500
            else:
                return jsonify({
                    'success': False,
                    'message': '无法启动智能文件撰写系统'
                }), 500
                
        except Exception as e:
            logger.error(f"启动智能文件撰写系统失败: {e}")
            return jsonify({
                'success': False,
                'message': f'启动失败: {str(e)}'
            }), 500
    @app.route('/api/case2pg/launch', methods=['POST'])
    def launch_case2pg_system():
        """启动数据处理系统并返回状态"""
        try:
            # 启动case2pg服务
            success = service_manager.start_service('case2pg')
            
            if success:
                # 等待服务启动完成
                import time
                time.sleep(2)  # 给服务一些启动时间
                
                # 检查服务是否真正启动成功
                status = service_manager.get_service_status('case2pg')
                if status.get('status') == 'running':
                    return jsonify({
                        'success': True,
                        'message': '数据处理系统启动成功',
                        'service_url': 'http://localhost:9000/case2pg'
                    })
                else:
                    return jsonify({
                        'success': False,
                        'message': '服务启动失败，请检查系统状态'
                    }), 500
            else:
                return jsonify({
                    'success': False,
                    'message': '无法启动数据处理系统'
                }), 500
                
        except Exception as e:
            logger.error(f"启动数据处理系统失败: {e}")
            return jsonify({
                'success': False,
                'message': f'启动失败: {str(e)}'
            }), 500
        


    @app.route('/api/censor/launch', methods=['POST'])
    def launch_censor_system():
        """启动文件审查系统并返回状态"""
        try:
            # 启动censor服务
            success = service_manager.start_service('censor')
            
            if success:
                # 等待服务启动完成
                import time
                time.sleep(2)  # 给服务一些启动时间
                
                # 检查服务是否真正启动成功
                status = service_manager.get_service_status('censor')
                if status.get('status') == 'running':
                    return jsonify({
                        'success': True,
                        'message': '文件审查系统启动成功',
                        'service_url': 'http://localhost:9000/censor',
                        'iframe_url': 'http://localhost:9000/censor'
                    })
                else:
                    return jsonify({
                        'success': False,
                        'message': '服务启动失败，请检查系统状态'
                    }), 500
            else:
                return jsonify({
                    'success': False,
                    'message': '无法启动文件审查系统'
                }), 500
                
        except Exception as e:
            logger.error(f"启动文件审查系统失败: {e}")
            return jsonify({
                'success': False,
                'message': f'启动失败: {str(e)}'
            }), 500


    
    @app.route('/favicon.ico')
    def favicon():
        """网站图标"""
        return send_from_directory(os.path.join(app.root_path, 'static'),
                                   'favicon.ico', mimetype='image/vnd.microsoft.icon')
    
    @app.route('/api/monitoring/status')
    def monitoring_status():
        try:
            status = service_manager.get_monitoring_status()
            return jsonify(status)
        except Exception as e:
            logger.error(f"获取监控状态失败: {e}")
            return jsonify({'error': '获取监控状态失败'}), 500
    
    @app.errorhandler(404)
    def not_found(error):
        """404错误处理"""
        return render_template('error.html', 
                             error_code=404, 
                             error_message='页面未找到'), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        """500错误处理"""
        logger.error(f"内部服务器错误: {str(error)}")
        return render_template('error.html', 
                             error_code=500, 
                             error_message='内部服务器错误'), 500
    
    @app.errorhandler(502)
    def bad_gateway(error):
        """502错误处理"""
        logger.error(f"网关错误: {error}")
        return render_template('error.html', 
                             error_code=502, 
                             error_message='服务暂时不可用'), 502
    
    @app.errorhandler(503)
    def service_unavailable(error):
        """503错误处理"""
        logger.error(f"服务不可用: {error}")
        return render_template('error.html', 
                             error_code=503, 
                             error_message='服务暂时不可用'), 503
    
    return app

if __name__ == '__main__':
    app = create_app()
    
    logger.info("启动统一门户应用...")
    logger.info(f"门户地址: http://{Config.HOST}:{Config.PORT}")
    logger.info(f"调试模式: {Config.DEBUG}")
    
    # 打印系统配置信息
    logger.info("已配置的子系统:")
    for name, config in Config.SUBSYSTEMS.items():
        logger.info(f"  - {config['name']}: {config['url']}")
    
    print(f"\n{'='*60}")
    print(f"🚀 统一门户系统启动中...")
    print(f"📍 服务器地址: http://localhost:{Config.PORT}")
    print(f"🌐 网络地址: http://0.0.0.0:{Config.PORT}")
    print(f"🔧 调试模式: {'开启' if Config.DEBUG else '关闭'}")
    print(f"📊 集成子系统: 文件撰写、业务查询、数据处理、文件审查、会议纪要")
    print(f"{'='*60}\n")
    
    app.run(
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG
    )