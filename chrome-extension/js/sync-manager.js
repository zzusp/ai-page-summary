/**
 * Chrome扩展跨设备同步管理器
 * 实现API设置和历史记录的跨设备同步
 */

class SyncManager {
  constructor() {
    this.syncStatus = {
      state: 'normal', // normal, syncing, error
      lastSyncTime: null,
      errorMessage: null
    };
    
    this.config = {
      // 同步配置
      autoSync: true,
      syncHistory: false, // 历史记录同步开关，默认关闭
      conflictResolution: 'latest', // latest, local, remote
      maxSyncSize: 100 * 1024, // 100KB 限制
      syncInterval: 30000, // 30秒检查一次
      
      // 存储限制
      maxHistoryItems: 50,
      maxSettingsSize: 10 * 1024, // 10KB
      
      // 密钥配置
      encryptionEnabled: true
    };
    
    this.syncTimer = null;
    this.pendingChanges = new Set();
    this.isInitialized = false;
    
    this.init();
  }

  /**
   * 初始化同步管理器
   */
  async init() {
    try {
      console.log('初始化同步管理器...');
      
      // 检查同步存储支持
      if (!this.checkSyncSupport()) {
        throw new Error('设备不支持chrome.storage.sync API');
      }
      
      // 加载配置
      await this.loadConfig();
      
      // 监听存储变化
      this.setupStorageListeners();
      
      // 启动自动同步
      if (this.config.autoSync) {
        this.startAutoSync();
      }
      
      this.isInitialized = true;
      this.updateSyncStatus('normal');
      console.log('同步管理器初始化完成');
      
    } catch (error) {
      console.error('同步管理器初始化失败:', error);
      this.updateSyncStatus('error', error.message);
    }
  }

  /**
   * 检查同步存储支持
   */
  checkSyncSupport() {
    return typeof chrome !== 'undefined' && 
           chrome.storage && 
           chrome.storage.sync;
  }

  /**
   * 加载配置
   */
  async loadConfig() {
    try {
      const result = await chrome.storage.sync.get(['syncConfig']);
      if (result.syncConfig) {
        this.config = { ...this.config, ...result.syncConfig };
      }
    } catch (error) {
      console.error('加载同步配置失败:', error);
    }
  }

  /**
   * 保存配置
   */
  async saveConfig() {
    try {
      await chrome.storage.sync.set({ syncConfig: this.config });
    } catch (error) {
      console.error('保存同步配置失败:', error);
      throw error;
    }
  }

  /**
   * 设置存储变化监听器
   */
  setupStorageListeners() {
    // 监听来自其他设备的同步变化
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync') {
        this.handleRemoteChanges(changes);
      }
    });
  }

  /**
   * 处理来自远程的变更
   */
  async handleRemoteChanges(changes) {
    try {
      console.log('检测到远程同步变更:', Object.keys(changes));
      
      const hasSettingsChange = changes.apiProvider || changes.apiKey || 
                               changes.apiUrl || changes.summaryLength;
      const hasHistoryChange = changes.syncHistory;
      
      if (hasSettingsChange || hasHistoryChange) {
        await this.handleSettingsSync(changes);
      }
      
    } catch (error) {
      console.error('处理远程变更失败:', error);
    }
  }

  /**
   * 处理设置同步
   */
  async handleSettingsSync(changes) {
    try {
      this.updateSyncStatus('syncing');
      
      // 获取本地设置
      const localSettings = await this.getLocalSettings();
      const remoteSettings = await this.getRemoteSettings();
      
      // 解决冲突
      const resolvedSettings = await this.resolveConflicts(localSettings, remoteSettings);
      
      // 应用解决后的设置
      await this.applySettings(resolvedSettings);
      
      this.updateSyncStatus('normal');
      
    } catch (error) {
      console.error('处理设置同步失败:', error);
      this.updateSyncStatus('error', error.message);
    }
  }

  /**
   * 获取本地设置
   */
  async getLocalSettings() {
    try {
      const result = await chrome.storage.sync.get([
        'apiProvider', 'apiKey', 'apiUrl', 'summaryLength', 
        'modelName', 'temperature', 'maxTokens', 'lastModified'
      ]);
      
      return {
        ...result,
        lastModified: result.lastModified || Date.now()
      };
    } catch (error) {
      console.error('获取本地设置失败:', error);
      return { lastModified: Date.now() };
    }
  }

  /**
   * 获取远程设置
   */
  async getRemoteSettings() {
    return this.getLocalSettings(); // 远程设置就是当前同步存储中的设置
  }

  /**
   * 解决设置冲突
   */
  async resolveConflicts(localSettings, remoteSettings) {
    const resolution = this.config.conflictResolution;
    
    let resolved;
    switch (resolution) {
      case 'local':
        resolved = { ...remoteSettings, ...localSettings };
        break;
      case 'remote':
        resolved = { ...localSettings, ...remoteSettings };
        break;
      case 'latest':
      default:
        // 优先使用最新修改的
        if (localSettings.lastModified >= remoteSettings.lastModified) {
          resolved = { ...remoteSettings, ...localSettings };
        } else {
          resolved = { ...localSettings, ...remoteSettings };
        }
        break;
    }
    
    console.log('冲突解决结果:', {
      resolution,
      localTime: localSettings.lastModified,
      remoteTime: remoteSettings.lastModified,
      chosen: resolved.lastModified
    });
    
    return resolved;
  }

  /**
   * 应用设置
   */
  async applySettings(settings) {
    try {
      const encryptedKey = settings.apiKey ? 
        await this.encryptData(settings.apiKey) : '';
      
      await chrome.storage.sync.set({
        apiProvider: settings.apiProvider,
        apiKey: encryptedKey,
        apiUrl: settings.apiUrl || '',
        summaryLength: settings.summaryLength || 'medium',
        modelName: settings.modelName || 'gpt-3.5-turbo',
        temperature: settings.temperature || 0.3,
        maxTokens: settings.maxTokens || 1500,
        lastModified: settings.lastModified
      });
      
      console.log('设置已应用并同步');
    } catch (error) {
      console.error('应用设置失败:', error);
      throw error;
    }
  }

  /**
   * 同步API设置
   */
  async syncSettings() {
    try {
      if (!this.isInitialized) {
        throw new Error('同步管理器未初始化');
      }
      
      this.updateSyncStatus('syncing');
      
      // 标记修改时间
      const timestamp = Date.now();
      
      // 获取当前设置
      const currentSettings = await this.getCurrentSettings();
      currentSettings.lastModified = timestamp;
      
      // 检查数据大小
      if (!this.checkDataSize(currentSettings)) {
        throw new Error('设置数据超出同步限制');
      }
      
      // 加密敏感信息
      const encryptedSettings = await this.encryptSensitiveData(currentSettings);
      
      // 存储到同步存储
      await chrome.storage.sync.set(encryptedSettings);
      
      this.syncStatus.lastSyncTime = timestamp;
      this.updateSyncStatus('normal');
      
      console.log('API设置同步完成');
      return { success: true, timestamp };
      
    } catch (error) {
      console.error('设置同步失败:', error);
      this.updateSyncStatus('error', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取当前设置
   */
  async getCurrentSettings() {
    const result = await chrome.storage.sync.get([
      'apiProvider', 'apiKey', 'apiUrl', 'summaryLength', 
      'modelName', 'temperature', 'maxTokens'
    ]);
    
    // 解密API密钥
    const decryptedKey = result.apiKey ? 
      await this.decryptData(result.apiKey) : '';
    
    return {
      provider: result.apiProvider || 'openai',
      apiKey: decryptedKey,
      apiUrl: result.apiUrl || '',
      summaryLength: result.summaryLength || 'medium',
      modelName: result.modelName || 'gpt-3.5-turbo',
      temperature: result.temperature || 0.3,
      maxTokens: result.maxTokens || 1500
    };
  }

  /**
   * 同步历史记录（可选功能）
   */
  async syncHistory(force = false) {
    try {
      if (!this.config.syncHistory && !force) {
        console.log('历史记录同步已禁用');
        return { success: true, message: '历史记录同步已禁用' };
      }
      
      this.updateSyncStatus('syncing');
      
      // 获取本地历史记录
      const localHistory = await this.getLocalHistory();
      
      // 检查数据大小
      if (!this.checkDataSize({ history: localHistory })) {
        throw new Error('历史记录数据超出同步限制');
      }
      
      // 加密历史记录
      const encryptedHistory = await this.encryptData(JSON.stringify(localHistory));
      
      // 存储到同步存储（使用单独的键）
      const historyKey = 'encryptedHistory';
      await chrome.storage.sync.set({ [historyKey]: encryptedHistory });
      
      this.syncStatus.lastSyncTime = Date.now();
      this.updateSyncStatus('normal');
      
      console.log(`历史记录同步完成，共${localHistory.length}条记录`);
      return { 
        success: true, 
        count: localHistory.length,
        timestamp: this.syncStatus.lastSyncTime
      };
      
    } catch (error) {
      console.error('历史记录同步失败:', error);
      this.updateSyncStatus('error', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取本地历史记录
   */
  async getLocalHistory() {
    try {
      const result = await chrome.storage.local.get(['history']);
      return result.history || [];
    } catch (error) {
      console.error('获取本地历史记录失败:', error);
      return [];
    }
  }

  /**
   * 加密敏感数据
   */
  async encryptSensitiveData(settings) {
    if (!this.config.encryptionEnabled) {
      return settings;
    }
    
    try {
      const encrypted = { ...settings };
      
      if (settings.apiKey) {
        encrypted.apiKey = await this.encryptData(settings.apiKey);
      }
      
      return encrypted;
    } catch (error) {
      console.error('加密敏感数据失败:', error);
      return settings;
    }
  }

  /**
   * 使用AES-GCM加密数据
   */
  async encryptData(data) {
    try {
      if (!this.config.encryptionEnabled) {
        return btoa(encodeURIComponent(data));
      }
      
      // 生成随机密钥
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      
      // 生成随机IV
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // 加密数据
      const encodedData = new TextEncoder().encode(data);
      const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encodedData
      );
      
      // 导出密钥
      const exportedKey = await crypto.subtle.exportKey('raw', key);
      
      // 组合IV、密钥和数据
      const combined = new Uint8Array(iv.length + exportedKey.byteLength + encryptedData.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(exportedKey), iv.length);
      combined.set(new Uint8Array(encryptedData), iv.length + exportedKey.byteLength);
      
      // 转换为Base64
      return btoa(String.fromCharCode.apply(null, combined));
      
    } catch (error) {
      console.error('数据加密失败:', error);
      // 降级到简单编码
      return btoa(encodeURIComponent(data));
    }
  }

  /**
   * 使用AES-GCM解密数据
   */
  async decryptData(encryptedData) {
    try {
      if (!encryptedData) return '';
      
      if (!this.config.encryptionEnabled) {
        return decodeURIComponent(atob(encryptedData));
      }
      
      // 从Base64转换
      const combined = new Uint8Array(
        atob(encryptedData).split('').map(c => c.charCodeAt(0))
      );
      
      // 提取IV、密钥和数据
      const iv = combined.slice(0, 12);
      const keyData = combined.slice(12, 44); // 32字节密钥
      const data = combined.slice(44);
      
      // 导入密钥
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      
      // 解密数据
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        data
      );
      
      // 转换为字符串
      return new TextDecoder().decode(decryptedData);
      
    } catch (error) {
      console.error('数据解密失败:', error);
      try {
        // 降级到简单解码
        return decodeURIComponent(atob(encryptedData));
      } catch {
        return '';
      }
    }
  }

  /**
   * 检查数据大小
   */
  checkDataSize(data) {
    try {
      const serialized = JSON.stringify(data);
      const sizeInBytes = new Blob([serialized]).size;
      
      return sizeInBytes <= this.config.maxSyncSize;
    } catch (error) {
      console.error('数据大小检查失败:', error);
      return true; // 默认允许
    }
  }

  /**
   * 更新同步状态
   */
  updateSyncStatus(state, errorMessage = null) {
    this.syncStatus.state = state;
    this.syncStatus.errorMessage = errorMessage;
    
    // 触发状态变化事件
    this.onSyncStatusChange?.(this.syncStatus);
    
    console.log('同步状态更新:', this.syncStatus);
  }

  /**
   * 启动自动同步
   */
  startAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    
    this.syncTimer = setInterval(() => {
      this.performAutoSync();
    }, this.config.syncInterval);
  }

  /**
   * 停止自动同步
   */
  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * 执行自动同步
   */
  async performAutoSync() {
    try {
      if (this.pendingChanges.size > 0) {
        console.log('执行自动同步...');
        
        // 同步设置
        await this.syncSettings();
        
        // 同步历史记录（如果启用）
        if (this.config.syncHistory) {
          await this.syncHistory();
        }
        
        this.pendingChanges.clear();
      }
    } catch (error) {
      console.error('自动同步失败:', error);
    }
  }

  /**
   * 标记待同步变更
   */
  markPendingChange(changeType) {
    this.pendingChanges.add(changeType);
  }

  /**
   * 获取同步状态
   */
  getSyncStatus() {
    return { ...this.syncStatus };
  }

  /**
   * 获取同步配置
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * 更新同步配置
   */
  async updateConfig(newConfig) {
    try {
      this.config = { ...this.config, ...newConfig };
      await this.saveConfig();
      
      // 更新自动同步
      if (this.config.autoSync) {
        this.startAutoSync();
      } else {
        this.stopAutoSync();
      }
      
      console.log('同步配置已更新');
      return { success: true };
    } catch (error) {
      console.error('更新同步配置失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 启用历史记录同步
   */
  async enableHistorySync() {
    return this.updateConfig({ syncHistory: true });
  }

  /**
   * 禁用历史记录同步
   */
  async disableHistorySync() {
    return this.updateConfig({ syncHistory: false });
  }

  /**
   * 清除同步数据
   */
  async clearSyncData() {
    try {
      await chrome.storage.sync.clear();
      this.pendingChanges.clear();
      this.updateSyncStatus('normal');
      console.log('同步数据已清除');
      return { success: true };
    } catch (error) {
      console.error('清除同步数据失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取同步统计信息
   */
  async getSyncStats() {
    try {
      const result = await chrome.storage.sync.get(null);
      const settings = Object.keys(result).filter(key => 
        !key.startsWith('syncConfig') && key !== 'encryptedHistory'
      );
      
      return {
        totalItems: Object.keys(result).length,
        settingsItems: settings.length,
        hasHistory: !!result.encryptedHistory,
        lastSyncTime: this.syncStatus.lastSyncTime,
        syncStatus: this.syncStatus.state,
        dataSize: JSON.stringify(result).length
      };
    } catch (error) {
      console.error('获取同步统计失败:', error);
      return null;
    }
  }

  /**
   * 导出同步数据
   */
  async exportSyncData() {
    try {
      const settings = await this.getCurrentSettings();
      const stats = await this.getSyncStats();
      
      return {
        exportTime: new Date().toISOString(),
        settings: settings,
        config: this.config,
        stats: stats
      };
    } catch (error) {
      console.error('导出同步数据失败:', error);
      return null;
    }
  }

  /**
   * 导入同步数据
   */
  async importSyncData(data) {
    try {
      if (!data || !data.settings) {
        throw new Error('无效的同步数据');
      }
      
      // 应用设置
      await this.applySettings({
        ...data.settings,
        lastModified: Date.now()
      });
      
      // 更新配置
      if (data.config) {
        await this.updateConfig(data.config);
      }
      
      console.log('同步数据导入成功');
      return { success: true };
    } catch (error) {
      console.error('导入同步数据失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 销毁同步管理器
   */
  destroy() {
    this.stopAutoSync();
    this.pendingChanges.clear();
    this.isInitialized = false;
    console.log('同步管理器已销毁');
  }
}

// 如果在模块环境中，导出类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SyncManager;
}

// 全局可用
if (typeof window !== 'undefined') {
  window.SyncManager = SyncManager;
}