// 工具函数 - 处理扩展通信
class CommunicationUtils {
  // 安全的发送消息到后台脚本
  static async sendToBackground(action, data = {}) {
    return new Promise((resolve, reject) => {
      if (!chrome.runtime?.id) {
        reject(new Error('扩展未正确加载'));
        return;
      }

      chrome.runtime.sendMessage(
        { action, ...data },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response?.success) {
            resolve(response);
          } else {
            reject(new Error(response?.error || '请求失败'));
          }
        }
      );
    });
  }

  // 安全的发送消息到内容脚本
  static async sendToContentScript(tabId, action, data = {}) {
    return new Promise((resolve, reject) => {
      if (!chrome.tabs) {
        reject(new Error('Chrome tabs API不可用'));
        return;
      }

      chrome.tabs.sendMessage(
        tabId,
        { action, ...data },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response) {
            resolve(response);
          } else {
            reject(new Error('内容脚本无响应'));
          }
        }
      );
    });
  }

  // 确保内容脚本已加载
  static async ensureContentScriptLoaded(tabId, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        // 尝试发送测试消息
        await this.sendToContentScript(tabId, 'ping');
        return true;
      } catch (error) {
        if (i === maxRetries - 1) {
          throw new Error('内容脚本加载失败');
        }
        
        // 等待并重试
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    return false;
  }

  // 创建通知
  static createNotification(options) {
    chrome.action.setIcon({
      tabId: options.tabId,
      path: {
        48: 'icons/icon48.png',
        128: 'icons/icon128.png'
      }
    });

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: options.title || '智能页面总结器',
      message: options.message
    });
  }

  // ==================== 选择模式状态管理 ====================
  
  // 发送选择模式事件到background script（处理popup关闭情况）
  static async sendSelectionEvent(tabId, originalAction, eventData) {
    try {
      // 先尝试发送到popup（如果popup存在）
      const response = await this.sendToContentScript(tabId, originalAction, eventData);
      return response;
    } catch (error) {
      // 如果popup不存在（已关闭），发送到background script
      console.log('Popup不存在，发送选择事件到background script:', originalAction);
      return await this.sendToBackground('selectionEvent', {
        originalAction: originalAction,
        ...eventData,
        tabId: tabId,
        timestamp: Date.now()
      });
    }
  }

  // 检查选择模式状态
  static async checkSelectionState(tabId) {
    try {
      // 首先检查content script中的选择状态
      const contentState = await this.sendToContentScript(tabId, 'getSelectionState');
      if (contentState && contentState.isSelectionMode) {
        return contentState;
      }
      
      // 如果content script没有选择状态，检查background script
      const bgResponse = await this.sendToBackground('getSelectionState', { tabId });
      if (bgResponse.success && bgResponse.selectionState) {
        return bgResponse.selectionState;
      }
      
      return null;
    } catch (error) {
      console.log('检查选择模式状态失败:', error.message);
      return null;
    }
  }

  // 保存选择模式状态到background（确保popup关闭后仍能恢复）
  static async saveSelectionState(tabId, selectionState) {
    try {
      // 同时保存到session storage和background script
      await chrome.storage.session.set({ selectionState: selectionState });
      
      // 保存到background script
      return await this.sendToBackground('saveSelectionState', {
        selectionState: {
          ...selectionState,
          tabId: tabId,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('保存选择模式状态失败:', error);
      // 即使background保存失败，session storage已经保存了
      return { success: true };
    }
  }

  // 清除选择模式状态
  static async clearSelectionState() {
    try {
      // 清除session storage
      await chrome.storage.session.remove(['selectionState']);
      
      // 清除background script中的状态
      await this.sendToBackground('clearSelectionState');
      
      return { success: true };
    } catch (error) {
      console.error('清除选择模式状态失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 恢复选择模式状态
  static async restoreSelectionState(tabId) {
    try {
      // 首先检查session storage
      const sessionResult = await chrome.storage.session.get(['selectionState']);
      if (sessionResult.selectionState && 
          sessionResult.selectionState.tabId === tabId) {
        return sessionResult.selectionState;
      }
      
      // 然后检查background script
      const bgResponse = await this.sendToBackground('getSelectionState', { tabId });
      if (bgResponse.success && bgResponse.selectionState) {
        return bgResponse.selectionState;
      }
      
      return null;
    } catch (error) {
      console.error('恢复选择模式状态失败:', error);
      return null;
    }
  }
}