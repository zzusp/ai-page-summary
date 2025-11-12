// SyncManager: 负责跨设备同步管理
class SyncManager {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1秒
    this.syncKey = 'lastSyncTimestamp';
    this.isOnline = true;
    
    // 监听网络状态
    this.setupNetworkListener();
  }

  // 设置网络状态监听
  setupNetworkListener() {
    chrome.runtime.onConnect?.addListener((port) => {
      if (port.name === 'sync_channel') {
        port.onMessage.addListener((message) => {
          if (message.type === 'network_status') {
            this.isOnline = message.online;
          }
        });
      }
    });
  }

  // 带重试的存储操作
  async saveWithRetry(storageArea, data, maxRetries = this.maxRetries) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        // 检查网络状态
        if (!this.isOnline && storageArea === chrome.storage.sync) {
          throw new Error('网络离线，暂不同步到云端');
        }
        
        await new Promise((resolve, reject) => {
          storageArea.set(data, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });
        
        return { success: true, attempt: i + 1 };
      } catch (error) {
        lastError = error;
        console.warn(`存储尝试 ${i + 1} 失败:`, error.message);
        
        // 最后一次重试失败，直接抛出错误
        if (i === maxRetries - 1) {
          break;
        }
        
        // 指数退避重试
        await this.delay(this.retryDelay * Math.pow(2, i));
      }
    }
    
    return { success: false, error: lastError.message, attempt: maxRetries };
  }

  // 带重试的获取操作
  async getWithRetry(storageArea, keys, maxRetries = this.maxRetries) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await new Promise((resolve, reject) => {
          storageArea.get(keys, (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(result);
            }
          });
        });
        
        return { success: true, data: result, attempt: i + 1 };
      } catch (error) {
        lastError = error;
        console.warn(`获取尝试 ${i + 1} 失败:`, error.message);
        
        if (i === maxRetries - 1) {
          break;
        }
        
        await this.delay(this.retryDelay * Math.pow(2, i));
      }
    }
    
    return { success: false, error: lastError.message, data: {}, attempt: maxRetries };
  }

  // 延迟函数
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 获取同步时间戳
  async getSyncTimestamp() {
    const result = await this.getWithRetry(chrome.storage.local, [this.syncKey]);
    return result.success ? result.data[this.syncKey] || 0 : 0;
  }

  // 更新同步时间戳
  async updateSyncTimestamp() {
    const timestamp = Date.now();
    await this.saveWithRetry(chrome.storage.local, { [this.syncKey]: timestamp });
    return timestamp;
  }

  // 冲突解决：比较时间戳，保留最新的设置
  async resolveConflict(localSettings, remoteSettings) {
    const localTimestamp = localSettings.timestamp || 0;
    const remoteTimestamp = remoteSettings.timestamp || 0;
    
    if (remoteTimestamp > localTimestamp) {
      console.log('使用远程设置（更新）');
      return {
        ...remoteSettings,
        _conflictResolved: true,
        _resolvedAt: Date.now()
      };
    } else {
      console.log('使用本地设置（更新）');
      return {
        ...localSettings,
        _conflictResolved: true,
        _resolvedAt: Date.now()
      };
    }
  }

  // 检查是否为有效的设置数据
  isValidSettings(data) {
    return data && 
           typeof data === 'object' && 
           (data.provider || data.apiProvider) && 
           Object.keys(data).length > 0;
  }
}

// 后台服务工作者脚本
class BackgroundService {
  constructor() {
    this.contextMenuListenerAdded = false;
    this.isInitialized = false;
    this.syncManager = new SyncManager();
    // 在构造函数中调用异步初始化
    this.init().catch(error => {
      console.error('初始化失败:', error);
    });
  }

  // 初始化
  async init() {
    // 防止重复初始化
    if (this.isInitialized) {
      console.log('Background service already initialized');
      return;
    }
    
    try {
      // 监听来自popup和content script的消息
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        this.handleMessage(message, sender, sendResponse);
        return true; // 保持消息通道开放
      });

      // 设置快捷键监听
      chrome.commands.onCommand.addListener((command) => {
        this.handleCommand(command);
      });

      // 初始化跨设备同步
      await this.initializeSync();

      // 延迟初始化上下文菜单，确保Service Worker完全启动
      setTimeout(() => {
        this.setupContextMenus();
      }, 100);

      this.isInitialized = true;
      console.log('Background service initialized successfully with sync support');
    } catch (error) {
      console.error('Failed to initialize background service:', error);
    }
  }

  // 初始化跨设备同步
  async initializeSync() {
    try {
      // 监听存储变化事件（跨设备同步）
      chrome.storage.onChanged.addListener((changes, areaName) => {
        this.handleStorageChange(changes, areaName);
      });

      // 初始化时进行数据迁移（向后兼容性）
      await this.migrateLegacyData();

      // 标记同步已初始化
      console.log('跨设备同步已初始化');
    } catch (error) {
      console.error('Failed to initialize sync:', error);
    }
  }

  // 处理存储变化事件（跨设备同步）
  async handleStorageChange(changes, areaName) {
    try {
      if (areaName === 'sync' && changes.appSettings) {
        console.log('检测到设置变更，准备进行跨设备同步...');
        
        // 获取本地设置
        const localResult = await this.getLocalSettings();
        const newSettings = changes.appSettings.newValue;
        
        // 检查是否是有效的设置数据
        if (this.syncManager.isValidSettings(newSettings)) {
          // 冲突解决
          const resolvedSettings = await this.syncManager.resolveConflict(
            localResult, 
            newSettings
          );
          
          // 更新本地设置（带时间戳）
          await this.saveLocalSettings(resolvedSettings);
          
          // 通知前端设置已同步
          this.broadcastSettingsUpdate(resolvedSettings, 'cross_device_sync');
        }
      }
    } catch (error) {
      console.error('处理存储变化失败:', error);
    }
  }

  // 广播设置更新到所有相关页面
  broadcastSettingsUpdate(settings, source) {
    // 发送消息到所有打开的标签页
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'settingsUpdated',
          settings: settings,
          source: source
        }).catch(() => {
          // 忽略无法发送消息的标签页
        });
      });
    });
  }

  // 数据迁移：向后兼容性处理
  async migrateLegacyData() {
    try {
      console.log('开始数据迁移...');
      
      // 检查是否已经迁移过
      const migrationResult = await this.syncManager.getWithRetry(
        chrome.storage.local, ['migrationCompleted']
      );
      
      if (migrationResult.success && migrationResult.data.migrationCompleted) {
        console.log('数据已迁移，跳过迁移步骤');
        return;
      }

      // 检查是否有旧的local存储数据需要迁移到sync
      const legacyResult = await this.syncManager.getWithRetry(
        chrome.storage.local, 
        ['apiProvider', 'apiKey', 'apiUrl', 'summaryLength', 'modelName', 'temperature', 'maxTokens']
      );

      if (legacyResult.success) {
        const legacyData = legacyResult.data;
        const hasLegacyData = Object.keys(legacyData).some(key => legacyData[key] !== undefined);
        
        if (hasLegacyData) {
          console.log('发现旧数据，开始迁移...');
          
          // 添加时间戳
          const timestampedData = {
            ...legacyData,
            timestamp: Date.now(),
            _migrated: true
          };
          
          // 迁移到sync存储
          const syncResult = await this.syncManager.saveWithRetry(
            chrome.storage.sync, 
            { appSettings: timestampedData }
          );
          
          if (syncResult.success) {
            console.log('数据迁移成功');
          } else {
            console.warn('数据迁移失败，将保持local存储作为备用');
          }
        }
      }
      
      // 标记迁移完成
      await this.syncManager.saveWithRetry(
        chrome.storage.local, 
        { migrationCompleted: true, migrationDate: Date.now() }
      );
      
    } catch (error) {
      console.error('数据迁移失败:', error);
    }
  }

  // 处理消息
  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'ping':
          sendResponse({ success: true, message: 'Background script is ready' });
          break;
          
        case 'summarizeContent':
          const result = await this.summarizeContent(message.content, message.url, message.title, message.userFocus, message.operationId);
          sendResponse(result);
          break;
        
        case 'saveSettings':
          const saveResult = await this.saveSettings(message.settings);
          sendResponse(saveResult);
          break;
        
        case 'getSettings':
          try {
            const settings = await this.getSettings();
            console.log('🔍 [BACKGROUND] getSettings 返回:', {
              hasSettings: !!settings,
              provider: settings?.provider,
              hasApiKey: !!settings?.apiKey,
              hasApiUrl: !!settings?.apiUrl
            });
            sendResponse({ success: true, settings });
          } catch (error) {
            console.error('❌ [BACKGROUND] getSettings 失败:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;
        
        case 'testApi':
          const testResult = await this.testApi(message.prompt, message.settings);
          sendResponse(testResult);
          break;
        
        case 'clearSettings':
          const clearResult = await this.clearSettings();
          sendResponse(clearResult);
          break;
        
        case 'forceSync':
          const syncResult = await this.forceSyncSettings();
          sendResponse(syncResult);
          break;
        
        case 'getSyncStatus':
          const syncStatus = await this.getSyncStatus();
          sendResponse({ success: true, status: syncStatus });
          break;
        
        // 历史记录相关操作
        case 'getHistory':
          const history = await this.getHistory();
          sendResponse({ success: true, history });
          break;
        
        case 'deleteHistoryItem':
          await this.deleteHistoryItem(message.id);
          sendResponse({ success: true });
          break;
        
        case 'clearHistory':
          await this.clearHistory();
          sendResponse({ success: true });
          break;
        
        case 'exportHistory':
          const exportData = await this.exportHistory();
          sendResponse({ success: true, data: exportData });
          break;
        
        // 任务状态检查
        case 'checkTaskStatus':
          const taskStatus = await this.checkTaskStatus(message.operationId);
          sendResponse({ success: true, ...taskStatus });
          break;
        
        // 选择模式状态管理
        case 'saveSelectionState':
          // 如果selectionState中没有tabId，从sender获取
          const updatedState = { ...message.selectionState };
          if (!updatedState.tabId && sender.tab) {
            updatedState.tabId = sender.tab.id;
            console.log('✅ background script自动填充tabId:', updatedState.tabId);
          }
          await this.saveSelectionState(updatedState);
          // 返回更新后的状态，让content script知道tabId已被填充
          sendResponse({ 
            success: true, 
            updatedState: updatedState.tabId ? { tabId: updatedState.tabId } : null 
          });
          break;
        
        case 'getSelectionState':
          console.log('🔍 [Background] 收到getSelectionState请求，tabId:', message.tabId);
          const selectionState = await this.getSelectionState(message.tabId);
          console.log('📦 [Background] 返回选择状态:', {
            hasState: !!selectionState,
            tabId: selectionState?.tabId,
            elementCount: selectionState?.selectedElements?.length || 0
          });
          sendResponse({ success: true, selectionState });
          break;
        
        case 'clearSelectionState':
          await this.clearSelectionState();
          sendResponse({ success: true });
          break;
        
        // 选择模式事件处理
        case 'selectionEvent':
          await this.handleSelectionEvent(message.data);
          sendResponse({ success: true });
          break;
        
        // 悬浮选择弹窗管理
        case 'createFloatingSelection':
          const createResult = await this.createFloatingSelection(message.tabId, message.maxSelections);
          sendResponse(createResult);
          break;
        
        case 'closeFloatingSelection':
          await this.closeFloatingSelection(message.tabId);
          sendResponse({ success: true });
          break;
        
        case 'updateSelectionState':
          await this.updateSelectionState(message.tabId, message.selectionData);
          sendResponse({ success: true });
          break;
        
        case 'getCurrentTabId':
          // 获取当前标签页ID
          if (sender.tab) {
            sendResponse({ success: true, tabId: sender.tab.id });
          } else {
            sendResponse({ success: false, error: '无法获取标签页ID' });
          }
          break;
        
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background service error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  // 处理命令
  async handleCommand(command) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      switch (command) {
        case 'summarize':
          await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
          break;
        case 'open_config':
          chrome.runtime.openOptionsPage();
          break;
      }
    } catch (error) {
      console.error('Command handling error:', error);
    }
  }

  // 设置上下文菜单
  setupContextMenus() {
    try {
      // 清除所有现有菜单
      this.removeAllContextMenus();
      
      // 等待清除完成后创建新菜单
      setTimeout(() => {
        this.createContextMenus();
      }, 200);
    } catch (error) {
      console.error('Failed to setup context menus:', error);
    }
  }

  // 创建上下文菜单
  createContextMenus() {
    try {
      // 创建新的上下文菜单
      chrome.contextMenus.create({
        id: 'summarizePage',
        title: '智能总结此页面',
        contexts: ['page']
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('Failed to create context menu:', chrome.runtime.lastError);
          return;
        }
        console.log('Context menu created successfully');
      });

      // 设置点击事件监听器（只设置一次）
      this.setupContextMenuListener();
    } catch (error) {
      console.error('Failed to create context menus:', error);
    }
  }

  // 移除所有上下文菜单
  removeAllContextMenus() {
    try {
      chrome.contextMenus.removeAll(() => {
        if (chrome.runtime.lastError) {
          console.warn('Warning while removing context menus:', chrome.runtime.lastError);
        } else {
          console.log('All context menus removed successfully');
        }
      });
    } catch (error) {
      console.error('Failed to remove context menus:', error);
    }
  }

  // 设置上下文菜单点击监听器
  setupContextMenuListener() {
    // 确保只添加一次监听器
    if (this.contextMenuListenerAdded) return;
    
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
      if (info.menuItemId === 'summarizePage' && tab.id) {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
          if (response && response.success) {
            const summaryResult = await this.summarizeContent(
              response.content, 
              response.url, 
              response.title
            );
            
            // 显示通知
            this.showSummaryNotification(response.title, summaryResult);
          }
        } catch (error) {
          console.error('Context menu action failed:', error);
        }
      }
    });
    
    this.contextMenuListenerAdded = true;
  }

  // 总结内容
  async summarizeContent(content, url, title, userFocus = '', operationId = null) {
    try {
      console.log('开始总结内容:', { url, title: title?.substring(0, 50), hasUserFocus: !!userFocus });
      
      // 获取用户设置
      const settings = await this.getSettings();
      console.log('获取设置:', { 
        provider: settings.provider, 
        hasApiKey: !!settings.apiKey, 
        hasApiUrl: !!settings.apiUrl 
      });
      
      if (!settings.apiKey) {
        throw new Error('请先在扩展设置中配置API密钥');
      }
      
      if (!settings.apiUrl && settings.provider === 'custom') {
        throw new Error('自定义API模式下请配置API地址');
      }

      // 准备提示词
      const prompt = this.buildPrompt(content, title, settings, userFocus);
      console.log('构建提示词完成:', { 
        systemLength: prompt.system?.length, 
        userLength: prompt.user?.length 
      });

      // 如果提供了操作ID，保存操作状态
      if (operationId) {
        await this.saveOperationState(operationId, {
          status: 'in_progress',
          url: url,
          title: title,
          userFocus: userFocus,
          timestamp: Date.now()
        });
      }
      
      // 调用API
      console.log('开始调用API...');
      const result = await this.callApi(prompt, settings);
      
      if (!result.success) {
        console.error('API调用失败:', result.error);
        throw new Error(result.error || 'API调用失败');
      }

      console.log('API调用成功');

      // 计算置信度
      const confidence = this.calculateConfidence(content, result.summary);

      // 自动保存到历史记录
      try {
        await this.saveSummaryToHistory({
          url: url,
          title: title,
          summary: result.summary,
          confidence: confidence,
          usage: result.usage,
          timestamp: Date.now(),
          provider: settings.provider
        });
        console.log('已自动保存到历史记录');
      } catch (historyError) {
        console.error('保存到历史记录失败:', historyError);
        // 不影响主流程，只记录错误
      }

      // 如果提供了操作ID，更新操作状态为完成
      if (operationId) {
        await this.saveOperationState(operationId, {
          status: 'completed',
          result: {
            summary: result.summary,
            confidence: confidence
          },
          timestamp: Date.now()
        });
      }

      return {
        success: true,
        summary: result.summary,
        confidence: confidence,
        usage: result.usage,
        timestamp: Date.now(),
        operationId: operationId
      };

    } catch (error) {
      console.error('Summary failed:', error);
      
      // 提供更详细的错误信息
      let userMessage = error.message;
      if (error.message.includes('400')) {
        userMessage = 'API请求格式错误，请检查：\n' +
          '1. API密钥是否正确\n' +
          '2. API地址是否有效\n' +
          '3. 网络连接是否正常\n' +
          '4. API服务是否正常';
      } else if (error.message.includes('401')) {
        userMessage = 'API认证失败，请检查API密钥是否正确';
      } else if (error.message.includes('403')) {
        userMessage = 'API访问被拒绝，请检查API权限设置';
      } else if (error.message.includes('429')) {
        userMessage = 'API调用频率过高，请稍后重试';
      } else if (error.message.includes('500')) {
        userMessage = 'API服务器错误，请稍后重试';
      }
      
      // 如果提供了操作ID，更新操作状态为失败
      if (operationId) {
        await this.saveOperationState(operationId, {
          status: 'failed',
          error: userMessage,
          timestamp: Date.now()
        });
      }
      
      return {
        success: false,
        error: userMessage,
        timestamp: Date.now(),
        operationId: operationId
      };
    }
  }

  // 构建优化提示词
  buildPrompt(content, title, settings, userFocus = '') {
    // 判断是否有用户指定的重点
    const hasFocus = userFocus && userFocus.trim().length > 0;
    const focusSection = hasFocus ? `## 重点关注领域
用户在以下方面希望获得重点关注，请特别突出这些内容：
${userFocus}

` : '';
    
    // 为有重点和无重点分别准备不同的提示词模板
    const promptTemplates = {
      openai: {
        // 无用户重点的通用总结
        noFocus: {
          system: `你是一个专业的内容总结专家。你的任务是对给定的网页内容进行客观、准确、全面的总结。

请遵循以下原则：
1. 以客观总结为主，不要添加个人观点或评价
2. 保持内容的完整性和准确性
3. 提取所有关键信息和重要观点
4. 覆盖内容的核心要点和主要信息
5. 使用清晰、简洁的语言
6. 如果内容包含多个部分，请分别总结
7. 避免重复和冗余信息
8. 保留重要的数据、事实和结论
9. 以原始内容为主，不进行过度发散或扩展

总结格式：
- 使用简洁的段落和项目符号
- 突出主要观点和关键信息
- 保持逻辑清晰和结构化
- 确保信息完整且易于理解`,

          user: `请总结以下网页内容：

标题：${title}

内容：
${content}

请提供全面、详细的总结，确保涵盖所有重要信息。`
        },
        // 有用户重点的定向总结
        withFocus: {
          system: `你是一个专业的内容总结专家。你的任务是对给定的网页内容进行客观、准确的总结，并特别关注用户指定的重点内容。

请遵循以下原则：
1. 以客观总结为主，不要添加个人观点或评价
2. 保持内容的完整性和准确性
3. 重点突出用户指定的重点领域
4. 提取关键信息和重要观点
5. 使用清晰、简洁的语言
6. 如果内容包含多个部分，请分别总结
7. 避免重复和冗余信息
8. 保留重要的数据、事实和结论
9. 以原始内容为主，不进行过度发散或扩展

总结格式：
- 使用简洁的段落和项目符号
- 重点突出主要观点和关键信息
- 对用户重点关注的内容给予更高权重
- 保持逻辑清晰和结构化`,

          user: `${focusSection}请总结以下网页内容：

标题：${title}

内容：
${content}

请提供详细的总结，在全面覆盖的基础上，特别突出用户指定的重点内容。`
        }
      },
      
      anthropic: {
        // 无用户重点的通用总结
        noFocus: {
          system: `你是一个专业的内容分析专家。请对提供的网页内容进行客观、全面、详细的总结。

总结要求：
- 客观准确，不添加主观判断
- 提取所有关键信息和重要观点
- 覆盖内容的核心要点和主要信息
- 保持内容的完整性
- 使用清晰的结构化格式
- 提取重要数据和事实
- 避免重复和冗余
- 以原内容为主，避免过度扩展

请基于原始内容进行完整总结，确保信息的全面性和准确性。`,

          user: `请总结以下网页内容：

标题：${title}

内容：
${content}

请提供全面、客观的总结，确保涵盖所有重要信息。`
        },
        // 有用户重点的定向总结
        withFocus: {
          system: `你是一个专业的内容分析专家。请对提供的网页内容进行客观、详细的总结，并特别重视用户指定的重点关注领域。

总结要求：
- 客观准确，不添加主观判断
- 重点突出用户指定的重点领域
- 突出重点信息和关键观点
- 保持内容的完整性
- 使用清晰的结构化格式
- 提取重要数据和事实
- 避免重复和冗余
- 以原内容为主，避免过度扩展

请基于原始内容进行总结，特别突出用户关注的关键点。`,

          user: `${focusSection}请总结以下网页内容：

标题：${title}

内容：
${content}

请提供全面、客观的总结，在全面覆盖的基础上，特别关注用户指定的重点领域。`
        }
      },

      custom: {
        // 无用户重点的通用总结
        noFocus: {
          system: `请对给定的网页内容进行专业、全面的总结。要求：
1. 客观总结，不添加个人观点
2. 提取所有关键信息和重要内容
3. 保持逻辑清晰和结构化
4. 提取重要数据和事实
5. 使用简洁明确的语言
6. 以原始内容为主，不进行过度发散
7. 覆盖内容的核心要点

不要添加评论、评价或额外解释，专注于总结原内容的全部重要信息。`,

          user: `请总结以下网页内容：

标题：${title}

内容：
${content}

请提供详细全面的客观总结，确保信息完整。`
        },
        // 有用户重点的定向总结
        withFocus: {
          system: `请对给定的网页内容进行专业总结，特别关注用户指定的重点内容。要求：
1. 客观总结，不添加个人观点
2. 重点关注用户指定的领域和内容
3. 突出重点信息和关键内容
4. 保持逻辑清晰和结构化
5. 提取重要数据和事实
6. 使用简洁明确的语言
7. 以原始内容为主，不进行过度发散

不要添加评论、评价或额外解释，专注于总结原内容和用户关注点。`,

          user: `${focusSection}请总结以下网页内容：

标题：${title}

内容：
${content}

请提供详细的客观总结，在全面覆盖的基础上，特别关注用户指定的重点内容。`
        }
      }
    };

    const provider = settings.provider || 'openai';
    const template = promptTemplates[provider] || promptTemplates.openai;
    const selectedTemplate = hasFocus ? template.withFocus : template.noFocus;
    
    return {
      system: selectedTemplate.system,
      user: selectedTemplate.user
    };
  }

  // 测试API
  async testApi(prompt, settings) {
    try {
      console.log('开始测试API:', { provider: settings.provider, hasApiKey: !!settings.apiKey, apiUrl: settings.apiUrl });
      
      // 验证设置
      if (!settings.apiKey) {
        return { success: false, error: 'API密钥不能为空' };
      }
      
      if (!settings.apiUrl && settings.provider === 'custom') {
        return { success: false, error: '自定义API模式下API地址不能为空' };
      }
      
      // 调用API
      const result = await this.callApi(prompt, settings);
      
      if (result.success) {
        return {
          success: true,
          summary: result.summary || 'API测试成功！',
          usage: result.usage || { total_tokens: 0 }
        };
      } else {
        return {
          success: false,
          error: result.error || 'API测试失败'
        };
      }
    } catch (error) {
      console.error('API测试失败:', error);
      return {
        success: false,
        error: error.message || 'API测试失败'
      };
    }
  }

  // 调用大模型API
  async callApi(prompt, settings) {
    const { provider, apiKey, apiUrl, modelName } = settings;
    
    console.log('API调用参数:', { provider, hasApiKey: !!apiKey, apiUrl, modelName });
    
    try {
      switch (provider) {
        case 'openai':
          return await this.callOpenAI(prompt, apiKey, apiUrl, modelName);
        
        case 'anthropic':
          return await this.callAnthropic(prompt, apiKey, apiUrl, modelName);
        
        case 'custom':
          return await this.callCustomApi(prompt, apiKey, apiUrl, modelName);
        
        default:
          throw new Error('不支持的API提供商');
      }
    } catch (error) {
      console.error('API call failed:', error);
      return { success: false, error: error.message };
    }
  }

  // 调用OpenAI API
  async callOpenAI(prompt, apiKey, apiUrl, modelName = 'gpt-3.5-turbo') {
    const defaultUrl = 'https://api.openai.com/v1/chat/completions';
    const url = apiUrl || defaultUrl;
    
    const requestBody = {
      model: modelName,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ],
      max_tokens: 1500,
      temperature: 0.3
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API错误: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('OpenAI API返回数据格式错误');
    }

    return {
      success: true,
      summary: data.choices[0].message.content,
      usage: data.usage
    };
  }

  // 调用Anthropic API
  async callAnthropic(prompt, apiKey, apiUrl, modelName = 'claude-3-haiku-20240307') {
    const defaultUrl = 'https://api.anthropic.com/v1/messages';
    const url = apiUrl || defaultUrl;
    
    const requestBody = {
      model: modelName,
      max_tokens: 1500,
      temperature: 0.3,
      system: prompt.system,
      messages: [
        { role: 'user', content: prompt.user }
      ]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Anthropic API错误: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.content || !data.content[0] || !data.content[0].text) {
      throw new Error('Anthropic API返回数据格式错误');
    }

    return {
      success: true,
      summary: data.content[0].text,
      usage: data.usage
    };
  }

  // 调用自定义API
  async callCustomApi(prompt, apiKey, apiUrl, modelName = 'gpt-3.5-turbo') {
    console.log('开始调用自定义API:', {
      url: apiUrl,
      hasApiKey: !!apiKey,
      promptLength: prompt.user?.length,
      modelName
    });

    // 验证输入参数
    if (!apiKey) {
      throw new Error('API密钥不能为空');
    }
    
    if (!apiUrl) {
      throw new Error('API地址不能为空');
    }

    const requestBody = {
      model: modelName,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ],
      max_tokens: 1500,
      temperature: 0.3
    };

    const headers = {
      'Content-Type': 'application/json'
    };

    // 如果API地址包含常见的API key头
    if (apiUrl.includes('openai')) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else if (apiUrl.includes('anthropic')) {
      headers['x-api-key'] = apiKey;
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    console.log('发送API请求:', {
      url: apiUrl,
      headers: Object.keys(headers),
      bodySize: JSON.stringify(requestBody).length
    });

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    console.log('收到API响应:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      let errorMessage = `${response.status} - ${response.statusText}`;
      try {
        const errorData = await response.json();
        console.error('API错误详情:', errorData);
        errorMessage += ` - ${errorData.error?.message || errorData.message || JSON.stringify(errorData)}`;
      } catch (parseError) {
        console.error('无法解析错误响应:', parseError);
      }
      throw new Error(`API错误: ${errorMessage}`);
    }

    const data = await response.json();
    
    // 尝试多种可能的响应格式
    let summary = '';
    if (data.choices && data.choices[0] && data.choices[0].message) {
      summary = data.choices[0].message.content;
    } else if (data.content && data.content[0] && data.content[0].text) {
      summary = data.content[0].text;
    } else if (data.text) {
      summary = data.text;
    } else if (typeof data === 'string') {
      summary = data;
    } else {
      throw new Error('无法解析API响应格式');
    }

    return {
      success: true,
      summary: summary,
      usage: data.usage || null
    };
  }

  // 计算置信度
  calculateConfidence(content, summary) {
    if (!content || !summary) return 50;
    
    // 基础置信度
    let confidence = 60;
    
    // 内容长度影响
    if (content.length > 2000) confidence += 20;
    else if (content.length > 1000) confidence += 15;
    else if (content.length < 100) confidence -= 20;
    
    // 总结质量评估
    const summaryLength = summary.length;
    const contentLength = content.length;
    const ratio = summaryLength / contentLength;
    
    // 合理的总结长度比例
    if (ratio > 0.1 && ratio < 0.5) confidence += 15;
    else if (ratio <= 0.05) confidence -= 10;
    else if (ratio >= 0.8) confidence -= 20;
    
    // 总结结构评估
    const hasStructure = summary.includes('\n') || summary.includes('•') || summary.includes('-');
    if (hasStructure) confidence += 10;
    
    // 内容类型影响
    const isStructured = content.includes('\n') || content.includes('。') || content.includes('.');
    if (isStructured) confidence += 5;
    
    return Math.max(0, Math.min(100, confidence));
  }

  // 显示总结通知
  showSummaryNotification(title, result) {
    const summary = result.summary.substring(0, 150);
    
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#28a745' });
    
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 3000);

    // 这里可以添加更复杂的通知系统
    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '页面总结完成',
        message: `${title}\n\n${summary}...`
      });
    }
  }

  // 保存设置（支持跨设备同步）
  async saveSettings(settings) {
    try {
      console.log('开始保存设置...', { provider: settings.provider });
      
      // 验证设置数据
      if (!this.validateSettings(settings)) {
        throw new Error('设置数据格式无效');
      }
      
      // 加密存储敏感信息
      const encryptedKey = this.encryptApiKey(settings.apiKey);
      
      // 准备完整的设置数据
      const fullSettings = {
        provider: settings.provider || 'openai',
        apiKey: encryptedKey,
        apiUrl: settings.apiUrl || '',
        summaryLength: settings.summaryLength || 'medium',
        modelName: settings.modelName || 'gpt-3.5-turbo',
        temperature: settings.temperature || 0.3,
        maxTokens: settings.maxTokens || 1500,
        timestamp: Date.now() // 添加时间戳用于冲突解决
      };
      
      // 优先保存到sync存储（跨设备同步）
      const syncResult = await this.syncManager.saveWithRetry(
        chrome.storage.sync, 
        { appSettings: fullSettings }
      );
      
      // 同时保存到local存储（向后兼容性）
      const localResult = await this.syncManager.saveWithRetry(
        chrome.storage.local, 
        { appSettings: fullSettings }
      );
      
      // 更新同步时间戳
      await this.syncManager.updateSyncTimestamp();
      
      let success = syncResult.success && localResult.success;
      let message = '设置保存成功';
      
      if (!syncResult.success) {
        console.warn('Sync存储失败:', syncResult.error);
        message = '设置已保存到本地，跨设备同步失败';
        success = localResult.success; // 至少本地保存成功
      }
      
      if (!localResult.success) {
        console.error('Local存储失败:', localResult.error);
        success = false;
        message = '设置保存失败: ' + localResult.error;
      }
      
      return { 
        success, 
        message,
        syncAttempt: syncResult.attempt,
        localAttempt: localResult.attempt
      };
      
    } catch (error) {
      console.error('保存设置失败:', error);
      return { 
        success: false, 
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  // 获取设置（优先从sync获取，fallback到local）
  async getSettings() {
    try {
      console.log('开始获取设置...');
      
      // 优先从sync存储获取（跨设备同步的数据）
      const syncResult = await this.syncManager.getWithRetry(
        chrome.storage.sync, 
        ['appSettings']
      );
      
      let settings = null;
      let source = 'none';
      
      if (syncResult.success && this.syncManager.isValidSettings(syncResult.data.appSettings)) {
        settings = syncResult.data.appSettings;
        source = 'sync';
        console.log('从sync存储获取设置成功');
      } else {
        // Fallback到local存储
        const localResult = await this.syncManager.getWithRetry(
          chrome.storage.local, 
          ['appSettings']
        );
        
        if (localResult.success && this.syncManager.isValidSettings(localResult.data.appSettings)) {
          settings = localResult.data.appSettings;
          source = 'local';
          console.log('从local存储获取设置（fallback）');
        }
      }
      
      // 如果没有找到设置，返回默认值
      if (!settings) {
        console.log('未找到设置，返回默认值');
        return this.getDefaultSettings();
      }
      
      // 解密API密钥
      const decryptedKey = settings.apiKey ? this.decryptApiKey(settings.apiKey) : '';
      
      const result = {
        provider: settings.provider || 'openai',
        apiKey: decryptedKey,
        apiUrl: settings.apiUrl || '',
        summaryLength: settings.summaryLength || 'medium',
        modelName: settings.modelName || 'gpt-3.5-turbo',
        temperature: settings.temperature || 0.3,
        maxTokens: settings.maxTokens || 1500,
        timestamp: settings.timestamp || 0,
        _source: source,
        _fetchAttempts: Math.max(syncResult.attempt, 1)
      };
      
      console.log('设置获取成功:', { 
        provider: result.provider, 
        source, 
        hasApiKey: !!result.apiKey,
        hasApiUrl: !!result.apiUrl,
        apiUrl: result.apiUrl,
        fetchAttempts: result._fetchAttempts
      });
      
      return result;
      
    } catch (error) {
      console.error('获取设置失败:', error);
      return this.getDefaultSettings();
    }
  }

  // 获取本地设置（用于冲突解决）
  async getLocalSettings() {
    try {
      const result = await this.syncManager.getWithRetry(
        chrome.storage.local, 
        ['appSettings']
      );
      
      return result.success && this.syncManager.isValidSettings(result.data.appSettings) 
        ? result.data.appSettings 
        : {};
    } catch (error) {
      console.error('获取本地设置失败:', error);
      return {};
    }
  }

  // 保存本地设置（用于冲突解决后更新）
  async saveLocalSettings(settings) {
    try {
      const fullSettings = {
        ...settings,
        timestamp: settings.timestamp || Date.now()
      };
      
      return await this.syncManager.saveWithRetry(
        chrome.storage.local, 
        { appSettings: fullSettings }
      );
    } catch (error) {
      console.error('保存本地设置失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 清除设置
  async clearSettings() {
    try {
      console.log('开始清除设置...');
      
      // 清除sync存储
      const syncResult = await this.syncManager.saveWithRetry(
        chrome.storage.sync, 
        { appSettings: null }
      );
      
      // 清除local存储
      const localResult = await this.syncManager.saveWithRetry(
        chrome.storage.local, 
        { appSettings: null }
      );
      
      const success = syncResult.success && localResult.success;
      const message = success ? '设置清除成功' : '部分设置清除失败';
      
      console.log('设置清除完成:', { success, syncAttempt: syncResult.attempt, localAttempt: localResult.attempt });
      
      return { 
        success, 
        message,
        syncAttempt: syncResult.attempt,
        localAttempt: localResult.attempt
      };
      
    } catch (error) {
      console.error('清除设置失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 强制同步设置
  async forceSyncSettings() {
    try {
      console.log('开始强制同步设置...');
      
      // 从local获取最新设置
      const localResult = await this.getLocalSettings();
      
      if (Object.keys(localResult).length === 0) {
        return { success: false, message: '没有找到本地设置可以同步' };
      }
      
      // 强制同步到sync
      const timestamp = Date.now();
      const syncData = { ...localResult, timestamp, _forceSync: true };
      
      const result = await this.syncManager.saveWithRetry(
        chrome.storage.sync, 
        { appSettings: syncData }
      );
      
      await this.syncManager.updateSyncTimestamp();
      
      return {
        success: result.success,
        error: result.success ? null : result.error,
        message: result.success ? '强制同步成功' : `强制同步失败: ${result.error}`,
        timestamp: timestamp
      };
      
    } catch (error) {
      console.error('强制同步失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 获取同步状态
  async getSyncStatus() {
    try {
      const syncTimestamp = await this.syncManager.getSyncTimestamp();
      
      // 检查sync存储是否有数据
      const syncResult = await this.syncManager.getWithRetry(
        chrome.storage.sync, 
        ['appSettings']
      );
      
      // 检查local存储是否有数据
      const localResult = await this.syncManager.getWithRetry(
        chrome.storage.local, 
        ['appSettings', 'migrationCompleted']
      );
      
      const hasSyncData = syncResult.success && this.syncManager.isValidSettings(syncResult.data.appSettings);
      const hasLocalData = localResult.success && this.syncManager.isValidSettings(localResult.data.appSettings);
      
      return {
        lastSyncTime: syncTimestamp,
        hasSyncData,
        hasLocalData,
        isMigrated: localResult.data?.migrationCompleted || false,
        online: this.syncManager.isOnline,
        syncStatus: hasSyncData ? 'available' : 'empty',
        localStatus: hasLocalData ? 'available' : 'empty'
      };
      
    } catch (error) {
      console.error('获取同步状态失败:', error);
      return {
        lastSyncTime: 0,
        hasSyncData: false,
        hasLocalData: false,
        isMigrated: false,
        online: this.syncManager.isOnline,
        error: error.message
      };
    }
  }

  // 验证设置数据
  validateSettings(settings) {
    if (!settings || typeof settings !== 'object') {
      return false;
    }
    
    // 基本验证
    const validProviders = ['openai', 'anthropic', 'custom'];
    if (settings.provider && !validProviders.includes(settings.provider)) {
      return false;
    }
    
    // 如果提供了apiKey，确保是字符串
    if (settings.apiKey && typeof settings.apiKey !== 'string') {
      return false;
    }
    
    return true;
  }

  // 获取默认设置
  getDefaultSettings() {
    return {
      provider: 'openai',
      apiKey: '',
      apiUrl: '',
      summaryLength: 'medium',
      modelName: 'gpt-3.5-turbo',
      temperature: 0.3,
      maxTokens: 1500,
      timestamp: 0,
      _source: 'default'
    };
  }

  // ==================== 历史记录管理 ====================
  
  // 保存总结到历史记录
  async saveSummaryToHistory(summaryData) {
    try {
      const history = await this.getHistory();
      const historyItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        url: summaryData.url,
        title: summaryData.title || '未知标题',
        summary: summaryData.summary,
        confidence: summaryData.confidence,
        usage: summaryData.usage,
        provider: summaryData.provider || 'unknown',
        timestamp: summaryData.timestamp
      };
      
      // 添加到历史记录开头，保持最多50条记录
      history.unshift(historyItem);
      if (history.length > 50) {
        history.splice(50); // 保留最新的50条
      }
      
      await chrome.storage.local.set({ history: history });
      console.log('历史记录已保存:', historyItem.title);
      
      return historyItem;
    } catch (error) {
      console.error('保存历史记录失败:', error);
      throw error;
    }
  }
  
  // 保存操作状态
  async saveOperationState(operationId, state) {
    try {
      const result = await chrome.storage.local.get(['activeOperations']);
      const activeOperations = result.activeOperations || {};
      
      activeOperations[operationId] = {
        ...activeOperations[operationId],
        ...state
      };
      
      await chrome.storage.local.set({ activeOperations });
      console.log('操作状态已保存:', { operationId, status: state.status });
    } catch (error) {
      console.error('保存操作状态失败:', error);
    }
  }
  
  // 检查任务状态
  async checkTaskStatus(operationId) {
    try {
      // 检查是否存在相应的操作记录
      const result = await chrome.storage.local.get(['activeOperations']);
      const activeOperations = result.activeOperations || {};
      
      if (activeOperations[operationId]) {
        const operation = activeOperations[operationId];
        const timeDiff = Date.now() - operation.timestamp;
        
        // 如果操作超过5分钟，认为已超时
        if (timeDiff > 5 * 60 * 1000) {
          // 清理过期的操作
          delete activeOperations[operationId];
          await chrome.storage.local.set({ activeOperations });
          return { status: 'failed', error: '任务超时' };
        }
        
        if (operation.status === 'completed') {
          // 任务已完成，返回结果
          const summaryResult = {
            status: 'completed',
            summary: operation.result.summary,
            confidence: operation.result.confidence,
            timestamp: operation.timestamp
          };
          
          // 清理已完成的操作
          delete activeOperations[operationId];
          await chrome.storage.local.set({ activeOperations });
          
          return summaryResult;
        } else if (operation.status === 'failed') {
          // 任务失败
          const errorResult = {
            status: 'failed',
            error: operation.error || '任务执行失败'
          };
          
          // 清理失败的操作
          delete activeOperations[operationId];
          await chrome.storage.local.set({ activeOperations });
          
          return errorResult;
        } else {
          // 任务仍在进行中
          return { status: 'in_progress' };
        }
      }
      
      // 未找到操作记录
      return { status: 'not_found' };
      
    } catch (error) {
      console.error('检查任务状态失败:', error);
      return { status: 'error', error: error.message };
    }
  }

  // 获取历史记录
  async getHistory() {
    try {
      const result = await chrome.storage.local.get(['history']);
      return result.history || [];
    } catch (error) {
      console.error('获取历史记录失败:', error);
      return [];
    }
  }

  // 删除历史记录项
  async deleteHistoryItem(id) {
    try {
      const history = await this.getHistory();
      const filteredHistory = history.filter(item => item.id !== id);
      await chrome.storage.local.set({ history: filteredHistory });
      console.log('历史记录项已删除:', id);
    } catch (error) {
      console.error('删除历史记录失败:', error);
      throw error;
    }
  }

  // 清空历史记录
  async clearHistory() {
    try {
      await chrome.storage.local.set({ history: [] });
      console.log('历史记录已清空');
    } catch (error) {
      console.error('清空历史记录失败:', error);
      throw error;
    }
  }

  // 导出历史记录
  async exportHistory() {
    try {
      const history = await this.getHistory();
      const exportData = {
        exportDate: new Date().toISOString(),
        totalCount: history.length,
        records: history
      };
      return exportData;
    } catch (error) {
      console.error('导出历史记录失败:', error);
      throw error;
    }
  }

  // 简单的API密钥加密（实际应用中应使用更安全的方法）
  encryptApiKey(key) {
    if (!key) return '';
    return btoa(encodeURIComponent(key));
  }

  decryptApiKey(encryptedKey) {
    if (!encryptedKey) return '';
    try {
      return decodeURIComponent(atob(encryptedKey));
    } catch {
      return '';
    }
  }

  // ==================== 选择模式状态管理 ====================
  
  // 保存选择模式状态
  async saveSelectionState(selectionState) {
    try {
      // 如果tabId为null，尝试从当前活动标签页获取（如果可能）
      // 注意：这里无法直接获取，因为需要sender.tab.id，但保存时可能没有sender
      // 所以tabId应该在调用此方法之前就已经设置好了
      await chrome.storage.local.set({ selectionState: selectionState });
      console.log('✅ 选择模式状态已保存到background:', {
        tabId: selectionState.tabId,
        isSelectionMode: selectionState.isSelectionMode,
        selectedCount: selectionState.selectedElements?.length || 0,
        hasTabId: selectionState.tabId !== null && selectionState.tabId !== undefined
      });
    } catch (error) {
      console.error('保存选择模式状态失败:', error);
      throw error;
    }
  }

  // 获取选择模式状态
  async getSelectionState(tabId) {
    try {
      const result = await chrome.storage.local.get(['selectionState']);
      const selectionState = result.selectionState;
      
      // 如果selectionState存在但tabId为null，且请求的tabId匹配当前标签页，则返回状态
      // 这样可以处理content script无法获取tabId的情况
      if (selectionState && (selectionState.tabId === null || selectionState.tabId === undefined)) {
        console.log('⚠️ 选择状态的tabId为null，可能是content script无法获取，仍然返回状态');
      }
      
      // 检查状态是否过期（超过15分钟）
      if (selectionState && selectionState.timestamp) {
        const timeDiff = Date.now() - selectionState.timestamp;
        if (timeDiff > 15 * 60 * 1000) { // 15分钟过期
          console.log('选择模式状态已过期，自动清理');
          await this.clearSelectionState();
          return null;
        }
      }
      
      // 如果指定了tabId，检查是否匹配
      // 如果selectionState.tabId为null（content script无法获取），则仍然返回状态
      if (tabId && selectionState && selectionState.tabId !== null && selectionState.tabId !== undefined && selectionState.tabId !== tabId) {
        console.log('选择模式状态不匹配当前标签页，返回null', {
          stateTabId: selectionState.tabId,
          requestTabId: tabId
        });
        return null;
      }
      
      // 如果tabId为null，记录警告但返回状态
      if (selectionState && (selectionState.tabId === null || selectionState.tabId === undefined)) {
        console.log('⚠️ 选择状态的tabId为null，可能是content script无法获取，仍然返回状态');
      }
      
      return selectionState || null;
    } catch (error) {
      console.error('获取选择模式状态失败:', error);
      return null;
    }
  }
  
  // 处理获取选择状态请求
  async handleGetSelectionState(tabId) {
    try {
      const selectionState = await this.getSelectionState(tabId);
      return {
        success: true,
        selectionState: selectionState
      };
    } catch (error) {
      console.error('处理获取选择状态失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 清除选择模式状态
  async clearSelectionState() {
    try {
      await chrome.storage.local.remove(['selectionState']);
      console.log('选择模式状态已清除');
    } catch (error) {
      console.error('清除选择模式状态失败:', error);
      throw error;
    }
  }

  // 处理选择模式事件
  async handleSelectionEvent(eventData) {
    try {
      console.log('处理选择模式事件:', eventData.originalAction);
      
      switch (eventData.originalAction) {
        case 'elementSelected':
          // 更新选择状态
          const selectionState = await this.getSelectionState(eventData.tabId);
          if (selectionState) {
            selectionState.selectedElements = selectionState.selectedElements || [];
            
            // 避免重复添加
            if (!selectionState.selectedElements.some(el => el.id === eventData.element.id)) {
              selectionState.selectedElements.push(eventData.element);
              selectionState.timestamp = Date.now();
              await this.saveSelectionState(selectionState);
              
              console.log('元素选择已记录:', {
                elementId: eventData.element.id,
                totalSelected: selectionState.selectedElements.length
              });
            }
          }
          break;
          
        case 'selectionModeStarted':
          // 记录选择模式启动
          console.log('选择模式已启动:', {
            tabId: eventData.tabId,
            maxSelections: eventData.maxSelections
          });
          break;
          
        case 'selectionModeStopped':
          // 选择模式结束，清理状态
          await this.clearSelectionState();
          console.log('选择模式已结束，状态已清理');
          break;
          
        default:
          console.log('未知的选择模式事件:', eventData.originalAction);
      }
    } catch (error) {
      console.error('处理选择模式事件失败:', error);
    }
  }

  // ==================== 悬浮选择弹窗管理 ====================
  
  // 存储活跃的悬浮选择弹窗
  floatingSelectionWindows = new Map();
  
  // 创建悬浮选择弹窗
  async createFloatingSelection(tabId, maxSelections = 10) {
    try {
      // 检查是否已有悬浮选择弹窗
      if (this.floatingSelectionWindows.has(tabId)) {
        return { success: false, error: '该标签页已存在悬浮选择弹窗' };
      }
      
      // 获取标签页信息
      const tab = await chrome.tabs.get(tabId);
      if (!tab) {
        return { success: false, error: '无法获取标签页信息' };
      }
      
      // 创建悬浮选择弹窗
      const windowOptions = {
        url: chrome.runtime.getURL('selection-overlay.html'),
        type: 'popup',
        width: 400,
        height: 500,
        top: 100,
        left: 100,
        focused: true
      };
      
      const window = await chrome.windows.create(windowOptions);
      
      // 存储窗口信息
      this.floatingSelectionWindows.set(tabId, {
        windowId: window.id,
        tabId: tabId,
        maxSelections: maxSelections,
        created: Date.now()
      });
      
      // 发送初始化消息给悬浮选择弹窗
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(window.tabs[0].id, {
            action: 'initFloatingSelection',
            data: {
              tabId: tabId,
              maxSelections: maxSelections,
              pageUrl: tab.url
            }
          });
        } catch (error) {
          console.error('发送初始化消息失败:', error);
        }
      }, 500);
      
      console.log('悬浮选择弹窗已创建:', { tabId, windowId: window.id });
      
      return { success: true, windowId: window.id };
      
    } catch (error) {
      console.error('创建悬浮选择弹窗失败:', error);
      return { success: false, error: error.message };
    }
  }
  
  // 关闭悬浮选择弹窗
  async closeFloatingSelection(tabId) {
    try {
      if (!this.floatingSelectionWindows.has(tabId)) {
        return { success: false, error: '该标签页没有悬浮选择弹窗' };
      }
      
      const windowInfo = this.floatingSelectionWindows.get(tabId);
      
      // 关闭窗口
      await chrome.windows.remove(windowInfo.windowId);
      
      // 从存储中移除
      this.floatingSelectionWindows.delete(tabId);
      
      console.log('悬浮选择弹窗已关闭:', { tabId, windowId: windowInfo.windowId });
      
      return { success: true };
      
    } catch (error) {
      console.error('关闭悬浮选择弹窗失败:', error);
      return { success: false, error: error.message };
    }
  }
  
  // 更新选择状态
  async updateSelectionState(tabId, selectionData) {
    try {
      // 存储选择状态
      await chrome.storage.local.set({
        [`selection_${tabId}`]: {
          ...selectionData,
          timestamp: Date.now()
        }
      });
      
      // 通知popup更新选择状态
      chrome.tabs.sendMessage(tabId, {
        action: 'selectionUpdated',
        data: selectionData
      }).catch(error => {
        console.log('popup可能已关闭，无法发送选择更新消息');
      });
      
      console.log('选择状态已更新:', { tabId, action: selectionData.action });
      
      return { success: true };
      
    } catch (error) {
      console.error('更新选择状态失败:', error);
      return { success: false, error: error.message };
    }
  }
  
  // 获取选择状态
  async getSelectionStateForTab(tabId) {
    try {
      const result = await chrome.storage.local.get([`selection_${tabId}`]);
      const selectionState = result[`selection_${tabId}`];
      
      // 检查是否过期（30分钟）
      if (selectionState && selectionState.timestamp) {
        const timeDiff = Date.now() - selectionState.timestamp;
        if (timeDiff > 30 * 60 * 1000) {
          await this.clearSelectionStateForTab(tabId);
          return null;
        }
      }
      
      return selectionState || null;
      
    } catch (error) {
      console.error('获取选择状态失败:', error);
      return null;
    }
  }
  
  // 清除选择状态
  async clearSelectionStateForTab(tabId) {
    try {
      await chrome.storage.local.remove([`selection_${tabId}`]);
      console.log('选择状态已清除:', tabId);
    } catch (error) {
      console.error('清除选择状态失败:', error);
      throw error;
    }
  }
}

// 初始化后台服务
let backgroundService;

// 确保Service Worker在挂起后能正确恢复
if (typeof window === 'undefined') {
  // Service Worker 环境
  backgroundService = new BackgroundService();
  
  // 处理Service Worker挂起
  chrome.runtime.onSuspend?.addListener(() => {
    console.log('Service Worker is being suspended');
  });
  
  // 处理Service Worker恢复
  chrome.runtime.onSuspendCanceled?.addListener(() => {
    console.log('Service Worker suspension canceled');
    setTimeout(() => {
      backgroundService.setupContextMenus();
    }, 100);
  });
} else {
  // 页面环境 - 异步初始化
  backgroundService = new BackgroundService();
  // 页面环境中也已经调用了init()
}

// 全局错误处理
self.addEventListener('error', (event) => {
  console.error('Global error in service worker:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection in service worker:', event.reason);
});