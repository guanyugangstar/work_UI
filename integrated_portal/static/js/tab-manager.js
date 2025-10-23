/**
 * 标签页管理器（优化版本）
 * 负责管理多个子系统的标签页切换、iframe加载等功能
 */

class TabManager {
    constructor() {
        this.tabs = new Map(); // 存储标签页信息
        this.activeTab = null; // 当前活动标签页
        this.tabCounter = 0; // 标签页计数器
        this.lazyLoadQueue = new Set(); // 懒加载队列
        this.maxTabs = 10; // 最大标签页数量
        this.inactiveTabTimeout = 300000; // 5分钟后卸载非活动标签页
        this.inactiveTabTimers = new Map(); // 非活动标签页定时器
        this.performanceMetrics = new Map(); // 性能指标
        this.intersectionObserver = null; // 交叉观察器
        
        this.init();
    }
    
    /**
     * 初始化标签页管理器
     */
    init() {
        this.createTabNavigation();
        this.bindEvents();
        this.initPerformanceOptimizations();
        
        // 只在开发模式下输出日志
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('标签页管理器已初始化（优化版本）');
        }
    }
    
    /**
     * 初始化性能优化功能
     */
    initPerformanceOptimizations() {
        // 初始化交叉观察器用于懒加载
        this.intersectionObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const tabId = entry.target.getAttribute('data-tab-id');
                        this.loadTabIfNeeded(tabId);
                    }
                });
            },
            { threshold: 0.1 }
        );
        
        // 监听内存使用情况
        if ('memory' in performance) {
            setInterval(() => {
                this.checkMemoryUsage();
            }, 60000); // 每60秒检查一次（从30秒改为60秒）
        }
        
        // 预加载优化
        this.setupPreloadOptimization();
    }
    
    /**
     * 创建标签页导航结构
     */
    createTabNavigation() {
        const tabList = document.getElementById('tabList');
        if (!tabList) return;
        
        // 设置无障碍属性
        tabList.setAttribute('role', 'tablist');
        tabList.setAttribute('aria-label', '系统标签页');
        
        // 清空现有内容
        tabList.innerHTML = '';
        
        // 创建欢迎页标签（默认）
        this.createWelcomeTab();
    }
    
    /**
     * 创建欢迎页标签
     */
    createWelcomeTab() {
        const welcomeTab = {
            id: 'welcome',
            name: '欢迎页面',
            icon: 'fas fa-home',
            type: 'welcome',
            isClosable: false,
            isActive: true
        };
        
        this.tabs.set('welcome', welcomeTab);
        this.activeTab = 'welcome';
        this.renderTab(welcomeTab);
        this.showWelcomePanel();
    }
    
    /**
     * 打开新标签页（优化版本）
     * @param {string} systemName - 系统名称
     * @param {Object} options - 选项
     */
    openTab(systemName, options = {}) {
        const systemConfig = window.PortalConfig.systems[systemName];
        if (!systemConfig) {
            console.error('未知的系统:', systemName);
            return;
        }
        
        // 检查是否已经存在该系统的标签页
        const existingTab = this.findTabBySystem(systemName);
        if (existingTab) {
            this.activateTab(existingTab.id);
            return;
        }
        
        // 检查标签页数量限制
        if (this.tabs.size >= this.maxTabs) {
            this.closeOldestInactiveTab();
        }
        
        // 创建新标签页
        const tabId = `tab-${systemName}-${++this.tabCounter}`;
        const tab = {
            id: tabId,
            name: systemConfig.name,
            icon: this.getSystemIcon(systemName),
            type: 'system',
            system: systemName,
            url: systemConfig.path || systemConfig.url, // 优先使用path（相对路径），避免外部链接问题
            isClosable: true,
            isActive: false,
            status: 'pending', // 改为pending状态，支持懒加载
            loadTime: null,
            createTime: Date.now(),
            lastActiveTime: Date.now(),
            isLoaded: false,
            priority: options.priority || 'normal',
            ...options
        };
        
        this.tabs.set(tabId, tab);
        this.renderTab(tab);
        this.activateTab(tabId);
        
        // 根据优先级决定是否立即加载
        if (options.priority === 'high' || options.immediate) {
            this.loadTabContent(tabId);
        } else {
            this.lazyLoadQueue.add(tabId);
            this.scheduleTabLoad(tabId);
        }
        
        // 更新全局状态
        window.PortalState.currentSystem = systemName;
        
        // 只在开发模式下输出日志
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('打开标签页（优化）:', tab);
        }
    }
    
    /**
     * 查找系统对应的标签页
     * @param {string} systemName - 系统名称
     * @returns {Object|null} 标签页对象
     */
    findTabBySystem(systemName) {
        for (const tab of this.tabs.values()) {
            if (tab.system === systemName) {
                return tab;
            }
        }
        return null;
    }
    
    /**
     * 渲染标签页
     * @param {Object} tab - 标签页对象
     */
    renderTab(tab) {
        const tabList = document.getElementById('tabList');
        if (!tabList) return;
        
        const tabElement = document.createElement('button');
        tabElement.className = `tab-item ${tab.isActive ? 'active' : ''}`;
        tabElement.setAttribute('data-tab-id', tab.id);
        tabElement.setAttribute('title', tab.name);
        tabElement.setAttribute('role', 'tab');
        tabElement.setAttribute('aria-selected', tab.isActive ? 'true' : 'false');
        tabElement.setAttribute('aria-controls', `panel-${tab.id}`);
        tabElement.setAttribute('tabindex', tab.isActive ? '0' : '-1');
        
        let statusIndicator = '';
        if (tab.type === 'system') {
            statusIndicator = `<div class="tab-status ${tab.status}" aria-label="状态: ${tab.status}"></div>`;
        }
        
        tabElement.innerHTML = `
            <i class="tab-icon ${tab.icon}" aria-hidden="true"></i>
            <span class="tab-text">${tab.name}</span>
            ${statusIndicator}
            ${tab.isClosable ? '<button class="tab-close" title="关闭标签页" aria-label="关闭 ' + tab.name + '">&times;</button>' : ''}
            <div class="tab-tooltip">${tab.name}</div>
        `;
        
        tabList.appendChild(tabElement);
        
        // 绑定事件
        this.bindTabEvents(tabElement, tab);
    }
    
    /**
     * 绑定标签页事件
     * @param {HTMLElement} tabElement - 标签页元素
     * @param {Object} tab - 标签页对象
     */
    bindTabEvents(tabElement, tab) {
        // 点击激活标签页
        tabElement.addEventListener('click', (e) => {
            if (!e.target.classList.contains('tab-close')) {
                this.activateTab(tab.id);
            }
        });
        
        // 键盘导航
        tabElement.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    this.navigateToPreviousTab();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.navigateToNextTab();
                    break;
                case 'Home':
                    e.preventDefault();
                    this.navigateToFirstTab();
                    break;
                case 'End':
                    e.preventDefault();
                    this.navigateToLastTab();
                    break;
                case 'Delete':
                    if (tab.isClosable) {
                        e.preventDefault();
                        this.closeTab(tab.id);
                    }
                    break;
            }
        });
        
        // 关闭标签页
        const closeBtn = tabElement.querySelector('.tab-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeTab(tab.id);
            });
        }
        
        // 右键菜单
        tabElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showTabContextMenu(e, tab);
        });
        
        // 中键关闭
        tabElement.addEventListener('mousedown', (e) => {
            if (e.button === 1 && tab.isClosable) { // 中键
                e.preventDefault();
                this.closeTab(tab.id);
            }
        });
    }
    
    /**
     * 激活标签页（优化版本）
     * @param {string} tabId - 标签页ID
     */
    activateTab(tabId) {
        const tab = this.tabs.get(tabId);
        if (!tab) return;
        
        // 记录性能指标
        const activationStart = performance.now();
        
        // 清除之前活动标签页的非活动定时器
        if (this.activeTab && this.inactiveTabTimers.has(this.activeTab)) {
            clearTimeout(this.inactiveTabTimers.get(this.activeTab));
            this.inactiveTabTimers.delete(this.activeTab);
        }
        
        // 取消所有标签页的激活状态
        this.tabs.forEach((t, id) => {
            if (t.isActive) {
                t.isActive = false;
                t.lastActiveTime = Date.now();
                // 为非活动标签页设置卸载定时器
                this.scheduleTabUnload(id);
            }
            const element = document.querySelector(`[data-tab-id="${id}"]`);
            if (element) {
                element.classList.remove('active');
                element.setAttribute('aria-selected', 'false');
                element.setAttribute('tabindex', '-1');
            }
        });
        
        // 激活当前标签页
        tab.isActive = true;
        tab.lastActiveTime = Date.now();
        this.activeTab = tabId;
        
        const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
        if (tabElement) {
            tabElement.classList.add('active');
            tabElement.setAttribute('aria-selected', 'true');
            tabElement.setAttribute('tabindex', '0');
            tabElement.focus();
        }
        
        // 确保标签页已加载
        if (!tab.isLoaded && tab.type === 'system') {
            this.loadTabContent(tabId);
        }
        
        // 显示对应内容
        this.showTabContent(tab);
        
        // 更新全局状态
        if (tab.type === 'system') {
            window.PortalState.currentSystem = tab.system;
        } else {
            window.PortalState.currentSystem = null;
        }
        
        // 更新无障碍属性
        if (window.accessibilityManager) {
            window.accessibilityManager.updateTabAria(tabId);
        }
        
        // 记录激活时间
        const activationTime = performance.now() - activationStart;
        this.recordPerformanceMetric(tabId, 'activation', activationTime);
        
        // 触发事件
        document.dispatchEvent(new CustomEvent('tabActivated', {
            detail: { tab, activationTime }
        }));
        
        // 只在开发模式下输出日志
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('激活标签页（优化）:', tab, `激活耗时: ${activationTime.toFixed(2)}ms`);
        }
    }
    
    /**
     * 显示标签页内容
     * @param {Object} tab - 标签页对象
     */
    showTabContent(tab) {
        const welcomePanel = document.getElementById('welcomePanel');
        const iframeContainer = document.getElementById('iframeContainer');
        
        if (tab.type === 'welcome') {
            // 显示欢迎页面
            this.showWelcomePanel();
        } else if (tab.type === 'system') {
            // 显示iframe内容
            this.showIframeContent(tab);
        }
    }
    
    /**
     * 显示欢迎页面
     */
    showWelcomePanel() {
        const welcomePanel = document.getElementById('welcomePanel');
        const iframeContainer = document.getElementById('iframeContainer');
        
        if (welcomePanel) {
            welcomePanel.classList.add('active');
        }
        if (iframeContainer) {
            iframeContainer.classList.remove('active');
        }
    }
    
    /**
     * 显示iframe内容
     * @param {Object} tab - 标签页对象
     */
    showIframeContent(tab) {
        const welcomePanel = document.getElementById('welcomePanel');
        const iframeContainer = document.getElementById('iframeContainer');
        
        if (welcomePanel) {
            welcomePanel.classList.remove('active');
        }
        if (iframeContainer) {
            iframeContainer.classList.add('active');
            
            // 查找或创建iframe
            let iframe = iframeContainer.querySelector(`iframe[data-tab-id="${tab.id}"]`);
            if (!iframe) {
                iframe = this.createIframe(tab);
                iframeContainer.appendChild(iframe);
            }
            
            // 显示当前iframe，隐藏其他
            const allIframes = iframeContainer.querySelectorAll('iframe');
            allIframes.forEach(frame => {
                frame.style.display = frame === iframe ? 'block' : 'none';
            });
        }
    }
    
    /**
     * 创建iframe
     * @param {Object} tab - 标签页对象
     * @returns {HTMLIFrameElement} iframe元素
     */
    createIframe(tab) {
        const iframe = document.createElement('iframe');
        iframe.setAttribute('data-tab-id', tab.id);
        iframe.src = tab.url;
        iframe.style.display = 'none';
        
        // 绑定加载事件
        iframe.addEventListener('load', () => {
            this.onIframeLoad(tab, iframe);
        });
        
        iframe.addEventListener('error', () => {
            this.onIframeError(tab, iframe);
        });
        
        return iframe;
    }
    
    /**
     * 加载标签页内容（优化版本）
     * @param {string} tabId - 标签页ID
     */
    loadTabContent(tabId) {
        const tab = this.tabs.get(tabId);
        if (!tab || tab.type !== 'system' || tab.isLoaded) return;
        
        // 从懒加载队列中移除
        this.lazyLoadQueue.delete(tabId);
        
        // 更新状态为加载中
        this.updateTabStatus(tabId, 'loading');
        
        // 记录开始时间
        tab.loadStartTime = Date.now();
        tab.isLoaded = true;
        
        // 记录加载开始的性能指标
        this.recordPerformanceMetric(tabId, 'loadStart', Date.now());
        
        // 只在开发模式下输出日志
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('开始加载标签页内容（优化）:', tab);
        }
    }
    
    /**
     * iframe加载完成处理（优化版本）
     * @param {Object} tab - 标签页对象
     * @param {HTMLIFrameElement} iframe - iframe元素
     */
    onIframeLoad(tab, iframe) {
        // 计算加载时间
        if (tab.loadStartTime) {
            tab.loadTime = Date.now() - tab.loadStartTime;
            delete tab.loadStartTime;
        }
        
        // 更新状态
        this.updateTabStatus(tab.id, 'loaded');
        
        // 记录性能指标
        this.recordPerformanceMetric(tab.id, 'loadComplete', {
            loadTime: tab.loadTime,
            timestamp: Date.now()
        });
        
        // 优化iframe性能
        this.optimizeIframe(iframe);
        
        // 只在开发模式下输出日志
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('标签页加载完成（优化）:', tab, `加载耗时: ${tab.loadTime}ms`);
        }
        
        // 显示通知（仅对当前活动标签页）
        if (tab.isActive && window.PortalUtils) {
            window.PortalUtils.showNotification(
                `${tab.name} 加载完成 (${tab.loadTime}ms)`,
                'success',
                2000
            );
        }
        
        // 预加载下一个标签页
        this.preloadNextTab();
    }
    
    /**
     * iframe加载错误处理
     * @param {Object} tab - 标签页对象
     * @param {HTMLIFrameElement} iframe - iframe元素
     */
    onIframeError(tab, iframe) {
        // 更新状态
        this.updateTabStatus(tab.id, 'error');
        
        console.error('标签页加载失败:', tab);
        
        // 显示错误通知
        if (window.PortalUtils) {
            window.PortalUtils.showNotification(
                `${tab.name} 加载失败`,
                'error',
                5000
            );
        }
    }
    
    /**
     * 更新标签页状态
     * @param {string} tabId - 标签页ID
     * @param {string} status - 状态
     */
    updateTabStatus(tabId, status) {
        const tab = this.tabs.get(tabId);
        if (!tab) return;
        
        tab.status = status;
        
        const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
        if (tabElement) {
            const statusElement = tabElement.querySelector('.tab-status');
            if (statusElement) {
                statusElement.className = `tab-status ${status}`;
            }
        }
    }
    
    /**
     * 关闭标签页（优化版本，支持自动停止后端服务）
     * @param {string} tabId - 标签页ID
     * @param {boolean} confirmClose - 是否显示确认对话框
     */
    async closeTab(tabId, confirmClose = true) {
        const tab = this.tabs.get(tabId);
        if (!tab || !tab.isClosable) return;
        
        // 如果是系统标签页，询问是否同时停止后端服务
        if (tab.type === 'system' && tab.system && confirmClose) {
            const shouldStopService = await this.showCloseConfirmation(tab);
            if (shouldStopService === null) {
                // 用户取消关闭
                return;
            }
            
            if (shouldStopService) {
                // 停止后端服务
                await this.stopBackendService(tab.system, tab.name);
            }
        }
        
        // 清理定时器
        if (this.inactiveTabTimers.has(tabId)) {
            clearTimeout(this.inactiveTabTimers.get(tabId));
            this.inactiveTabTimers.delete(tabId);
        }
        
        // 从懒加载队列中移除
        this.lazyLoadQueue.delete(tabId);
        
        // 清理性能指标
        this.performanceMetrics.delete(tabId);
        
        // 移除DOM元素
        const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
        if (tabElement) {
            tabElement.remove();
        }
        
        // 移除iframe并清理内存
        const iframe = document.querySelector(`iframe[data-tab-id="${tabId}"]`);
        if (iframe) {
            // 清理iframe内容以释放内存
            iframe.src = 'about:blank';
            setTimeout(() => iframe.remove(), 100);
        }
        
        // 从Map中删除
        this.tabs.delete(tabId);
        
        // 如果关闭的是当前活动标签页，需要激活其他标签页
        if (this.activeTab === tabId) {
            this.activateNextTab();
        }
        
        // 只在开发模式下输出日志
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('关闭标签页（优化）:', tab);
        }
        
        // 触发内存清理
        this.requestMemoryCleanup();
    }
    
    /**
     * 显示关闭确认对话框
     * @param {Object} tab - 标签页对象
     * @returns {Promise<boolean|null>} - true: 停止服务并关闭, false: 仅关闭页面, null: 取消
     */
    async showCloseConfirmation(tab) {
        return new Promise((resolve) => {
            // 创建确认对话框
            const modal = document.createElement('div');
            modal.className = 'close-confirmation-modal';
            modal.innerHTML = `
                <div class="modal-overlay">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3><i class="${tab.icon}"></i> 关闭 ${tab.name}</h3>
                        </div>
                        <div class="modal-body">
                            <p>您正在关闭 <strong>${tab.name}</strong> 页面。</p>
                            <p>是否同时停止后端服务进程？</p>
                            <div class="warning-note">
                                <i class="fas fa-info-circle"></i>
                                停止服务将释放系统资源，但需要重新启动才能再次使用。
                            </div>
                        </div>
                        <div class="modal-actions">
                            <button class="btn btn-secondary" data-action="cancel">
                                <i class="fas fa-times"></i> 取消
                            </button>
                            <button class="btn btn-warning" data-action="close-only">
                                <i class="fas fa-window-close"></i> 仅关闭页面
                            </button>
                            <button class="btn btn-danger" data-action="stop-and-close">
                                <i class="fas fa-stop"></i> 停止服务并关闭
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            // 添加样式
            if (!document.getElementById('close-confirmation-styles')) {
                const styles = document.createElement('style');
                styles.id = 'close-confirmation-styles';
                styles.textContent = `
                    .close-confirmation-modal {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        z-index: 10000;
                    }
                    
                    .close-confirmation-modal .modal-overlay {
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0, 0, 0, 0.5);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        animation: fadeIn 0.2s ease-out;
                    }
                    
                    .close-confirmation-modal .modal-content {
                        background: white;
                        border-radius: 8px;
                        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                        max-width: 500px;
                        width: 90%;
                        animation: slideIn 0.3s ease-out;
                    }
                    
                    .close-confirmation-modal .modal-header {
                        padding: 20px 20px 0;
                        border-bottom: 1px solid #eee;
                        margin-bottom: 20px;
                    }
                    
                    .close-confirmation-modal .modal-header h3 {
                        margin: 0;
                        color: #333;
                        font-size: 18px;
                    }
                    
                    .close-confirmation-modal .modal-body {
                        padding: 0 20px 20px;
                    }
                    
                    .close-confirmation-modal .modal-body p {
                        margin: 0 0 15px;
                        color: #666;
                        line-height: 1.5;
                    }
                    
                    .close-confirmation-modal .warning-note {
                        background: #fff3cd;
                        border: 1px solid #ffeaa7;
                        border-radius: 4px;
                        padding: 12px;
                        margin: 15px 0;
                        color: #856404;
                        font-size: 14px;
                    }
                    
                    .close-confirmation-modal .warning-note i {
                        margin-right: 8px;
                        color: #f39c12;
                    }
                    
                    .close-confirmation-modal .modal-actions {
                        padding: 20px;
                        border-top: 1px solid #eee;
                        display: flex;
                        gap: 10px;
                        justify-content: flex-end;
                    }
                    
                    .close-confirmation-modal .btn {
                        padding: 8px 16px;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                        transition: all 0.2s;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    }
                    
                    .close-confirmation-modal .btn:hover {
                        transform: translateY(-1px);
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                    }
                    
                    .close-confirmation-modal .btn-secondary {
                        background: #6c757d;
                        color: white;
                    }
                    
                    .close-confirmation-modal .btn-warning {
                        background: #ffc107;
                        color: #212529;
                    }
                    
                    .close-confirmation-modal .btn-danger {
                        background: #dc3545;
                        color: white;
                    }
                    
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    
                    @keyframes slideIn {
                        from { 
                            opacity: 0;
                            transform: translateY(-20px) scale(0.95);
                        }
                        to { 
                            opacity: 1;
                            transform: translateY(0) scale(1);
                        }
                    }
                `;
                document.head.appendChild(styles);
            }
            
            // 添加到页面
            document.body.appendChild(modal);
            
            // 绑定事件
            modal.addEventListener('click', (e) => {
                const action = e.target.getAttribute('data-action');
                if (action) {
                    modal.remove();
                    switch (action) {
                        case 'cancel':
                            resolve(null);
                            break;
                        case 'close-only':
                            resolve(false);
                            break;
                        case 'stop-and-close':
                            resolve(true);
                            break;
                    }
                } else if (e.target === modal.querySelector('.modal-overlay')) {
                    // 点击遮罩层关闭
                    modal.remove();
                    resolve(null);
                }
            });
            
            // ESC键关闭
            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    modal.remove();
                    document.removeEventListener('keydown', handleEsc);
                    resolve(null);
                }
            };
            document.addEventListener('keydown', handleEsc);
        });
    }
    
    /**
     * 停止后端服务
     * @param {string} systemName - 系统名称
     * @param {string} displayName - 显示名称
     */
    async stopBackendService(systemName, displayName) {
        try {
            // 显示停止中的提示
            this.showNotification(`正在停止 ${displayName} 服务...`, 'info');
            
            const response = await fetch(`/api/services/${systemName}/stop`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification(`${displayName} 服务已成功停止`, 'success');
                console.log(`服务 ${systemName} 已停止:`, result.message);
                
                // 触发服务状态更新
                if (window.serviceManager) {
                    window.serviceManager.checkAllServices();
                }
            } else {
                this.showNotification(`停止 ${displayName} 服务失败: ${result.message}`, 'error');
                console.error(`停止服务 ${systemName} 失败:`, result.message);
            }
        } catch (error) {
            this.showNotification(`停止 ${displayName} 服务时发生错误`, 'error');
            console.error(`停止服务 ${systemName} 时发生错误:`, error);
        }
    }
    
    /**
     * 显示通知消息
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型 (success, error, warning, info)
     */
    showNotification(message, type = 'info') {
        // 如果ServiceManager存在，使用其通知方法
        if (window.serviceManager && typeof window.serviceManager.showNotification === 'function') {
            window.serviceManager.showNotification(message, type);
            return;
        }
        
        // 否则使用简单的通知实现
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // 添加样式
        if (!document.getElementById('notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 12px 20px;
                    border-radius: 4px;
                    color: white;
                    font-size: 14px;
                    z-index: 10001;
                    animation: slideInRight 0.3s ease-out;
                    max-width: 300px;
                    word-wrap: break-word;
                }
                
                .notification-success { background: #28a745; }
                .notification-error { background: #dc3545; }
                .notification-warning { background: #ffc107; color: #212529; }
                .notification-info { background: #17a2b8; }
                
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(notification);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }
    
    /**
     * 激活下一个标签页
     */
    activateNextTab() {
        const tabIds = Array.from(this.tabs.keys());
        
        if (tabIds.length > 0) {
            // 优先激活欢迎页面，如果没有则激活最后一个
            const welcomeTab = tabIds.find(id => this.tabs.get(id).type === 'welcome');
            const targetTabId = welcomeTab || tabIds[tabIds.length - 1];
            this.activateTab(targetTabId);
        }
    }
    
    /**
     * 刷新当前标签页
     */
    refreshCurrentTab() {
        if (!this.activeTab) return;
        
        const tab = this.tabs.get(this.activeTab);
        if (!tab || tab.type !== 'system') return;
        
        const iframe = document.querySelector(`iframe[data-tab-id="${this.activeTab}"]`);
        if (iframe) {
            this.updateTabStatus(this.activeTab, 'loading');
            tab.loadStartTime = Date.now();
            iframe.src = iframe.src; // 重新加载
            
            if (window.PortalUtils) {
                window.PortalUtils.showNotification(
                    `正在刷新 ${tab.name}`,
                    'info',
                    2000
                );
            }
        }
    }
    
    /**
     * 显示标签页右键菜单
     * @param {MouseEvent} event - 鼠标事件
     * @param {Object} tab - 标签页对象
     */
    showTabContextMenu(event, tab) {
        // 移除现有菜单
        const existingMenu = document.querySelector('.tab-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        // 创建菜单
        const menu = document.createElement('div');
        menu.className = 'tab-context-menu active';
        menu.style.left = `${event.clientX}px`;
        menu.style.top = `${event.clientY}px`;
        
        const menuItems = [];
        
        if (tab.type === 'system') {
            menuItems.push(
                { text: '刷新', icon: 'fas fa-sync-alt', action: () => this.refreshTab(tab.id) },
                { text: '在新标签页中打开', icon: 'fas fa-external-link-alt', action: () => this.duplicateTab(tab.id) }
            );
            
            if (tab.isClosable) {
                menuItems.push(
                    { divider: true },
                    { text: '关闭标签页', icon: 'fas fa-times', action: () => this.closeTab(tab.id) },
                    { text: '关闭其他标签页', icon: 'fas fa-times-circle', action: () => this.closeOtherTabs(tab.id) }
                );
            }
        }
        
        menu.innerHTML = menuItems.map(item => {
            if (item.divider) {
                return '<div class="tab-context-divider"></div>';
            }
            return `
                <div class="tab-context-item" data-action="${item.action}">
                    <i class="${item.icon}"></i>
                    <span>${item.text}</span>
                </div>
            `;
        }).join('');
        
        document.body.appendChild(menu);
        
        // 绑定菜单事件
        menu.addEventListener('click', (e) => {
            const item = e.target.closest('.tab-context-item');
            if (item) {
                const actionIndex = Array.from(menu.querySelectorAll('.tab-context-item')).indexOf(item);
                const menuItem = menuItems.filter(item => !item.divider)[actionIndex];
                if (menuItem && menuItem.action) {
                    menuItem.action();
                }
            }
            menu.remove();
        });
        
        // 点击其他地方关闭菜单
        setTimeout(() => {
            document.addEventListener('click', function closeMenu() {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            });
        }, 0);
    }
    
    /**
     * 刷新指定标签页
     * @param {string} tabId - 标签页ID
     */
    refreshTab(tabId) {
        const currentActive = this.activeTab;
        this.activateTab(tabId);
        this.refreshCurrentTab();
        if (currentActive !== tabId) {
            this.activateTab(currentActive);
        }
    }
    
    /**
     * 复制标签页
     * @param {string} tabId - 标签页ID
     */
    duplicateTab(tabId) {
        const tab = this.tabs.get(tabId);
        if (!tab || tab.type !== 'system') return;
        
        this.openTab(tab.system);
    }
    
    /**
     * 关闭其他标签页
     * @param {string} keepTabId - 保留的标签页ID
     */
    closeOtherTabs(keepTabId) {
        const tabsToClose = Array.from(this.tabs.keys()).filter(id => 
            id !== keepTabId && this.tabs.get(id).isClosable
        );
        
        tabsToClose.forEach(tabId => this.closeTab(tabId));
    }
    
    /**
     * 获取系统图标
     * @param {string} systemName - 系统名称
     * @returns {string} 图标类名
     */
    getSystemIcon(systemName) {
        const iconMap = {
            writing: 'fas fa-edit',
            qa_sys: 'fas fa-question-circle',
            case2pg: 'fas fa-database',
            censor: 'fas fa-search'
        };
        return iconMap[systemName] || 'fas fa-cog';
    }
    
    /**
     * 绑定全局事件
     */
    bindEvents() {
        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            // Ctrl+W 关闭当前标签页
            if (e.ctrlKey && e.key === 'w') {
                e.preventDefault();
                if (this.activeTab) {
                    const tab = this.tabs.get(this.activeTab);
                    if (tab && tab.isClosable) {
                        this.closeTab(this.activeTab);
                    }
                }
            }
            
            // Ctrl+R 刷新当前标签页
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                this.refreshCurrentTab();
            }
            
            // Ctrl+Tab 切换到下一个标签页
            if (e.ctrlKey && e.key === 'Tab') {
                e.preventDefault();
                this.switchToNextTab();
            }
        });
    }
    
    /**
     * 切换到下一个标签页
     */
    switchToNextTab() {
        const tabIds = Array.from(this.tabs.keys());
        const currentIndex = tabIds.indexOf(this.activeTab);
        const nextIndex = (currentIndex + 1) % tabIds.length;
        this.activateTab(tabIds[nextIndex]);
    }
    
    /**
     * 导航到上一个标签页
     */
    navigateToPreviousTab() {
        const tabIds = Array.from(this.tabs.keys());
        const currentIndex = tabIds.indexOf(this.activeTab);
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : tabIds.length - 1;
        this.activateTab(tabIds[prevIndex]);
    }
    
    /**
     * 导航到下一个标签页
     */
    navigateToNextTab() {
        this.switchToNextTab();
    }
    
    /**
     * 导航到第一个标签页
     */
    navigateToFirstTab() {
        const tabIds = Array.from(this.tabs.keys());
        if (tabIds.length > 0) {
            this.activateTab(tabIds[0]);
        }
    }
    
    /**
     * 导航到最后一个标签页
     */
    navigateToLastTab() {
        const tabIds = Array.from(this.tabs.keys());
        if (tabIds.length > 0) {
            this.activateTab(tabIds[tabIds.length - 1]);
        }
    }
    
    /**
     * 获取所有标签页信息
     * @returns {Array} 标签页列表
     */
    getAllTabs() {
        return Array.from(this.tabs.values());
    }
    
    /**
     * 获取当前活动标签页
     * @returns {Object|null} 当前标签页
     */
    getCurrentTab() {
        return this.activeTab ? this.tabs.get(this.activeTab) : null;
    }
    
    // ========== 性能优化相关方法 ==========
    
    /**
     * 调度标签页加载
     * @param {string} tabId - 标签页ID
     */
    scheduleTabLoad(tabId) {
        // 使用requestIdleCallback在浏览器空闲时加载
        if (window.requestIdleCallback) {
            window.requestIdleCallback(() => {
                if (this.lazyLoadQueue.has(tabId)) {
                    this.loadTabContent(tabId);
                }
            }, { timeout: 5000 });
        } else {
            // 降级方案
            setTimeout(() => {
                if (this.lazyLoadQueue.has(tabId)) {
                    this.loadTabContent(tabId);
                }
            }, 1000);
        }
    }
    
    /**
     * 调度标签页卸载
     * @param {string} tabId - 标签页ID
     */
    scheduleTabUnload(tabId) {
        const timer = setTimeout(() => {
            this.unloadInactiveTab(tabId);
        }, this.inactiveTabTimeout);
        
        this.inactiveTabTimers.set(tabId, timer);
    }
    
    /**
     * 卸载非活动标签页
     * @param {string} tabId - 标签页ID
     */
    unloadInactiveTab(tabId) {
        const tab = this.tabs.get(tabId);
        if (!tab || tab.isActive || tab.type !== 'system') return;
        
        const iframe = document.querySelector(`iframe[data-tab-id="${tabId}"]`);
        if (iframe) {
            // 保存当前状态
            tab.savedState = {
                scrollPosition: this.getIframeScrollPosition(iframe),
                url: iframe.src
            };
            
            // 卸载iframe内容
            iframe.src = 'about:blank';
            tab.isLoaded = false;
            this.updateTabStatus(tabId, 'unloaded');
            
            // 只在开发模式下输出日志
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log('卸载非活动标签页:', tab);
            }
        }
    }
    
    /**
     * 关闭最旧的非活动标签页
     */
    closeOldestInactiveTab() {
        let oldestTab = null;
        let oldestTime = Date.now();
        
        for (const tab of this.tabs.values()) {
            if (tab.isClosable && !tab.isActive && tab.lastActiveTime < oldestTime) {
                oldestTime = tab.lastActiveTime;
                oldestTab = tab;
            }
        }
        
        if (oldestTab) {
            this.closeTab(oldestTab.id);
        }
    }
    
    /**
     * 检查内存使用情况
     */
    checkMemoryUsage() {
        if (!('memory' in performance)) return;
        
        const memory = performance.memory;
        const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        
        // 只在开发模式下输出日志
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('内存使用情况:', {
                used: Math.round(memory.usedJSHeapSize / 1024 / 1024) + 'MB',
                total: Math.round(memory.jsHeapSizeLimit / 1024 / 1024) + 'MB',
                ratio: Math.round(usageRatio * 100) + '%'
            });
        }
        
        // 如果内存使用超过80%，主动清理
        if (usageRatio > 0.8) {
            this.performMemoryCleanup();
        }
    }
    
    /**
     * 执行内存清理
     */
    performMemoryCleanup() {
        console.log('执行内存清理...');
        
        // 卸载所有非活动标签页
        for (const [tabId, tab] of this.tabs.entries()) {
            if (!tab.isActive && tab.type === 'system' && tab.isLoaded) {
                this.unloadInactiveTab(tabId);
            }
        }
        
        // 清理性能指标历史数据
        this.cleanupPerformanceMetrics();
        
        // 请求垃圾回收（如果可用）
        this.requestMemoryCleanup();
    }
    
    /**
     * 请求内存清理
     */
    requestMemoryCleanup() {
        if (window.gc) {
            window.gc();
        }
    }
    
    /**
     * 优化iframe性能
     * @param {HTMLIFrameElement} iframe - iframe元素
     */
    optimizeIframe(iframe) {
        // 设置iframe的loading属性
        iframe.loading = 'lazy';
        
        // 添加性能优化属性
        iframe.setAttribute('importance', 'low');
        
        // 监听iframe的资源加载
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (iframeDoc) {
                // 优化图片加载
                const images = iframeDoc.querySelectorAll('img');
                images.forEach(img => {
                    if (!img.loading) {
                        img.loading = 'lazy';
                    }
                });
            }
        } catch (e) {
            // 跨域限制，忽略错误
        }
    }
    
    /**
     * 设置预加载优化
     */
    setupPreloadOptimization() {
        // 预加载常用系统资源
        const commonSystems = ['writing'];
        commonSystems.forEach(systemName => {
            const systemConfig = window.PortalConfig?.systems?.[systemName];
            if (systemConfig) {
                this.preloadSystemResources(systemConfig.path);
            }
        });
    }
    
    /**
     * 预加载系统资源
     * @param {string} url - 系统URL
     */
    preloadSystemResources(url) {
        // 创建预加载链接
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        document.head.appendChild(link);
    }
    
    /**
     * 预加载下一个标签页
     */
    preloadNextTab() {
        if (this.lazyLoadQueue.size > 0) {
            const nextTabId = this.lazyLoadQueue.values().next().value;
            if (nextTabId) {
                this.scheduleTabLoad(nextTabId);
            }
        }
    }
    
    /**
     * 根据需要加载标签页
     * @param {string} tabId - 标签页ID
     */
    loadTabIfNeeded(tabId) {
        const tab = this.tabs.get(tabId);
        if (tab && !tab.isLoaded && this.lazyLoadQueue.has(tabId)) {
            this.loadTabContent(tabId);
        }
    }
    
    /**
     * 获取iframe滚动位置
     * @param {HTMLIFrameElement} iframe - iframe元素
     * @returns {Object} 滚动位置
     */
    getIframeScrollPosition(iframe) {
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            return {
                x: iframeDoc.documentElement.scrollLeft || iframeDoc.body.scrollLeft,
                y: iframeDoc.documentElement.scrollTop || iframeDoc.body.scrollTop
            };
        } catch (e) {
            return { x: 0, y: 0 };
        }
    }
    
    /**
     * 记录性能指标
     * @param {string} tabId - 标签页ID
     * @param {string} metric - 指标名称
     * @param {*} value - 指标值
     */
    recordPerformanceMetric(tabId, metric, value) {
        if (!this.performanceMetrics.has(tabId)) {
            this.performanceMetrics.set(tabId, {});
        }
        
        const metrics = this.performanceMetrics.get(tabId);
        if (!metrics[metric]) {
            metrics[metric] = [];
        }
        
        metrics[metric].push({
            value,
            timestamp: Date.now()
        });
        
        // 限制历史数据数量
        if (metrics[metric].length > 10) {
            metrics[metric] = metrics[metric].slice(-10);
        }
    }
    
    /**
     * 清理性能指标
     */
    cleanupPerformanceMetrics() {
        const cutoffTime = Date.now() - 300000; // 5分钟前
        
        for (const [tabId, metrics] of this.performanceMetrics.entries()) {
            for (const [metricName, values] of Object.entries(metrics)) {
                metrics[metricName] = values.filter(item => item.timestamp > cutoffTime);
            }
        }
    }
    
    /**
     * 获取性能报告
     * @returns {Object} 性能报告
     */
    getPerformanceReport() {
        const report = {
            totalTabs: this.tabs.size,
            activeTabs: Array.from(this.tabs.values()).filter(tab => tab.isActive).length,
            loadedTabs: Array.from(this.tabs.values()).filter(tab => tab.isLoaded).length,
            lazyLoadQueue: this.lazyLoadQueue.size,
            memoryUsage: null
        };
        
        if ('memory' in performance) {
            report.memoryUsage = {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            };
        }
        
        return report;
    }
    
    /**
     * 销毁标签页管理器
     */
    destroy() {
        // 清理所有定时器
        for (const timer of this.inactiveTabTimers.values()) {
            clearTimeout(timer);
        }
        this.inactiveTabTimers.clear();
        
        // 断开交叉观察器
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
            this.intersectionObserver = null;
        }
        
        // 清理所有标签页
        for (const [tabId, tab] of this.tabs.entries()) {
            if (tab.iframe && tab.iframe.parentNode) {
                tab.iframe.parentNode.removeChild(tab.iframe);
            }
        }
        
        // 清理数据结构
        this.tabs.clear();
        this.lazyLoadQueue.clear();
        this.performanceMetrics.clear();
        this.activeTab = null;
        
        // 只在开发模式下输出日志
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('标签页管理器已销毁');
        }
    }
}

// 导出TabManager类
window.TabManager = TabManager;