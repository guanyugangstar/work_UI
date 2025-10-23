"""
服务管理器 - 负责按需启动和管理子系统
"""
import subprocess
import time
import threading
import requests
import logging
from typing import Dict, Optional, List, Tuple
import os
import signal
import psutil
import json
import sys
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class ServiceManager:
    """服务管理器类"""
    
    def __init__(self):
        self.services = {
            'writing': {
                'name': '智能文件撰写系统',
                'port': 9000,
                'path': '',
                'script': '',
                'process': None,
                'last_health_check': None,
                'started': False,

                'restart_count': 0,
                'last_restart': None,
                'health_check_failures': 0,
                'auto_restart_disabled': False
            },
            'case2pg': {
                'name': '数据处理系统',
                'port': 9000,
                'path': '',
                'script': '',
                'process': None,
                'last_health_check': None,
                'started': False,
                'restart_count': 0,
                'last_restart': None,
                'health_check_failures': 0,
                'auto_restart_disabled': False
            },
            'censor': {
                'name': '文件审查系统',
                'port': 9000,
                'path': '',
                'script': '',
                'process': None,
                'last_health_check': None,
                'started': False,
                'restart_count': 0,
                'last_restart': None,
                'health_check_failures': 0,
                'auto_restart_disabled': False
            },
            'qa_sys': {
                'name': '业务查询系统',
                'port': 9000,
                'path': '',
                'script': '',
                'process': None,
                'last_health_check': None,
                'started': False,
                'restart_count': 0,
                'last_restart': None,
                'health_check_failures': 0,
                'auto_restart_disabled': False
            }
        }
        
        # 监控配置
        self.monitoring_enabled = True
        self.health_check_interval = 30  # 秒
        self.max_restart_attempts = 3
        self.restart_cooldown = 300  # 5分钟冷却期
        self.max_health_check_failures = 3
        
        # 监控线程
        self.monitoring_thread = None
        self.stop_monitoring = False
        
        # 启动锁
        self.startup_lock = threading.Lock()
        
        # 进程管理
        self.processes = {}
        
        # 为每个服务添加完整的配置
        for service_name, config in self.services.items():
            if service_name == 'qa_sys':
                # QA系统已整合到门户内，不再单独进程/端口
                config['command'] = None
                config['check_url'] = f"http://localhost:{config['port']}/qa_sys/"
            elif service_name == 'writing':
                # 门户内整合，不再单独进程/端口
                config['command'] = None
                config['check_url'] = f"http://localhost:{self.services['writing']['port']}/writing/"
            elif service_name == 'case2pg':
                # case2pg系统已整合到门户内，不再单独进程/端口
                config['command'] = None
                config['check_url'] = f"http://localhost:{self.services['case2pg']['port']}/case2pg/"
            elif service_name == 'censor':
                # censor系统已整合到门户内，不再单独进程/端口
                config['command'] = None
                config['check_url'] = f"http://localhost:{self.services['censor']['port']}/censor/"
            else:
                # 其他系统使用Python
                config['command'] = [sys.executable, config['script']]
                config['check_url'] = f"http://localhost:{config['port']}/"
            config['cwd'] = config['path']
        
        # 启动监控
        self.start_monitoring()
    
    def is_service_running(self, service_name: str) -> bool:
        """检查服务是否正在运行"""
        if service_name not in self.services:
            return False
        
        config = self.services[service_name]
        port = config['port']
        
        # 检查端口是否被占用
        try:
            for conn in psutil.net_connections():
                if conn.laddr.port == port and conn.status == psutil.CONN_LISTEN:
                    return True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
        
        return False
    
    def check_service_health(self, service_name: str) -> bool:
        """检查服务健康状态"""
        if service_name not in self.services:
            return False
        
        config = self.services[service_name]
        check_url = config['check_url']
        
        try:
            response = requests.get(check_url, timeout=5)
            return response.status_code == 200
        except requests.RequestException:
            return False
    
    def start_service(self, service_name: str) -> bool:
        """启动指定的服务"""
        with self.startup_lock:
            if service_name not in self.services:
                logger.error(f"未知的服务: {service_name}")
                return False
            
            # 检查服务是否已经在运行
            if self.services[service_name]['started']:
                logger.info(f"服务 {service_name} 已经在运行")
                return True
            
            if service_name == 'writing':
                # 门户内置，无需启动外部进程，标记为已启动
                logger.info("启动智能文件撰写系统（蓝图激活）")
                self.services['writing']['started'] = True
                return True
            
            if service_name == 'case2pg':
                # 门户内置，无需启动外部进程，标记为已启动
                logger.info("启动数据处理系统（蓝图激活）")
                self.services['case2pg']['started'] = True
                return True
            
            if service_name == 'qa_sys':
                # 门户内置，无需启动外部进程，标记为已启动
                logger.info("启动业务查询系统（蓝图激活）")
                self.services['qa_sys']['started'] = True
                return True

            if service_name == 'censor':
                # 门户内置，无需启动外部进程，标记为已启动
                logger.info("启动文件审查系统（蓝图激活）")
                self.services['censor']['started'] = True
                return True

            if self.is_service_running(service_name):
                logger.info(f"服务 {service_name} 已经在运行")
                return True
            
            config = self.services[service_name]
            
            # 重新启用自动重启功能
            config['auto_restart_disabled'] = False
            
            try:
                logger.info(f"正在启动服务: {config['name']}")
                logger.info(f"启动命令: {config['command']}")
                logger.info(f"工作目录: {config['path']}")
                
                # 启动进程
                process = subprocess.Popen(
                    config['command'],
                    cwd=config['path'],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
                )
                
                config['process'] = process
                self.processes[service_name] = process
                logger.info(f"进程已创建，PID: {process.pid}")
                
                # 等待服务启动
                max_wait_time = 30  # 最大等待30秒
                wait_interval = 1   # 每秒检查一次
                
                for i in range(max_wait_time):
                    time.sleep(wait_interval)
                    
                    # 检查进程是否还在运行
                    if process.poll() is not None:
                        stdout, stderr = process.communicate()
                        stdout_text = stdout.decode('utf-8', errors='ignore')
                        stderr_text = stderr.decode('utf-8', errors='ignore')
                        logger.error(f"服务 {service_name} 进程退出，退出码: {process.returncode}")
                        logger.error(f"标准输出: {stdout_text}")
                        logger.error(f"标准错误: {stderr_text}")
                        return False
                    
                    # 检查服务是否可访问
                    if self.is_service_running(service_name):
                        logger.info(f"服务 {service_name} 启动成功")
                        return True
                
                logger.error(f"服务 {service_name} 启动超时")
                self.stop_service(service_name)
                return False
                
            except Exception as e:
                logger.error(f"启动服务 {service_name} 时发生错误: {str(e)}")
                return False
    
    def stop_service(self, service_name: str) -> bool:
        """停止指定的服务"""
        # 设置禁用自动重启标志
        if service_name in self.services:
            self.services[service_name]['auto_restart_disabled'] = True
            logger.info(f"已禁用服务 {service_name} 的自动重启")

        # 写作系统：仅标记为未启动，不做进程操作
        if service_name == 'writing':
            self.services['writing']['started'] = False
            logger.info("已停止智能文件撰写系统（蓝图停用）")
            return True
        
        # 数据处理系统：仅标记为未启动，不做进程操作
        if service_name == 'case2pg':
            self.services['case2pg']['started'] = False
            logger.info("已停止数据处理系统（蓝图停用）")
            return True
        
        # 业务查询系统：仅标记为未启动，不做进程操作
        if service_name == 'qa_sys':
            self.services['qa_sys']['started'] = False
            logger.info("已停止业务查询系统（蓝图停用）")
            return True
        
        # 文件审查系统：仅标记为未启动，不做进程操作
        if service_name == 'censor':
            self.services['censor']['started'] = False
            logger.info("已停止文件审查系统（蓝图停用）")
            return True

        
        if service_name not in self.processes:
            return True
        
        try:
            process = self.processes[service_name]
            
            if os.name == 'nt':  # Windows
                # 在Windows上使用taskkill终止进程树
                subprocess.run(['taskkill', '/F', '/T', '/PID', str(process.pid)], 
                             capture_output=True)
            else:  # Unix/Linux
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
            
            del self.processes[service_name]
            logger.info(f"服务 {service_name} 已停止")
            return True
            
        except Exception as e:
            logger.error(f"停止服务 {service_name} 时发生错误: {str(e)}")
            return False
    
    def get_service_status(self, service_name: str) -> Dict:
        """获取服务状态"""
        if service_name not in self.services:
            return {'status': 'unknown', 'message': '未知服务'}
        
        if service_name == 'writing':
            started = self.services['writing'].get('started', False)
            return {
                'status': 'running' if started else 'stopped',
                'message': '服务已启动' if started else '服务未运行',
                'port': self.services['writing']['port'],
                'name': self.services['writing']['name']
            }
        
        if service_name == 'case2pg':
            started = self.services['case2pg'].get('started', False)
            return {
                'status': 'running' if started else 'stopped',
                'message': '服务已启动' if started else '服务未运行',
                'port': self.services['case2pg']['port'],
                'name': self.services['case2pg']['name']
            }
        
        if service_name == 'censor':
            started = self.services['censor'].get('started', False)
            return {
                'status': 'running' if started else 'stopped',
                'message': '服务已启动' if started else '服务未运行',
                'port': self.services['censor']['port'],
                'name': self.services['censor']['name']
            }
        
        if service_name == 'qa_sys':
            started = self.services['qa_sys'].get('started', False)
            return {
                'status': 'running' if started else 'stopped',
                'message': '服务已启动' if started else '服务未运行',
                'port': self.services['qa_sys']['port'],
                'name': self.services['qa_sys']['name']
            }

        is_running = self.is_service_running(service_name)
        is_healthy = self.check_service_health(service_name) if is_running else False
        
        if is_running and is_healthy:
            status = 'running'
            message = '服务正常运行'
        elif is_running and not is_healthy:
            status = 'unhealthy'
            message = '服务运行但不健康'
        else:
            status = 'stopped'
            message = '服务未运行'
        
        return {
            'status': status,
            'message': message,
            'port': self.services[service_name]['port'],
            'name': self.services[service_name]['name']
        }
    
    def get_all_services_status(self) -> Dict:
        """获取所有服务的状态"""
        status = {}
        for service_name in self.services:
            status[service_name] = self.get_service_status(service_name)
        return status
    
    def start_monitoring(self):
        """启动服务监控"""
        if self.monitoring_enabled and not self.monitoring_thread:
            self.stop_monitoring = False
            self.monitoring_thread = threading.Thread(target=self._monitoring_loop, daemon=True)
            self.monitoring_thread.start()
            logger.info("服务监控已启动")
    
    def stop_monitoring_service(self):
        """停止服务监控"""
        self.stop_monitoring = True
        if self.monitoring_thread:
            self.monitoring_thread.join(timeout=5)
            self.monitoring_thread = None
        logger.info("服务监控已停止")
    
    def _monitoring_loop(self):
        """监控循环"""
        while not self.stop_monitoring:
            try:
                self._check_all_services_health()
                time.sleep(self.health_check_interval)
            except Exception as e:
                logger.error(f"监控循环出错: {e}")
                time.sleep(10)  # 出错时等待10秒再继续
    
    def _check_all_services_health(self):
        """检查所有服务的健康状态"""
        for service_name, service_config in self.services.items():
            try:
                self._check_service_health(service_name)
            except Exception as e:
                logger.error(f"检查服务 {service_name} 健康状态时出错: {e}")
    
    def _check_service_health(self, service_name: str):
        """检查单个服务的健康状态"""
        if service_name not in self.services:
            return
        
        service_config = self.services[service_name]
        current_time = datetime.now()
        
        # 如果服务已禁用自动重启，跳过健康检查和重启逻辑
        if service_config.get('auto_restart_disabled', False):
            service_config['last_health_check'] = current_time
            service_config['health_check_failures'] = 0
            return
        
        # 如果服务进程不存在，跳过健康检查
        if not self.is_service_running(service_name):
            service_config['last_health_check'] = current_time
            service_config['health_check_failures'] = 0
            return
        
        # 执行健康检查
        is_healthy = self._perform_health_check(service_name)
        service_config['last_health_check'] = current_time
        
        if is_healthy:
            service_config['health_check_failures'] = 0
            logger.debug(f"服务 {service_name} 健康检查通过")
        else:
            service_config['health_check_failures'] += 1
            logger.warning(f"服务 {service_name} 健康检查失败 ({service_config['health_check_failures']}/{self.max_health_check_failures})")
            
            # 如果连续失败次数达到阈值，尝试重启
            if service_config['health_check_failures'] >= self.max_health_check_failures:
                self._attempt_service_restart(service_name)
    
    def _perform_health_check(self, service_name: str) -> bool:
        """执行健康检查"""
        try:
            service_config = self.services[service_name]
            port = service_config['port']
            
            # 尝试连接服务端口
            response = requests.get(f'http://localhost:{port}/', timeout=5)
            return response.status_code < 500
        except Exception as e:
            logger.debug(f"服务 {service_name} 健康检查失败: {e}")
            return False
    
    def _attempt_service_restart(self, service_name: str):
        """尝试重启服务"""
        service_config = self.services[service_name]
        current_time = datetime.now()
        
        # 检查是否在冷却期内
        if service_config['last_restart']:
            time_since_restart = current_time - service_config['last_restart']
            if time_since_restart.total_seconds() < self.restart_cooldown:
                logger.info(f"服务 {service_name} 在冷却期内，跳过重启")
                return
        
        # 检查重启次数限制
        if service_config['restart_count'] >= self.max_restart_attempts:
            logger.error(f"服务 {service_name} 已达到最大重启次数 ({self.max_restart_attempts})，停止自动重启")
            return
        
        logger.info(f"尝试重启服务 {service_name} (第 {service_config['restart_count'] + 1} 次)")
        
        try:
            # 停止服务
            self.stop_service(service_name)
            time.sleep(2)  # 等待服务完全停止
            
            # 启动服务
            success = self.start_service(service_name)
            
            if success:
                service_config['restart_count'] += 1
                service_config['last_restart'] = current_time
                service_config['health_check_failures'] = 0
                logger.info(f"服务 {service_name} 重启成功")
            else:
                logger.error(f"服务 {service_name} 重启失败")
                
        except Exception as e:
            logger.error(f"重启服务 {service_name} 时出错: {e}")
    
    def get_monitoring_status(self) -> Dict:
        """获取监控状态信息"""
        return {
            'monitoring_enabled': self.monitoring_enabled,
            'health_check_interval': self.health_check_interval,
            'max_restart_attempts': self.max_restart_attempts,
            'restart_cooldown': self.restart_cooldown,
            'services_status': {
                name: {
                    'last_health_check': config['last_health_check'].isoformat() if config['last_health_check'] else None,
                    'restart_count': config['restart_count'],
                    'last_restart': config['last_restart'].isoformat() if config['last_restart'] else None,
                    'health_check_failures': config['health_check_failures']
                }
                for name, config in self.services.items()
            }
        }
    
    def reset_service_stats(self, service_name: str):
        """重置服务统计信息"""
        if service_name in self.services:
            self.services[service_name]['restart_count'] = 0
            self.services[service_name]['last_restart'] = None
            self.services[service_name]['health_check_failures'] = 0
            logger.info(f"已重置服务 {service_name} 的统计信息")
    
    def ensure_service_running(self, service_name: str) -> bool:
        """确保服务正在运行，如果没有运行则启动它"""
        if self.is_service_running(service_name):
            return True
        
        return self.start_service(service_name)
    
    def cleanup(self):
        """清理所有启动的进程"""
        for service_name in list(self.processes.keys()):
            self.stop_service(service_name)

# 全局服务管理器实例
service_manager = ServiceManager()