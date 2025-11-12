// 悬浮选择模式弹窗逻辑
class SelectionOverlay {
    constructor() {
        this.selectedElements = [];
        this.maxSelections = 10;
        this.isActive = false;
        this.init();
    }

    init() {
        this.createOverlay();
        this.bindEvents();
    }

    createOverlay() {
        // 检查是否已存在悬浮弹窗
        if (document.getElementById('selection-overlay')) {
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'selection-overlay';
        overlay.className = 'selection-overlay';
        
        overlay.innerHTML = `
            <div class="selection-header">
                <span class="selection-title">选择模式</span>
                <button class="close-btn" title="关闭">×</button>
            </div>
            <div class="selection-content">
                <div class="selection-instructions">
                    点击页面上的元素进行选择，最多可选择 ${this.maxSelections} 个元素
                </div>
                <div class="selection-counter">
                    已选择: <span id="selection-count">0</span> / ${this.maxSelections}
                </div>
                <div class="selected-items" id="selected-items">
                    <div class="no-selection">尚未选择任何元素</div>
                </div>
            </div>
            <div class="selection-controls">
                <button class="control-btn" id="clear-selection">清空选择</button>
                <button class="control-btn primary" id="confirm-selection">确认选择</button>
            </div>
        `;

        document.body.appendChild(overlay);
        this.overlay = overlay;
    }

    bindEvents() {
        // 关闭按钮
        this.overlay.querySelector('.close-btn').addEventListener('click', () => {
            this.hide();
        });

        // 清空选择
        this.overlay.querySelector('#clear-selection').addEventListener('click', () => {
            this.clearSelection();
        });

        // 确认选择
        this.overlay.querySelector('#confirm-selection').addEventListener('click', () => {
            this.confirmSelection();
        });

        // 页面点击事件 - 处理元素选择
        document.addEventListener('click', this.handlePageClick.bind(this), true);

        // 页面滚动时保持弹窗位置
        document.addEventListener('scroll', this.handleScroll.bind(this), true);
    }

    handlePageClick(event) {
        if (!this.isActive) return;

        // 如果点击的是弹窗本身或弹窗内的元素，不处理
        if (event.target.closest('#selection-overlay')) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const element = event.target;
        this.toggleElementSelection(element);
    }

    toggleElementSelection(element) {
        // 检查元素是否已经被选择
        const existingIndex = this.selectedElements.findIndex(selected => 
            selected.element === element
        );

        if (existingIndex >= 0) {
            // 取消选择
            this.removeSelection(element);
        } else {
            // 添加选择
            this.addSelection(element);
        }
    }

    addSelection(element) {
        if (this.selectedElements.length >= this.maxSelections) {
            this.showMessage(`最多只能选择 ${this.maxSelections} 个元素`);
            return;
        }

        // 获取元素的文本内容（简化显示）
        const textContent = this.getElementText(element);
        const selector = this.generateSelector(element);

        const selection = {
            element: element,
            text: textContent,
            selector: selector,
            originalStyles: {
                backgroundColor: element.style.backgroundColor,
                border: element.style.border
            }
        };

        this.selectedElements.push(selection);
        
        // 添加高亮样式
        element.classList.add('selection-highlight');
        
        this.updateDisplay();
    }

    removeSelection(element) {
        const index = this.selectedElements.findIndex(selected => 
            selected.element === element
        );

        if (index >= 0) {
            // 移除高亮样式
            element.classList.remove('selection-highlight');
            
            // 恢复原始样式
            const selection = this.selectedElements[index];
            if (selection.originalStyles.backgroundColor) {
                element.style.backgroundColor = selection.originalStyles.backgroundColor;
            }
            if (selection.originalStyles.border) {
                element.style.border = selection.originalStyles.border;
            }
            
            this.selectedElements.splice(index, 1);
            this.updateDisplay();
        }
    }

    clearSelection() {
        // 移除所有高亮样式
        this.selectedElements.forEach(selection => {
            selection.element.classList.remove('selection-highlight');
            
            // 恢复原始样式
            if (selection.originalStyles.backgroundColor) {
                selection.element.style.backgroundColor = selection.originalStyles.backgroundColor;
            }
            if (selection.originalStyles.border) {
                selection.element.style.border = selection.originalStyles.border;
            }
        });

        this.selectedElements = [];
        this.updateDisplay();
    }

    getElementText(element) {
        // 获取元素的文本内容，用于显示
        let text = element.textContent || element.innerText || '';
        text = text.trim().replace(/\s+/g, ' ');
        
        // 限制显示长度
        if (text.length > 50) {
            text = text.substring(0, 47) + '...';
        }
        
        return text || '[无文本内容]';
    }

    generateSelector(element) {
        // 生成CSS选择器，用于后续识别元素
        if (element.id) {
            return `#${element.id}`;
        }
        
        if (element.className) {
            const classes = element.className.split(' ').filter(c => c).join('.');
            if (classes) {
                return `${element.tagName.toLowerCase()}.${classes}`;
            }
        }
        
        return element.tagName.toLowerCase();
    }

    updateDisplay() {
        const countElement = this.overlay.querySelector('#selection-count');
        const itemsContainer = this.overlay.querySelector('#selected-items');
        
        countElement.textContent = this.selectedElements.length;
        
        if (this.selectedElements.length === 0) {
            itemsContainer.innerHTML = '<div class="no-selection">尚未选择任何元素</div>';
        } else {
            itemsContainer.innerHTML = this.selectedElements.map((selection, index) => `
                <div class="selected-item">
                    <span class="selected-item-content">${selection.text}</span>
                    <button class="remove-item" data-index="${index}" title="移除">×</button>
                </div>
            `).join('');

            // 绑定移除按钮事件
            itemsContainer.querySelectorAll('.remove-item').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt(e.target.getAttribute('data-index'));
                    const selection = this.selectedElements[index];
                    if (selection) {
                        this.removeSelection(selection.element);
                    }
                });
            });
        }

        // 更新确认按钮状态
        const confirmBtn = this.overlay.querySelector('#confirm-selection');
        confirmBtn.disabled = this.selectedElements.length === 0;
    }

    confirmSelection() {
        if (this.selectedElements.length === 0) {
            this.showMessage('请至少选择一个元素');
            return;
        }

        // 准备选择结果数据
        const selectionData = this.selectedElements.map(selection => ({
            text: selection.text,
            selector: selection.selector,
            html: selection.element.outerHTML.substring(0, 500) // 限制HTML大小
        }));

        // 发送消息到内容脚本
        window.postMessage({
            type: 'SELECTION_COMPLETE',
            data: {
                selections: selectionData,
                count: this.selectedElements.length
            }
        }, '*');

        // 隐藏弹窗但保持选择状态
        this.hide();
        
        this.showMessage(`已选择 ${this.selectedElements.length} 个元素`);
    }

    show() {
        this.isActive = true;
        this.overlay.classList.add('active');
        
        // 添加页面样式
        this.addPageStyles();
        
        // 更新显示
        this.updateDisplay();
    }

    hide() {
        this.isActive = false;
        this.overlay.classList.remove('active');
        
        // 移除页面样式
        this.removePageStyles();
    }

    addPageStyles() {
        // 添加高亮样式到页面
        if (!document.getElementById('selection-highlight-styles')) {
            const style = document.createElement('style');
            style.id = 'selection-highlight-styles';
            style.textContent = `
                .selection-highlight {
                    background-color: rgba(66, 133, 244, 0.3) !important;
                    border: 2px solid #4285f4 !important;
                    cursor: pointer !important;
                }
                .selection-highlight:hover {
                    background-color: rgba(66, 133, 244, 0.5) !important;
                }
            `;
            document.head.appendChild(style);
        }
    }

    removePageStyles() {
        const style = document.getElementById('selection-highlight-styles');
        if (style) {
            style.remove();
        }
    }

    handleScroll() {
        if (this.isActive) {
            // 可以在这里添加滚动时弹窗位置调整逻辑
            // 目前保持固定位置
        }
    }

    showMessage(message) {
        // 简单的消息提示
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
            messageEl.remove();
        }, 2000);
    }

    getSelections() {
        return this.selectedElements.map(selection => ({
            text: selection.text,
            selector: selection.selector
        }));
    }
}

// 全局变量
window.selectionOverlay = null;

// 初始化函数
document.addEventListener('DOMContentLoaded', function() {
    // 等待页面加载完成后再初始化
    if (!window.selectionOverlay) {
        window.selectionOverlay = new SelectionOverlay();
    }
});

// 导出供其他脚本使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SelectionOverlay;
}