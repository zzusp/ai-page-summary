# 弹窗用户界面设计 - 页面元素选择功能

## 1. 设计概述

基于现有的Chrome扩展弹窗界面分析，设计并实现页面元素选择功能，以提升用户对内容选择的精确性和便捷性。

## 2. 设计原则

- **一致性**: 遵循现有视觉设计规范，保持界面风格统一
- **简洁性**: 最小化界面复杂度，专注核心功能
- **直观性**: 用户能够快速理解和使用新功能
- **可扩展性**: 为未来功能优化预留空间
- **响应性**: 提供良好的交互反馈和状态提示

## 3. 界面结构设计

### 3.1 整体布局

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>智能页面总结</title>
    <link rel="stylesheet" href="popup.css">
</head>
<body>
    <div class="container">
        <!-- 头部区域 -->
        <div class="header">
            <div class="logo">
                <span class="logo-icon">📊</span>
                <span class="logo-text">智能页面总结</span>
            </div>
            <div class="header-actions">
                <button id="historyBtn" class="icon-btn">
                    <span class="btn-icon">📚</span>
                    <span id="historyBadge" class="badge">0</span>
                </button>
                <button id="settingsBtn" class="icon-btn">
                    <span class="btn-icon">⚙️</span>
                </button>
            </div>
        </div>

        <!-- 状态栏 -->
        <div class="status-bar">
            <div id="statusIndicator" class="status-indicator ready"></div>
            <span id="statusText" class="status-text">就绪</span>
        </div>

        <!-- 页面信息区 -->
        <div class="page-info">
            <div id="pageTitle" class="page-title">页面标题</div>
            <div id="pageUrl" class="page-url">https://example.com</div>
        </div>

        <!-- 总结重点输入区 -->
        <div class="summary-focus">
            <label for="focusInput" class="focus-label">
                <span class="label-icon">💡</span>
                总结重点 (可选)
            </label>
            <textarea id="focusInput" class="focus-input" 
                      placeholder="请输入您希望重点关注的方面，例如：技术细节、关键结论、数据分析等..." 
                      maxlength="500"></textarea>
            <div id="charCount" class="char-count">0/500</div>
            
            <!-- 选择状态显示区 -->
            <div id="selectionStatus" class="selection-status" style="display: none;">
                <div class="selection-header">
                    <div class="selection-info">
                        <span class="selection-icon">✅</span>
                        <span class="selection-label">已选择 <span id="selectionCount">0</span> 个元素</span>
                    </div>
                    <button id="clearSelectionBtn" class="clear-selection-btn">
                        <span class="btn-icon">🗑️</span>
                        清除选择
                    </button>
                </div>
                
                <!-- 选择内容预览区 -->
                <div id="selectionPreview" class="selection-preview">
                    <div class="preview-header">选择内容预览:</div>
                    <div class="preview-content">
                        <!-- 动态生成的选择内容 -->
                    </div>
                </div>
            </div>
        </div>

        <!-- 主操作区 -->
        <div class="main-actions">
            <button id="selectContentBtn" class="select-btn">
                <span class="btn-icon">🎯</span>
                <span class="btn-text">选择页面元素</span>
            </button>
            <button id="summarizeBtn" class="primary-btn">
                <span class="btn-icon">🔍</span>
                <span class="btn-text">开始总结</span>
            </button>
            <button id="clearBtn" class="secondary-btn">
                <span class="btn-icon">🗑️</span>
                <span class="btn-text">清除结果</span>
            </button>
        </div>

        <!-- 连接测试区 -->
        <div class="connection-test">
            <button id="testConnectionBtn" class="test-btn">
                <span class="btn-icon">🔧</span>
                测试连接
            </button>
        </div>

        <!-- 加载指示器 -->
        <div id="loadingIndicator" class="loading-indicator" style="display: none;">
            <div class="spinner"></div>
            <div class="loading-text">正在分析页面内容...</div>
            <div class="progress-bar">
                <div id="progressFill" class="progress-fill"></div>
            </div>
        </div>

        <!-- 结果展示区 -->
        <div id="resultsSection" class="results-section" style="display: none;">
            <div class="results-header">
                <h3 class="results-title">页面总结</h3>
                <div class="results-actions">
                    <button id="copyBtn" class="action-btn">
                        <span class="btn-icon">📋</span>
                        复制
                    </button>
                    <button id="exportBtn" class="action-btn">
                        <span class="btn-icon">💾</span>
                        导出
                    </button>
                </div>
            </div>
            <div id="summaryContent" class="summary-content"></div>
            <div class="results-footer">
                <div class="confidence">
                    <span class="confidence-label">置信度:</span>
                    <div class="confidence-bar">
                        <div id="scoreFill" class="score-fill"></div>
                    </div>
                    <span id="scoreText" class="score-text">0%</span>
                </div>
                <div id="timestamp" class="timestamp"></div>
            </div>
        </div>

        <!-- 错误信息区 -->
        <div id="errorSection" class="error-section" style="display: none;">
            <div class="error-icon">⚠️</div>
            <div id="errorText" class="error-text">错误信息</div>
            <button id="retryBtn" class="retry-btn">重试</button>
        </div>

        <!-- 快捷键提示区 -->
        <div class="shortcuts-section">
            <button id="shortcutsToggle" class="shortcuts-toggle">
                <span class="toggle-icon">💡</span>
                快捷键帮助
            </button>
            <div id="shortcutsContent" class="shortcuts-content" style="display: none;">
                <div class="shortcut-item">
                    <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd>
                    <span>快速总结</span>
                </div>
                <div class="shortcut-item">
                    <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>O</kbd>
                    <span>打开设置</span>
                </div>
            </div>
        </div>
    </div>

    <!-- 历史记录模态框 -->
    <div id="historyModal" class="modal" style="display: none;">
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">历史记录</h3>
                <button id="closeHistoryBtn" class="close-btn">×</button>
            </div>
            <div id="historyList" class="history-list"></div>
            <div class="modal-footer">
                <button id="clearHistoryBtn" class="danger-btn">清空历史</button>
                <button id="exportHistoryBtn" class="secondary-btn">导出历史</button>
            </div>
        </div>
    </div>
</body>
</html>
```

## 4. 新增组件详细设计

### 4.1 选择页面元素按钮

```css
.select-btn {
    background: linear-gradient(135deg, #ff9a56 0%, #ff6b35 100%);
    border: none;
    border-radius: 8px;
    padding: 12px 20px;
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(255, 107, 53, 0.3);
    flex: 1;
    min-height: 44px;
}

.select-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(255, 107, 53, 0.4);
    background: linear-gradient(135deg, #ff8f66 0%, #ff7b45 100%);
}

.select-btn:active {
    transform: translateY(0);
    box-shadow: 0 2px 4px rgba(255, 107, 53, 0.3);
}

.select-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
}

.select-btn .btn-icon {
    font-size: 16px;
}
```

### 4.2 选择状态显示区

```css
.selection-status {
    margin-top: 12px;
    padding: 16px;
    background: linear-gradient(135deg, #f0f8ff 0%, #e6f3ff 100%);
    border: 1px solid #b3d9ff;
    border-radius: 8px;
    animation: slideDown 0.3s ease;
}

.selection-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.selection-info {
    display: flex;
    align-items: center;
    gap: 8px;
}

.selection-icon {
    color: #28a745;
    font-size: 16px;
}

.selection-label {
    font-weight: 500;
    color: #333;
    font-size: 14px;
}

.clear-selection-btn {
    background: #dc3545;
    border: none;
    border-radius: 6px;
    padding: 6px 12px;
    color: white;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: all 0.2s ease;
}

.clear-selection-btn:hover {
    background: #c82333;
    transform: scale(1.05);
}

.clear-selection-btn .btn-icon {
    font-size: 12px;
}
```

### 4.3 选择内容预览区

```css
.selection-preview {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    max-height: 120px;
    overflow-y: auto;
}

.preview-header {
    padding: 8px 12px;
    background: #f8f9fa;
    border-bottom: 1px solid #e0e0e0;
    font-size: 12px;
    font-weight: 500;
    color: #666;
}

.preview-content {
    padding: 8px 12px;
    max-height: 80px;
    overflow-y: auto;
}

.preview-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 6px;
    padding: 4px 0;
}

.preview-item:last-child {
    margin-bottom: 0;
}

.preview-type {
    background: #007bff;
    color: white;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 500;
    min-width: 40px;
    text-align: center;
    flex-shrink: 0;
}

.preview-text {
    color: #333;
    font-size: 12px;
    line-height: 1.4;
    word-break: break-word;
    flex: 1;
}

.preview-empty {
    text-align: center;
    color: #999;
    font-size: 12px;
    padding: 20px 0;
}
```

## 5. 布局优化

### 5.1 主操作区调整

```css
.main-actions {
    display: flex;
    gap: 12px;
    padding: 16px 20px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    margin-bottom: 16px;
}

.main-actions .select-btn {
    flex: 1.2; /* 选择按钮稍大，提供更多视觉权重 */
}

.main-actions .primary-btn {
    flex: 2; /* 开始总结按钮最大，作为主要操作 */
}

.main-actions .secondary-btn {
    flex: 0.8; /* 清除按钮相对较小 */
}
```

### 5.2 响应式设计

```css
@media (max-width: 420px) {
    .main-actions {
        flex-direction: column;
        gap: 8px;
    }
    
    .main-actions .select-btn,
    .main-actions .primary-btn,
    .main-actions .secondary-btn {
        flex: none;
        width: 100%;
    }
    
    .selection-status {
        margin-top: 8px;
        padding: 12px;
    }
    
    .selection-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
    }
    
    .clear-selection-btn {
        align-self: flex-end;
    }
}
```

## 6. 交互状态设计

### 6.1 按钮状态

```css
/* 选择按钮状态 */
.select-btn.selecting {
    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
    animation: pulse 1.5s infinite;
}

.select-btn.selected {
    background: linear-gradient(135deg, #17a2b8 0%, #138496 100%);
}

/* 清除按钮状态 */
.clear-selection-btn:disabled {
    background: #6c757d;
    cursor: not-allowed;
    transform: none;
}
```

### 6.2 动画效果

```css
@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes pulse {
    0% {
        box-shadow: 0 0 0 0 rgba(255, 107, 53, 0.7);
    }
    70% {
        box-shadow: 0 0 0 10px rgba(255, 107, 53, 0);
    }
    100% {
        box-shadow: 0 0 0 0 rgba(255, 107, 53, 0);
    }
}
```

## 7. JavaScript交互逻辑

### 7.1 选择功能控制

```javascript
class SelectionManager {
    constructor() {
        this.selectedElements = [];
        this.isSelecting = false;
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        this.selectBtn = document.getElementById('selectContentBtn');
        this.selectionStatus = document.getElementById('selectionStatus');
        this.selectionCount = document.getElementById('selectionCount');
        this.selectionPreview = document.getElementById('selectionPreview');
        this.clearSelectionBtn = document.getElementById('clearSelectionBtn');
    }

    bindEvents() {
        this.selectBtn.addEventListener('click', () => this.toggleSelection());
        this.clearSelectionBtn.addEventListener('click', () => this.clearSelection());
    }

    toggleSelection() {
        if (this.isSelecting) {
            this.endSelection();
        } else {
            this.startSelection();
        }
    }

    startSelection() {
        this.isSelecting = true;
        this.selectBtn.classList.add('selecting');
        this.selectBtn.innerHTML = `
            <span class="btn-icon">⏹️</span>
            <span class="btn-text">停止选择</span>
        `;
        // 发送消息到content script开始选择模式
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {action: 'startSelection'});
        });
    }

    endSelection() {
        this.isSelecting = false;
        this.selectBtn.classList.remove('selecting');
        this.selectBtn.innerHTML = `
            <span class="btn-icon">🎯</span>
            <span class="btn-text">选择页面元素</span>
        `;
        // 发送消息到content script结束选择模式
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {action: 'endSelection'});
        });
    }

    updateSelection(elements) {
        this.selectedElements = elements;
        this.updateUI();
    }

    updateUI() {
        if (this.selectedElements.length > 0) {
            this.showSelectionStatus();
        } else {
            this.hideSelectionStatus();
        }
    }

    showSelectionStatus() {
        this.selectionStatus.style.display = 'block';
        this.selectionCount.textContent = this.selectedElements.length;
        this.updatePreview();
    }

    hideSelectionStatus() {
        this.selectionStatus.style.display = 'none';
    }

    updatePreview() {
        const content = this.selectedElements.map(element => {
            return `
                <div class="preview-item">
                    <span class="preview-type">${element.type}</span>
                    <span class="preview-text">${this.truncateText(element.content, 50)}</span>
                </div>
            `;
        }).join('');
        
        this.selectionPreview.innerHTML = `
            <div class="preview-header">选择内容预览:</div>
            <div class="preview-content">
                ${content || '<div class="preview-empty">暂无选择内容</div>'}
            </div>
        `;
    }

    truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    clearSelection() {
        this.selectedElements = [];
        this.updateUI();
        // 通知content script清除选择
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {action: 'clearSelection'});
        });
    }
}
```

## 8. 集成指南

### 8.1 CSS集成

1. 将新增的CSS样式添加到现有的`popup.css`文件中
2. 确保样式加载顺序正确，避免样式覆盖
3. 验证响应式设计在不同屏幕尺寸下的表现

### 8.2 JavaScript集成

1. 在现有的`popup.js`中初始化`SelectionManager`类
2. 扩展现有的消息处理机制以支持选择功能
3. 与现有的状态管理集成

### 8.3 功能集成

1. 将选择的内容传递给现有的总结功能
2. 扩展本地存储以保存选择状态
3. 更新快捷键系统以支持新功能

## 9. 总结

本设计通过在现有弹窗界面中添加"选择页面元素"按钮和选择状态显示区，为用户提供了精确控制页面内容选择的功能。设计遵循了现有的视觉规范，保持了界面的简洁性和一致性，同时提供了良好的用户体验和可扩展性。

新功能的核心优势：
- **精确选择**: 用户可以自主选择要总结的页面元素
- **状态透明**: 清晰显示选择状态和预览内容
- **操作便捷**: 一键切换选择模式，操作简单直观
- **视觉一致**: 遵循现有设计语言，保持界面统一
- **响应友好**: 良好的交互反馈和状态提示