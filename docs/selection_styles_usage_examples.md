# 选择功能样式使用示例

## 概述

本文档提供了AI网页总结器扩展中选择功能样式的实际使用示例，帮助开发者理解如何在JavaScript中应用这些CSS类。

## HTML示例结构

```html
<!-- 基础页面结构 -->
<!DOCTYPE html>
<html>
<head>
    <title>选择功能测试页面</title>
</head>
<body>
    <!-- 页面内容区域 -->
    <div class="content-area">
        <h1>AI网页总结器 - 选择功能演示</h1>
        
        <!-- 可以选择的段落 -->
        <p class="ai-selection-selectable" data-selection-id="para-1">
            这是一个可以被选择的段落。当您激活选择模式时，这个段落会显示高亮效果。
        </p>
        
        <!-- 图片选择示例 -->
        <div class="ai-selection-selectable" data-selection-id="img-container">
            <img src="example.jpg" alt="示例图片" style="width: 300px; height: 200px;">
            <p>这张图片可以被选择用于分析</p>
        </div>
        
        <!-- 工具栏容器（由JavaScript动态创建） -->
        <div id="ai-selection-toolbar-container"></div>
    </div>
</body>
</html>
```

## JavaScript使用示例

### 1. 激活选择模式

```javascript
// 激活选择模式
function activateSelectionMode() {
    document.body.classList.add('ai-selection-active');
    
    // 为所有可选择元素添加选择类
    const selectableElements = document.querySelectorAll('p, div, section, article, img, video');
    selectableElements.forEach(element => {
        element.classList.add('ai-selection-selectable');
    });
    
    // 添加事件监听器
    addSelectionEventListeners();
}
```

### 2. 元素选择处理

```javascript
function addSelectionEventListeners() {
    // 悬浮高亮
    document.addEventListener('mouseover', handleElementHover);
    document.addEventListener('mouseout', handleElementOut);
    
    // 点击选择
    document.addEventListener('click', handleElementClick);
    
    // 键盘事件
    document.addEventListener('keydown', handleKeyboard);
}

// 悬浮处理
function handleElementHover(event) {
    const element = event.target.closest('.ai-selection-selectable');
    if (element && document.body.classList.contains('ai-selection-active')) {
        element.classList.add('ai-selection-hover');
        
        // 在元素上方显示工具栏
        showSelectionToolbar(element);
    }
}

// 悬浮离开处理
function handleElementOut(event) {
    const element = event.target.closest('.ai-selection-selectable');
    if (element) {
        element.classList.remove('ai-selection-hover');
        
        // 延迟隐藏工具栏，避免闪烁
        setTimeout(() => {
            if (!element.matches(':hover')) {
                hideSelectionToolbar();
            }
        }, 100);
    }
}

// 元素点击处理
function handleElementClick(event) {
    const element = event.target.closest('.ai-selection-selectable');
    if (element && document.body.classList.contains('ai-selection-active')) {
        event.preventDefault();
        event.stopPropagation();
        
        // 切换选择状态
        if (element.classList.contains('ai-selection-selected')) {
            deselectElement(element);
        } else {
            selectElement(element);
        }
    }
}
```

### 3. 选择状态管理

```javascript
// 选择元素
function selectElement(element) {
    element.classList.add('ai-selection-selected');
    element.classList.add('ai-selection-confirmed');
    
    // 更新选择计数
    updateSelectionCount();
    
    // 显示工具栏
    showSelectionToolbar(element);
    
    // 添加确认动画
    setTimeout(() => {
        element.classList.remove('ai-selection-confirmed');
    }, 300);
}

// 取消选择
function deselectElement(element) {
    element.classList.remove('ai-selection-selected');
    element.classList.remove('ai-selection-hover');
    
    updateSelectionCount();
    
    // 如果没有其他选中元素，隐藏工具栏
    const selectedCount = document.querySelectorAll('.ai-selection-selected').length;
    if (selectedCount === 0) {
        hideSelectionToolbar();
    }
}

// 更新选择计数
function updateSelectionCount() {
    const count = document.querySelectorAll('.ai-selection-selected').length;
    const countIndicator = document.querySelector('.ai-selection-count');
    if (countIndicator) {
        countIndicator.textContent = count;
    }
}
```

### 4. 工具栏显示与隐藏

```javascript
// 显示选择工具栏
function showSelectionToolbar(element) {
    const existingToolbar = document.querySelector('.ai-selection-toolbar');
    if (existingToolbar) {
        existingToolbar.remove();
    }
    
    const toolbar = createSelectionToolbar(element);
    document.body.appendChild(toolbar);
    
    // 定位工具栏
    positionToolbar(toolbar, element);
    
    // 显示动画
    setTimeout(() => {
        toolbar.classList.add('show');
    }, 10);
}

// 创建工具栏
function createSelectionToolbar(element) {
    const toolbar = document.createElement('div');
    toolbar.className = 'ai-selection-toolbar';
    toolbar.innerHTML = `
        <div class="ai-selection-group">
            <button class="ai-selection-btn" data-action="extract" title="提取内容">
                <svg class="ai-selection-icon" viewBox="0 0 24 24">
                    <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z"/>
                </svg>
            </button>
            <button class="ai-selection-btn" data-action="summarize" title="生成摘要">
                <svg class="ai-selection-icon" viewBox="0 0 24 24">
                    <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2M18 20H6V4H13V9H18V20Z"/>
                </svg>
            </button>
        </div>
        <div class="ai-selection-group">
            <span class="ai-selection-count">0</span>
            <button class="ai-selection-btn" data-action="clear" title="清除选择">
                <svg class="ai-selection-icon" viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"/>
                </svg>
            </button>
        </div>
    `;
    
    // 添加按钮事件监听器
    toolbar.addEventListener('click', handleToolbarAction);
    
    return toolbar;
}

// 定位工具栏
function positionToolbar(toolbar, element) {
    const rect = element.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();
    
    // 计算位置
    let top = rect.top - toolbarRect.height - 10 + window.scrollY;
    let left = rect.left + (rect.width - toolbarRect.width) / 2;
    
    // 边界检查
    if (top < window.scrollY) {
        top = rect.bottom + 10 + window.scrollY;
    }
    
    if (left < 10) {
        left = 10;
    } else if (left + toolbarRect.width > window.innerWidth - 10) {
        left = window.innerWidth - toolbarRect.width - 10;
    }
    
    // 应用位置
    toolbar.style.position = 'absolute';
    toolbar.style.top = `${top}px`;
    toolbar.style.left = `${left}px`;
    toolbar.style.zIndex = '9999';
}

// 隐藏工具栏
function hideSelectionToolbar() {
    const toolbar = document.querySelector('.ai-selection-toolbar');
    if (toolbar) {
        toolbar.classList.remove('show');
        setTimeout(() => {
            toolbar.remove();
        }, 250);
    }
}
```

### 5. 工具栏操作处理

```javascript
// 工具栏操作处理
function handleToolbarAction(event) {
    const button = event.target.closest('.ai-selection-btn');
    if (!button) return;
    
    const action = button.dataset.action;
    const selectedElements = document.querySelectorAll('.ai-selection-selected');
    
    switch (action) {
        case 'extract':
            handleExtractContent(selectedElements);
            break;
        case 'summarize':
            handleSummarizeContent(selectedElements);
            break;
        case 'clear':
            handleClearSelection(selectedElements);
            break;
    }
}

// 提取内容
function handleExtractContent(elements) {
    elements.forEach(element => {
        // 添加加载状态
        element.classList.add('ai-selection-loading');
        
        // 模拟内容提取
        setTimeout(() => {
            element.classList.remove('ai-selection-loading');
            showSuccessMessage('内容提取完成');
        }, 1500);
    });
}

// 生成摘要
function handleSummarizeContent(elements) {
    const content = Array.from(elements).map(el => el.textContent).join('\n');
    
    // 模拟摘要生成
    showLoadingMessage('正在生成摘要...');
    
    setTimeout(() => {
        hideMessage();
        showSummary(content);
    }, 2000);
}

// 清除选择
function handleClearSelection(elements) {
    elements.forEach(element => {
        element.classList.remove('ai-selection-selected', 'ai-selection-hover', 'ai-selection-confirmed');
    });
    
    hideSelectionToolbar();
    updateSelectionCount();
}
```

### 6. 消息提示系统

```javascript
// 显示成功消息
function showSuccessMessage(message) {
    showMessage(message, 'success');
}

// 显示错误消息
function showErrorMessage(message) {
    showMessage(message, 'error');
}

// 显示加载消息
function showLoadingMessage(message) {
    showMessage(message, 'loading');
}

// 通用消息显示
function showMessage(message, type = 'info') {
    hideMessage();
    
    const messageEl = document.createElement('div');
    messageEl.className = `ai-selection-message ai-selection-message-${type}`;
    messageEl.textContent = message;
    
    document.body.appendChild(messageEl);
    
    // 显示动画
    setTimeout(() => {
        messageEl.classList.add('show');
    }, 10);
    
    // 自动隐藏
    if (type !== 'loading') {
        setTimeout(() => {
            hideMessage();
        }, 3000);
    }
}

// 隐藏消息
function hideMessage() {
    const message = document.querySelector('.ai-selection-message');
    if (message) {
        message.classList.remove('show');
        setTimeout(() => {
            message.remove();
        }, 300);
    }
}
```

### 7. 键盘快捷键支持

```javascript
// 键盘事件处理
function handleKeyboard(event) {
    switch (event.key) {
        case 'Escape':
            exitSelectionMode();
            break;
        case 'Enter':
            handleEnterKey();
            break;
        case 'a':
        case 'A':
            if (event.ctrlKey || event.metaKey) {
                event.preventDefault();
                selectAllElements();
            }
            break;
    }
}

// 退出选择模式
function exitSelectionMode() {
    document.body.classList.remove('ai-selection-active');
    
    // 清除所有选择类
    const elements = document.querySelectorAll('.ai-selection-selectable, .ai-selection-selected, .ai-selection-hover');
    elements.forEach(element => {
        element.classList.remove('ai-selection-selectable', 'ai-selection-selected', 'ai-selection-hover');
    });
    
    hideSelectionToolbar();
}

// 全选
function selectAllElements() {
    const elements = document.querySelectorAll('.ai-selection-selectable');
    elements.forEach(element => {
        element.classList.add('ai-selection-selected');
    });
    updateSelectionCount();
    showSelectionToolbar(elements[0]);
}
```

## 完整的使用流程

```javascript
// 初始化选择功能
function initSelectionFeature() {
    // 创建选择模式切换按钮
    const toggleButton = createToggleButton();
    document.body.appendChild(toggleButton);
    
    // 添加切换事件
    toggleButton.addEventListener('click', toggleSelectionMode);
    
    // 监听快捷键
    document.addEventListener('keydown', (event) => {
        if (event.altKey && event.key === 's') {
            event.preventDefault();
            toggleSelectionMode();
        }
    });
}

// 切换选择模式
function toggleSelectionMode() {
    const isActive = document.body.classList.contains('ai-selection-active');
    
    if (isActive) {
        exitSelectionMode();
    } else {
        activateSelectionMode();
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initSelectionFeature);
```

## 样式定制指南

### 1. 修改颜色方案

```css
/* 自定义选择颜色 */
.ai-selection-selected {
  background-color: rgba(255, 0, 0, 0.1) !important; /* 红色选择 */
  border-color: rgba(255, 0, 0, 0.6) !important;
}

.ai-selection-selectable:hover {
  background-color: rgba(255, 0, 0, 0.15) !important;
  border-color: rgba(255, 0, 0, 0.8) !important;
}
```

### 2. 调整动画效果

```css
/* 禁用所有动画 */
.ai-selection-active * {
  transition: none !important;
  animation: none !important;
}

/* 仅保留基本过渡 */
.ai-selection-selectable {
  transition: background-color 0.1s ease !important;
}
```

### 3. 响应式调整

```css
/* 小屏幕优化 */
@media (max-width: 480px) {
  .ai-selection-toolbar {
    padding: 6px !important;
    border-radius: 8px !important;
  }
  
  .ai-selection-btn {
    width: 32px !important;
    height: 32px !important;
  }
}
```

这些示例代码展示了如何在实际项目中使用选择功能样式，开发者可以根据具体需求进行调整和扩展。
