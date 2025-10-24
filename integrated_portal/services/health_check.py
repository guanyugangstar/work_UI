"""
健康检查服务
监控各子系统的运行状态
"""
import requests
import logging
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from config.settings import Config
from services.service_manager import service_manager

logger = logging.getLogger(__name__)

class HealthCheckService:
    """健康检查服务类"""
    
    def __init__(self):
        self.subsystems = Config.SUBSYSTEMS
        self.timeout = Config.HEALTH_CHECK_TIMEOUT
    
    def check_service(self, system_name, system_config):
        """
        检查单个子系统的健康状态
        
        Args:
            system_name: 子系统名称
            system_config: 子系统配置
            
        Returns:
            dict: 健康检查结果
        """
        result = {
            'name': system_name,
            'display_name': system_config['name'],
            'url': system_config['url'],
            'status': 'unknown',
            'response_time': None,
            'error': None,
            'checked_at': datetime.now().isoformat()
        }
        
        try:
            start_time = datetime.now()
            
            # 检查服务的启动状态
            started = service_manager.services.get(system_name, {}).get('started', False)
            
            # 发送健康检查请求
            # 统一使用门户内路由进行健康检查，避免外部端口依赖
            check_url = system_config['url']
            if system_name == 'writing':
                check_url = 'http://localhost:9000/writing/'
            elif system_name == 'qa_sys':
                check_url = 'http://localhost:9000/qa_sys/'
            elif system_name == 'case2pg':
                check_url = 'http://localhost:9000/case2pg/'
            elif system_name == 'censor':
                check_url = 'http://localhost:9000/censor/'
            elif system_name == 'meeting_minutes':
                check_url = 'http://localhost:9000/meeting_minutes/'

            response = requests.get(
                check_url,
                timeout=self.timeout,
                allow_redirects=True
            )
            
            end_time = datetime.now()
            response_time = (end_time - start_time).total_seconds() * 1000
            
            result['response_time'] = round(response_time, 2)
            
            # 判断服务状态 - 结合启动状态和实际响应
            if response.status_code == 200:
                if started:
                    result['status'] = 'healthy'
                else:
                    # 服务响应正常但未标记为启动，显示为停止状态
                    result['status'] = 'stopped'
                    result['error'] = '服务未启动'
            elif 400 <= response.status_code < 500:
                result['status'] = 'degraded'
                result['error'] = f"HTTP {response.status_code}"
            else:
                result['status'] = 'unhealthy'
                result['error'] = f"HTTP {response.status_code}"
                
        except requests.exceptions.ConnectionError:
            # 连接失败时，根据启动状态判断
            if started:
                result['status'] = 'down'
                result['error'] = '服务已启动但连接失败'
            else:
                result['status'] = 'stopped'
                result['error'] = '服务未启动'
            logger.warning(f"子系统 {system_name} 连接失败，启动状态: {started}")
            
        except requests.exceptions.Timeout:
            result['status'] = 'timeout'
            result['error'] = '请求超时'
            logger.warning(f"子系统 {system_name} 请求超时")
            
        except Exception as e:
            result['status'] = 'error'
            result['error'] = str(e)
            logger.error(f"检查子系统 {system_name} 时发生错误: {str(e)}")
        
        return result
    
    def check_all_services(self):
        """
        并发检查所有子系统的健康状态
        
        Returns:
            dict: 所有子系统的健康检查结果
        """
        results = {
            'overall_status': 'healthy',
            'checked_at': datetime.now().isoformat(),
            'services': {},
            'summary': {
                'total': len(self.subsystems),
                'healthy': 0,
                'degraded': 0,
                'unhealthy': 0,
                'down': 0,
                'timeout': 0,
                'error': 0
            }
        }
        
        # 使用线程池并发检查
        with ThreadPoolExecutor(max_workers=4) as executor:
            # 提交所有检查任务
            future_to_system = {
                executor.submit(self.check_service, name, config): name
                for name, config in self.subsystems.items()
            }
            
            # 收集结果
            for future in as_completed(future_to_system):
                system_name = future_to_system[future]
                try:
                    result = future.result()
                    results['services'][system_name] = result
                    
                    # 更新统计
                    status = result['status']
                    if status in results['summary']:
                        results['summary'][status] += 1
                        
                except Exception as e:
                    logger.error(f"获取 {system_name} 健康检查结果失败: {str(e)}")
                    results['services'][system_name] = {
                        'name': system_name,
                        'status': 'error',
                        'error': str(e),
                        'checked_at': datetime.now().isoformat()
                    }
                    results['summary']['error'] += 1
        
        # 确定整体状态
        if results['summary']['down'] > 0 or results['summary']['error'] > 0:
            results['overall_status'] = 'critical'
        elif results['summary']['unhealthy'] > 0 or results['summary']['timeout'] > 0:
            results['overall_status'] = 'unhealthy'
        elif results['summary']['degraded'] > 0:
            results['overall_status'] = 'degraded'
        else:
            results['overall_status'] = 'healthy'
        
        return results
    
    def get_service_status(self, system_name):
        """
        获取指定子系统的状态
        
        Args:
            system_name: 子系统名称
            
        Returns:
            dict: 子系统状态信息
        """
        if system_name not in self.subsystems:
            return {
                'error': f'子系统 {system_name} 不存在'
            }
        
        return self.check_service(system_name, self.subsystems[system_name])
    
    def is_service_healthy(self, system_name):
        """
        检查指定子系统是否健康
        
        Args:
            system_name: 子系统名称
            
        Returns:
            bool: 是否健康
        """
        result = self.get_service_status(system_name)
        return result.get('status') == 'healthy'