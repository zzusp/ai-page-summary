// 主弹出页面脚本
// 引用通信工具类
console.log('========================================');
console.log('📄 [POPUP] popup.js 脚本开始加载');
console.log('📄 [POPUP] 时间:', new Date().toISOString());
console.log('📄 [POPUP] 当前URL:', window.location.href);
console.log('========================================');

if (typeof CommunicationUtils === 'undefined' && typeof require !== 'undefined') {
  // 在某些环境中可能需要动态加载
}

console.log('📄 [POPUP] popup.js 脚本加载完成，准备初始化');
console.log('📄 [POPUP] document.readyState:', document.readyState);

class PopupManager {
  // 初始化状态
  constructor() {
    console.log('🚀 PopupManager 构造函数开始执行');
    this.isSummarizing = false; // 总结状态标志
    this.currentOperationId = null; // 当前操作ID
    this.isTaskStateRestored = false; // 任务状态是否已恢复过
    
    // 选择模式状态管理
    this.isSelectionMode = false; // 是否处于选择模式
    this.selectedElements = []; // 已选择的元素
    this.maxSelectionCount = 10; // 最大选择数量
    this.selectionStateRestored = false; // 选择状态是否已恢复过
    
    console.log('🔍 [POPUP] 开始初始化元素...');
    this.initElements();
    console.log('🔍 [POPUP] 开始绑定事件...');
    this.bindEvents();
    // 立即尝试恢复选择状态（在加载页面信息之前）
    console.log('🔍 [POPUP] 开始恢复选择状态...');
    this.restoreSelectionStateOnInit();
    console.log('🔍 [POPUP] 开始加载页面信息...');
    this.loadCurrentPageInfo();
    // 异步加载设置，捕获错误
    console.log('🔍 [POPUP] 准备调用 loadSettings...');
    this.loadSettings().catch(error => {
      console.error('❌ [POPUP] loadSettings 执行失败:', error);
      console.error('❌ [POPUP] 错误堆栈:', error.stack);
    });
    console.log('🔍 [POPUP] 开始加载历史记录预览...');
    this.loadHistoryPreview(); // 预加载历史记录预览
    this.setupKeyboardShortcuts();
    this.setupPopupLifecycle(); // 监听弹窗生命周期
    this.setupMessageListener(); // 设置消息监听
    console.log('✅ PopupManager 构造函数执行完成');
  }
  
  // 在初始化时立即恢复选择状态
  async restoreSelectionStateOnInit() {
    console.log('🔍 [Popup] 开始初始化时恢复选择状态');
    try {
      // 先获取当前标签页ID
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        this.currentTabId = tab.id;
        console.log('✅ [Popup] 初始化时获取到tabId:', this.currentTabId);
        // 立即恢复选择状态
        const restored = await this.restoreSelectionState();
        if (restored) {
          this.selectionStateRestored = true;
          console.log('✅ [Popup] 初始化时成功恢复选择状态');
        } else {
          console.log('ℹ️ [Popup] 初始化时没有找到需要恢复的选择状态');
        }
      } else {
        console.warn('⚠️ [Popup] 初始化时无法获取标签页信息');
      }
    } catch (error) {
      console.error('❌ [Popup] 初始化时恢复选择状态失败:', error);
    }
  }

  // 初始化DOM元素
  initElements() {
    // 主要按钮
    this.summarizeBtn = document.getElementById('summarizeBtn');
    this.selectElementsBtn = document.getElementById('selectElementsBtn');
    this.clearBtn = document.getElementById('clearBtn');
    this.settingsBtn = document.getElementById('settingsBtn');
    this.historyBtn = document.getElementById('historyBtn');
    this.testConnectionBtn = document.getElementById('testConnectionBtn');
    
    // 状态相关
    this.statusBar = document.getElementById('statusBar');
    this.statusIndicator = document.getElementById('statusIndicator');
    this.statusText = document.getElementById('statusText');
    
    // 页面信息
    this.pageTitle = document.getElementById('pageTitle');
    this.pageUrl = document.getElementById('pageUrl');
    
    // 加载和结果
    this.loading = document.getElementById('loading');
    this.progressBar = document.getElementById('progressBar');
    this.results = document.getElementById('results');
    this.summaryContent = document.getElementById('summaryContent');
    this.confidenceScore = document.getElementById('confidenceScore');
    this.scoreFill = document.getElementById('scoreFill');
    this.scoreText = document.getElementById('scoreText');
    this.timestamp = document.getElementById('timestamp');
    
    // 错误处理
    this.errorMessage = document.getElementById('errorMessage');
    this.errorText = document.getElementById('errorText');
    this.retryBtn = document.getElementById('retryBtn');
    
    // 操作按钮
    this.copyBtn = document.getElementById('copyBtn');
    this.exportBtn = document.getElementById('exportBtn');
    
    // 总结重点输入
    this.focusInput = document.getElementById('focusInput');
    this.charCount = document.getElementById('charCount');
    
    // API配置提示
    this.apiConfigNotice = document.getElementById('apiConfigNotice');
    this.goToConfigBtn = document.getElementById('goToConfigBtn');
    
    // 模态框
    this.historyModal = document.getElementById('historyModal');
    this.closeHistoryBtn = document.getElementById('closeHistoryBtn');
    this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
    this.exportHistoryBtn = document.getElementById('exportHistoryBtn');
    this.historyList = document.getElementById('historyList');
    
    // 选择相关元素
    this.selectionStatus = document.getElementById('selectionStatus');
    this.exitSelectionBtn = document.getElementById('exitSelectionBtn');
    this.selectionInstructions = document.getElementById('selectionInstructions');
    this.selectedCount = document.getElementById('selectedCount');
    this.selectedList = document.getElementById('selectedList');
    this.clearSelectionBtn = document.getElementById('clearSelectionBtn');
    this.viewSelectionBtn = document.getElementById('viewSelectionBtn');
    
    // 悬浮选择预览相关元素
    this.floatingSelectionPreview = document.getElementById('floatingSelectionPreview');
    this.closePreviewBtn = document.getElementById('closePreviewBtn');
    this.previewContent = document.getElementById('previewContent');
    // applySelectionBtn 已移除，选择元素现在作为总结范围
    this.clearPreviewBtn = document.getElementById('clearPreviewBtn');
    
    // 已选择元素卡片（selectedContentPreview 是动态创建的）
  }

  // 绑定事件
  bindEvents() {
    console.log('🔗 [POPUP] 开始绑定事件');
    
    // 主要功能
    if (this.summarizeBtn) {
      this.summarizeBtn.addEventListener('click', () => this.summarizeCurrentPage());
    } else {
      console.warn('⚠️ [POPUP] summarizeBtn 未找到');
    }
    
    if (this.selectElementsBtn) {
      this.selectElementsBtn.addEventListener('click', async () => {
        try {
          await this.toggleSelectionMode();
        } catch (error) {
          console.error('切换选择模式失败:', error);
          this.showError(`操作失败: ${error.message}`);
        }
      });
    } else {
      console.warn('⚠️ [POPUP] selectElementsBtn 未找到');
    }
    
    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => this.clearResults());
    } else {
      console.warn('⚠️ [POPUP] clearBtn 未找到');
    }
    
    if (this.retryBtn) {
      this.retryBtn.addEventListener('click', () => this.summarizeCurrentPage());
    } else {
      console.warn('⚠️ [POPUP] retryBtn 未找到');
    }
    
    if (this.testConnectionBtn) {
      this.testConnectionBtn.addEventListener('click', () => this.testConnection());
    } else {
      console.warn('⚠️ [POPUP] testConnectionBtn 未找到');
    }
    
    // API配置提示
    if (this.goToConfigBtn) {
      this.goToConfigBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
      });
    } else {
      console.warn('⚠️ [POPUP] goToConfigBtn 未找到');
    }
    
    // 总结重点输入
    if (this.focusInput) {
      this.focusInput.addEventListener('input', () => this.updateCharCount());
      this.focusInput.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
          e.preventDefault();
          this.summarizeCurrentPage();
        }
      });
    } else {
      console.warn('⚠️ [POPUP] focusInput 未找到');
    }
    
    // 设置和历史
    if (this.settingsBtn) {
      this.settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
    } else {
      console.warn('⚠️ [POPUP] settingsBtn 未找到');
    }
    
    if (this.historyBtn) {
      this.historyBtn.addEventListener('click', () => this.showHistory());
    } else {
      console.warn('⚠️ [POPUP] historyBtn 未找到');
    }
    
    // 操作按钮
    if (this.copyBtn) {
      this.copyBtn.addEventListener('click', () => this.copySummary());
    } else {
      console.warn('⚠️ [POPUP] copyBtn 未找到');
    }
    
    if (this.exportBtn) {
      this.exportBtn.addEventListener('click', () => this.exportSummary());
    } else {
      console.warn('⚠️ [POPUP] exportBtn 未找到');
    }
    
    // 模态框控制
    if (this.closeHistoryBtn) {
      this.closeHistoryBtn.addEventListener('click', () => this.hideHistory());
    } else {
      console.warn('⚠️ [POPUP] closeHistoryBtn 未找到');
    }
    
    if (this.clearHistoryBtn) {
      this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
    } else {
      console.warn('⚠️ [POPUP] clearHistoryBtn 未找到');
    }
    
    if (this.exportHistoryBtn) {
      this.exportHistoryBtn.addEventListener('click', () => this.exportHistory());
    } else {
      console.warn('⚠️ [POPUP] exportHistoryBtn 未找到');
    }
    
    // 点击模态框背景关闭
    if (this.historyModal) {
      this.historyModal.addEventListener('click', (e) => {
        if (e.target === this.historyModal) {
          this.hideHistory();
        }
      });
    } else {
      console.warn('⚠️ [POPUP] historyModal 未找到');
    }
    
    // 选择相关事件
    if (this.exitSelectionBtn) {
      this.exitSelectionBtn.addEventListener('click', () => this.exitSelectionMode());
    } else {
      console.warn('⚠️ [POPUP] exitSelectionBtn 未找到');
    }
    
    if (this.clearSelectionBtn) {
      this.clearSelectionBtn.addEventListener('click', () => this.clearSelection());
    } else {
      console.warn('⚠️ [POPUP] clearSelectionBtn 未找到');
    }
    
    if (this.viewSelectionBtn) {
      this.viewSelectionBtn.addEventListener('click', () => this.viewSelectedContent());
    } else {
      console.warn('⚠️ [POPUP] viewSelectionBtn 未找到');
    }
    
    // confirmSelectionBtn 可能不存在，静默处理
    if (this.confirmSelectionBtn) {
      this.confirmSelectionBtn.addEventListener('click', () => this.confirmSelection());
    }
    
    // 已选择元素卡片清除按钮在 selectedContentPreview 中动态绑定
    
    // 悬浮选择预览相关事件
    if (this.closePreviewBtn) {
      this.closePreviewBtn.addEventListener('click', () => this.hideFloatingSelectionPreview());
    }
    
    if (this.clearPreviewBtn) {
      this.clearPreviewBtn.addEventListener('click', () => this.clearSelection());
    }
    
    console.log('✅ [POPUP] 事件绑定完成');
  }

  // 加载当前页面信息
  async loadCurrentPageInfo() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        this.currentTabId = tab.id;
        this.pageTitle.textContent = tab.title || '未知页面';
        this.pageUrl.textContent = this.truncateUrl(tab.url);
        this.updateStatus('就绪', 'ready');
        
        // 如果还没有恢复过选择状态，则恢复（避免重复调用）
        // 注意：restoreSelectionStateOnInit 可能已经调用过了
        if (!this.selectionStateRestored) {
          console.log('🔍 loadCurrentPageInfo: 开始恢复选择状态');
          await this.restoreSelectionState();
        } else {
          console.log('ℹ️ loadCurrentPageInfo: 选择状态已恢复，跳过');
        }
      }
    } catch (error) {
      console.error('获取页面信息失败:', error);
      this.updateStatus('获取页面信息失败', 'error');
    }
  }

  // 预加载历史记录预览
  async loadHistoryPreview() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getHistory' });
      if (response.success && response.history && response.history.length > 0) {
        // 在历史按钮上显示记录数量
        const historyCount = response.history.length;
        const historyBtn = document.getElementById('historyBtn');
        if (historyBtn) {
          historyBtn.title = `查看历史记录 (${historyCount}条)`;
          // 添加数量徽章
          let badge = historyBtn.querySelector('.history-count');
          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'history-count';
            historyBtn.appendChild(badge);
          }
          badge.textContent = historyCount > 99 ? '99+' : historyCount;
          badge.style.display = 'inline-block';
        }
        console.log(`预加载历史记录: ${historyCount}条`);
      } else {
        // 隐藏数量徽章
        const historyBtn = document.getElementById('historyBtn');
        if (historyBtn) {
          const badge = historyBtn.querySelector('.history-count');
          if (badge) {
            badge.style.display = 'none';
          }
        }
      }
    } catch (error) {
      console.error('预加载历史记录失败:', error);
    }
  }

  // 更新历史记录数量显示
  async updateHistoryCount() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getHistory' });
      if (response.success) {
        const historyCount = response.history ? response.history.length : 0;
        const historyBtn = document.getElementById('historyBtn');
        if (historyBtn) {
          // 更新标题
          historyBtn.title = historyCount > 0 ? `查看历史记录 (${historyCount}条)` : '查看历史记录';
          // 更新或创建数量徽章
          let badge = historyBtn.querySelector('.history-count');
          if (!badge && historyCount > 0) {
            badge = document.createElement('span');
            badge.className = 'history-count';
            historyBtn.appendChild(badge);
          }
          
          if (badge) {
            if (historyCount > 0) {
              badge.textContent = historyCount > 99 ? '99+' : historyCount;
              badge.style.display = 'inline-block';
            } else {
              badge.style.display = 'none';
            }
          }
        }
        console.log(`历史记录数量已更新: ${historyCount}条`);
      }
    } catch (error) {
      console.error('更新历史记录数量失败:', error);
    }
  }

  // 监听弹窗生命周期
  setupPopupLifecycle() {
    // 监听窗口关闭事件
    window.addEventListener('beforeunload', () => {
      // 保存当前任务状态，以便在重新打开时恢复
      this.saveCurrentTaskState();
      
      // 如果处于选择模式，保存选择模式状态但不退出
      if (this.isSelectionMode) {
        this.saveSelectionState();
      }
    });

    // 监听焦点变化
    window.addEventListener('blur', () => {
      console.log('弹窗失去焦点');
      
      // 保存当前状态
      this.saveCurrentTaskState();
      
      // 如果处于选择模式，保存选择状态
      if (this.isSelectionMode) {
        this.saveSelectionState();
      }
    });

    window.addEventListener('focus', async () => {
      console.log('弹窗获得焦点，恢复任务状态');
      
      // 重新加载历史记录预览
      this.loadHistoryPreview();
      
      // 重新加载设置（可能从配置页面返回，API状态可能已改变）
      await this.loadSettings();
      
      // 检查并恢复之前的任务状态
      this.restoreTaskState();
      
      // 恢复选择模式状态（确保页面信息已加载）
      // 确保currentTabId已设置
      if (!this.currentTabId) {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab) {
            this.currentTabId = tab.id;
          }
        } catch (error) {
          console.warn('获取标签页ID失败:', error);
        }
      }
      await this.restoreSelectionState();
    });

    // 页面可见性变化
    document.addEventListener('visibilitychange', async () => {
      if (!document.hidden) {
        console.log('弹窗重新可见，检查历史记录');
        this.loadHistoryPreview();
        
        // 确保currentTabId已设置
        if (!this.currentTabId) {
          try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
              this.currentTabId = tab.id;
            }
          } catch (error) {
            console.warn('获取标签页ID失败:', error);
          }
        }
        // 恢复选择模式状态
        await this.restoreSelectionState();
        // 重新加载设置（可能从配置页面返回）
        await this.loadSettings();
      }
    });
    
    // 监听storage变化（当API测试状态改变时）
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.apiTestPassed) {
          console.log('API测试状态已改变，重新加载设置');
          this.loadSettings();
        }
      });
    }
  }

  // 设置消息监听
  setupMessageListener() {
    // 监听来自内容脚本的消息
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        try {
          if (message.source === 'content-script') {
            this.handleSelectionMessage(message);
          }
          sendResponse({ success: true });
        } catch (error) {
          console.error('处理消息失败:', error);
          sendResponse({ success: false, error: error.message });
        }
        return true; // 保持消息通道开放
      });
    }
  }

  // 保存当前任务状态
  async saveCurrentTaskState() {
    if (this.isSummarizing && this.currentOperationId) {
      try {
        const taskState = {
          operationId: this.currentOperationId,
          isSummarizing: this.isSummarizing,
          tabId: this.currentTabId,
          timestamp: Date.now(),
          userFocus: this.focusInput.value.trim()
        };
        await chrome.storage.session.set({ currentTaskState: taskState });
        console.log('已保存任务状态:', taskState);
      } catch (error) {
        console.error('保存任务状态失败:', error);
      }
    }
  }

  // 恢复任务状态
  async restoreTaskState() {
    try {
      const result = await chrome.storage.session.get('currentTaskState');
      if (result.currentTaskState) {
        const taskState = result.currentTaskState;
        const timeDiff = Date.now() - taskState.timestamp;
        
        // 如果任务状态超过5分钟，认为已过期
        if (timeDiff > 5 * 60 * 1000) {
          await this.clearTaskState();
          this.isTaskStateRestored = false; // 重置标志位
          return;
        }
        
        // 在恢复任务前先确保API配置已正确加载
        await this.loadSettings();
        
        // 检查任务是否还在进行中
        this.isSummarizing = true;
        this.currentOperationId = taskState.operationId;
        this.currentTabId = taskState.tabId;
        this.focusInput.value = taskState.userFocus || '';
        
        // 更新UI状态
        this.updateStatus('正在恢复任务...', 'loading');
        this.showLoading(50);
        this.summarizeBtn.disabled = true;
        
        // 只有在第一次恢复时才显示提示信息
        if (!this.isTaskStateRestored) {
          this.showInfo('检测到之前正在进行的总结任务，已恢复状态。');
          this.isTaskStateRestored = true; // 标记已显示过
        }
        
        console.log('已恢复任务状态:', taskState);
        
        // 重新检查任务状态
        setTimeout(() => {
          this.checkTaskStatus();
        }, 1000);
      }
    } catch (error) {
      console.error('恢复任务状态失败:', error);
      await this.clearTaskState();
      this.isTaskStateRestored = false; // 重置标志位
    }
  }

  // 检查任务状态
  async checkTaskStatus() {
    if (!this.currentOperationId) {
      return;
    }
    
    try {
      // 发送状态检查请求到后台
      const response = await CommunicationUtils.sendToBackground('checkTaskStatus', {
        operationId: this.currentOperationId
      });
      
      if (response && response.success) {
        if (response.status === 'completed') {
          // 任务已完成，显示结果
          this.hideLoading();
          this.showResults(response.summary, response.confidence, response.timestamp);
          this.isSummarizing = false;
          this.currentOperationId = null;
          await this.clearTaskState();
        } else if (response.status === 'failed') {
          // 任务失败
          this.hideLoading();
          this.showError('之前的任务失败，请重新尝试');
          this.isSummarizing = false;
          this.currentOperationId = null;
          await this.clearTaskState();
        } else {
          // 任务仍在进行中，继续等待
          this.updateStatus('正在继续总结...', 'loading');
          this.showLoading(70);
          
          // 继续检查
          setTimeout(() => {
            this.checkTaskStatus();
          }, 2000);
        }
      } else {
        // 无法获取状态，重置
        this.hideLoading();
        this.isSummarizing = false;
        this.currentOperationId = null;
        this.updateStatus('就绪', 'ready');
        this.summarizeBtn.disabled = false;
        await this.clearTaskState();
      }
    } catch (error) {
      console.error('检查任务状态失败:', error);
      this.hideLoading();
      this.isSummarizing = false;
      this.currentOperationId = null;
      this.updateStatus('就绪', 'ready');
      this.summarizeBtn.disabled = false;
      await this.clearTaskState();
    }
  }

  // 清除任务状态
  async clearTaskState() {
    try {
      await chrome.storage.session.remove('currentTaskState');
      this.isTaskStateRestored = false; // 重置标志位
      console.log('已清除任务状态');
    } catch (error) {
      console.error('清除任务状态失败:', error);
    }
  }

  async loadSettings() {
    console.log('🔍 [POPUP] loadSettings 方法被调用');
    try {
      console.log('🔍 [POPUP] 开始加载设置...');
      
      // 检查 chrome.runtime 是否可用
      if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
        console.error('❌ [POPUP] Chrome runtime API 不可用');
        this.showApiConfigNotice();
        this.summarizeBtn.disabled = true;
        return;
      }
      
      // 使用background.js的getSettings方法来获取完整的配置
      const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
      
      console.log('🔍 [POPUP] 获取设置响应 (JSON):', JSON.stringify(response, null, 2));
      
      // 检查响应是否有效
      if (!response) {
        console.error('❌ [POPUP] 获取设置响应为空');
        this.showApiConfigNotice();
        this.summarizeBtn.disabled = true;
        return;
      }
      
      if (response && response.success && response.settings) {
        this.settings = {
          provider: response.settings.provider || 'openai',
          apiKey: response.settings.apiKey || '',
          apiUrl: response.settings.apiUrl || '',
          summaryLength: response.settings.summaryLength || 'medium'
        };
        
        const settingsInfo = {
          provider: this.settings.provider,
          hasApiKey: !!this.settings.apiKey,
          hasApiUrl: !!this.settings.apiUrl,
          apiKeyLength: this.settings.apiKey ? this.settings.apiKey.length : 0,
          apiUrl: this.settings.apiUrl
        };
        console.log('🔍 [POPUP] 解析后的设置 (JSON):', JSON.stringify(settingsInfo, null, 2));
        
        // 检查API配置是否完整
        // 对于custom provider，apiUrl是必需的；对于其他provider，apiUrl可选（有默认值）
        const hasApiConfig = this.settings.apiKey && 
          (this.settings.provider === 'custom' ? !!this.settings.apiUrl : true);
        
        const statusCheck = {
          hasApiConfig: hasApiConfig,
          shouldShowNotice: !hasApiConfig
        };
        console.log('🔍 [POPUP] API状态检查 (JSON):', JSON.stringify(statusCheck, null, 2));
        
        // 根据配置状态更新UI（不再检查API测试是否通过）
        if (!hasApiConfig) {
          // 显示API配置提示
          this.showApiConfigNotice();
          // 禁用总结按钮
          this.summarizeBtn.disabled = true;
          // 隐藏错误提示（如果有）
          this.hideError();
          
          const failureInfo = {
            hasApiKey: !!this.settings.apiKey,
            hasApiUrl: !!this.settings.apiUrl,
            reason: 'API配置不完整'
          };
          console.log('⚠️ [POPUP] API配置不完整 (JSON):', JSON.stringify(failureInfo, null, 2));
        } else {
          // 隐藏API配置提示
          this.hideApiConfigNotice();
          // 启用总结按钮
          this.summarizeBtn.disabled = false;
          // 隐藏错误提示
          this.hideError();
          
          const successInfo = {
            provider: this.settings.provider,
            hasApiKey: !!this.settings.apiKey,
            hasApiUrl: !!this.settings.apiUrl,
            source: response.settings._source
          };
          console.log('✅ [POPUP] 设置加载成功，API已配置 (JSON):', JSON.stringify(successInfo, null, 2));
        }
      } else {
        console.error('❌ [POPUP] 获取设置失败:', response);
        // 显示API配置提示
        this.showApiConfigNotice();
        // 禁用总结按钮
        this.summarizeBtn.disabled = true;
        // 不显示错误提示，因为已经有配置提示了
        this.hideError();
      }
    } catch (error) {
      console.error('❌ [POPUP] 加载设置失败:', error);
      // 显示API配置提示
      this.showApiConfigNotice();
      // 禁用总结按钮
      this.summarizeBtn.disabled = true;
      // 不显示错误提示，因为已经有配置提示了
      this.hideError();
    }
  }
  
  // 显示API配置提示
  showApiConfigNotice() {
    if (this.apiConfigNotice) {
      this.apiConfigNotice.style.display = 'block';
    }
  }
  
  // 隐藏API配置提示
  hideApiConfigNotice() {
    if (this.apiConfigNotice) {
      this.apiConfigNotice.style.display = 'none';
    }
  }

  // 刷新设置（用于需要重新加载设置时）
  async refreshSettings() {
    console.log('刷新设置配置...');
    await this.loadSettings();
  }

  // 设置键盘快捷键
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey) {
        switch (e.key) {
          case 'S':
            e.preventDefault();
            this.summarizeCurrentPage();
            break;
          case 'O':
            e.preventDefault();
            chrome.runtime.openOptionsPage();
            break;
        }
      }
    });
  }

  // 更新状态
  updateStatus(message, type = 'ready') {
    this.statusText.textContent = message;
    this.statusIndicator.className = `status-indicator ${type}`;
  }

  // 更新字符计数
  updateCharCount() {
    const length = this.focusInput.value.length;
    this.charCount.textContent = length;
    
    // 根据字符数改变颜色提示
    if (length > 450) {
      this.charCount.style.color = '#dc3545'; // 红色警告
    } else if (length > 300) {
      this.charCount.style.color = '#fd7e14'; // 橙色提醒
    } else {
      this.charCount.style.color = '#6c757d'; // 默认灰色
    }
  }

  // 截断URL显示
  truncateUrl(url) {
    if (url.length > 50) {
      return url.substring(0, 47) + '...';
    }
    return url;
  }

  // 显示错误
  showError(message) {
    this.errorText.textContent = message;
    this.errorMessage.style.display = 'flex';
    this.results.style.display = 'none';
    this.loading.style.display = 'none';
    this.updateStatus('错误', 'error');
  }

  // 显示信息提示
  showInfo(message) {
    // 创建信息提示元素
    const infoDiv = document.createElement('div');
    infoDiv.className = 'info-message';
    infoDiv.style.cssText = `
      background: #e3f2fd;
      border: 1px solid #2196f3;
      color: #1976d2;
      padding: 8px 12px;
      border-radius: 4px;
      margin: 8px 0;
      font-size: 12px;
      line-height: 1.4;
    `;
    infoDiv.textContent = message;
    
    // 插入到错误消息之前
    this.errorMessage.parentNode.insertBefore(infoDiv, this.errorMessage);
    
    // 3秒后自动消失
    setTimeout(() => {
      if (infoDiv.parentNode) {
        infoDiv.parentNode.removeChild(infoDiv);
      }
    }, 3000);
  }

  // 隐藏错误
  hideError() {
    this.errorMessage.style.display = 'none';
  }

  // 显示加载状态
  showLoading(progress = 0) {
    this.loading.style.display = 'block';
    this.results.style.display = 'none';
    this.errorMessage.style.display = 'none';
    this.progressBar.style.width = `${progress}%`;
    this.updateStatus('分析中...', 'loading');
  }

  // 隐藏加载状态
  hideLoading() {
    this.loading.style.display = 'none';
  }

  // 显示结果
  showResults(summary, confidence, timestamp) {
    console.log('开始显示结果:', {
      hasSummary: !!summary,
      summaryLength: summary?.length,
      confidence: confidence,
      timestamp: timestamp
    });
    
    try {
      this.summaryContent.innerHTML = this.formatSummary(summary);
      this.scoreFill.style.width = `${confidence}%`;
      this.scoreText.textContent = `${confidence}%`;
      this.timestamp.textContent = this.formatTimestamp(timestamp);
      this.results.style.display = 'block';
      this.errorMessage.style.display = 'none';
      this.updateStatus('完成', 'success');
      
      console.log('结果显示完成:', {
        resultsDisplay: this.results.style.display,
        hasError: this.errorMessage.style.display,
        summaryContentLength: this.summaryContent.innerHTML.length
      });
    } catch (error) {
      console.error('showResults出错:', error);
    }
  }

  // 格式化总结内容
  formatSummary(summary) {
    console.log('开始格式化总结内容，长度:', summary.length);
    
    // 直接使用自定义Markdown渲染器
    try {
      console.log('使用自定义Markdown渲染器');
      return this.customMarkdownToHtml(summary);
    } catch (error) {
      console.error('自定义渲染器失败:', error);
      // 如果渲染失败，至少返回原始内容
      return `<div class="markdown-fallback">${summary.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
    }
  }

  // 自定义Markdown转HTML渲染器
  customMarkdownToHtml(markdown) {
    let html = markdown;
    
    // 转义HTML特殊字符
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // 处理代码块（```language\ncode\n```）
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre><code class="language-${lang || 'text'}">${code.trim()}</code></pre>`;
    });
    
    // 处理内联代码（`code`）
    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    
    // 处理标题（从最大到最小，避免嵌套问题）
    html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    
    // 处理粗体（**text** 和 __text__）
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    
    // 处理斜体（*text* 和 _text_）
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
    
    // 处理链接 [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    
    // 处理引用块
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
    
    // 处理有序列表
    const olRegex = /^(\s*\d+\. .+(?:\n(?!\n).+)*)/gm;
    if (html.match(olRegex)) {
      html = html.replace(olRegex, (match) => {
        const items = match.trim().split('\n').map(item => {
          return item.replace(/^\s*\d+\. /, '').trim();
        }).filter(item => item);
        return '<ol>' + items.map(item => `<li>${item}</li>`).join('') + '</ol>';
      });
    }
    
    // 处理无序列表
    const ulRegex = /^(\s*[-*+] .+(?:\n(?!\n).+)*)/gm;
    if (html.match(ulRegex)) {
      html = html.replace(ulRegex, (match) => {
        const items = match.trim().split('\n').map(item => {
          return item.replace(/^\s*[-*+] /, '').trim();
        }).filter(item => item);
        return '<ul>' + items.map(item => `<li>${item}</li>`).join('') + '</ul>';
      });
    }
    
    // 处理段落（多个换行符分隔）
    html = html.split(/\n\s*\n/).map(paragraph => {
      paragraph = paragraph.trim();
      if (paragraph && !paragraph.match(/^<(h\d|ul|ol|pre|blockquote)/)) {
        return `<p>${paragraph}</p>`;
      }
      return paragraph;
    }).join('\n');
    
    // 清理多余的空行和标签
    html = html.replace(/\n\s*\n/g, '\n').replace(/^\s+|\s+$/g, '');
    
    console.log('自定义渲染结果:', html.substring(0, 200) + '...');
    return html;
  }

  // 格式化时间戳
  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN');
  }

  // 总结当前页面
  async summarizeCurrentPage() {
    // 防止重复点击
    if (this.isSummarizing) {
      console.log('总结已在进行中，忽略重复请求');
      this.updateStatus('正在总结中...', 'loading');
      return;
    }

    if (!this.currentTabId) {
      this.showError('无法获取当前页面信息');
      return;
    }

    if (!this.settings.apiKey || !this.settings.apiUrl) {
      this.showError('请先在设置中配置API信息');
      return;
    }

    // 设置操作ID和状态
    this.currentOperationId = Date.now();
    this.isSummarizing = true;
    this.hideError();
    this.showLoading(10);
    
    console.log(`开始总结操作: ${this.currentOperationId}`);
    
    // 保存任务状态
    await this.saveCurrentTaskState();

    try {
      // 更新进度
      this.showLoading(30);
      
      // 确保内容脚本已加载
      await CommunicationUtils.ensureContentScriptLoaded(this.currentTabId);

      this.showLoading(40);

      // 根据是否有选中元素决定提取范围
      let response;
      if (this.selectedElements && this.selectedElements.length > 0) {
        // 如果有选中元素，只提取选中元素的内容（作为总结范围）
        console.log(`提取选中元素内容，元素数量: ${this.selectedElements.length}`);
        this.updateStatus(`正在提取选中元素内容...`, 'loading');
        response = await CommunicationUtils.sendToContentScript(this.currentTabId, 'extractSelectedContent', {
          selectedElements: this.selectedElements
        });
        
        if (!response || !response.success) {
          throw new Error(response?.error || '无法提取选中元素内容');
        }
        
        // extractSelectedContent 已经返回了 url 和 title，直接使用
        // 确保响应格式与 extractContent 一致
        if (!response.url) {
          response.url = '';
        }
        if (!response.title) {
          response.title = '无标题';
        }
      } else {
        // 如果没有选中元素，提取整个页面内容
        console.log('提取整个页面内容');
        response = await CommunicationUtils.sendToContentScript(this.currentTabId, 'extractContent');
      }

      if (!response || !response.content) {
        throw new Error('无法提取页面内容');
      }

      this.showLoading(60);

      // 获取用户输入的总结重点
      const userFocus = this.focusInput.value.trim();
      
      // 发送总结请求到后台脚本
      const summaryResponse = await CommunicationUtils.sendToBackground('summarizeContent', {
        content: response.content,
        url: response.url,
        title: response.title,
        operationId: this.currentOperationId, // 传递操作ID
        userFocus: userFocus // 传递用户重点关注内容
      });

      this.showLoading(90);

      if (!summaryResponse.success) {
        throw new Error(summaryResponse.error || '总结失败');
      }

      this.showLoading(100);
      
      // 检查操作是否仍然有效
      if (this.currentOperationId && summaryResponse.operationId !== this.currentOperationId) {
        console.log('操作ID不匹配，结果已过时');
        return;
      }
      
      this.hideLoading();
      this.showResults(summaryResponse.summary, summaryResponse.confidence, Date.now());
      
      // 重置状态
      this.isSummarizing = false;
      this.currentOperationId = null;
      
      // 清除保存的任务状态
      await this.clearTaskState();
      
      // 更新历史记录数量显示（数量+1）
      await this.updateHistoryCount();
      
      // 刷新历史记录预览
      setTimeout(() => {
        this.loadHistoryPreview();
      }, 500);

    } catch (error) {
      console.error('总结失败:', error);
      
      // 重置状态
      this.isSummarizing = false;
      this.currentOperationId = null;
      
      // 清除保存的任务状态
      await this.clearTaskState();
      
      // 处理连接错误
      if (error.message.includes('Could not establish connection') || 
          error.message.includes('Receiving end does not exist')) {
        this.showError('扩展连接失败。请尝试：\n1. 刷新当前网页\n2. 重新加载扩展\n3. 重启Chrome浏览器');
      } else if (error.message.includes('内容脚本')) {
        this.showError('内容提取失败，请刷新页面，并确保页面已完全加载后重试。');
      } else {
        this.showError(`总结失败: ${error.message}`);
      }
    }
  }

  // 测试扩展连接状态和API
  async testConnection() {
    try {
      this.updateStatus('测试连接中...', 'loading');
      
      // 测试后台脚本连接
      const backgroundResponse = await CommunicationUtils.sendToBackground('ping');
      if (!backgroundResponse.success) {
        throw new Error('后台脚本连接失败');
      }
      
      // 测试内容脚本连接
      if (this.currentTabId) {
        const contentResponse = await CommunicationUtils.sendToContentScript(this.currentTabId, 'ping');
        if (!contentResponse.success) {
          throw new Error('内容脚本连接失败');
        }
      }
      
      // 测试API配置
      this.updateStatus('测试API配置中...', 'loading');
      const settings = await this.getSettingsForTest();
      
      if (!settings || !settings.apiKey) {
        throw new Error('API配置不完整，请先在设置中配置API信息');
      }
      
      // 使用简单的测试内容测试API
      const testContent = '这是一个测试内容，用于验证API配置是否正确。请简单总结这段话。';
      const testPrompt = {
        system: '你是一个总结助手。请用一句话总结给定的测试内容。',
        user: `请总结以下测试内容：\n\n${testContent}`
      };
      
      this.updateStatus('测试API调用中...', 'loading');
      const apiTestResponse = await CommunicationUtils.sendToBackground('testApi', {
        prompt: testPrompt,
        settings: settings
      });
      
      if (apiTestResponse && apiTestResponse.success) {
        this.updateStatus('连接和API测试通过', 'success');
        this.showInfo('✅ 连接正常，API测试通过！');
        setTimeout(() => this.updateStatus('就绪', 'ready'), 3000);
      } else {
        throw new Error(apiTestResponse?.error || 'API测试失败');
      }
      
    } catch (error) {
      console.error('测试连接失败:', error);
      this.updateStatus('连接异常', 'error');
      this.showError(`测试失败: ${error.message}\n\n请尝试:\n1. 检查API配置是否正确\n2. 刷新当前页面\n3. 重新加载扩展`);
    }
  }
  
  // 获取设置用于测试
  async getSettingsForTest() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
      if (response && response.success && response.settings) {
        return response.settings;
      }
      return null;
    } catch (error) {
      console.error('获取设置失败:', error);
      return null;
    }
  }

  // 清除结果
  clearResults() {
    this.results.style.display = 'none';
    this.errorMessage.style.display = 'none';
    this.loading.style.display = 'none';
    this.updateStatus('已清除', 'ready');
  }

  // 复制总结
  async copySummary() {
    const summary = this.summaryContent.textContent;
    try {
      await navigator.clipboard.writeText(summary);
      this.updateStatus('已复制', 'success');
      setTimeout(() => this.updateStatus('就绪', 'ready'), 2000);
    } catch (error) {
      this.showError('复制失败');
    }
  }

  // 导出总结
  async exportSummary() {
    const content = this.summaryContent.textContent;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `页面总结-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // 保存到历史记录
  async saveToHistory(data) {
    try {
      const result = await chrome.storage.local.get(['history']);
      const history = result.history || [];
      
      history.unshift(data);
      
      // 保留最近100条记录
      if (history.length > 100) {
        history.splice(100);
      }
      
      await chrome.storage.local.set({ history });
      await this.updateHistoryCount(); // 更新数量显示
    } catch (error) {
      console.error('保存历史记录失败:', error);
    }
  }

  // 显示历史记录
  async showHistory() {
    try {
      // 通过background.js获取历史记录
      const response = await chrome.runtime.sendMessage({ action: 'getHistory' });
      if (response.success) {
        this.renderHistory(response.history);
        this.historyModal.style.display = 'flex';
      } else {
        console.error('获取历史记录失败:', response.error);
      }
    } catch (error) {
      console.error('加载历史记录失败:', error);
    }
  }

  // 渲染历史记录
  renderHistory(history) {
    if (history.length === 0) {
      this.historyList.innerHTML = '<div class="no-history">暂无历史记录</div>';
      return;
    }

    this.historyList.innerHTML = history.map(item => `
      <div class="history-item" data-id="${item.id}" data-item="${JSON.stringify({id: item.id, title: item.title})}">
        <div class="history-header">
          <h4 class="history-title">${this.escapeHtml(item.title)}</h4>
          <div class="history-actions" onclick="event.stopPropagation()">
            <button class="action-btn view-btn" data-action="view" data-id="${item.id}" title="查看">
              <span class="icon">👁️</span>
            </button>
            <button class="action-btn delete-btn" data-action="delete" data-id="${item.id}" title="删除">
              <span class="icon">🗑️</span>
            </button>
          </div>
        </div>
        <div class="history-url">${this.escapeHtml(item.url)}</div>
        <div class="history-preview">${this.escapeHtml(item.summary.substring(0, 150))}...</div>
        <div class="history-meta">
          <span class="confidence">置信度: ${item.confidence}%</span>
          <span class="timestamp">${this.formatTimestamp(item.timestamp)}</span>
          <span class="provider">${item.provider}</span>
        </div>
      </div>
    `).join('');

    // 添加事件委托监听器 - 监听整个历史记录项的点击和按钮点击
    this.historyList.addEventListener('click', (event) => {
      const historyItem = event.target.closest('.history-item');
      if (historyItem) {
        const id = historyItem.getAttribute('data-id');
        const button = event.target.closest('button[data-action]');
        
        if (button) {
          // 如果点击的是按钮，执行按钮的特定操作
          const action = button.getAttribute('data-action');
          console.log('历史记录按钮点击:', action, id);
          
          if (action === 'view') {
            this.loadHistoryItem(id);
          } else if (action === 'delete') {
            this.deleteHistoryItem(id);
          }
        } else {
          // 如果点击的是历史记录项的其他部分（除了按钮），直接查看
          console.log('历史记录项点击:', id);
          this.loadHistoryItem(id);
        }
      }
    });
  }

  // 加载历史记录项
  async loadHistoryItem(id) {
    console.log('开始加载历史记录项:', id);
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getHistory' });
      console.log('获取历史记录响应:', response);
      if (response && response.success) {
        const history = response.history;
        const item = history.find(h => h.id === id);
        console.log('找到的历史记录项:', item);
        if (item) {
          this.hideHistory();
          this.showResults(item.summary, item.confidence, item.timestamp);
          this.pageTitle.textContent = item.title;
          this.pageUrl.textContent = this.truncateUrl(item.url);
          console.log('成功显示历史记录项');
        } else {
          console.warn('未找到历史记录项:', id);
        }
      } else {
        console.error('获取历史记录失败:', response);
      }
    } catch (error) {
      console.error('加载历史记录项失败:', error);
    }
  }

  // 删除历史记录项
  async deleteHistoryItem(id) {
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'deleteHistoryItem', 
        id: id 
      });
      if (response.success) {
        this.showHistory(); // 重新渲染
        // 更新历史记录数量显示（数量-1）
        await this.updateHistoryCount();
      } else {
        console.error('删除历史记录失败:', response.error);
      }
    } catch (error) {
      console.error('删除历史记录失败:', error);
    }
  }

  // 隐藏历史记录
  hideHistory() {
    this.historyModal.style.display = 'none';
  }

  // 清空历史记录
  async clearHistory() {
    if (confirm('确定要清空所有历史记录吗？')) {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'clearHistory' });
        if (response.success) {
          this.showHistory();
          // 更新历史记录数量显示（数量归零）
          await this.updateHistoryCount();
        } else {
          console.error('清空历史记录失败:', response.error);
        }
      } catch (error) {
        console.error('清空历史记录失败:', error);
      }
    }
  }

  // 导出历史记录
  async exportHistory() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'exportHistory' });
      if (response.success) {
        const data = response.data;
        const content = data.records.map(item => 
          `标题: ${item.title}\nURL: ${item.url}\n总结: ${item.summary}\n置信度: ${item.confidence}%\n时间: ${this.formatTimestamp(item.timestamp)}\n提供商: ${item.provider}\n\n${'='.repeat(50)}\n\n`
        ).join('');
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `页面总结历史-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.updateStatus('历史记录已导出', 'success');
      } else {
        console.error('导出历史记录失败:', response.error);
      }
    } catch (error) {
      console.error('导出历史记录失败:', error);
    }
  }

  // HTML转义
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==================== 悬浮选择模式功能 ====================
  
  // 切换选择模式 - 现在会启动悬浮选择弹窗
  async toggleSelectionMode() {
    if (this.isSelectionMode) {
      await this.exitSelectionMode();
    } else {
      await this.startFloatingSelection();
    }
  }
  
  // 启动悬浮选择模式
  async startFloatingSelection() {
    // 如果currentTabId还没有设置，先尝试获取
    if (!this.currentTabId) {
      try {
        await this.loadCurrentPageInfo();
        if (!this.currentTabId) {
          this.showError('无法获取当前页面信息，请刷新页面后重试');
          return;
        }
      } catch (error) {
        console.error('获取页面信息失败:', error);
        this.showError('无法获取当前页面信息，请刷新页面后重试');
        return;
      }
    }
    
    try {
      // 确保内容脚本已加载
      await CommunicationUtils.ensureContentScriptLoaded(this.currentTabId);
      
      // 通过content script启动选择模式（在页面上直接显示悬浮弹窗）
      const response = await CommunicationUtils.sendToContentScript(this.currentTabId, 'startSelection', {
        maxSelections: this.maxSelectionCount
      });
      
      if (!response || !response.success) {
        throw new Error(response?.error || '启动悬浮选择模式失败');
      }
      
      // 标记为选择模式状态
      this.isSelectionMode = true;
      this.selectedElements = [];
      
      // 更新UI
      this.selectElementsBtn.classList.add('active');
      this.selectElementsBtn.querySelector('.btn-text').textContent = '退出选择';
      
      // 隐藏选择状态区域（因为选择弹窗在页面上）
      this.selectionStatus.style.display = 'none';
      
      // 显示选择状态
      this.updateStatus('选择模式已启动，请在页面上选择元素', 'ready');
      
      // 监听选择结果
      this.setupSelectionListener();
      
      // 保存选择状态
      await this.saveSelectionState();
      
      console.log('悬浮选择模式已启动');
      
    } catch (error) {
      console.error('启动悬浮选择模式失败:', error);
      this.showError(`启动悬浮选择模式失败: ${error.message}`);
      
      // 清理状态
      this.isSelectionMode = false;
      this.selectElementsBtn.classList.remove('active');
      this.selectElementsBtn.querySelector('.btn-text').textContent = '选择总结范围';
    }
  }
  
  // 设置选择监听器
  setupSelectionListener() {
    // 监听来自content script的选择状态更新
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.source === 'content-script') {
          if (message.action === 'elementSelected') {
            this.handleElementSelected(message.data);
            sendResponse({ success: true });
          } else if (message.action === 'selectionCleared') {
            this.handleSelectionCleared();
            sendResponse({ success: true });
          } else if (message.action === 'selectionStopped') {
            this.handleSelectionStopped(message.data);
            sendResponse({ success: true });
          }
        }
        return true;
      });
    }
  }
  
  // 处理元素选择
  handleElementSelected(data) {
    if (data && data.element) {
      // 检查是否已存在
      const existingIndex = this.selectedElements.findIndex(el => el.id === data.element.id);
      if (existingIndex === -1) {
        this.selectedElements.push(data.element);
        // 保存状态
        this.saveSelectionState();
        console.log('元素已选择:', data.element);
      }
    }
  }
  
  // 处理选择清除
  handleSelectionCleared() {
    this.selectedElements = [];
    this.saveSelectionState();
    console.log('选择已清除');
  }
  
  // 处理选择停止
  handleSelectionStopped(data) {
    if (data && data.elements) {
      this.selectedElements = data.elements || [];
      this.saveSelectionState();
      // 显示已选择内容的预览
      this.showSelectedContentPreview();
      console.log('选择已停止，已选择元素数:', this.selectedElements.length);
    }
  }
  
  // 更新选择显示
  updateSelectionDisplay() {
    if (this.selectedElements.length > 0) {
      // 显示选择状态
      this.selectionStatus.style.display = 'block';
      this.selectedCount.textContent = this.selectedElements.length;
      
      // 更新选择列表
      this.updateSelectedElementsList();
      
      this.showSelectionInstructions(`已选择 ${this.selectedElements.length} 个元素`);
    } else {
      this.selectionStatus.style.display = 'none';
      this.showSelectionInstructions('请选择页面元素作为总结范围');
    }
  }
  
  // 更新已选择元素列表
  updateSelectedElementsList() {
    if (this.selectedElements.length === 0) {
      this.selectedList.innerHTML = '<div style="color: #999; font-style: italic; text-align: center; padding: 20px;">暂无选择的元素</div>';
      return;
    }
    
    this.selectedList.innerHTML = this.selectedElements.map((element, index) => `
      <div class="selected-item" data-index="${index}">
        <div class="selected-item-text" title="${this.escapeHtml(element.text || '')}">
          ${this.escapeHtml(element.text || '').substring(0, 50)}${(element.text || '').length > 50 ? '...' : ''}
        </div>
        <span class="selected-item-type">${element.type || '元素'}</span>
      </div>
    `).join('');
  }
  
  // 选择完成回调
  async onSelectionCompleted(data) {
    if (data.elements && data.elements.length > 0) {
      this.selectedElements = data.elements;
      
      // 选择元素作为总结范围，不再填充到总结重点输入框
      // 用户可以在总结重点输入框中输入关注的重点
      
      // 更新UI
      this.updateSelectionDisplay();
      
      this.updateStatus(`已选择 ${this.selectedElements.length} 个元素作为总结范围`, 'success');
      this.showSelectionInstructions(`已选择 ${this.selectedElements.length} 个元素作为总结范围，您可以在"总结重点"输入框中指定关注的重点`);
      
      // 2秒后自动退出选择模式
      setTimeout(() => {
        this.exitSelectionMode();
      }, 2000);
      
      console.log('悬浮选择完成:', this.selectedElements);
    }
  }
  
  // 选择取消回调
  onSelectionCancelled() {
    this.selectedElements = [];
    this.isSelectionMode = false;
    
    // 恢复UI
    this.selectionStatus.style.display = 'none';
    this.selectElementsBtn.classList.remove('active');
    this.selectElementsBtn.querySelector('.btn-text').textContent = '选择页面元素';
    
    this.updateStatus('选择已取消', 'ready');
    
    console.log('悬浮选择已取消');
  }
  
  // 退出选择模式
  async exitSelectionMode() {
    if (!this.isSelectionMode) return;
    
    this.isSelectionMode = false;
    
    try {
      // 通知content script停止选择模式
      if (this.currentTabId) {
        await CommunicationUtils.sendToContentScript(this.currentTabId, 'stopSelection', {});
      }
      
      // 保存当前选择状态（即使退出模式也保存，以便下次打开时显示）
      if (this.selectedElements.length > 0) {
        await this.saveSelectionState();
        // 显示已选择内容的预览
        this.showSelectedContentPreview();
      } else {
        // 如果没有选择，清除状态
        await this.clearSelectionState();
      }
      
      // 恢复UI状态
      this.selectionStatus.style.display = 'none';
      this.selectElementsBtn.classList.remove('active');
      this.selectElementsBtn.querySelector('.btn-text').textContent = '选择总结范围';
      
      this.updateStatus('已退出选择模式', 'ready');
      this.showSelectionInstructions('');
      
      console.log('已退出悬浮选择模式');
      
    } catch (error) {
      console.error('退出选择模式失败:', error);
      
      // 即使失败也清理本地状态
      this.isSelectionMode = false;
      this.selectedElements = [];
      this.selectionStatus.style.display = 'none';
      this.selectElementsBtn.classList.remove('active');
      this.selectElementsBtn.querySelector('.btn-text').textContent = '选择总结范围';
    }
  }
  
  // 保存选择模式状态
  async saveSelectionState() {
    try {
      const selectionState = {
        isSelectionMode: this.isSelectionMode,
        selectedElements: this.selectedElements.map(el => ({
          id: el.id,
          text: el.text || el.textContent || '',
          tagName: el.tagName || '',
          selector: el.selector || ''
        })),
        tabId: this.currentTabId,
        timestamp: Date.now()
      };
      
      // 保存到session storage
      await chrome.storage.session.set({ selectionState: selectionState });
      
      // 保存到background script（确保popup关闭后仍能恢复）
      await CommunicationUtils.sendToBackground('saveSelectionState', {
        selectionState: selectionState
      });
      
      console.log('选择模式状态已保存，元素数:', this.selectedElements.length);
    } catch (error) {
      console.error('保存选择模式状态失败:', error);
    }
  }
  
  
  // 恢复选择模式状态
  async restoreSelectionState() {
    try {
      console.log('🔍 [Popup] 开始恢复选择状态，当前tabId:', this.currentTabId);
      
      // 确保currentTabId已设置
      if (!this.currentTabId) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          this.currentTabId = tab.id;
          console.log('✅ [Popup] 恢复时获取到tabId:', this.currentTabId);
        }
      }
      
      // 优先从chrome.storage.local直接读取（更可靠）
      let state = null;
      try {
        const storageResult = await chrome.storage.local.get('selectionState');
        console.log('📦 [Popup] 从storage.local读取结果:', storageResult);
        if (storageResult && storageResult.selectionState) {
          state = storageResult.selectionState;
          console.log('✅ [Popup] 从storage.local读取到选择状态:', {
            tabId: state.tabId,
            elementCount: state.selectedElements?.length || 0,
            timestamp: state.timestamp,
            isSelectionMode: state.isSelectionMode
          });
          console.log('✅ [Popup] 选择元素详情:', state.selectedElements);
        } else {
          console.log('⚠️ [Popup] storage.local中没有selectionState数据，尝试从background script获取');
        }
      } catch (error) {
        console.error('❌ [Popup] 从storage.local读取失败:', error);
      }
      
      // 如果storage.local没有，尝试从background script获取
      if (!state) {
        try {
          console.log('🔍 [Popup] 尝试从background script获取选择状态，tabId:', this.currentTabId);
          const response = await CommunicationUtils.sendToBackground('getSelectionState', {
            tabId: this.currentTabId
          });
          console.log('📦 [Popup] background script响应:', response);
          if (response && response.success && response.selectionState) {
            state = response.selectionState;
            console.log('✅ [Popup] 从background script读取到选择状态:', {
              tabId: state.tabId,
              elementCount: state.selectedElements?.length || 0,
              timestamp: state.timestamp,
              isSelectionMode: state.isSelectionMode
            });
            console.log('✅ [Popup] 选择元素详情:', state.selectedElements);
            
            // 如果从background script读取到数据，也保存到storage.local以便下次快速读取
            if (state) {
              chrome.storage.local.set({ selectionState: state }, () => {
                if (!chrome.runtime.lastError) {
                  console.log('✅ [Popup] 已将background script的数据保存到storage.local');
                }
              });
            }
          } else {
            console.log('⚠️ [Popup] background script没有返回选择状态:', response);
          }
        } catch (error) {
          console.error('❌ [Popup] 从background script读取失败:', error);
        }
      }
      
      // 如果还没有，尝试从session storage获取
      if (!state) {
        try {
          const result = await chrome.storage.session.get('selectionState');
          if (result.selectionState) {
            state = result.selectionState;
            console.log('从session storage读取到选择状态:', state);
          }
        } catch (error) {
          console.warn('从session storage读取失败:', error);
        }
      }
      
      if (state) {
        // 检查状态是否过期（超过15分钟）
        if (state.timestamp && Date.now() - state.timestamp > 15 * 60 * 1000) {
          console.log('选择状态已过期，清除');
          await this.clearSelectionState();
          return false;
        }
        
        // 检查是否在同一标签页（如果tabId存在）
        // 如果state.tabId为null（content script无法获取），则仍然尝试恢复（可能是同一标签页）
        if (state.tabId !== null && state.tabId !== undefined && this.currentTabId && state.tabId !== this.currentTabId) {
          console.log('⚠️ 选择状态属于不同标签页，不恢复', {
            stateTabId: state.tabId,
            currentTabId: this.currentTabId
          });
          return false;
        }
        
        // 如果tabId为null，记录警告但继续恢复（可能是content script无法获取tabId的情况）
        if (state.tabId === null || state.tabId === undefined) {
          console.log('⚠️ 选择状态的tabId为null，可能是content script无法获取，仍然尝试恢复');
        }
        
        // 恢复选择元素（不恢复选择模式状态，只恢复已选择的元素）
        console.log('🔍 [Popup] 检查选择状态中的元素:', {
          hasSelectedElements: !!state.selectedElements,
          isArray: Array.isArray(state.selectedElements),
          length: state.selectedElements?.length || 0,
          selectedElements: state.selectedElements
        });
        
        if (state.selectedElements && Array.isArray(state.selectedElements) && state.selectedElements.length > 0) {
          this.selectedElements = state.selectedElements;
          console.log('✅ [Popup] 恢复选择元素，数量:', this.selectedElements.length);
          console.log('✅ [Popup] 恢复的元素数据:', JSON.stringify(this.selectedElements, null, 2));
          
          // 显示已选择内容的预览
          console.log('🔍 [Popup] 准备显示预览...');
          this.showSelectedContentPreview();
          
          console.log('✅ [Popup] 已恢复选择状态并显示预览，元素数:', this.selectedElements.length);
          this.selectionStateRestored = true;
          return true;
        } else {
          console.log('⚠️ [Popup] 选择状态中没有元素或元素为空', {
            hasSelectedElements: !!state.selectedElements,
            isArray: Array.isArray(state.selectedElements),
            length: state.selectedElements?.length || 0,
            selectedElements: state.selectedElements
          });
          this.selectedElements = [];
          this.hideSelectedContentPreview();
        }
      } else {
        console.log('未找到选择状态');
        this.selectedElements = [];
        this.hideSelectedContentPreview();
      }
    } catch (error) {
      console.error('恢复选择模式状态失败:', error);
      this.selectedElements = [];
      this.hideSelectedContentPreview();
    }
    
    return false;
  }
  
  // 清除选择模式状态
  async clearSelectionState() {
    try {
      // 清除所有存储中的选择状态
      await chrome.storage.session.remove('selectionState');
      await chrome.storage.local.remove('selectionState');
      // 同时清除background script中的状态
      await CommunicationUtils.sendToBackground('clearSelectionState', {});
      // 隐藏预览
      this.hideSelectedContentPreview();
      this.selectedElements = [];
      console.log('选择模式状态已清除');
    } catch (error) {
      console.error('清除选择模式状态失败:', error);
    }
  }
  
  // 显示已选择内容的预览
  showSelectedContentPreview() {
    console.log('🔍 showSelectedContentPreview 被调用，selectedElements:', this.selectedElements);
    
    if (!this.selectedElements || this.selectedElements.length === 0) {
      console.log('⚠️ 没有选择元素，隐藏预览');
      this.hideSelectedContentPreview();
      return;
    }
    
    console.log('✅ 准备显示预览，元素数量:', this.selectedElements.length);
    
    // 创建或更新预览区域
    let previewArea = document.getElementById('selectedContentPreview');
    if (!previewArea) {
      // 在总结重点输入区（summary-focus）之前插入预览区域
      const summaryFocus = document.querySelector('.summary-focus');
      if (!summaryFocus) {
        console.error('❌ 找不到summary-focus元素，无法创建预览区域');
        return;
      }
      previewArea = document.createElement('div');
      previewArea.id = 'selectedContentPreview';
      previewArea.className = 'selected-content-preview';
      summaryFocus.parentNode.insertBefore(previewArea, summaryFocus);
      console.log('✅ 创建了新的预览区域，位置在总结重点输入区上方');
    } else {
      console.log('✅ 使用现有的预览区域');
      // 确保卡片在正确的位置（summary-focus之前）
      const summaryFocus = document.querySelector('.summary-focus');
      if (summaryFocus && previewArea.parentNode !== summaryFocus.parentNode) {
        // 如果卡片不在正确的位置，移动到正确位置
        summaryFocus.parentNode.insertBefore(previewArea, summaryFocus);
        console.log('✅ 已移动预览区域到正确位置');
      }
    }
    
    // 显示预览内容（简单显示，不显示完整内容）
    const previewText = this.selectedElements.map((el, index) => {
      // 处理不同的数据结构
      let text = '';
      if (typeof el === 'string') {
        text = el;
      } else if (el && typeof el === 'object') {
        text = el.text || el.textContent || '';
      }
      const shortText = text.length > 30 ? text.substring(0, 30) + '...' : text;
      return `${index + 1}. ${shortText || '[无文本内容]'}`;
    }).join('\n');
    
    console.log('✅ 预览文本:', previewText);
    
    previewArea.innerHTML = `
      <div class="preview-header">
        <span class="preview-icon">📋</span>
        <span class="preview-title">已选择 ${this.selectedElements.length} 个元素</span>
        <button id="clearSelectedContentBtn" class="clear-preview-btn" title="清除选择">×</button>
      </div>
      <div class="preview-content">
        <pre class="preview-text">${this.escapeHtml(previewText)}</pre>
      </div>
      <div class="preview-actions">
        <span class="preview-hint">已选择的内容将作为总结范围</span>
        <button id="viewSelectedContentBtn" class="secondary-btn small-btn" style="margin-left: auto;">查看详细</button>
      </div>
    `;
    
    previewArea.style.display = 'block';
    console.log('✅ 预览区域已显示，display:', previewArea.style.display);
    console.log('✅ 预览区域元素:', previewArea);
    
    // 绑定事件
    const clearBtn = document.getElementById('clearSelectedContentBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearSelectedContent();
      });
      console.log('✅ 清除按钮已绑定');
    } else {
      console.warn('⚠️ 找不到清除按钮');
    }
    
    // 绑定查看详细按钮
    const viewBtn = document.getElementById('viewSelectedContentBtn');
    if (viewBtn) {
      viewBtn.addEventListener('click', () => {
        this.viewSelectedContent();
      });
      console.log('✅ 查看详细按钮已绑定');
    } else {
      console.warn('⚠️ 找不到查看详细按钮');
    }
    
    // 应用按钮已移除，选择元素现在作为总结范围
  }
  
  // 隐藏已选择内容的预览
  hideSelectedContentPreview() {
    const previewArea = document.getElementById('selectedContentPreview');
    if (previewArea) {
      previewArea.style.display = 'none';
    }
  }
  
  // 清除已选择的内容
  async clearSelectedContent() {
    this.selectedElements = [];
    await this.clearSelectionState();
    this.hideSelectedContentPreview();
    this.hideFloatingSelectionPreview();
    this.updateStatus('已清除选择内容', 'ready');
  }
  
  // 查看已选择内容的详细信息
  async viewSelectedContent() {
    if (!this.selectedElements || this.selectedElements.length === 0) {
      this.showError('没有已选择的内容');
      return;
    }
    
    try {
      // 显示加载状态
      if (this.floatingSelectionPreview) {
        this.floatingSelectionPreview.style.display = 'block';
        this.previewContent.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">正在加载选中内容...</div>';
      }
      
      // 确保内容脚本已加载
      if (this.currentTabId) {
        await CommunicationUtils.ensureContentScriptLoaded(this.currentTabId);
        
        // 从content script获取完整的选择内容
        const response = await CommunicationUtils.sendToContentScript(this.currentTabId, 'extractSelectedContent', {
          selectedElements: this.selectedElements
        });
        
        if (response && response.success && response.content) {
          // 显示详细内容
          this.showFloatingSelectionPreview(response.content);
        } else {
          // 如果无法获取完整内容，使用简单文本
          const content = this.selectedElements.map((el, index) => {
            const text = el.text || el.textContent || '';
            const type = el.type || el.tagName || '元素';
            return `【${index + 1}】${type}\n${text}\n${'='.repeat(50)}`;
          }).join('\n\n');
          this.showFloatingSelectionPreview(content);
        }
      } else {
        // 如果没有tabId，使用简单文本
        const content = this.selectedElements.map((el, index) => {
          const text = el.text || el.textContent || '';
          const type = el.type || el.tagName || '元素';
          return `【${index + 1}】${type}\n${text}\n${'='.repeat(50)}`;
        }).join('\n\n');
        this.showFloatingSelectionPreview(content);
      }
    } catch (error) {
      console.error('查看选中内容失败:', error);
      // 使用简单文本作为备用
      const content = this.selectedElements.map((el, index) => {
        const text = el.text || el.textContent || '';
        const type = el.type || el.tagName || '元素';
        return `【${index + 1}】${type}\n${text}\n${'='.repeat(50)}`;
      }).join('\n\n');
      this.showFloatingSelectionPreview(content);
      this.showError(`加载内容时出错: ${error.message}`);
    }
  }
  
  // 显示悬浮选择预览
  showFloatingSelectionPreview(content) {
    if (!this.floatingSelectionPreview || !this.previewContent) {
      console.warn('预览区域元素不存在');
      return;
    }
    
    // 格式化内容显示
    const formattedContent = this.escapeHtml(content);
    const lines = formattedContent.split('\n');
    const formattedLines = lines.map(line => {
      // 高亮分隔线
      if (line.trim().startsWith('=')) {
        return `<div class="preview-separator">${line}</div>`;
      }
      // 高亮标题（【】格式）
      if (line.includes('【') && line.includes('】')) {
        return `<div class="preview-title-line">${line}</div>`;
      }
      return `<div class="preview-line">${line}</div>`;
    }).join('');
    
    this.previewContent.innerHTML = `
      <div class="preview-text-content">
        ${formattedLines}
      </div>
    `;
    
    this.floatingSelectionPreview.style.display = 'block';
    this.updateStatus(`已显示 ${this.selectedElements.length} 个选中元素的详细内容`, 'success');
  }
  
  // 隐藏悬浮选择预览
  hideFloatingSelectionPreview() {
    if (this.floatingSelectionPreview) {
      this.floatingSelectionPreview.style.display = 'none';
    }
  }
  
  // 应用已选择的内容到总结重点
  async applySelectedContent() {
    if (!this.selectedElements || this.selectedElements.length === 0) {
      return;
    }
    
    try {
      // 从content script获取完整的选择内容
      const response = await CommunicationUtils.sendToContentScript(this.currentTabId, 'extractSelectedContent', {
        selectedElements: this.selectedElements
      });
      
      if (response && response.content) {
        this.focusInput.value = response.content;
        this.updateCharCount();
        this.updateStatus('已应用选择内容到总结重点', 'success');
        this.hideSelectedContentPreview();
      } else {
        // 如果无法获取完整内容，使用简单文本
        const content = this.selectedElements.map(el => el.text || el.textContent || '').join('\n\n');
        this.focusInput.value = content;
        this.updateCharCount();
        this.updateStatus('已应用选择内容到总结重点', 'success');
        this.hideSelectedContentPreview();
      }
    } catch (error) {
      console.error('应用选择内容失败:', error);
      // 使用简单文本作为备用
      const content = this.selectedElements.map(el => el.text || el.textContent || '').join('\n\n');
      this.focusInput.value = content;
      this.updateCharCount();
      this.updateStatus('已应用选择内容到总结重点', 'success');
      this.hideSelectedContentPreview();
    }
  }
  
  // 更新选择UI
  updateSelectionUI() {
    this.selectionStatus.style.display = 'block';
    this.updateSelectedElements();
  }
  
  // 隐藏选择UI
  hideSelectionUI() {
    this.selectionStatus.style.display = 'none';
  }
  
  // 显示选择提示
  showSelectionInstructions(message) {
    this.selectionInstructions.textContent = message;
    this.selectionInstructions.classList.add('selection-pulse');
    
    // 3秒后移除脉冲动画
    setTimeout(() => {
      this.selectionInstructions.classList.remove('selection-pulse');
    }, 3000);
  }
  
  // 更新已选择元素显示
  updateSelectedElements() {
    this.selectedCount.textContent = this.selectedElements.length;
    
    if (this.selectedElements.length === 0) {
      this.selectedList.innerHTML = '<div style="color: #999; font-style: italic; text-align: center; padding: 20px;">暂无选择的元素</div>';
      return;
    }
    
    this.selectedList.innerHTML = this.selectedElements.map((element, index) => `
      <div class="selected-item" data-index="${index}">
        <div class="selected-item-text" title="${this.escapeHtml(element.text || '')}">
          ${this.escapeHtml(element.text || '').substring(0, 50)}${(element.text || '').length > 50 ? '...' : ''}
        </div>
        <button class="remove-selected-btn" data-index="${index}" title="移除">×</button>
      </div>
    `).join('');
    
    // 为移除按钮添加事件监听
    this.selectedList.querySelectorAll('.remove-selected-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.getAttribute('data-index'));
        this.removeSelectedElement(index);
      });
    });
  }
  
  // 移除已选择的元素
  removeSelectedElement(index) {
    if (index >= 0 && index < this.selectedElements.length) {
      this.selectedElements.splice(index, 1);
      this.updateSelectedElements();
      
      // 通知内容脚本移除元素高亮
      if (this.currentTabId && this.isSelectionMode) {
        CommunicationUtils.sendToContentScript(this.currentTabId, 'removeSelection', {
          index: index
        }).catch(error => {
          console.error('通知移除选择失败:', error);
        });
      }
    }
  }
  
  // 清除所有选择
  clearSelection() {
    this.selectedElements = [];
    this.updateSelectedElements();
    
    // 通知内容脚本清除所有高亮
    if (this.currentTabId && this.isSelectionMode) {
      CommunicationUtils.sendToContentScript(this.currentTabId, 'clearAllSelections').catch(error => {
        console.error('通知清除选择失败:', error);
      });
    }
  }
  
  // 确认选择
  async confirmSelection() {
    if (this.selectedElements.length === 0) {
      this.showSelectionInstructions('请先选择要作为总结范围的页面元素');
      return;
    }
    
    try {
      // 确认选择，保存选择状态（作为总结范围）
      this.updateStatus(`已选择 ${this.selectedElements.length} 个元素作为总结范围`, 'success');
      this.showSelectionInstructions(`已确认选择 ${this.selectedElements.length} 个元素作为总结范围，您可以在"总结重点"输入框中指定关注的重点`);
      
      // 退出选择模式，让用户可以输入总结重点
      setTimeout(() => {
        this.exitSelectionMode();
      }, 2000);
      
    } catch (error) {
      console.error('确认选择失败:', error);
      this.showError(`确认选择失败: ${error.message}`);
    }
  }
  
  // 处理来自内容脚本的选择消息
  handleSelectionMessage(message) {
    switch (message.action) {
      case 'elementSelected':
        this.onElementSelected(message.data);
        break;
      case 'elementRemoved':
        this.onElementRemoved(message.data);
        break;
      case 'selectionCleared':
        this.onSelectionCleared();
        break;
    }
  }
  
  // 元素被选择
  onElementSelected(data) {
    if (this.selectedElements.length >= this.maxSelectionCount) {
      this.showSelectionInstructions(`最多只能选择 ${this.maxSelectionCount} 个元素`);
      return;
    }
    
    this.selectedElements.push(data);
    this.updateSelectedElements();
    
    // 更新提示
    if (this.selectedElements.length === 1) {
      this.showSelectionInstructions('已选择1个元素作为总结范围，可以继续选择或点击确认选择');
    } else if (this.selectedElements.length >= this.maxSelectionCount) {
      this.showSelectionInstructions(`已选择${this.selectedElements.length}个元素作为总结范围，已达到最大数量`);
    } else {
      this.showSelectionInstructions(`已选择${this.selectedElements.length}个元素作为总结范围，可以继续选择或点击确认选择`);
    }
    
    console.log('元素已选择:', data);
  }
  
  // 元素被移除
  onElementRemoved(data) {
    const index = this.selectedElements.findIndex(el => el.id === data.id);
    if (index !== -1) {
      this.selectedElements.splice(index, 1);
      this.updateSelectedElements();
      console.log('元素已移除:', data);
    }
  }
  
  // 选择被清除
  onSelectionCleared() {
    this.selectedElements = [];
    this.updateSelectedElements();
    console.log('所有选择已清除');
  }
}

// 初始化
// 确保在 DOM 加载完成后初始化
console.log('========================================');
console.log('📋 [POPUP] 开始初始化流程');
console.log('📋 [POPUP] document.readyState:', document.readyState);
console.log('📋 [POPUP] document.body:', document.body ? '存在' : '不存在');
console.log('========================================');

if (document.readyState === 'loading') {
  console.log('📋 [POPUP] DOM 正在加载，等待 DOMContentLoaded 事件');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('========================================');
    console.log('📋 [POPUP] DOMContentLoaded 事件触发');
    console.log('📋 [POPUP] 开始初始化 PopupManager');
    console.log('========================================');
    try {
      window.popupManager = new PopupManager();
      console.log('✅ [POPUP] PopupManager 实例创建成功');
    } catch (error) {
      console.error('❌ [POPUP] PopupManager 实例创建失败:', error);
      console.error('❌ [POPUP] 错误堆栈:', error.stack);
    }
  });
} else {
  // DOM 已经加载完成，立即初始化
  console.log('========================================');
  console.log('📋 [POPUP] DOM 已加载完成，立即初始化 PopupManager');
  console.log('========================================');
  try {
    window.popupManager = new PopupManager();
    console.log('✅ [POPUP] PopupManager 实例创建成功');
  } catch (error) {
    console.error('❌ [POPUP] PopupManager 实例创建失败:', error);
    console.error('❌ [POPUP] 错误堆栈:', error.stack);
  }
}