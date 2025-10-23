/**
 * 统一门户系统 - 主要JavaScript文件
 * 处理基础功能、事件监听和工具函数
 * 性能优化版本 - 包含懒加载、缓存和性能监控
 */

// 性能监控
const PerformanceMonitor = {
    marks: new Map(),
    measures: new Map(),
    
    mark(name) {
        if (window.performance && window.performance.mark) {
            window.performance.mark(name);
            this.marks.set(name, Date.now());
        }
    },
    
    measure(name, startMark, endMark) {
        if (window.performance && window.performance.measure) {
            try {
                window.performance.measure(name, startMark, endMark);
                const measure = window.performance.getEntriesByName(name)[0];
                this.measures.set(name, measure.duration);
                return measure.duration;
            } catch (e) {
                console.warn('Performance measure failed:', e);
            }
        }
        return 0;
    },
    
    getMetrics() {
        return {
            marks: Object.fromEntries(this.marks),
            measures: Object.fromEntries(this.measures)
        };
    }
};

// 缓存管理器
const CacheManager = {
    cache: new Map(),
    maxSize: 100,
    ttl: 5 * 60 * 1000, // 5分钟
    
    set(key, value, customTtl = null) {
        const expiry = Date.now() + (customTtl || this.ttl);
        
        // 如果缓存已满，删除最旧的条目
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, { value, expiry });
    },
    
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }
        
        return item.value;
    },
    
    clear() {
        this.cache.clear();
    },
    
    cleanup() {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiry) {
                this.cache.delete(key);
            }
        }
    }
};

// 定期清理缓存
setInterval(() => CacheManager.cleanup(), 60000);

// 全局配置
window.PortalConfig = {
    // API端点
    endpoints: {
        health: '/health',
        proxy: '/proxy'
    },
    
    // 系统配置
    systems: {
        writing: {
            name: '智能文件撰写系统',
            icon: '📝',
            color: '#3b82f6',
            path: '/writing/',
            url: '/writing/'
        },
        qa_sys: {
            name: '业务查询系统',
            icon: '🏢',
            color: '#10b981',
            path: '/qa_sys',
            url: '/qa_sys'
        },
        case2pg: {
            name: '数据处理系统',
            icon: '📊',
            color: '#f59e0b',
            path: '/case2pg',
            url: '/case2pg'
        },
        censor: {
            name: '文件审查系统',
            icon: '🔍',
            color: '#ef4444',
            path: '/censor',
            url: '/censor'
        }
    },
    
    // 健康检查间隔（毫秒）
    healthCheckInterval: 60000,
    
    // 请求超时时间（毫秒）
    requestTimeout: 30000,
    
    // 性能配置
    performance: {
        enableMonitoring: true,
        enableCaching: true,
        lazyLoadThreshold: 100, // 懒加载阈值（像素）
        debounceDelay: 300,
        throttleDelay: 100
    }
};

// 全局状态管理
window.PortalState = {
    currentSystem: null,
    systemHealth: {},
    isLoading: false,
    lastHealthCheck: null
};

/**
 * 工具函数类
 */
class PortalUtils {
    /**
     * 显示加载指示器
     */
    static showLoading() {
        const indicator = document.getElementById('loadingIndicator');
        if (indicator) {
            indicator.classList.add('active');
        }
        window.PortalState.isLoading = true;
    }
    
    /**
     * 隐藏加载指示器
     */
    static hideLoading() {
        const indicator = document.getElementById('loadingIndicator');
        if (indicator) {
            indicator.classList.remove('active');
        }
        window.PortalState.isLoading = false;
    }
    
    /**
     * 显示模态框
     * @param {string} modalId - 模态框ID
     */
    static showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            // 设置无障碍属性
            modal.setAttribute('aria-hidden', 'false');
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            
            // 设置焦点陷阱
            if (window.accessibilityManager) {
                window.accessibilityManager.setupModalFocusTrap(modal);
            }
        }
    }
    
    /**
     * 隐藏模态框
     * @param {string} modalId - 模态框ID
     */
    static hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            
            // 重置无障碍属性
            modal.setAttribute('aria-hidden', 'true');
            
            // 恢复焦点到触发元素
            if (window.accessibilityManager) {
                window.accessibilityManager.restoreFocus();
            }
        }
    }
    
    /**
     * 格式化时间
     * @param {Date} date - 日期对象
     * @returns {string} 格式化的时间字符串
     */
    static formatTime(date) {
        return date.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
    /**
     * 格式化持续时间
     * @param {number} ms - 毫秒数
     * @returns {string} 格式化的持续时间
     */
    static formatDuration(ms) {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}min`;
    }
    
    /**
     * 防抖函数
     * @param {Function} func - 要防抖的函数
     * @param {number} wait - 等待时间
     * @returns {Function} 防抖后的函数
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * 节流函数
     * @param {Function} func - 要节流的函数
     * @param {number} limit - 限制时间
     * @returns {Function} 节流后的函数
     */
    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    /**
     * 发送HTTP请求（带缓存和性能监控）
     * @param {string} url - 请求URL
     * @param {Object} options - 请求选项
     * @returns {Promise} 请求Promise
     */
    static async request(url, options = {}) {
        const cacheKey = `request_${url}_${JSON.stringify(options)}`;
        const startTime = Date.now();
        
        // 性能监控
        if (window.PortalConfig.performance.enableMonitoring) {
            PerformanceMonitor.mark(`request_start_${url}`);
        }
        
        // 检查缓存
        if (window.PortalConfig.performance.enableCaching && options.method !== 'POST') {
            const cached = CacheManager.get(cacheKey);
            if (cached) {
                console.log('从缓存返回:', url);
                // 返回一个新的Response对象，包含缓存的数据
                return new Response(JSON.stringify(cached), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }
        
        const defaultOptions = {
            timeout: window.PortalConfig.requestTimeout,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        const finalOptions = { ...defaultOptions, ...options };
        
        // 创建AbortController用于超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), finalOptions.timeout);
        
        try {
            const response = await fetch(url, {
                ...finalOptions,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            // 缓存成功的GET请求 - 缓存解析后的数据而不是Response对象
            if (window.PortalConfig.performance.enableCaching && 
                (!options.method || options.method === 'GET')) {
                try {
                    const responseClone = response.clone();
                    const data = await responseClone.json();
                    CacheManager.set(cacheKey, data);
                } catch (cacheError) {
                    console.warn('缓存数据时出错:', cacheError);
                }
            }
            
            // 性能监控
            if (window.PortalConfig.performance.enableMonitoring) {
                PerformanceMonitor.mark(`request_end_${url}`);
                const duration = Date.now() - startTime;
                console.log(`请求 ${url} 耗时: ${duration}ms`);
            }
            
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            
            // 性能监控
            if (window.PortalConfig.performance.enableMonitoring) {
                const duration = Date.now() - startTime;
                console.warn(`请求失败 ${url} 耗时: ${duration}ms`, error);
            }
            
            if (error.name === 'AbortError') {
                throw new Error('请求超时');
            }
            throw error;
        }
    }
    
    /**
     * 显示通知（优化版本，支持通知池和批量处理）
     * @param {string} message - 通知消息
     * @param {string} type - 通知类型 (success, warning, error, info)
     * @param {number} duration - 显示时长（毫秒）
     */
    static showNotification(message, type = 'info', duration = 3000) {
        // 防止重复通知
        const notificationKey = `${type}_${message}`;
        if (this._activeNotifications && this._activeNotifications.has(notificationKey)) {
            return;
        }
        
        // 初始化通知池
        if (!this._activeNotifications) {
            this._activeNotifications = new Set();
            this._notificationQueue = [];
            this._maxNotifications = 5;
        }
        
        // 如果通知过多，加入队列
        if (this._activeNotifications.size >= this._maxNotifications) {
            this._notificationQueue.push({ message, type, duration });
            return;
        }
        
        this._activeNotifications.add(notificationKey);
        
        // 使用DocumentFragment提高性能
        const fragment = document.createDocumentFragment();
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.setAttribute('role', 'alert');
        notification.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
        notification.setAttribute('aria-atomic', 'true');
        notification.innerHTML = `
            <div class="notification-header">
                <span class="notification-title">
                    <i class="fas ${this.getNotificationIcon(type)}" aria-hidden="true"></i>
                    ${this.getNotificationTitle(type)}
                </span>
                <button class="notification-close" aria-label="关闭通知">&times;</button>
            </div>
            <div class="notification-content">${message}</div>
        `;
        
        fragment.appendChild(notification);
        
        // 无障碍支持
        if (window.accessibilityManager) {
            window.accessibilityManager.announceNotification(message, type);
        }
        
        // 获取或创建通知容器
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                pointer-events: none;
            `;
            document.body.appendChild(container);
        }
        
        container.appendChild(fragment);
        
        // 使用requestAnimationFrame优化动画
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });
        
        // 关闭事件（使用事件委托）
        const closeBtn = notification.querySelector('.notification-close');
        const closeNotification = () => {
            notification.classList.add('hide');
            
            // 使用transitionend事件而不是setTimeout
            const handleTransitionEnd = () => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                this._activeNotifications.delete(notificationKey);
                
                // 处理队列中的通知
                if (this._notificationQueue.length > 0) {
                    const next = this._notificationQueue.shift();
                    setTimeout(() => this.showNotification(next.message, next.type, next.duration), 100);
                }
                
                notification.removeEventListener('transitionend', handleTransitionEnd);
            };
            
            notification.addEventListener('transitionend', handleTransitionEnd);
            
            // 备用清理机制
            setTimeout(handleTransitionEnd, 500);
        };
        
        closeBtn.addEventListener('click', closeNotification, { once: true });
        
        // 自动关闭
        if (duration > 0) {
            setTimeout(closeNotification, duration);
        }
        
        // 焦点管理
        if (type === 'error' && window.accessibilityManager) {
            window.accessibilityManager.manageFocusForNotification(notification);
        }
    }
    
    /**
     * 获取通知图标
     * @param {string} type - 通知类型
     * @returns {string} 图标类名
     */
    static getNotificationIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            warning: 'fa-exclamation-triangle',
            error: 'fa-times-circle',
            info: 'fa-info-circle'
        };
        return icons[type] || icons.info;
    }

    static getNotificationTitle(type) {
        const titles = {
            success: '成功',
            warning: '警告',
            error: '错误',
            info: '信息'
        };
        return titles[type] || titles.info;
    }
}

/**
 * 健康检查管理器（优化版本）
 */
class HealthCheckManager {
    constructor() {
        this.checkInterval = null;
        this.isChecking = false;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1秒
        this.consecutiveFailures = 0;
        this.maxConsecutiveFailures = 5;
        this.adaptiveInterval = window.PortalConfig.healthCheckInterval;
        this.lastSuccessTime = null;
        this.errorHistory = [];
        this.maxErrorHistory = 10;
        this.circuitBreakerOpen = false;
        this.circuitBreakerTimeout = 30000; // 30秒
        this.lastCircuitBreakerReset = null;
    }
    
    /**
     * 开始定期健康检查
     */
    start() {
        this.check(); // 立即检查一次
        this.scheduleNextCheck();
    }
    
    /**
     * 停止健康检查
     */
    stop() {
        if (this.checkInterval) {
            clearTimeout(this.checkInterval);
            this.checkInterval = null;
        }
    }
    
    /**
     * 调度下一次检查
     */
    scheduleNextCheck() {
        if (this.checkInterval) {
            clearTimeout(this.checkInterval);
        }
        
        this.checkInterval = setTimeout(() => {
            this.check().then(() => {
                this.scheduleNextCheck();
            });
        }, this.adaptiveInterval);
    }
    
    /**
     * 执行健康检查（优化版本）
     */
    async check() {
        if (this.isChecking) return;
        
        // 检查熔断器状态
        if (this.circuitBreakerOpen) {
            const now = Date.now();
            if (this.lastCircuitBreakerReset && 
                (now - this.lastCircuitBreakerReset) < this.circuitBreakerTimeout) {
                console.log('熔断器开启中，跳过健康检查');
                return;
            } else {
                // 尝试重置熔断器
                this.circuitBreakerOpen = false;
                this.consecutiveFailures = 0;
                console.log('尝试重置熔断器');
            }
        }
        
        this.isChecking = true;
        const startTime = performance.now();
        
        try {
            // 使用性能监控
            PerformanceMonitor.mark('health-check-start');
            
            const response = await this.performHealthCheckWithRetry();
            const data = await response.json();
            
            // 记录成功
            this.onCheckSuccess(data, startTime);
            
            PerformanceMonitor.mark('health-check-end');
            PerformanceMonitor.measure('health-check-duration', 'health-check-start', 'health-check-end');
            
        } catch (error) {
            this.onCheckFailure(error, startTime);
        } finally {
            this.isChecking = false;
        }
    }
    
    /**
     * 带重试的健康检查
     */
    async performHealthCheckWithRetry() {
        let lastError;
        
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    // 指数退避延迟
                    const delay = this.retryDelay * Math.pow(2, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    console.log(`健康检查重试 ${attempt}/${this.maxRetries}`);
                }
                
                const response = await PortalUtils.request('/health');
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                return response;
                
            } catch (error) {
                lastError = error;
                console.warn(`健康检查尝试 ${attempt + 1} 失败:`, error.message);
                
                // 如果是最后一次尝试，抛出错误
                if (attempt === this.maxRetries) {
                    throw lastError;
                }
            }
        }
    }
    
    /**
     * 处理检查成功
     */
    onCheckSuccess(data, startTime) {
        const duration = performance.now() - startTime;
        
        // 重置错误计数
        this.consecutiveFailures = 0;
        this.retryCount = 0;
        this.lastSuccessTime = new Date();
        this.circuitBreakerOpen = false;
        
        // 自适应调整检查间隔
        this.adaptiveInterval = Math.max(
            window.PortalConfig.healthCheckInterval,
            this.adaptiveInterval * 0.9 // 成功时稍微减少间隔
        );
        
        // 更新状态
        window.PortalState.systemHealth = data;
        window.PortalState.lastHealthCheck = this.lastSuccessTime;
        
        this.updateUI(data);
        
        // 智能通知（避免过多成功通知）
        const status = data.overall_status || 'unknown';
        if (this.errorHistory.length > 0 && status === 'healthy') {
            // 从错误状态恢复
            PortalUtils.showNotification('系统已恢复正常运行', 'success', 3000);
            this.errorHistory = []; // 清空错误历史
        } else if (status === 'degraded') {
            PortalUtils.showNotification('部分系统性能下降', 'warning', 4000);
        } else if (status === 'unhealthy' || status === 'down') {
            PortalUtils.showNotification('发现系统异常', 'error', 5000);
        }
        
        console.log(`健康检查成功，耗时: ${duration.toFixed(2)}ms`);
    }
    
    /**
     * 处理检查失败
     */
    onCheckFailure(error, startTime) {
        const duration = performance.now() - startTime;
        this.consecutiveFailures++;
        
        // 记录错误历史
        const errorRecord = {
            timestamp: new Date(),
            error: error.message,
            duration: duration
        };
        
        this.errorHistory.push(errorRecord);
        if (this.errorHistory.length > this.maxErrorHistory) {
            this.errorHistory.shift();
        }
        
        // 自适应调整检查间隔（失败时增加间隔）
        this.adaptiveInterval = Math.min(
            this.adaptiveInterval * 1.5,
            window.PortalConfig.healthCheckInterval * 5 // 最大不超过5倍原间隔
        );
        
        // 检查是否需要开启熔断器
        if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
            this.circuitBreakerOpen = true;
            this.lastCircuitBreakerReset = Date.now();
            console.warn('连续失败次数过多，开启熔断器');
            PortalUtils.showNotification('健康检查暂时停用，系统可能存在问题', 'error', 8000);
        }
        
        console.error(`健康检查失败 (${this.consecutiveFailures}/${this.maxConsecutiveFailures}):`, error);
        
        // 设置错误状态
        window.PortalState.systemHealth = {
            overall_status: 'error',
            services: {},
            error: error.message,
            consecutive_failures: this.consecutiveFailures
        };
        
        this.updateUI(window.PortalState.systemHealth);
        
        // 智能错误通知
        if (this.consecutiveFailures === 1) {
            PortalUtils.showNotification('健康检查失败，正在重试...', 'warning', 3000);
        } else if (this.consecutiveFailures === 3) {
            PortalUtils.showNotification('健康检查持续失败，请检查网络连接', 'error', 5000);
        }
    }
    
    /**
     * 更新UI显示
     * @param {Object} healthData - 健康检查数据
     */
    updateUI(healthData) {
        // 更新系统卡片状态
        Object.keys(healthData.services).forEach(systemName => {
            const service = healthData.services[systemName];
            const card = document.querySelector(`[data-system="${systemName}"]`);
            if (card) {
                const statusEl = card.querySelector('.card-status');
                if (statusEl) {
                    const oldStatus = statusEl.getAttribute('data-status');
                    const newStatus = service.status;
                    const statusText = this.getStatusText(newStatus);
                    
                    // 只在状态真正发生变化时更新UI和公告
                    if (oldStatus !== newStatus) {
                        statusEl.setAttribute('data-status', newStatus);
                        statusEl.innerHTML = `<i class="fas fa-circle" aria-hidden="true"></i> <span>${statusText}</span>`;
                        
                        // 更新无障碍属性
                        if (window.accessibilityManager) {
                            window.accessibilityManager.updateSystemCardStatus(
                                systemName, 
                                newStatus, 
                                statusText
                            );
                        }
                    }
                }
            }
        });
        
        // 触发自定义事件
        document.dispatchEvent(new CustomEvent('healthCheckUpdate', {
            detail: healthData
        }));
    }
    
    /**
     * 获取状态文本
     * @param {string} status - 状态值
     * @returns {string} 状态文本
     */
    getStatusText(status) {
        const statusMap = {
            'healthy': '运行正常',
            'degraded': '性能下降',
            'unhealthy': '运行异常',
            'critical': '服务异常',
            'down': '服务停止',
            'timeout': '连接超时',
            'error': '检查失败',
            'unknown': '状态未知',
            // 添加与服务管理器一致的状态映射
            'running': '服务已启动',
            'stopped': '服务未运行',
            'starting': '启动中...',
            'stopping': '停止中...'
        };
        return statusMap[status] || '未知状态';
    }
    
    /**
     * 显示详细健康状态
     */
    showDetailedStatus() {
        const healthData = window.PortalState.systemHealth;
        const lastCheck = window.PortalState.lastHealthCheck;
        
        let content = '<div class="health-status-detail" role="region" aria-label="系统健康状态详情">';
        
        // 整体状态
        content += `
            <div class="health-section">
                <h4>整体状态</h4>
                <div class="status-item">
                    <span class="status-label">状态:</span>
                    <span class="status-value status-${healthData.overall_status || 'unknown'}">
                        ${this.getStatusText(healthData.overall_status || 'unknown')}
                    </span>
                </div>
                <div class="status-item">
                    <span class="status-label">检查时间:</span>
                    <span class="status-value">
                        ${lastCheck ? PortalUtils.formatTime(lastCheck) : '未检查'}
                    </span>
                </div>
            </div>
        `;
        
        // 各子系统状态
        if (healthData.services) {
            content += '<div class="health-section"><h4>子系统状态</h4>';
            
            Object.keys(healthData.services).forEach(systemName => {
                const service = healthData.services[systemName];
                const systemConfig = window.PortalConfig.systems[systemName];
                
                content += `
                    <div class="service-status">
                        <div class="service-header">
                            <span class="service-icon">${systemConfig?.icon || '🔧'}</span>
                            <span class="service-name">${systemConfig?.name || systemName}</span>
                            <span class="service-status-badge status-${service.status}">
                                ${this.getStatusText(service.status)}
                            </span>
                        </div>
                        <div class="service-details">
                            <div class="detail-item">
                                <span>响应时间:</span>
                                <span>${service.response_time ? PortalUtils.formatDuration(service.response_time) : '-'}</span>
                            </div>
                            <div class="detail-item">
                                <span>端口:</span>
                                <span>${service.port || '-'}</span>
                            </div>
                            ${service.error ? `
                                <div class="detail-item error">
                                    <span>错误信息:</span>
                                    <span>${service.error}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            });
            
            content += '</div>';
        }
        
        content += '</div>';
        
        // 添加样式
        if (!document.getElementById('health-status-styles')) {
            const styles = document.createElement('style');
            styles.id = 'health-status-styles';
            styles.textContent = `
                .health-status-detail { font-size: 14px; }
                .health-section { margin-bottom: 20px; }
                .health-section h4 { margin-bottom: 12px; color: #374151; font-weight: 600; }
                .status-item, .detail-item { display: flex; justify-content: space-between; margin-bottom: 8px; }
                .status-label { color: #6b7280; }
                .status-value { font-weight: 500; }
                .service-status { border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin-bottom: 12px; }
                .service-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
                .service-name { flex: 1; font-weight: 500; }
                .service-status-badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
                .service-details { padding-left: 24px; }
                .detail-item.error { color: #ef4444; }
                .status-healthy, .service-status-badge.status-healthy { color: #10b981; background: #d1fae5; }
                .status-degraded, .service-status-badge.status-degraded { color: #f59e0b; background: #fef3c7; }
                .status-unhealthy, .status-down, .status-error, 
                .service-status-badge.status-unhealthy, 
                .service-status-badge.status-down, 
                .service-status-badge.status-error { color: #ef4444; background: #fee2e2; }
                .status-unknown, .service-status-badge.status-unknown { color: #6b7280; background: #f3f4f6; }
            `;
            document.head.appendChild(styles);
        }
        
        // 显示在模态框中
        const modalBody = document.querySelector('#healthModal .modal-body');
        if (modalBody) {
            modalBody.innerHTML = content;
        }
        
        PortalUtils.showModal('healthModal');
        
        // 无障碍支持
        if (window.accessibilityManager) {
            window.accessibilityManager.announceModalOpen('健康状态详情');
        }
    }
}

/**
 * 系统导览管理器
 */
class SystemGuide {
    constructor() {
        this.modal = null;
        this.isVisible = false;
        this.init();
    }
    
    init() {
        this.modal = document.getElementById('systemGuideModal');
        if (this.modal) {
            this.bindEvents();
        }
    }
    
    bindEvents() {
        // 关闭按钮事件
        const closeButtons = this.modal.querySelectorAll('.modal-close');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.hideGuide();
            });
        });
        
        // 模态框遮罩点击关闭
        const overlay = this.modal.querySelector('.modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', () => {
                this.hideGuide();
            });
        }
        
        // ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hideGuide();
            }
        });
        
        // "立即体验"按钮事件
        const guideStartButtons = this.modal.querySelectorAll('.guide-start');
        guideStartButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const systemName = e.target.closest('.guide-start').getAttribute('data-system');
                if (systemName) {
                    this.startSystem(systemName);
                }
            });
        });
    }
    
    showGuide() {
        if (!this.modal) return;
        
        this.modal.classList.add('active');
        this.modal.setAttribute('aria-hidden', 'false');
        this.isVisible = true;
        
        // 聚焦到模态框
        setTimeout(() => {
            const firstFocusable = this.modal.querySelector('button, [tabindex]:not([tabindex="-1"])');
            if (firstFocusable) {
                firstFocusable.focus();
            }
        }, 100);
        
        // 更新系统状态显示
        this.updateSystemStatus();
        
        // 无障碍支持
        if (window.accessibilityManager) {
            window.accessibilityManager.announceModalOpen('系统导览');
        }
        
        // 性能监控
        if (window.PerformanceMonitor) {
            window.PerformanceMonitor.mark('guide-open');
        }
    }
    
    hideGuide() {
        if (!this.modal) return;
        
        this.modal.classList.remove('active');
        this.modal.setAttribute('aria-hidden', 'true');
        this.isVisible = false;
        
        // 无障碍支持
        if (window.accessibilityManager) {
            window.accessibilityManager.announceModalClose('系统导览');
        }
        
        // 性能监控
        if (window.PerformanceMonitor) {
            window.PerformanceMonitor.mark('guide-close');
            window.PerformanceMonitor.measure('guide-duration', 'guide-open', 'guide-close');
        }
    }
    
    async startSystem(systemName) {
        if (!systemName || !window.PortalConfig.systems[systemName]) {
            PortalUtils.showNotification('系统不存在', 'error');
            return;
        }
        
        const system = window.PortalConfig.systems[systemName];
        
        try {
            // 显示启动提示
            PortalUtils.showNotification(`正在启动 ${system.name}...`, 'info');
            
            // 检查系统状态
            const healthData = window.PortalState.systemHealth[systemName];
            const isRunning = healthData && healthData.status === 'healthy';
            
            if (!isRunning) {
                // 如果系统未运行，先启动服务
                if (window.serviceManager) {
                    const startResult = await window.serviceManager.startService(systemName);
                    if (!startResult.success) {
                        PortalUtils.showNotification(`启动 ${system.name} 失败: ${startResult.message}`, 'error');
                        return;
                    }
                    
                    // 等待服务启动
                    PortalUtils.showNotification(`${system.name} 启动成功，正在打开页面...`, 'success');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            
            // 关闭导览对话框
            this.hideGuide();
            
            // 打开系统标签页
            if (window.tabManager) {
                window.tabManager.openTab(systemName);
                PortalUtils.showNotification(`${system.name} 已打开`, 'success');
            }
            
        } catch (error) {
            console.error('启动系统失败:', error);
            PortalUtils.showNotification(`启动 ${system.name} 时发生错误`, 'error');
        }
    }
    
    updateSystemStatus() {
        if (!this.modal) return;
        
        const guideSystems = this.modal.querySelectorAll('.guide-system');
        guideSystems.forEach(guideSystem => {
            const systemName = guideSystem.getAttribute('data-system');
            const startButton = guideSystem.querySelector('.guide-start');
            
            if (systemName && startButton) {
                const healthData = window.PortalState.systemHealth[systemName];
                const isRunning = healthData && healthData.status === 'healthy';
                
                if (isRunning) {
                    startButton.innerHTML = '<i class="fas fa-external-link-alt"></i> 直接打开';
                    startButton.classList.remove('btn-primary');
                    startButton.classList.add('btn-success');
                } else {
                    startButton.innerHTML = '<i class="fas fa-rocket"></i> 立即体验';
                    startButton.classList.remove('btn-success');
                    startButton.classList.add('btn-primary');
                }
            }
        });
    }
}

/**
 * 主应用程序类
 */
class PortalApp {
    constructor() {
        this.healthManager = new HealthCheckManager();
        this.tabManager = new TabManager();
        this.systemGuide = new SystemGuide();
        window.tabManager = this.tabManager; // 设置全局引用
        window.healthManager = this.healthManager; // 设置全局引用
        window.SystemGuide = this.systemGuide; // 设置全局引用
        this.init();
    }
    
    /**
     * 初始化应用程序
     */
    init() {
        this.bindEvents();
        this.healthManager.start();
        
        // 初始化系统信息
        this.updateSystemInfo();
        
        console.log('统一门户系统已初始化');
    }
    
    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 健康检查按钮
        const healthCheckBtn = document.getElementById('healthCheckBtn');
        if (healthCheckBtn) {
            healthCheckBtn.addEventListener('click', () => {
                this.healthManager.showDetailedStatus();
            });
        }
        
        // 模态框关闭
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-close') || e.target.classList.contains('modal')) {
                const modal = e.target.closest('.modal') || e.target;
                if (modal.classList.contains('modal')) {
                    PortalUtils.hideModal(modal.id);
                }
            }
        });
        
        // ESC键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const activeModal = document.querySelector('.modal.active');
                if (activeModal) {
                    PortalUtils.hideModal(activeModal.id);
                }
            }
        });
        
        // 系统卡片点击事件已由service-manager.js处理，此处移除重复处理
        
        // 系统导览按钮
        const startBtn = document.getElementById('startBtn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                // 打开系统导览对话框
                window.SystemGuide.showGuide();
            });
        }
        
        // 检查所有服务按钮
        const checkAllBtn = document.getElementById('checkAllBtn');
        if (checkAllBtn) {
            checkAllBtn.addEventListener('click', () => {
                this.healthManager.check();
                PortalUtils.showNotification('正在检查所有服务状态...', 'info', 2000);
            });
        }
        
        // 刷新按钮
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                if (window.tabManager) {
                    window.tabManager.refreshCurrentTab();
                }
            });
        }
        
        // 全屏按钮
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreen();
            });
        }
        
        // 监听健康检查更新
        document.addEventListener('healthCheckUpdate', (e) => {
            this.updateSystemInfo();
        });
    }
    
    /**
     * 更新系统信息显示
     */
    updateSystemInfo() {
        const currentSystemEl = document.getElementById('currentSystem');
        const loadTimeEl = document.getElementById('loadTime');
        const connectionStatusEl = document.getElementById('connectionStatus');
        
        if (currentSystemEl) {
            const currentSystem = window.PortalState.currentSystem;
            if (currentSystem) {
                const systemConfig = window.PortalConfig.systems[currentSystem];
                currentSystemEl.textContent = systemConfig?.name || currentSystem;
            } else {
                currentSystemEl.textContent = '欢迎页面';
            }
        }
        
        if (loadTimeEl && window.PortalState.lastHealthCheck) {
            loadTimeEl.textContent = PortalUtils.formatTime(window.PortalState.lastHealthCheck);
        }
        
        if (connectionStatusEl) {
            const overallStatus = window.PortalState.systemHealth?.overall_status || 'unknown';
            connectionStatusEl.className = `value status-${overallStatus}`;
            connectionStatusEl.textContent = this.healthManager.getStatusText(overallStatus);
        }
    }
    
    // handleWritingSystemClick方法已移除，现在统一使用service-manager.js处理系统卡片点击

    /**
     * 切换全屏模式
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error('无法进入全屏模式:', err);
                PortalUtils.showNotification('无法进入全屏模式', 'warning');
            });
        } else {
            document.exitFullscreen().catch(err => {
                console.error('无法退出全屏模式:', err);
            });
        }
    }
    
    /**
     * 销毁应用程序
     */
    destroy() {
        this.healthManager.stop();
        if (this.tabManager) {
            this.tabManager.destroy();
        }
        window.tabManager = null; // 清除全局引用
        console.log('统一门户系统已销毁');
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.portalApp = new PortalApp();
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    if (window.portalApp) {
        window.portalApp.destroy();
    }
});

// 导出工具类供其他模块使用
window.PortalUtils = PortalUtils;