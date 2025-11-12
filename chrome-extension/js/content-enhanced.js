// 内容脚本 - 选择模式增强管理功能
// 这些方法将集成到主要的 content.js 文件中

class SelectionModeManager {
  constructor() {
    // 选择模式状态
    this.isSelectionMode = false;
    this.selectedElements = [];
    this.maxSelections = 10;
    this.eventListeners = new Map();
    this.selectionHistory = [];
    this.errorState = null;
    this.selectionStartTime = null;
    this.mutationObserver = null;
  }

  // ==================== 增强的启动和停止方法 ====================
  
  // 启动选择模式
  async startSelection(maxSelections = 10) {
    console.log('🚀 启动选择模式，最大选择数量:', maxSelections);
    
    try {
      // 检查是否已在选择模式中
      if (this.isSelectionMode) {
        console.warn('⚠️ 选择模式已在运行中');
        this.showUserMessage('选择模式已在运行中', 'warning');
        return Promise.resolve();
      }

      // 验证参数
      if (maxSelections < 1 || maxSelections > 50) {
        throw new Error(`最大选择数量必须在1-50之间，当前值: ${maxSelections}`);
      }

      // 初始化选择模式状态
      this.isSelectionMode = true;
      this.maxSelections = maxSelections;
      this.selectedElements = [];
      this.eventListeners = new Map();
      this.selectionHistory = [];
      this.errorState = null;
      this.selectionStartTime = Date.now();
      
      // 清理之前的状态
      await this.cleanupPreviousState();
      
      // 设置全局事件监听器
      this.setupGlobalEventListeners();
      
      // 显示选择UI
      this.showSelectionOverlay();
      this.showSelectionToolbar();
      this.updateSelectionUI();
      
      // 监听页面变化（用于动态页面）
      this.setupPageChangeListeners();
      
      // 通知popup模式已启动
      this.notifyPopup('selectionModeStarted', {
        maxSelections: this.maxSelections,
        timestamp: Date.now(),
        pageUrl: window.location.href
      });
      
      console.log('✅ 选择模式启动成功');
      this.logSelectionEvent('mode_started', { maxSelections });
      
    } catch (error) {
      console.error('❌ 启动选择模式失败:', error);
      this.handleSelectionError('启动选择模式失败', error);
      
      // 清理失败状态
      await this.forceCleanupSelectionState();
      throw error;
    }
  }

  // 停止选择模式
  async stopSelection() {
    console.log('🛑 停止选择模式');
    
    try {
      // 检查是否在选择模式中
      if (!this.isSelectionMode) {
        console.warn('⚠️ 选择模式未在运行');
        return Promise.resolve();
      }

      // 记录停止前的状态
      const finalState = {
        elementCount: this.selectedElements.length,
        duration: Date.now() - (this.selectionStartTime || Date.now()),
        elements: [...this.selectedElements]
      };

      // 停止选择模式
      this.isSelectionMode = false;
      
      // 清理事件监听器
      this.cleanupEventListeners();
      
      // 清理页面变化监听
      this.cleanupPageChangeListeners();
      
      // 保存选择历史
      this.saveSelectionHistory(finalState);
      
      // 清除选择状态
      this.selectedElements = [];
      
      // 清除选择高亮
      this.clearSelectionHighlights();
      
      // 隐藏选择UI
      this.hideSelectionOverlay();
      this.hideSelectionToolbar();
      
      // 通知popup模式已停止
      this.notifyPopup('selectionModeStopped', {
        finalSelectionCount: finalState.elementCount,
        duration: finalState.duration,
        timestamp: Date.now()
      });
      
      console.log('✅ 选择模式已停止，最终选择数量:', finalState.elementCount);
      this.logSelectionEvent('mode_stopped', finalState);
      
    } catch (error) {
      console.error('❌ 停止选择模式失败:', error);
      this.handleSelectionError('停止选择模式失败', error);
      
      // 即使出错也要强制清理状态
      await this.forceCleanupSelectionState();
    }
  }

  // ==================== 事件监听器管理 ====================
  
  // 设置全局事件监听器
  setupGlobalEventListeners() {
    console.log('📡 设置全局事件监听器');
    
    // 核心选择事件
    this.addEventListener('click', this.handleSelectionClick, true);
    this.addEventListener('mouseover', this.handleMouseOver, true);
    this.addEventListener('mouseout', this.handleMouseOut, true);
    this.addEventListener('contextmenu', this.handleContextMenu, true);
    
    // 键盘事件
    this.addEventListener('keydown', this.handleKeyDown, false);
    this.addEventListener('keyup', this.handleKeyUp, false);
    
    // 滚动事件（防抖处理）
    this.addThrottledEventListener('scroll', this.handleScroll, 100);
    
    // 窗口事件
    this.addEventListener('resize', this.handleWindowResize, false);
    this.addEventListener('beforeunload', this.handleBeforeUnload, false);
    
    // 防止事件冲突
    this.addEventListener('selectstart', this.handleSelectStart, true);
    this.addEventListener('dragstart', this.handleDragStart, true);
  }

  // 添加事件监听器并记录
  addEventListener(event, handler, useCapture = false) {
    const key = `${event}_${useCapture ? 'capture' : 'bubble'}`;
    this.eventListeners.set(key, { event, handler, useCapture });
    document.addEventListener(event, handler, useCapture);
    
    console.log(`📎 添加事件监听器: ${key}`);
  }

  // 添加防抖事件监听器
  addThrottledEventListener(event, handler, delay = 100) {
    let timeoutId = null;
    const throttledHandler = (event) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        handler.call(this, event);
      }, delay);
    };
    
    this.addEventListener(event, throttledHandler, false);
    this.eventListeners.set(`${event}_throttled`, { 
      event, 
      handler: throttledHandler, 
      timeoutId 
    });
  }

  // 清理事件监听器
  cleanupEventListeners() {
    console.log('🧹 清理事件监听器');
    
    let cleanedCount = 0;
    
    // 清理普通事件监听器
    for (const [key, { event, handler, useCapture }] of this.eventListeners.entries()) {
      try {
        // 处理防抖事件
        if (key.includes('_throttled') && handler.timeoutId) {
          clearTimeout(handler.timeoutId);
        }
        
        document.removeEventListener(event, handler, useCapture);
        this.eventListeners.delete(key);
        cleanedCount++;
        
      } catch (error) {
        console.warn(`清理事件监听器失败 (${key}):`, error);
      }
    }
    
    console.log(`✅ 清理了 ${cleanedCount} 个事件监听器`);
  }

  // 强制清理所有状态
  async forceCleanupSelectionState() {
    console.log('🚨 强制清理选择模式状态');
    
    // 强制重置状态
    this.isSelectionMode = false;
    this.selectedElements = [];
    this.eventListeners.clear();
    
    // 清理所有可能的高亮
    const highlights = document.querySelectorAll('.extension-selected, .extension-temp-highlight');
    highlights.forEach(el => {
      el.classList.remove('extension-selected', 'extension-temp-highlight');
    });
    
    // 清理扩展元素
    this.cleanupExtensionElements();
    
    console.log('✅ 强制清理完成');
  }

  // ==================== 状态管理 ====================
  
  // 清理之前的状态
  async cleanupPreviousState() {
    console.log('🧽 清理之前的选择状态');
    
    // 检查是否有未完成的选择模式
    if (this.eventListeners && this.eventListeners.size > 0) {
      console.warn('发现未清理的事件监听器，强制清理');
      this.cleanupEventListeners();
    }
    
    // 清理高亮元素
    this.clearSelectionHighlights();
    
    // 清理扩展创建的DOM元素
    this.cleanupExtensionElements();
    
    // 重置错误状态
    this.errorState = null;
    
    console.log('✅ 之前状态清理完成');
  }

  // 清理扩展创建的DOM元素
  cleanupExtensionElements() {
    const extensionSelectors = [
      '[id^="extension-"]',
      '[class*="extension-selection"]',
      '.extension-overlay',
      '.extension-tooltip',
      '.extension-toolbar'
    ];
    
    let removedCount = 0;
    
    for (const selector of extensionSelectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        try {
          el.remove();
          removedCount++;
        } catch (error) {
          console.warn(`清理元素失败:`, error);
        }
      });
    }
    
    if (removedCount > 0) {
      console.log(`清理了 ${removedCount} 个扩展元素`);
    }
  }

  // 保存选择历史
  saveSelectionHistory(state) {
    try {
      const historyEntry = {
        timestamp: Date.now(),
        pageUrl: window.location.href,
        pageTitle: document.title,
        ...state
      };
      
      // 保存到内存历史记录
      this.selectionHistory.push(historyEntry);
      
      // 限制历史记录数量
      if (this.selectionHistory.length > 20) {
        this.selectionHistory.shift();
      }
      
      console.log('💾 选择历史已保存');
      
    } catch (error) {
      console.error('保存选择历史失败:', error);
    }
  }

  // ==================== 错误处理 ====================
  
  // 处理选择模式错误
  handleSelectionError(context, error) {
    const errorInfo = {
      context: context,
      message: error.message,
      stack: error.stack,
      timestamp: Date.now(),
      pageUrl: window.location.href,
      selectionMode: this.isSelectionMode,
      selectedCount: this.selectedElements?.length || 0
    };
    
    // 记录错误
    console.error('❌ 选择模式错误:', errorInfo);
    this.errorState = errorInfo;
    
    // 显示用户友好的错误消息
    this.showUserMessage(this.getErrorMessage(context, error), 'error');
    
    // 通知popup
    this.notifyPopup('selectionError', errorInfo);
    
    // 可以选择自动恢复或停止模式
    if (this.shouldAutoRecover(context, error)) {
      console.log('🔄 尝试自动恢复...');
      setTimeout(() => this.attemptAutoRecovery(), 1000);
    }
  }

  // 获取用户友好的错误消息
  getErrorMessage(context, error) {
    const errorMessages = {
      '启动选择模式失败': '无法启动选择模式，请刷新页面后重试',
      '停止选择模式失败': '停止选择模式时发生错误，页面已自动清理',
      '事件监听失败': '事件监听设置失败，可能影响选择功能',
      '选择元素失败': '选择元素时出现错误，请重试',
      '提取内容失败': '提取选择内容失败，请检查页面状态'
    };
    
    return errorMessages[context] || `操作失败: ${error.message}`;
  }

  // 判断是否应该自动恢复
  shouldAutoRecover(context, error) {
    // 某些错误可以自动恢复
    const recoverableErrors = [
      'event listener',
      'timeout',
      'network'
    ];
    
    return recoverableErrors.some(keyword => 
      error.message.toLowerCase().includes(keyword)
    );
  }

  // 尝试自动恢复
  async attemptAutoRecovery() {
    try {
      console.log('🔧 尝试自动恢复选择模式...');
      
      // 清理当前状态
      await this.forceCleanupSelectionState();
      
      // 重新启动选择模式
      await this.startSelection(this.maxSelections);
      
      this.showUserMessage('选择模式已自动恢复', 'success');
      
    } catch (error) {
      console.error('自动恢复失败:', error);
      this.showUserMessage('自动恢复失败，请手动重启选择模式', 'error');
    }
  }

  // ==================== 用户反馈 ====================
  
  // 显示用户消息
  showUserMessage(message, type = 'info', duration = 3000) {
    try {
      // 创建消息元素
      const messageEl = document.createElement('div');
      messageEl.className = `extension-message extension-message-${type}`;
      messageEl.innerHTML = this.getMessageHTML(message, type);
      
      // 添加样式
      this.addMessageStyles();
      
      // 添加到页面
      document.body.appendChild(messageEl);
      
      // 动画显示
      setTimeout(() => messageEl.classList.add('show'), 10);
      
      // 自动移除
      if (duration > 0) {
        setTimeout(() => {
          messageEl.classList.remove('show');
          setTimeout(() => {
            if (messageEl.parentNode) {
              messageEl.parentNode.removeChild(messageEl);
            }
          }, 300);
        }, duration);
      }
      
      console.log(`💬 显示用户消息: ${message} (${type})`);
      
    } catch (error) {
      console.error('显示用户消息失败:', error);
    }
  }

  // 获取消息HTML
  getMessageHTML(message, type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    return `
      <div class="extension-message-icon">${icons[type] || icons.info}</div>
      <div class="extension-message-text">${message}</div>
      <button class="extension-message-close" onclick="this.parentElement.remove()">×</button>
    `;
  }

  // 添加消息样式
  addMessageStyles() {
    if (document.getElementById('extension-message-styles')) {
      return;
    }
    
    const style = document.createElement('style');
    style.id = 'extension-message-styles';
    style.textContent = `
      .extension-message {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        padding: 16px;
        max-width: 350px;
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 12px;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        border-left: 4px solid #2196f3;
      }
      
      .extension-message.show {
        transform: translateX(0);
      }
      
      .extension-message-success {
        border-left-color: #4caf50;
      }
      
      .extension-message-error {
        border-left-color: #f44336;
      }
      
      .extension-message-warning {
        border-left-color: #ff9800;
      }
      
      .extension-message-icon {
        font-size: 18px;
        flex-shrink: 0;
      }
      
      .extension-message-text {
        flex: 1;
        font-size: 14px;
        color: #333;
        line-height: 1.4;
      }
      
      .extension-message-close {
        background: none;
        border: none;
        font-size: 18px;
        color: #999;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .extension-message-close:hover {
        color: #333;
      }
    `;
    
    document.head.appendChild(style);
  }

  // ==================== 页面变化监听 ====================
  
  // 设置页面变化监听
  setupPageChangeListeners() {
    // 监听URL变化（SPA页面）
    this.addEventListener('popstate', this.handlePageChange, false);
    
    // 监听DOM变化
    this.setupMutationObserver();
    
    // 监听网络状态变化
    if (navigator.onLine !== undefined) {
      this.addEventListener('online', this.handleOnline, false);
      this.addEventListener('offline', this.handleOffline, false);
    }
  }

  // 设置MutationObserver
  setupMutationObserver() {
    try {
      this.mutationObserver = new MutationObserver((mutations) => {
        let shouldRefresh = false;
        
        mutations.forEach(mutation => {
          // 检查是否有重要的DOM变化
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            // 检查新增的节点是否可能影响选择
            for (let node of mutation.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const rect = node.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  shouldRefresh = true;
                  break;
                }
              }
            }
          }
        });
        
        if (shouldRefresh) {
          this.handlePageContentChange();
        }
      });
      
      this.mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false
      });
      
      console.log('🔍 MutationObserver 已设置');
      
    } catch (error) {
      console.warn('设置MutationObserver失败:', error);
    }
  }

  // 清理页面变化监听
  cleanupPageChangeListeners() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    
    console.log('🧹 页面变化监听已清理');
  }

  // ==================== 事件处理 ====================
  
  // 处理键盘事件
  handleKeyDown = (event) => {
    if (!this.isSelectionMode) return;
    
    switch (event.key) {
      case 'Escape':
        // ESC键停止选择模式
        event.preventDefault();
        this.stopSelection();
        break;
      case 'a':
        if (event.ctrlKey || event.metaKey) {
          // Ctrl+A 选择所有可选择元素
          event.preventDefault();
          this.selectAllElements();
        }
        break;
      case 'Delete':
      case 'Backspace':
        // 删除键清除最后选择
        if (this.selectedElements.length > 0) {
          this.removeSelection(this.selectedElements.length - 1);
        }
        break;
    }
  }

  // 处理窗口调整大小
  handleWindowResize = (event) => {
    if (!this.isSelectionMode) return;
    
    // 延迟更新UI，避免频繁调用
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      this.updateSelectionUI();
    }, 150);
  }

  // 处理页面卸载
  handleBeforeUnload = (event) => {
    if (this.isSelectionMode) {
      console.log('页面即将卸载，清理选择模式');
      this.forceCleanupSelectionState();
    }
  }

  // ==================== 通信功能 ====================
  
  // 通知popup
  notifyPopup(action, data) {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        console.warn('Chrome runtime 不可用');
        return;
      }
      
      const message = {
        source: 'content-script',
        action: action,
        data: data,
        timestamp: Date.now(),
        tabId: this.getCurrentTabId()
      };
      
      // 发送消息
      chrome.runtime.sendMessage(message)
        .then(response => {
          if (chrome.runtime.lastError) {
            console.warn('消息发送错误:', chrome.runtime.lastError.message);
          } else {
            console.log(`📤 向popup发送消息: ${action}`, response);
          }
        })
        .catch(error => {
          console.error('通知popup失败:', error);
          
          // 尝试备用通信方式
          this.fallbackNotifyPopup(action, data);
        });
        
    } catch (error) {
      console.error('通知popup出错:', error);
    }
  }

  // 备用通信方式
  fallbackNotifyPopup(action, data) {
    try {
      // 使用storage作为备用通信方式
      if (chrome.storage) {
        chrome.storage.local.set({
          [`fallbackMessage_${Date.now()}`]: {
            action,
            data,
            source: 'content-script',
            timestamp: Date.now()
          }
        });
      }
    } catch (error) {
      console.error('备用通信方式也失败:', error);
    }
  }

  // 获取当前标签页ID
  getCurrentTabId() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs[0]?.id || null);
      });
    });
  }

  // 记录选择事件
  logSelectionEvent(eventType, data) {
    const logEntry = {
      event: eventType,
      data: data,
      timestamp: Date.now(),
      pageUrl: window.location.href,
      selectionCount: this.selectedElements?.length || 0
    };
    
    console.log(`📊 选择事件: ${eventType}`, logEntry);
    
    // 可以发送到background script进行统计
    this.notifyPopup('selectionEventLogged', logEntry);
  }

  // ==================== 辅助方法 ====================
  
  // 更新选择UI
  updateSelectionUI() {
    this.updateSelectionCount();
    this.updateSelectionStatus();
  }

  // 更新选择状态
  updateSelectionStatus(message = null, type = 'info') {
    if (message) {
      this.showUserMessage(message, type);
    }
    
    // 通知popup更新状态
    this.notifyPopup('selectionStatusUpdate', {
      message: message,
      type: type,
      selectedCount: this.selectedElements.length,
      maxSelections: this.maxSelections
    });
  }

  // 更新选择数量
  updateSelectionCount() {
    const countElements = document.querySelectorAll('#selection-count, .selection-count');
    countElements.forEach(el => {
      el.textContent = this.selectedElements.length;
    });
  }
}

// 导出管理类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SelectionModeManager;
}