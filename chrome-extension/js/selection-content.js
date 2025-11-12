// 悬浮选择模式内容脚本
// 负责在页面上加载悬浮选择弹窗和处理选择模式通信

class SelectionContentHandler {
    constructor() {
        this.isSelectionMode = false;
        this.selectionOverlay = null;
        this.selectedElements = [];
        this.maxSelections = 10;
        this.init();
    }

    init() {
        console.log('🔧 初始化悬浮选择内容脚本');
        
        // 监听来自popup的消息
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handlePopupMessage(message, sender, sendResponse);
            return true; // 保持异步响应
        });

        // 监听页面上的悬浮选择事件
        window.addEventListener('message', (event) => {
            this.handlePageMessage(event);
        });

        // 页面加载完成后自动注入选择弹窗
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.injectSelectionOverlay();
            });
        } else {
            this.injectSelectionOverlay();
        }

        console.log('✅ 悬浮选择内容脚本初始化完成');
    }

    // 处理来自popup的消息
    handlePopupMessage(message, sender, sendResponse) {
        console.log('📨 收到popup消息:', message);
        
        try {
            switch (message.action) {
                case 'startSelectionMode':
                    this.startSelectionMode(message.maxSelections || 10).then(() => {
                        sendResponse({ success: true });
                    }).catch(error => {
                        sendResponse({ success: false, error: error.message });
                    });
                    break;

                case 'stopSelectionMode':
                    this.stopSelectionMode().then(() => {
                        sendResponse({ success: true });
                    }).catch(error => {
                        sendResponse({ success: false, error: error.message });
                    });
                    break;

                case 'getSelectionStatus':
                    sendResponse({
                        success: true,
                        isActive: this.isSelectionMode,
                        selectedCount: this.selectedElements.length,
                        maxSelections: this.maxSelections
                    });
                    break;

                case 'clearSelections':
                    this.clearSelections().then(() => {
                        sendResponse({ success: true });
                    }).catch(error => {
                        sendResponse({ success: false, error: error.message });
                    });
                    break;

                default:
                    sendResponse({ success: false, error: '未知的操作类型' });
            }
        } catch (error) {
            console.error('❌ 处理popup消息失败:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    // 处理页面上的消息（来自悬浮弹窗）
    handlePageMessage(event) {
        if (event.source !== window) return;
        
        const data = event.data;
        if (!data || typeof data !== 'object') return;

        console.log('📄 收到页面消息:', data.type);

        switch (data.type) {
            case 'SELECTION_COMPLETE':
                this.handleSelectionComplete(data.data);
                break;

            case 'SELECTION_UPDATED':
                this.handleSelectionUpdated(data.data);
                break;

            case 'OVERLAY_CLOSED':
                this.handleOverlayClosed();
                break;
        }
    }

    // 处理选择完成
    handleSelectionComplete(data) {
        console.log('✅ 选择完成:', data);
        
        this.selectedElements = data.selections || [];
        this.isSelectionMode = false;

        // 通知popup选择已完成
        chrome.runtime.sendMessage({
            action: 'selectionCompleted',
            data: {
                selections: this.selectedElements,
                count: this.selectedElements.length,
                timestamp: Date.now()
            }
        });

        // 显示完成消息
        this.showMessage(`已选择 ${this.selectedElements.length} 个元素`);
    }

    // 处理选择更新
    handleSelectionUpdated(data) {
        this.selectedElements = data.selections || [];
        
        // 通知popup选择状态更新
        chrome.runtime.sendMessage({
            action: 'selectionUpdated',
            data: {
                selections: this.selectedElements,
                count: this.selectedElements.length
            }
        });
    }

    // 处理弹窗关闭
    handleOverlayClosed() {
        console.log('🚪 悬浮弹窗已关闭');
        
        if (this.isSelectionMode) {
            this.isSelectionMode = false;
            
            // 通知popup选择模式已关闭
            chrome.runtime.sendMessage({
                action: 'selectionModeClosed',
                data: {
                    selections: this.selectedElements,
                    count: this.selectedElements.length
                }
            });
        }
    }

    // 开始选择模式
    async startSelectionMode(maxSelections = 10) {
        console.log('🚀 开始选择模式，最大选择数量:', maxSelections);
        
        if (this.isSelectionMode) {
            throw new Error('选择模式已在运行中');
        }

        this.isSelectionMode = true;
        this.maxSelections = maxSelections;
        this.selectedElements = [];

        // 确保悬浮弹窗已加载
        await this.ensureOverlayLoaded();

        // 显示悬浮弹窗
        this.showSelectionOverlay();

        console.log('✅ 选择模式启动成功');
    }

    // 停止选择模式
    async stopSelectionMode() {
        console.log('🛑 停止选择模式');
        
        if (!this.isSelectionMode) {
            console.warn('⚠️ 选择模式未在运行');
            return;
        }

        this.isSelectionMode = false;
        
        // 隐藏悬浮弹窗
        this.hideSelectionOverlay();

        console.log('✅ 选择模式已停止');
    }

    // 清除选择
    async clearSelections() {
        console.log('🗑️ 清除选择');
        
        this.selectedElements = [];
        
        // 通知悬浮弹窗清除选择
        window.postMessage({
            type: 'CLEAR_SELECTIONS',
            data: {}
        }, '*');

        console.log('✅ 选择已清除');
    }

    // 注入悬浮选择弹窗
    injectSelectionOverlay() {
        // 检查是否已存在
        if (document.getElementById('selection-overlay')) {
            console.log('✅ 悬浮弹窗已存在');
            return;
        }

        // 创建悬浮弹窗容器
        const overlay = document.createElement('div');
        overlay.id = 'selection-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 300px;
            max-height: 500px;
            background: #ffffff;
            border: 2px solid #4285f4;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: none;
            flex-direction: column;
        `;

        // 添加弹窗内容
        overlay.innerHTML = `
            <div style="background: #4285f4; color: white; padding: 12px 16px; border-radius: 6px 6px 0 0; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600; font-size: 14px;">选择模式</span>
                <button class="close-btn" style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; padding: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 3px;">×</button>
            </div>
            <div style="padding: 16px; flex: 1; overflow-y: auto;">
                <div style="margin-bottom: 16px; font-size: 13px; color: #5f6368; line-height: 1.4;">
                    点击页面上的元素进行选择，最多可选择 ${this.maxSelections} 个元素
                </div>
                <div style="margin-bottom: 12px; font-size: 13px; color: #4285f4; font-weight: 500;">
                    已选择: <span id="selection-count">0</span> / ${this.maxSelections}
                </div>
                <div id="selected-items" style="margin-bottom: 16px; max-height: 200px; overflow-y: auto; border: 1px solid #e0e0e0; border-radius: 4px; padding: 8px;">
                    <div style="color: #999; font-size: 12px;">尚未选择任何元素</div>
                </div>
            </div>
            <div style="display: flex; gap: 8px; padding: 0 16px 16px;">
                <button id="clear-selection" style="flex: 1; padding: 8px 12px; border: 1px solid #dadce0; border-radius: 4px; background: #ffffff; color: #5f6368; font-size: 13px; cursor: pointer;">清空选择</button>
                <button id="confirm-selection" style="flex: 1; padding: 8px 12px; border: 1px solid #4285f4; border-radius: 4px; background: #4285f4; color: white; font-size: 13px; cursor: pointer;">确认选择</button>
            </div>
        `;

        document.body.appendChild(overlay);
        this.selectionOverlay = overlay;

        // 绑定事件
        this.bindOverlayEvents();

        console.log('✅ 悬浮弹窗注入完成');
    }

    // 绑定弹窗事件
    bindOverlayEvents() {
        if (!this.selectionOverlay) return;

        // 关闭按钮
        this.selectionOverlay.querySelector('.close-btn').addEventListener('click', () => {
            this.hideSelectionOverlay();
            
            // 通知内容脚本弹窗已关闭
            window.postMessage({
                type: 'OVERLAY_CLOSED',
                data: {}
            }, '*');
        });

        // 清空选择
        this.selectionOverlay.querySelector('#clear-selection').addEventListener('click', () => {
            this.clearSelections();
        });

        // 确认选择
        this.selectionOverlay.querySelector('#confirm-selection').addEventListener('click', () => {
            this.confirmSelection();
        });
    }

    // 显示悬浮弹窗
    showSelectionOverlay() {
        if (this.selectionOverlay) {
            this.selectionOverlay.style.display = 'flex';
            
            // 更新选择计数
            this.updateSelectionCount();
            
            console.log('✅ 悬浮弹窗已显示');
        }
    }

    // 隐藏悬浮弹窗
    hideSelectionOverlay() {
        if (this.selectionOverlay) {
            this.selectionOverlay.style.display = 'none';
            console.log('✅ 悬浮弹窗已隐藏');
        }
    }

    // 更新选择计数
    updateSelectionCount() {
        if (this.selectionOverlay) {
            const countElement = this.selectionOverlay.querySelector('#selection-count');
            if (countElement) {
                countElement.textContent = this.selectedElements.length;
            }

            const itemsContainer = this.selectionOverlay.querySelector('#selected-items');
            if (itemsContainer) {
                if (this.selectedElements.length === 0) {
                    itemsContainer.innerHTML = '<div style="color: #999; font-size: 12px;">尚未选择任何元素</div>';
                } else {
                    itemsContainer.innerHTML = this.selectedElements.map((selection, index) => `
                        <div style="background: #f8f9fa; border: 1px solid #dadce0; border-radius: 4px; padding: 8px; margin-bottom: 6px; font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
                            <span style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${selection.text}</span>
                            <button class="remove-item" data-index="${index}" style="background: none; border: none; color: #ea4335; cursor: pointer; font-size: 12px; padding: 2px 6px; border-radius: 3px;">×</button>
                        </div>
                    `).join('');

                    // 绑定移除按钮事件
                    itemsContainer.querySelectorAll('.remove-item').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const index = parseInt(e.target.getAttribute('data-index'));
                            this.removeSelection(index);
                        });
                    });
                }
            }
        }
    }

    // 移除单个选择
    removeSelection(index) {
        if (index >= 0 && index < this.selectedElements.length) {
            this.selectedElements.splice(index, 1);
            this.updateSelectionCount();
            
            // 通知选择更新
            window.postMessage({
                type: 'SELECTION_UPDATED',
                data: {
                    selections: this.selectedElements,
                    count: this.selectedElements.length
                }
            }, '*');
        }
    }

    // 确认选择
    confirmSelection() {
        if (this.selectedElements.length === 0) {
            this.showMessage('请至少选择一个元素');
            return;
        }

        // 通知选择完成
        window.postMessage({
            type: 'SELECTION_COMPLETE',
            data: {
                selections: this.selectedElements,
                count: this.selectedElements.length
            }
        }, '*');

        this.hideSelectionOverlay();
        this.showMessage(`已选择 ${this.selectedElements.length} 个元素`);
    }

    // 确保弹窗已加载
    ensureOverlayLoaded() {
        return new Promise((resolve) => {
            if (this.selectionOverlay) {
                resolve();
            } else {
                // 等待弹窗加载
                const checkInterval = setInterval(() => {
                    if (this.selectionOverlay) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);

                // 超时保护
                setTimeout(() => {
                    clearInterval(checkInterval);
                    resolve();
                }, 2000);
            }
        });
    }

    // 显示消息提示
    showMessage(message) {
        const messageEl = document.createElement('div');
        messageEl.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 10001;
            font-size: 14px;
        `;
        messageEl.textContent = message;
        document.body.appendChild(messageEl);
        
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.remove();
            }
        }, 2000);
    }

    // 获取当前选择状态
    getSelectionStatus() {
        return {
            isActive: this.isSelectionMode,
            selectedCount: this.selectedElements.length,
            maxSelections: this.maxSelections,
            selections: [...this.selectedElements]
        };
    }
}

// 初始化悬浮选择内容处理器
let selectionHandler = null;

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        selectionHandler = new SelectionContentHandler();
    });
} else {
    selectionHandler = new SelectionContentHandler();
}

// 导出供其他脚本使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SelectionContentHandler;
}