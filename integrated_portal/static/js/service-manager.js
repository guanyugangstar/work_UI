/**
 * 服务管理器
 * 负责检查服务状态、启动和停止服务
 */

class ServiceManager {
    constructor() {
        this.services = ['writing', 'case2pg', 'censor', 'meeting_minutes'];
        this.statusCheckInterval = null;
        this.statusCheckIntervalTime = 30000; // 30秒检查一次，减少频繁检查
        this.init();
    }

    /**
     * 初始化服务管理器
     */
    async init() {
        this.bindEvents();
        await this.checkAllServices();
        this.startStatusCheck(); // 启动定期状态检查
        this.startMonitoringStatusUpdates();
        console.log('服务管理器已初始化');
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 绑定启动按钮事件
        document.addEventListener('click', (e) => {
            if (e.target.closest('.btn-start')) {
                const button = e.target.closest('.btn-start');
                const systemName = button.getAttribute('data-system');
                this.startService(systemName);
            }
        });

        // 绑定停止按钮事件
        document.addEventListener('click', (e) => {
            if (e.target.closest('.btn-stop')) {
                const button = e.target.closest('.btn-stop');
                const systemName = button.getAttribute('data-system');
                this.stopService(systemName);
            }
        });

        // 绑定检查所有服务按钮
        const checkAllBtn = document.getElementById('checkAllBtn');
        if (checkAllBtn) {
            checkAllBtn.addEventListener('click', () => {
                this.checkAllServices();
            });
        }

        // 绑定系统卡片点击事件
        document.addEventListener('click', (e) => {
            const systemCard = e.target.closest('.system-card');
            if (systemCard && !e.target.closest('.card-actions')) {
                const systemName = systemCard.getAttribute('data-system');
                this.openSystem(systemName);
            }
        });
    }

    /**
     * 开始定期状态检查
     */
    startStatusCheck() {
        this.checkAllServices(); // 立即检查一次
        this.statusCheckInterval = setInterval(() => {
            this.checkAllServices();
        }, this.statusCheckIntervalTime);
    }

    /**
     * 停止定期状态检查
     */
    stopStatusCheck() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
        }
    }

    /**
     * 检查所有服务状态
     */
    async checkAllServices() {
        // 只在开发模式下输出日志
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('检查所有服务状态...');
        }
        
        try {
            const response = await fetch('/api/services/status');
            const data = await response.json();
            
            if (data.success) {
                this.updateAllServiceStatus(data.services);
            } else {
                console.error('获取服务状态失败:', data.message);
            }
        } catch (error) {
            console.error('检查服务状态时发生错误:', error);
            // 如果API调用失败，将所有服务标记为未知状态
            this.services.forEach(service => {
                this.updateServiceStatus(service, 'unknown', '检查失败');
            });
        }
    }

    /**
     * 检查单个服务状态
     */
    async checkServiceStatus(serviceName) {
        try {
            const response = await fetch(`/api/services/${serviceName}/status`);
            const data = await response.json();
            
            if (data.success && data.status) {
                this.updateServiceStatus(serviceName, data.status.status, data.status.message);
                return data.status.status;
            } else {
                this.updateServiceStatus(serviceName, 'stopped', data.message || '服务停止');
                return 'stopped';
            }
        } catch (error) {
            console.error(`检查服务 ${serviceName} 状态时发生错误:`, error);
            this.updateServiceStatus(serviceName, 'unknown', '检查失败');
            return 'unknown';
        }
    }

    /**
     * 启动服务
     */
    async startService(serviceName) {
        console.log(`启动服务: ${serviceName}`);
        
        // 更新UI状态为启动中
        this.updateServiceStatus(serviceName, 'starting', '启动中...');
        this.setButtonLoading(serviceName, 'start', true);
        
        try {
            const response = await fetch(`/api/services/${serviceName}/start`, {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.success) {
                this.updateServiceStatus(serviceName, 'running', '服务已启动');
                this.showNotification(`${serviceName} 服务启动成功`, 'success');
                
                // 如果是写作系统，直接打开对应标签页
                if (serviceName === 'writing' && window.tabManager) {
                    window.tabManager.openTab('writing', { immediate: true, priority: 'high' });
                }
                
                // 等待一段时间后检查状态
                setTimeout(() => {
                    this.checkServiceStatus(serviceName);
                }, 1000);
                
                return true; // 返回成功
            } else {
                this.updateServiceStatus(serviceName, 'stopped', data.message || '启动失败');
                this.showNotification(`${serviceName} 服务启动失败: ${data.message}`, 'error');
                return false; // 返回失败
            }
        } catch (error) {
            console.error(`启动服务 ${serviceName} 时发生错误:`, error);
            this.updateServiceStatus(serviceName, 'stopped', '启动失败');
            this.showNotification(`${serviceName} 服务启动失败`, 'error');
            return false; // 返回失败
        } finally {
            this.setButtonLoading(serviceName, 'start', false);
        }
    }

    /**
     * 停止服务
     */
    async stopService(serviceName) {
        console.log(`停止服务: ${serviceName}`);
        
        // 更新UI状态为停止中
        this.updateServiceStatus(serviceName, 'stopping', '停止中...');
        this.setButtonLoading(serviceName, 'stop', true);
        
        try {
            const response = await fetch(`/api/services/${serviceName}/stop`, {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.success) {
                this.updateServiceStatus(serviceName, 'stopped', '服务已停止');
                this.showNotification(`${serviceName} 服务停止成功`, 'success');
            } else {
                this.showNotification(`${serviceName} 服务停止失败: ${data.message}`, 'error');
            }
        } catch (error) {
            console.error(`停止服务 ${serviceName} 时发生错误:`, error);
            this.showNotification(`${serviceName} 服务停止失败`, 'error');
        } finally {
            this.setButtonLoading(serviceName, 'stop', false);
        }
    }

    /**
     * 更新所有服务状态
     */
    updateAllServiceStatus(servicesData) {
        Object.keys(servicesData).forEach(serviceName => {
            const serviceInfo = servicesData[serviceName];
            this.updateServiceStatus(serviceName, serviceInfo.status, serviceInfo.message);
        });
    }

    /**
     * 更新服务状态显示
     */
    updateServiceStatus(serviceName, status, message) {
        const statusElement = document.getElementById(`${serviceName}-status`);
        const systemCard = document.querySelector(`[data-system="${serviceName}"]`);
        
        if (!statusElement || !systemCard) return;

        // 更新状态文本和图标
        const statusIcon = statusElement.querySelector('i');
        const statusText = statusElement.querySelector('span');
        
        if (statusIcon && statusText) {
            statusText.textContent = message || this.getStatusText(status);
            
            // 移除所有状态类
            statusElement.classList.remove('status-running', 'status-stopped', 'status-starting', 'status-stopping', 'status-unknown');
            statusElement.setAttribute('data-status', status);
            
            // 添加对应的状态类
            statusElement.classList.add(`status-${status}`);
            
            // 更新图标
            statusIcon.className = this.getStatusIcon(status);
        }

        // 更新按钮显示
        this.updateServiceButtons(serviceName, status);
        
        // 更新卡片样式
        systemCard.classList.remove('card-running', 'card-stopped', 'card-starting', 'card-stopping', 'card-unknown');
        systemCard.classList.add(`card-${status}`);
    }

    /**
     * 更新服务按钮显示
     */
    updateServiceButtons(serviceName, status) {
        const startBtn = document.querySelector(`[data-system="${serviceName}"].btn-start`);
        const stopBtn = document.querySelector(`[data-system="${serviceName}"].btn-stop`);
        
        if (!startBtn || !stopBtn) return;

        switch (status) {
            case 'running':
                startBtn.style.display = 'none';
                stopBtn.style.display = 'inline-flex';
                break;
            case 'stopped':
            case 'unknown':
                startBtn.style.display = 'inline-flex';
                stopBtn.style.display = 'none';
                break;
            case 'starting':
            case 'stopping':
                // 启动或停止过程中，显示对应按钮但禁用
                if (status === 'starting') {
                    startBtn.style.display = 'inline-flex';
                    stopBtn.style.display = 'none';
                } else {
                    startBtn.style.display = 'none';
                    stopBtn.style.display = 'inline-flex';
                }
                break;
        }
    }

    /**
     * 设置按钮加载状态
     */
    setButtonLoading(serviceName, buttonType, loading) {
        const button = document.querySelector(`[data-system="${serviceName}"].btn-${buttonType}`);
        if (!button) return;

        const icon = button.querySelector('i');
        const text = button.querySelector('span') || button.childNodes[button.childNodes.length - 1];
        
        if (loading) {
            button.disabled = true;
            button.classList.add('loading');
            if (icon) {
                icon.className = 'fas fa-spinner fa-spin';
            }
        } else {
            button.disabled = false;
            button.classList.remove('loading');
            if (icon) {
                icon.className = buttonType === 'start' ? 'fas fa-play' : 'fas fa-stop';
            }
        }
    }

    /**
     * 获取状态文本
     */
    getStatusText(status) {
        const statusTexts = {
            'running': '运行中',
            'stopped': '已停止',
            'starting': '启动中...',
            'stopping': '停止中...',
            'unknown': '状态未知'
        };
        return statusTexts[status] || '未知状态';
    }

    /**
     * 获取状态图标
     */
    getStatusIcon(status) {
        const statusIcons = {
            'running': 'fas fa-circle text-success',
            'stopped': 'fas fa-circle text-danger',
            'starting': 'fas fa-spinner fa-spin text-warning',
            'stopping': 'fas fa-spinner fa-spin text-warning',
            'unknown': 'fas fa-circle text-muted'
        };
        return statusIcons[status] || 'fas fa-circle text-muted';
    }

    /**
     * 打开系统
     */
    async openSystem(systemName) {
        // 对于qa_sys系统，现在直接使用蓝图路由，不需要特殊启动逻辑
        if (systemName === 'qa_sys') {
            this.showNotification('正在打开业务查询系统...', 'info');
            
            // 直接使用tabManager打开标签页，URL会从配置中获取
            if (window.tabManager) {
                window.tabManager.openTab(systemName);
                this.showNotification('业务查询系统已打开', 'success');
            }
            return;
        }
        

        
        // 其他系统使用原有逻辑
        // 首先检查服务状态
        const status = await this.checkServiceStatus(systemName);
        
        if (status === 'stopped' || status === 'unknown') {
            // 如果服务未运行，自动启动服务
            this.showNotification(`正在启动 ${systemName} 服务...`, 'info');
            
            const startResult = await this.startService(systemName);
            
            if (startResult) {
                // 等待服务启动后再打开
                this.showNotification(`${systemName} 服务启动成功，正在加载页面...`, 'success');
                
                // 写作系统由门户托管，无需等待外部端口
                if (window.tabManager) {
                    window.tabManager.openTab(systemName, { immediate: true, priority: 'high' });
                }
            } else {
                this.showNotification(`${systemName} 服务启动失败`, 'error');
            }
        } else if (status === 'running') {
            // 服务正在运行，直接打开
            if (window.tabManager) {
                window.tabManager.openTab(systemName);
            }
        }
    }

    /**
     * 显示通知
     */
    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        // 根据类型设置图标
        let icon = 'fas fa-info-circle';
        if (type === 'success') icon = 'fas fa-check-circle';
        else if (type === 'error') icon = 'fas fa-exclamation-circle';
        
        notification.innerHTML = `
            <i class="${icon}"></i>
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }

    /**
     * 开始监控状态更新
     */
    startMonitoringStatusUpdates() {
        // 每30秒更新一次监控状态
        setInterval(async () => {
            try {
                await this.updateMonitoringStatus();
            } catch (error) {
                console.error('更新监控状态失败:', error);
            }
        }, 30000);
        
        // 立即执行一次
        this.updateMonitoringStatus();
    }

    /**
     * 更新监控状态
     */
    async updateMonitoringStatus() {
        try {
            const response = await fetch('/api/monitoring/status');
            if (response.ok) {
                const monitoringStatus = await response.json();
                this.displayMonitoringInfo(monitoringStatus);
            }
        } catch (error) {
            console.error('获取监控状态失败:', error);
        }
    }

    /**
     * 显示监控信息
     */
    displayMonitoringInfo(monitoringStatus) {
        // 更新系统信息面板中的监控状态
        const systemInfo = document.querySelector('.system-info');
        if (systemInfo) {
            // 查找或创建监控状态显示区域
            let monitoringInfo = systemInfo.querySelector('.monitoring-info');
            if (!monitoringInfo) {
                monitoringInfo = document.createElement('div');
                monitoringInfo.className = 'monitoring-info';
                systemInfo.appendChild(monitoringInfo);
            }
            
            // 更新监控信息
            const servicesWithIssues = Object.entries(monitoringStatus.services_status)
                .filter(([name, status]) => status.restart_count > 0 || status.health_check_failures > 0);
            
            let statusHtml = `
                <h4><i class="fas fa-heartbeat"></i> 服务监控状态</h4>
                <div class="monitoring-details">
                    <p><strong>监控间隔:</strong> ${monitoringStatus.health_check_interval}秒</p>
                    <p><strong>最大重启次数:</strong> ${monitoringStatus.max_restart_attempts}</p>
            `;
            
            if (servicesWithIssues.length > 0) {
                statusHtml += '<h5>服务统计:</h5><ul>';
                servicesWithIssues.forEach(([name, status]) => {
                    if (status.restart_count > 0) {
                        statusHtml += `<li>${name}: 重启 ${status.restart_count} 次</li>`;
                    }
                    if (status.health_check_failures > 0) {
                        statusHtml += `<li>${name}: 健康检查失败 ${status.health_check_failures} 次</li>`;
                    }
                });
                statusHtml += '</ul>';
            } else {
                statusHtml += '<p class="text-success">所有服务运行正常</p>';
            }
            
            statusHtml += '</div>';
            monitoringInfo.innerHTML = statusHtml;
        }
    }

    /**
     * 重置服务统计信息
     */
    async resetServiceStats(serviceName) {
        try {
            const response = await fetch(`/api/services/${serviceName}/reset-stats`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification(`服务 ${serviceName} 的统计信息已重置`, 'success');
                await this.updateMonitoringStatus();
            } else {
                this.showNotification(`重置失败: ${result.message}`, 'error');
            }
        } catch (error) {
            console.error('重置服务统计信息失败:', error);
            this.showNotification('重置服务统计信息失败', 'error');
        }
    }

    /**
     * 在新窗口的iframe中打开censor系统
     */
    // 注释掉openCensorInIframe方法，因为现在使用tabManager在主应用中显示
    /*
    openCensorInIframe(url) {
        // 创建新窗口的HTML内容
        const iframeHtml = `
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>文件审查系统</title>
                <style>
                    body {
                        margin: 0;
                        padding: 0;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: #f5f5f5;
                    }
                    .header {
                        background: #2c3e50;
                        color: white;
                        padding: 10px 20px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 18px;
                        font-weight: 500;
                    }
                    .close-btn {
                        background: #e74c3c;
                        color: white;
                        border: none;
                        padding: 5px 15px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    }
                    .close-btn:hover {
                        background: #c0392b;
                    }
                    .iframe-container {
                        width: 100%;
                        height: calc(100vh - 60px);
                        border: none;
                        display: block;
                    }
                    iframe {
                        width: 100%;
                        height: 100%;
                        border: none;
                        background: white;
                    }
                    .loading {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        text-align: center;
                        color: #666;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 文件审查系统</h1>
                    <button class="close-btn" onclick="window.close()">关闭</button>
                </div>
                <div class="loading" id="loading">
                    <p>正在加载文件审查系统...</p>
                </div>
                <iframe 
                    src="${url}" 
                    class="iframe-container"
                    onload="document.getElementById('loading').style.display='none'"
                    onerror="document.getElementById('loading').innerHTML='<p style=color:red>加载失败，请检查服务是否正常运行</p>'"
                ></iframe>
            </body>
            </html>
        `;

        // 打开新窗口
        const newWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
        
        if (newWindow) {
            newWindow.document.write(iframeHtml);
            newWindow.document.close();
            
            // 设置窗口标题
            newWindow.document.title = '文件审查系统';
            
            console.log('文件审查系统已在新窗口中打开');
        } else {
            this.showNotification('无法打开新窗口，请检查浏览器弹窗设置', 'error');
        }
    }
    */

    /**
     * 销毁服务管理器
     */
    destroy() {
        this.stopStatusCheck();
        console.log('服务管理器已销毁');
    }
}

// 全局实例
window.ServiceManager = ServiceManager;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.serviceManager = new ServiceManager();
});