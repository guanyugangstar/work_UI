/**
 * 无障碍访问性管理器
 * 负责键盘导航、ARIA状态更新、屏幕阅读器支持等功能
 */
class AccessibilityManager {
    constructor() {
        this.focusIndex = 0;
        this.lastFocusedElement = null;
        this.lastAnnouncedStatus = {}; // 记录最后公告的状态
        this.lastAnnouncements = new Map(); // 记录最近的公告和时间
        this.announcementCooldown = 2000; // 相同公告的冷却时间（毫秒）
        
        this.currentFocusIndex = 0;
        this.focusableElements = [];
        this.announcements = [];
        this.ariaLiveRegion = null;
        this.gridRows = 0;
        this.gridCols = 0;
        this.currentGridPosition = { row: 0, col: 0 };
        
        // 绑定方法
        this.handleKeyboardNavigation = this.handleKeyboardNavigation.bind(this);
        this.handleGridNavigation = this.handleGridNavigation.bind(this);
        this.handleTabNavigation = this.handleTabNavigation.bind(this);
        this.handleEscape = this.handleEscape.bind(this);
        this.focusFirst = this.focusFirst.bind(this);
        this.focusLast = this.focusLast.bind(this);
        
        this.init();
    }
    
    /**
     * 初始化无障碍功能
     */
    init() {
        this.setupKeyboardNavigation();
        this.setupAriaLiveRegion();
        this.setupFocusManagement();
        this.setupGridNavigation();
        this.setupScreenReaderSupport();
        
        console.log('无障碍访问性管理器已初始化');
    }
    
    /**
     * 设置键盘导航
     */
    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardNavigation(e);
        });
        
        // 监听焦点变化
        document.addEventListener('focusin', (e) => {
            this.updateFocusIndex(e.target);
        });
    }
    
    /**
     * 处理键盘导航
     * @param {KeyboardEvent} e - 键盘事件
     */
    handleKeyboardNavigation(e) {
        const activeElement = document.activeElement;
        
        // 检查是否在系统网格中
        if (activeElement && activeElement.closest('.system-grid')) {
            this.handleGridNavigation(e);
            return;
        }
        
        // 标签页导航
        if (activeElement && activeElement.closest('.tab-navigation')) {
            this.handleTabNavigation(e);
            return;
        }
        
        // 通用导航
        switch (e.key) {
            case 'Tab':
                // Tab键由浏览器默认处理
                break;
            case 'Enter':
            case ' ':
                if (activeElement && (activeElement.classList.contains('system-card') || 
                    activeElement.classList.contains('btn'))) {
                    e.preventDefault();
                    activeElement.click();
                }
                break;
            case 'Escape':
                this.handleEscape();
                break;
            case 'Home':
                e.preventDefault();
                this.focusFirst();
                break;
            case 'End':
                e.preventDefault();
                this.focusLast();
                break;
        }
    }
    
    /**
     * 处理网格导航
     * @param {KeyboardEvent} e - 键盘事件
     */
    handleGridNavigation(e) {
        const systemCards = document.querySelectorAll('.system-card');
        if (systemCards.length === 0) return;
        
        const currentCard = document.activeElement;
        const currentIndex = Array.from(systemCards).indexOf(currentCard);
        
        if (currentIndex === -1) return;
        
        let newIndex = currentIndex;
        
        switch (e.key) {
            case 'ArrowRight':
                e.preventDefault();
                newIndex = Math.min(currentIndex + 1, systemCards.length - 1);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                newIndex = Math.max(currentIndex - 1, 0);
                break;
            case 'ArrowDown':
                e.preventDefault();
                // 假设每行2个卡片
                newIndex = Math.min(currentIndex + 2, systemCards.length - 1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                newIndex = Math.max(currentIndex - 2, 0);
                break;
            case 'Home':
                e.preventDefault();
                newIndex = 0;
                break;
            case 'End':
                e.preventDefault();
                newIndex = systemCards.length - 1;
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                currentCard.click();
                return;
        }
        
        if (newIndex !== currentIndex) {
            systemCards[newIndex].focus();
            this.announceCardFocus(systemCards[newIndex]);
        }
    }
    
    /**
     * 处理标签页导航
     * @param {KeyboardEvent} e - 键盘事件
     */
    handleTabNavigation(e) {
        const tabs = document.querySelectorAll('[role="tab"]');
        if (tabs.length === 0) return;
        
        const currentTab = document.activeElement;
        const currentIndex = Array.from(tabs).indexOf(currentTab);
        
        if (currentIndex === -1) return;
        
        let newIndex = currentIndex;
        
        switch (e.key) {
            case 'ArrowRight':
                e.preventDefault();
                newIndex = (currentIndex + 1) % tabs.length;
                break;
            case 'ArrowLeft':
                e.preventDefault();
                newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                break;
            case 'Home':
                e.preventDefault();
                newIndex = 0;
                break;
            case 'End':
                e.preventDefault();
                newIndex = tabs.length - 1;
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                currentTab.click();
                return;
        }
        
        if (newIndex !== currentIndex) {
            // 更新tabindex
            tabs.forEach((tab, index) => {
                tab.setAttribute('tabindex', index === newIndex ? '0' : '-1');
            });
            
            tabs[newIndex].focus();
        }
    }
    
    /**
     * 处理Escape键
     */
    handleEscape() {
        // 关闭模态框
        const modal = document.querySelector('.modal.show');
        if (modal) {
            const closeBtn = modal.querySelector('.close');
            if (closeBtn) {
                closeBtn.click();
            }
            return;
        }
        
        // 返回到主要内容
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.focus();
        }
    }
    
    /**
     * 聚焦到第一个可聚焦元素
     */
    focusFirst() {
        const firstFocusable = this.getFocusableElements()[0];
        if (firstFocusable) {
            firstFocusable.focus();
        }
    }
    
    /**
     * 聚焦到最后一个可聚焦元素
     */
    focusLast() {
        const focusableElements = this.getFocusableElements();
        const lastFocusable = focusableElements[focusableElements.length - 1];
        if (lastFocusable) {
            lastFocusable.focus();
        }
    }
    
    /**
     * 获取所有可聚焦元素
     * @returns {NodeList} 可聚焦元素列表
     */
    getFocusableElements() {
        return document.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), ' +
            'select:not([disabled]), textarea:not([disabled]), ' +
            '[tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
        );
    }
    
    /**
     * 设置ARIA实时区域
     */
    setupAriaLiveRegion() {
        // 创建屏幕阅读器公告区域
        const liveRegion = document.createElement('div');
        liveRegion.id = 'aria-live-region';
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.className = 'sr-only';
        document.body.appendChild(liveRegion);
        
        // 创建紧急公告区域
        const assertiveRegion = document.createElement('div');
        assertiveRegion.id = 'aria-assertive-region';
        assertiveRegion.setAttribute('aria-live', 'assertive');
        assertiveRegion.setAttribute('aria-atomic', 'true');
        assertiveRegion.className = 'sr-only';
        document.body.appendChild(assertiveRegion);
    }
    
    /**
     * 设置焦点管理
     */
    setupFocusManagement() {
        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.restoreFocus();
            }
        });
        
        // 监听窗口焦点
        window.addEventListener('focus', () => {
            this.restoreFocus();
        });
    }
    
    /**
     * 设置网格导航
     */
    setupGridNavigation() {
        const systemGrid = document.querySelector('.system-grid');
        if (systemGrid) {
            systemGrid.setAttribute('role', 'grid');
            
            const cards = systemGrid.querySelectorAll('.system-card');
            cards.forEach((card, index) => {
                card.setAttribute('role', 'gridcell');
                card.setAttribute('tabindex', index === 0 ? '0' : '-1');
            });
        }
    }
    
    /**
     * 设置屏幕阅读器支持
     */
    setupScreenReaderSupport() {
        // 为动态内容添加描述
        this.addDynamicDescriptions();
        
        // 监听状态变化
        this.observeStatusChanges();
        
        // 设置页面标题更新
        this.setupPageTitleUpdates();
    }
    
    /**
     * 添加动态描述
     */
    addDynamicDescriptions() {
        // 为系统卡片添加详细描述
        const systemCards = document.querySelectorAll('.system-card');
        systemCards.forEach(card => {
            const title = card.querySelector('h3').textContent;
            const desc = card.querySelector('p').textContent;
            const status = card.querySelector('.card-status span').textContent;
            
            card.setAttribute('aria-label', `${title}，${desc}，当前状态：${status}`);
        });
    }
    
    /**
     * 监听状态变化
     */
    observeStatusChanges() {
        // 监听系统状态变化
        const statusElements = document.querySelectorAll('[role="status"]');
        statusElements.forEach(element => {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    if (mutation.type === 'childList' || mutation.type === 'characterData') {
                        // 检查是否是系统卡片状态更新，避免与updateSystemCardStatus重复
                        const isSystemCard = element.closest('.system-card');
                        if (!isSystemCard) {
                            this.announceStatusChange(element);
                        }
                    }
                });
            });
            
            observer.observe(element, {
                childList: true,
                characterData: true,
                subtree: true
            });
        });
    }
    
    /**
     * 设置页面标题更新
     */
    setupPageTitleUpdates() {
        // 监听标签页切换
        document.addEventListener('tabActivated', (e) => {
            const tab = e.detail.tab;
            if (tab) {
                document.title = `${tab.name} - 统一门户系统`;
                this.announce(`已切换到${tab.name}`);
            }
        });
    }
    
    /**
     * 公告消息给屏幕阅读器
     * @param {string} message - 要公告的消息
     * @param {string} priority - 优先级 ('polite' 或 'assertive')
     */
    announce(message, priority = 'polite') {
        // 检查是否为重复公告
        const now = Date.now();
        const lastTime = this.lastAnnouncements.get(message);
        
        if (lastTime && (now - lastTime) < this.announcementCooldown) {
            // 在冷却时间内，跳过重复公告
            return;
        }
        
        // 记录公告时间
        this.lastAnnouncements.set(message, now);
        
        // 清理过期的公告记录（保持Map大小合理）
        if (this.lastAnnouncements.size > 50) {
            const cutoffTime = now - this.announcementCooldown * 2;
            for (const [msg, time] of this.lastAnnouncements.entries()) {
                if (time < cutoffTime) {
                    this.lastAnnouncements.delete(msg);
                }
            }
        }
        
        const regionId = priority === 'assertive' ? 'aria-assertive-region' : 'aria-live-region';
        const region = document.getElementById(regionId);
        
        if (region) {
            // 清空区域然后添加新消息
            region.textContent = '';
            setTimeout(() => {
                region.textContent = message;
            }, 100);
        }
        
        // 只在开发模式下输出到控制台，减少生产环境的噪音
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log(`屏幕阅读器公告 (${priority}):`, message);
        }
    }
    
    /**
     * 公告卡片焦点
     * @param {Element} card - 卡片元素
     */
    announceCardFocus(card) {
        const title = card.querySelector('h3').textContent;
        const status = card.querySelector('.card-status span').textContent;
        this.announce(`${title}，状态：${status}`);
    }
    
    /**
     * 公告状态变化
     * @param {Element} element - 状态元素
     */
    announceStatusChange(element) {
        const label = element.getAttribute('aria-labelledby');
        const labelElement = label ? document.getElementById(label) : null;
        const labelText = labelElement ? labelElement.textContent : '状态';
        const statusText = element.textContent;
        
        this.announce(`${labelText}已更新为：${statusText}`);
    }
    
    /**
     * 更新焦点索引
     * @param {Element} element - 当前聚焦的元素
     */
    updateFocusIndex(element) {
        const focusableElements = this.getFocusableElements();
        this.currentFocusIndex = Array.from(focusableElements).indexOf(element);
    }
    
    /**
     * 恢复焦点
     */
    restoreFocus() {
        const focusableElements = this.getFocusableElements();
        if (focusableElements[this.currentFocusIndex]) {
            focusableElements[this.currentFocusIndex].focus();
        } else if (focusableElements.length > 0) {
            focusableElements[0].focus();
        }
    }
    
    /**
     * 更新标签页ARIA属性
     * @param {string} activeTabId - 活动标签页ID
     */
    updateTabAria(activeTabId) {
        const tabs = document.querySelectorAll('[role="tab"]');
        const panels = document.querySelectorAll('[role="tabpanel"]');
        
        tabs.forEach(tab => {
            const isActive = tab.getAttribute('data-tab-id') === activeTabId;
            tab.setAttribute('aria-selected', isActive.toString());
            tab.setAttribute('tabindex', isActive ? '0' : '-1');
        });
        
        panels.forEach(panel => {
            const isActive = panel.id === activeTabId + '-panel' || 
                           (activeTabId === 'welcome' && panel.id === 'welcomePanel');
            panel.setAttribute('aria-hidden', (!isActive).toString());
        });
    }
    
    /**
     * 更新系统卡片状态
     * @param {string} systemName - 系统名称
     * @param {string} status - 状态
     * @param {string} displayName - 显示名称
     */
    updateSystemCardStatus(systemName, status, displayName) {
        // 防止重复公告相同状态
        const statusKey = `${systemName}_status`;
        const currentTime = Date.now();
        
        // 检查是否是相同状态的重复调用
        if (this.lastAnnouncedStatus && this.lastAnnouncedStatus[statusKey] === status) {
            return; // 状态未变化，不进行公告
        }
        
        // 检查是否在冷却时间内
        const lastAnnounceTime = this.lastAnnouncements.get(statusKey);
        if (lastAnnounceTime && (currentTime - lastAnnounceTime) < this.announcementCooldown) {
            return; // 在冷却时间内，不进行公告
        }
        
        // 记录最后公告的状态和时间
        if (!this.lastAnnouncedStatus) {
            this.lastAnnouncedStatus = {};
        }
        this.lastAnnouncedStatus[statusKey] = status;
        this.lastAnnouncements.set(statusKey, currentTime);
        
        // 只公告重要的状态变化
        if (this.shouldAnnounceStatusChange(status)) {
            const statusText = this.getStatusText(status);
            this.announce(`状态已更新为： ${statusText}`);
        }
    }

    /**
     * 判断是否应该公告状态变化
     * @param {string} status - 状态
     * @returns {boolean} 是否应该公告
     */
    shouldAnnounceStatusChange(status) {
        // 只公告重要的状态变化
        const importantStatuses = ['running', 'stopped', 'error', 'healthy', '服务已启动', '服务停止', '运行正常'];
        return importantStatuses.includes(status);
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
            'down': '服务停止',
            'timeout': '连接超时',
            'error': '检查失败',
            'unknown': '状态未知',
            'running': '服务运行中',
            'stopped': '服务已停止'
        };
        return statusMap[status] || status || '未知状态';
    }
    
    /**
     * 公告通知消息
     * @param {string} message - 通知消息
     * @param {string} type - 通知类型
     */
    announceNotification(message, type) {
        const priority = type === 'error' ? 'assertive' : 'polite';
        const prefix = type === 'error' ? '错误：' : 
                      type === 'warning' ? '警告：' : 
                      type === 'success' ? '成功：' : '';
        
        this.announce(`${prefix}${message}`, priority);
    }
    
    /**
     * 管理通知的焦点
     * @param {Element} notification - 通知元素
     */
    manageFocusForNotification(notification) {
        // 对于错误通知，将焦点移到通知上
        const closeButton = notification.querySelector('.notification-close');
        if (closeButton) {
            closeButton.focus();
        }
    }
    
    /**
     * 公告系统状态变化
     * @param {string} status - 状态
     * @param {string} statusText - 状态文本
     */
    announceSystemStatusChange(status, statusText) {
        const priority = status === 'error' ? 'assertive' : 'polite';
        this.announce(`系统整体状态已更新为：${statusText}`, priority);
    }
    
    /**
     * 公告模态框打开
     * @param {string} modalTitle - 模态框标题
     */
    announceModalOpen(modalTitle) {
        this.announce(`已打开${modalTitle}对话框`);
        
        // 将焦点移到模态框
        setTimeout(() => {
            const modal = document.querySelector('.modal.show');
            if (modal) {
                const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                if (firstFocusable) {
                    firstFocusable.focus();
                } else {
                    modal.focus();
                }
            }
        }, 100);
    }
    
    /**
     * 设置模态框焦点陷阱
     * @param {Element} modal - 模态框元素
     */
    setupModalFocusTrap(modal) {
        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length === 0) return;
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    // Shift + Tab
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    // Tab
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                const closeButton = modal.querySelector('.close, .modal-close');
                if (closeButton) {
                    closeButton.click();
                }
            }
        });
    }
    
    /**
     * 获取无障碍报告
     * @returns {Object} 无障碍功能状态报告
     */
    getAccessibilityReport() {
        const focusableElements = this.getFocusableElements();
        const ariaElements = document.querySelectorAll('[aria-label], [aria-labelledby], [aria-describedby]');
        const liveRegions = document.querySelectorAll('[aria-live]');
        
        return {
            focusableElementsCount: focusableElements.length,
            ariaElementsCount: ariaElements.length,
            liveRegionsCount: liveRegions.length,
            currentFocusIndex: this.currentFocusIndex,
            hasSkipLink: !!document.querySelector('.skip-link'),
            hasAriaLiveRegion: !!document.getElementById('aria-live-region'),
            hasAriaAssertiveRegion: !!document.getElementById('aria-assertive-region'),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 验证WCAG合规性
     * @returns {Object} WCAG合规性检查结果
     */
    validateWCAGCompliance() {
        const issues = [];
        const warnings = [];
        
        // 检查图片alt属性
        const images = document.querySelectorAll('img');
        images.forEach((img, index) => {
            if (!img.hasAttribute('alt')) {
                issues.push(`图片 ${index + 1} 缺少alt属性`);
            }
        });
        
        // 检查表单标签
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach((input, index) => {
            const hasLabel = document.querySelector(`label[for="${input.id}"]`) || 
                           input.hasAttribute('aria-label') || 
                           input.hasAttribute('aria-labelledby');
            if (!hasLabel) {
                issues.push(`表单元素 ${index + 1} 缺少标签`);
            }
        });
        
        // 检查标题层级
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        let lastLevel = 0;
        headings.forEach((heading, index) => {
            const level = parseInt(heading.tagName.charAt(1));
            if (level > lastLevel + 1) {
                warnings.push(`标题 ${index + 1} 跳级：从 h${lastLevel} 到 h${level}`);
            }
            lastLevel = level;
        });
        
        // 检查颜色对比度（简单检查）
        const colorElements = document.querySelectorAll('[style*="color"]');
        if (colorElements.length > 0) {
            warnings.push('发现内联颜色样式，建议检查颜色对比度');
        }
        
        return {
            issues,
            warnings,
            score: Math.max(0, 100 - (issues.length * 10) - (warnings.length * 5)),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 生成完整的无障碍报告
     * @returns {Object} 完整的无障碍报告
     */
    generateFullReport() {
        const basicReport = this.getAccessibilityReport();
        const wcagReport = this.validateWCAGCompliance();
        
        return {
            basic: basicReport,
            wcag: wcagReport,
            summary: {
                overallScore: Math.round((wcagReport.score + (basicReport.hasAriaLiveRegion ? 10 : 0) + (basicReport.hasSkipLink ? 10 : 0)) / 1.2),
                criticalIssues: wcagReport.issues.length,
                warnings: wcagReport.warnings.length,
                recommendations: this.getRecommendations(wcagReport)
            },
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * 获取改进建议
     * @param {Object} wcagReport - WCAG报告
     * @returns {Array} 建议列表
     */
    getRecommendations(wcagReport) {
        const recommendations = [];
        
        if (wcagReport.issues.length > 0) {
            recommendations.push('修复所有关键的无障碍问题');
        }
        
        if (wcagReport.warnings.length > 0) {
            recommendations.push('处理警告项以提升用户体验');
        }
        
        if (!document.querySelector('.skip-link')) {
            recommendations.push('添加跳转到主内容的链接');
        }
        
        if (document.querySelectorAll('[tabindex]').length === 0) {
            recommendations.push('为交互元素设置合适的tabindex');
        }
        
        return recommendations;
    }
}

// 全局实例
window.AccessibilityManager = AccessibilityManager;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.accessibilityManager = new AccessibilityManager();
});