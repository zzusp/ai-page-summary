// 设置页面脚本
class OptionsManager {
  constructor() {
    // 检查Chrome扩展API是否可用
    this.checkChromeApiAvailability();
    
    this.initElements();
    this.bindEvents();
    this.loadSettings();
    this.setupValidation();
    this.startSyncStatusPolling();
  }

  // 检查Chrome API可用性
  checkChromeApiAvailability() {
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      console.warn('Chrome扩展API不可用，这可能是因为页面不是通过扩展加载的');
      this.isChromeApiAvailable = false;
      
      // 显示警告信息
      this.showApiUnavailableWarning();
    } else {
      this.isChromeApiAvailable = true;
      console.log('Chrome扩展API已加载');
    }
  }

  // 显示API不可用警告
  showApiUnavailableWarning() {
    const warningDiv = document.createElement('div');
    warningDiv.id = 'apiWarning';
    warningDiv.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #ff6b35;
      color: white;
      padding: 10px;
      text-align: center;
      z-index: 10000;
      font-weight: bold;
    `;
    warningDiv.innerHTML = `
      ⚠️ Chrome扩展API不可用。请通过Chrome扩展管理页面正确加载此扩展后再测试。
      <button onclick="this.parentElement.remove()" style="margin-left: 10px; background: white; color: #ff6b35; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">关闭</button>
    `;
    document.body.insertBefore(warningDiv, document.body.firstChild);
  }

  // 初始化DOM元素
  initElements() {
    // API配置
    this.apiProvider = document.getElementById('apiProvider');
    this.apiKey = document.getElementById('apiKey');
    this.apiUrl = document.getElementById('apiUrl');
    this.modelName = document.getElementById('modelName');
    this.customModelName = document.getElementById('customModelName');
    this.modelHelp = document.getElementById('modelHelp');
    this.modelGroup = document.getElementById('modelGroup');
    
    // 高级设置
    this.temperature = document.getElementById('temperature');
    this.temperatureValue = document.getElementById('temperatureValue');
    this.maxTokens = document.getElementById('maxTokens');
    this.summaryLength = document.getElementById('summaryLength');
    
    // 跨设备同步
    this.syncIndicator = document.getElementById('syncIndicator');
    this.syncDot = document.getElementById('syncDot');
    this.syncText = document.getElementById('syncText');
    this.syncTime = document.getElementById('syncTime');
    this.historySyncToggle = document.getElementById('historySyncToggle');
    this.recordCountGroup = document.getElementById('recordCountGroup');
    this.recordCount = document.getElementById('recordCount');
    this.syncNowBtn = document.getElementById('syncNowBtn');
    this.clearSyncDataBtn = document.getElementById('clearSyncDataBtn');
    
    // 按钮
    this.toggleKey = document.getElementById('toggleKey');
    this.saveBtn = document.getElementById('saveBtn');
    this.resetBtn = document.getElementById('resetBtn');
    this.testApiBtn = document.getElementById('testApiBtn');
    this.clearTestBtn = document.getElementById('clearTestBtn');
    
    // 测试结果
    this.testResult = document.getElementById('testResult');
    this.testResultContent = document.getElementById('testResultContent');
    
    // 状态栏
    this.statusBar = document.getElementById('statusBar');
    this.statusIndicator = document.getElementById('statusIndicator');
    this.statusText = document.getElementById('statusText');
    
    // 模态框
    this.modal = document.getElementById('modal');
    this.modalTitle = document.getElementById('modalTitle');
    this.modalBody = document.getElementById('modalBody');
    this.modalFooter = document.getElementById('modalFooter');
    this.closeModalBtn = document.getElementById('closeModalBtn');
    this.modalOkBtn = document.getElementById('modalOkBtn');
    this.modalCancelBtn = document.getElementById('modalCancelBtn');
  }

  // 绑定事件
  bindEvents() {
    // API提供商切换
    this.apiProvider.addEventListener('change', () => this.handleProviderChange());
    
    // 密码显示/隐藏
    this.toggleKey.addEventListener('click', () => this.togglePasswordVisibility());
    
    // 温度滑块
    this.temperature.addEventListener('input', (e) => {
      this.temperatureValue.textContent = e.target.value;
    });
    
    // 跨设备同步事件
    this.historySyncToggle.addEventListener('change', () => this.handleSyncToggleChange());
    this.recordCount.addEventListener('change', () => this.handleRecordCountChange());
    this.syncNowBtn.addEventListener('click', () => this.syncNow());
    this.clearSyncDataBtn.addEventListener('click', () => this.clearSyncData());
    
    // 保存设置
    this.saveBtn.addEventListener('click', () => this.saveSettings());
    
    // 重置设置
    this.resetBtn.addEventListener('click', () => this.resetSettings());
    
    // API测试
    this.testApiBtn.addEventListener('click', () => this.testApi());
    this.clearTestBtn.addEventListener('click', () => this.clearTestResult());
    
    // 模态框控制
    this.closeModalBtn.addEventListener('click', () => this.hideModal());
    this.modalOkBtn.addEventListener('click', () => this.handleModalOk());
    this.modalCancelBtn.addEventListener('click', () => this.hideModal());
    
    // 点击模态框背景关闭
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hideModal();
      }
    });
    
    // ESC键关闭模态框
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.style.display !== 'none') {
        this.hideModal();
      }
    });
  }

  // 加载设置
  async loadSettings() {
    try {
      this.updateStatus('加载设置中...', 'loading');
      
      // 检查Chrome API是否可用
      if (!this.isChromeApiAvailable) {
        console.log('使用默认设置（Chrome API不可用）');
        const defaultSettings = {
          provider: 'openai',
          apiKey: '',
          apiUrl: '',
          modelName: 'gpt-3.5-turbo',
          temperature: 0.3,
          maxTokens: 1500,
          summaryLength: 'medium',
          syncEnabled: false,
          recordCount: 50
        };
        this.populateForm(defaultSettings);
        this.updateStatus('使用默认设置（请通过Chrome扩展加载）', 'warning');
        return;
      }
      
      console.log('🔍 [OPTIONS] 准备发送 getSettings 消息...');
      const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
      
      console.log('🔍 [OPTIONS] 获取设置响应类型:', typeof response);
      console.log('🔍 [OPTIONS] 获取设置响应 (JSON):', JSON.stringify(response, null, 2));
      
      // 检查响应
      if (!response) {
        console.error('❌ [OPTIONS] 响应为空');
        this.updateStatus('加载设置失败: 响应为空', 'error');
        return;
      }
      
      // 检查响应格式
      if (response.success === true && response.settings) {
        const settings = response.settings;
        console.log('✅ [OPTIONS] 设置格式正确，解析后的设置:', {
          provider: settings.provider,
          hasApiKey: !!settings.apiKey,
          hasApiUrl: !!settings.apiUrl,
          apiUrl: settings.apiUrl
        });
        this.populateForm(settings);
        this.updateStatus('设置已加载', 'ready');
      } else if (response.provider) {
        // 如果 response 本身就有 provider，说明 response 可能就是 settings
        console.log('⚠️ [OPTIONS] 响应格式异常，response 本身就是 settings');
        console.log('⚠️ [OPTIONS] 响应内容 (JSON):', JSON.stringify(response, null, 2));
        this.populateForm(response);
        this.updateStatus('设置已加载（格式异常）', 'ready');
      } else {
        // 其他情况
        const errorInfo = {
          hasResponse: !!response,
          success: response?.success,
          hasSettings: !!response?.settings,
          hasProvider: !!response?.provider,
          responseKeys: response ? Object.keys(response) : [],
          responseType: typeof response,
          response: response
        };
        console.error('❌ [OPTIONS] 获取设置失败');
        console.error('❌ [OPTIONS] 响应详情 (JSON):', JSON.stringify(errorInfo, null, 2));
        this.updateStatus('加载设置失败', 'error');
      }
    } catch (error) {
      console.error('加载设置失败:', error);
      this.updateStatus('加载设置失败', 'error');
    }
  }

  // 填充表单
  populateForm(settings) {
    this.apiProvider.value = settings.provider;
    this.apiKey.value = settings.apiKey;
    this.apiUrl.value = settings.apiUrl;
    this.temperature.value = settings.temperature;
    this.temperatureValue.textContent = settings.temperature;
    this.maxTokens.value = settings.maxTokens;
    this.summaryLength.value = settings.summaryLength;
    
    // 跨设备同步设置
    this.historySyncToggle.checked = settings.syncEnabled || false;
    this.recordCount.value = settings.recordCount || 50;
    this.updateRecordCountVisibility();
    
    // 先设置提供商
    this.handleProviderChange();
    this.updateModelOptions();
    
    // 然后设置模型名称
    if (settings.provider === 'custom') {
      this.customModelName.value = settings.modelName || '';
    } else {
      this.modelName.value = settings.modelName || this.modelName.options[0]?.value || '';
    }
    
    // 初始化同步状态
    this.updateSyncStatus('normal');
    this.updateSyncTime();
  }

  // 处理提供商变化
  handleProviderChange() {
    const provider = this.apiProvider.value;
    
    // 更新模型选项
    this.updateModelOptions();
    
    // 更新API地址占位符
    const urlPlaceholders = {
      openai: 'https://api.openai.com/v1/chat/completions',
      anthropic: 'https://api.anthropic.com/v1/messages',
      custom: 'https://your-api-endpoint.com/v1/chat/completions'
    };
    
    this.apiUrl.placeholder = urlPlaceholders[provider] || urlPlaceholders.custom;
    
    // 显示/隐藏模型选择和自定义输入
    if (provider === 'custom') {
      this.modelGroup.style.opacity = '1';
      this.modelName.style.display = 'none';
      this.customModelName.style.display = 'block';
      this.modelHelp.textContent = '输入你的自定义模型名称';
    } else {
      this.modelGroup.style.opacity = '1';
      this.modelName.style.display = 'block';
      this.customModelName.style.display = 'none';
      this.modelHelp.textContent = '选择要使用的模型';
    }
  }

  // 更新模型选项
  updateModelOptions() {
    const provider = this.apiProvider.value;
    
    if (provider === 'custom') {
      // 自定义API：显示输入框，隐藏下拉选择
      this.modelName.style.display = 'none';
      this.customModelName.style.display = 'block';
      this.modelHelp.textContent = '输入你的自定义模型名称 (如: llama-2-70b, qwen-turbo, gemma-7b等)';
      return;
    }
    
    // 其他API：显示下拉选择，隐藏输入框
    this.modelName.style.display = 'block';
    this.customModelName.style.display = 'none';
    this.modelHelp.textContent = '选择要使用的模型';
    
    const modelSelect = this.modelName;
    
    const modelOptions = {
      openai: [
        { value: 'gpt-3.5-turbo', text: 'GPT-3.5 Turbo (推荐)' },
        { value: 'gpt-4', text: 'GPT-4' },
        { value: 'gpt-4-turbo-preview', text: 'GPT-4 Turbo Preview' }
      ],
      anthropic: [
        { value: 'claude-3-haiku-20240307', text: 'Claude 3 Haiku (推荐)' },
        { value: 'claude-3-sonnet-20240229', text: 'Claude 3 Sonnet' },
        { value: 'claude-3-opus-20240229', text: 'Claude 3 Opus' }
      ]
    };
    
    const options = modelOptions[provider] || [];
    
    // 清空现有选项
    modelSelect.innerHTML = '';
    
    // 添加新选项
    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.text;
      modelSelect.appendChild(optionElement);
    });
  }

  // 设置验证
  setupValidation() {
    // API密钥验证
    this.apiKey.addEventListener('blur', () => {
      this.validateApiKey();
    });
    
    // API URL验证
    this.apiUrl.addEventListener('blur', () => {
      this.validateApiUrl();
    });
  }

  // 验证API密钥
  validateApiKey() {
    const key = this.apiKey.value.trim();
    
    if (key && key.length < 10) {
      this.showFieldError(this.apiKey, 'API密钥格式不正确');
      return false;
    }
    
    this.clearFieldError(this.apiKey);
    return true;
  }

  // 验证API URL
  validateApiUrl() {
    const url = this.apiUrl.value.trim();
    
    if (url && !this.isValidUrl(url)) {
      this.showFieldError(this.apiUrl, '请输入有效的URL地址');
      return false;
    }
    
    this.clearFieldError(this.apiUrl);
    return true;
  }

  // 检查URL有效性
  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  // 显示字段错误
  showFieldError(field, message) {
    this.clearFieldError(field);
    
    field.classList.add('error');
    const errorElement = document.createElement('div');
    errorElement.className = 'field-error';
    errorElement.textContent = message;
    
    field.parentNode.appendChild(errorElement);
  }

  // 清除字段错误
  clearFieldError(field) {
    field.classList.remove('error');
    const errorElement = field.parentNode.querySelector('.field-error');
    if (errorElement) {
      errorElement.remove();
    }
  }

  // 切换密码可见性
  togglePasswordVisibility() {
    const isPassword = this.apiKey.type === 'password';
    this.apiKey.type = isPassword ? 'text' : 'password';
    this.toggleKey.querySelector('.icon').textContent = isPassword ? '🙈' : '👁️';
  }

  // 保存设置
  async saveSettings() {
    if (!this.validateForm()) {
      return;
    }

    try {
      this.updateStatus('保存设置中...', 'loading');
      
      const settings = this.getFormData();
      
      // 清除API测试通过状态（因为配置可能已改变）
      try {
        await chrome.storage.local.set({ apiTestPassed: false });
        console.log('⚠️ [OPTIONS] 已清除API测试状态（配置已改变）');
        // 验证清除是否成功
        const verify = await chrome.storage.local.get('apiTestPassed');
        console.log('🔍 [OPTIONS] 验证清除结果:', JSON.stringify(verify, null, 2));
      } catch (error) {
        console.warn('⚠️ [OPTIONS] 清除API测试状态失败:', error);
      }
      
      // 检查Chrome API是否可用
      if (!this.isChromeApiAvailable) {
        console.log('无法保存设置 - Chrome API不可用', settings);
        this.updateStatus('无法保存 - 请通过Chrome扩展加载', 'error');
        this.showErrorModal('无法保存设置到Chrome扩展存储。请通过Chrome扩展管理页面正确加载此扩展后再试。');
        return;
      }
      
      const response = await chrome.runtime.sendMessage({
        action: 'saveSettings',
        settings: settings
      });

      if (response.success) {
        this.updateStatus('设置已保存', 'success');
        this.showSuccessModal('设置已成功保存！', () => {
          // 可以关闭设置页面或刷新
        });
      } else {
        this.updateStatus('保存失败', 'error');
        this.showErrorModal(`保存失败: ${response.error}`);
      }
    } catch (error) {
      console.error('保存设置失败:', error);
      this.updateStatus('保存失败', 'error');
      this.showErrorModal(`保存失败: ${error.message}`);
    }
  }

  // 获取表单数据
  getFormData() {
    const provider = this.apiProvider.value;
    
    // 根据提供商类型选择模型名称源
    let modelName;
    if (provider === 'custom') {
      modelName = this.customModelName.value.trim() || 'default';
    } else {
      modelName = this.modelName.value;
    }
    
    return {
      provider: provider,
      apiKey: this.apiKey.value.trim(),
      apiUrl: this.apiUrl.value.trim(),
      modelName: modelName,
      temperature: parseFloat(this.temperature.value),
      maxTokens: parseInt(this.maxTokens.value),
      summaryLength: this.summaryLength.value,
      syncEnabled: this.historySyncToggle.checked,
      recordCount: parseInt(this.recordCount.value)
    };
  }

  // 验证表单
  validateForm() {
    let isValid = true;
    
    // 验证API密钥
    if (!this.apiKey.value.trim()) {
      this.showFieldError(this.apiKey, '请输入API密钥');
      isValid = false;
    } else if (!this.validateApiKey()) {
      isValid = false;
    }
    
    // 验证API URL
    if (this.apiUrl.value.trim() && !this.validateApiUrl()) {
      isValid = false;
    }
    
    // 验证最大值
    if (parseInt(this.maxTokens.value) < 100) {
      this.showFieldError(this.maxTokens, '最大Token数不能小于100');
      isValid = false;
    }
    
    // 验证自定义模型名称
    if (this.apiProvider.value === 'custom' && !this.customModelName.value.trim()) {
      this.showFieldError(this.customModelName, '请输入自定义模型名称');
      isValid = false;
    }
    
    if (!isValid) {
      this.updateStatus('请检查表单输入', 'error');
    }
    
    return isValid;
  }

  // 重置设置
  resetSettings() {
    this.showConfirmModal('确定要重置所有设置吗？这将清除你的API配置。', async () => {
      // 重置UI表单字段
      this.apiProvider.value = 'openai';
      this.apiKey.value = '';
      this.apiUrl.value = '';
      this.customModelName.value = '';
      this.temperature.value = '0.3';
      this.temperatureValue.textContent = '0.3';
      this.maxTokens.value = '1500';
      this.summaryLength.value = 'medium';
      this.historySyncToggle.checked = false;
      this.recordCount.value = '50';
      this.updateRecordCountVisibility();
      this.handleProviderChange();
      
      // 如果Chrome API可用，尝试清除存储
      if (this.isChromeApiAvailable) {
        try {
          await chrome.runtime.sendMessage({ action: 'clearSettings' });
          this.updateStatus('设置已重置', 'success');
        } catch (error) {
          console.error('重置设置失败:', error);
          this.updateStatus('UI已重置，但存储清除失败', 'warning');
        }
      } else {
        this.updateStatus('UI已重置（Chrome API不可用）', 'warning');
      }
    });
  }

  // 测试API
  async testApi() {
    if (!this.validateForm()) {
      return;
    }

    try {
      this.updateStatus('测试API中...', 'loading');
      this.testApiBtn.disabled = true;
      this.testApiBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">测试中...</span>';
      
      const settings = this.getFormData();
      
      // 使用简单的测试内容
      const testContent = '这是一个测试内容，用于验证API配置是否正确。请简单总结这段话。';
      const testPrompt = {
        system: '你是一个总结助手。请用一句话总结给定的测试内容。',
        user: `请总结以下测试内容：\n\n${testContent}`
      };
      
      // 模拟API调用（这里应该调用实际的API测试）
      const result = await this.testApiCall(testPrompt, settings);
      
      this.showTestResult(result);
      
    } catch (error) {
      console.error('API测试失败:', error);
      this.showTestResult({
        success: false,
        error: error.message
      });
    } finally {
      this.updateStatus('就绪', 'ready');
      this.testApiBtn.disabled = false;
      this.testApiBtn.innerHTML = '<span class="btn-icon">🔍</span><span class="btn-text">测试 API</span>';
    }
  }

  // 测试API调用
  async testApiCall(prompt, settings) {
    try {
      // 调用后台脚本的API测试功能
      const response = await chrome.runtime.sendMessage({
        action: 'testApi',
        prompt: prompt,
        settings: settings
      });
      
      if (response && response.success) {
        return {
          success: true,
          summary: response.summary || 'API测试成功！',
          usage: response.usage || { total_tokens: 0 }
        };
      } else {
        return {
          success: false,
          error: response?.error || 'API测试失败'
        };
      }
    } catch (error) {
      console.error('API测试调用失败:', error);
      return {
        success: false,
        error: error.message || 'API测试调用失败'
      };
    }
  }

  // 显示测试结果
  async showTestResult(result) {
    this.testResult.style.display = 'block';
    
    console.log('🔍 [OPTIONS] showTestResult 被调用，结果:', JSON.stringify({
      success: result.success,
      hasError: !!result.error,
      hasSummary: !!result.summary
    }, null, 2));
    
    if (result.success) {
      // 保存API测试通过状态
      try {
        await chrome.storage.local.set({ apiTestPassed: true });
        console.log('✅ [OPTIONS] API测试通过状态已保存到 storage.local');
        // 验证保存是否成功
        const verify = await chrome.storage.local.get('apiTestPassed');
        console.log('🔍 [OPTIONS] 验证保存结果:', JSON.stringify(verify, null, 2));
      } catch (error) {
        console.error('❌ [OPTIONS] 保存API测试状态失败:', error);
      }
      
      this.testResultContent.innerHTML = `
        <div class="test-success">
          <div class="success-icon">✅</div>
          <h4>API测试成功！</h4>
          <p>你的API配置工作正常，可以开始使用扩展了。</p>
          <div class="test-summary">
            <h5>测试总结结果：</h5>
            <div class="summary-text">${result.summary}</div>
            ${result.usage ? `<p class="usage-info">Token使用量: ${result.usage.total_tokens}</p>` : ''}
          </div>
        </div>
      `;
    } else {
      // 清除API测试通过状态
      try {
        await chrome.storage.local.set({ apiTestPassed: false });
        console.log('⚠️ [OPTIONS] API测试失败状态已保存到 storage.local');
        // 验证保存是否成功
        const verify = await chrome.storage.local.get('apiTestPassed');
        console.log('🔍 [OPTIONS] 验证保存结果:', JSON.stringify(verify, null, 2));
      } catch (error) {
        console.error('❌ [OPTIONS] 保存API测试状态失败:', error);
      }
      
      this.testResultContent.innerHTML = `
        <div class="test-error">
          <div class="error-icon">❌</div>
          <h4>API测试失败</h4>
          <p>请检查你的API配置：</p>
          <ul class="error-list">
            <li>确认API密钥是否正确</li>
            <li>检查API地址是否有效</li>
            <li>验证网络连接</li>
            <li>确认API账户有足够余额</li>
          </ul>
          <p class="error-details">错误信息: ${result.error}</p>
        </div>
      `;
    }
  }

  // 清除测试结果
  clearTestResult() {
    this.testResult.style.display = 'none';
    this.testResultContent.innerHTML = '';
  }

  // 更新状态
  updateStatus(message, type = 'ready') {
    this.statusText.textContent = message;
    this.statusIndicator.className = `status-indicator ${type}`;
  }

  // 显示成功模态框
  showSuccessModal(message, onOk) {
    this.modalTitle.textContent = '成功';
    this.modalBody.innerHTML = `<p>${message}</p>`;
    this.modalFooter.style.display = 'none';
    this.modal.style.display = 'flex';
    
    this.modalOkBtn.onclick = () => {
      this.hideModal();
      if (onOk) onOk();
    };
  }

  // 显示错误模态框
  showErrorModal(message) {
    this.modalTitle.textContent = '错误';
    this.modalBody.innerHTML = `<p>${message}</p>`;
    this.modalFooter.style.display = 'none';
    this.modal.style.display = 'flex';
  }

  // 显示确认模态框
  showConfirmModal(message, onConfirm) {
    this.modalTitle.textContent = '确认';
    this.modalBody.innerHTML = `<p>${message}</p>`;
    this.modalFooter.style.display = 'flex';
    this.modal.style.display = 'flex';
    
    this.modalOkBtn.onclick = () => {
      this.hideModal();
      if (onConfirm) onConfirm();
    };
    
    this.modalCancelBtn.onclick = () => {
      this.hideModal();
    };
  }

  // 隐藏模态框
  hideModal() {
    this.modal.style.display = 'none';
  }

  // 处理模态框确认
  handleModalOk() {
    this.hideModal();
  }

  // =============== 跨设备同步相关方法 ===============

  // 处理同步开关变化
  handleSyncToggleChange() {
    this.updateRecordCountVisibility();
    this.saveSyncSettings();
  }

  // 处理记录数量变化
  handleRecordCountChange() {
    this.saveSyncSettings();
  }

  // 更新记录数量选择器显示
  updateRecordCountVisibility() {
    if (this.historySyncToggle.checked) {
      this.recordCountGroup.style.display = 'block';
    } else {
      this.recordCountGroup.style.display = 'none';
    }
  }

  // 保存同步设置
  saveSyncSettings() {
    if (!this.isChromeApiAvailable) {
      console.log('无法保存同步设置 - Chrome API不可用');
      return;
    }

    const syncSettings = {
      syncEnabled: this.historySyncToggle.checked,
      recordCount: parseInt(this.recordCount.value)
    };

    chrome.runtime.sendMessage({
      action: 'saveSettings',
      settings: syncSettings
    }).then(response => {
      if (response.success) {
        console.log('同步设置已保存');
      } else {
        console.error('保存同步设置失败:', response.error);
      }
    }).catch(error => {
      console.error('保存同步设置异常:', error);
    });
  }

  // 立即同步
  async syncNow() {
    if (!this.isChromeApiAvailable) {
      this.showErrorModal('无法执行同步操作 - 请通过Chrome扩展加载');
      return;
    }

    try {
      this.updateSyncStatus('syncing');
      this.syncNowBtn.disabled = true;
      this.syncNowBtn.innerHTML = '<span class="btn-icon sync-loading">🔄</span><span class="btn-text">同步中...</span>';

      const response = await chrome.runtime.sendMessage({
        action: 'forceSync',
        settings: this.getFormData()
      });

      if (response.success) {
        this.updateSyncStatus('normal');
        this.updateSyncTime();
        this.showSuccessModal('同步完成！', () => {
          console.log('跨设备同步成功');
        });
      } else {
        this.updateSyncStatus('error');
        this.showErrorModal(`同步失败: ${response.error}`);
      }
    } catch (error) {
      console.error('同步异常:', error);
      this.updateSyncStatus('error');
      this.showErrorModal(`同步失败: ${error.message}`);
    } finally {
      this.syncNowBtn.disabled = false;
      this.syncNowBtn.innerHTML = '<span class="btn-icon">🔄</span><span class="btn-text">立即同步</span>';
    }
  }

  // 清除同步数据
  clearSyncData() {
    this.showConfirmModal('确定要清除所有同步数据吗？此操作不可恢复。', async () => {
      if (!this.isChromeApiAvailable) {
        this.showErrorModal('无法执行清除操作 - 请通过Chrome扩展加载');
        return;
      }

      try {
        const response = await chrome.runtime.sendMessage({
          action: 'clearSettings'
        });

        if (response.success) {
          this.updateSyncStatus('offline');
          this.updateSyncTime();
          this.showSuccessModal('同步数据已清除！');
        } else {
          this.showErrorModal(`清除失败: ${response.error}`);
        }
      } catch (error) {
        console.error('清除同步数据异常:', error);
        this.showErrorModal(`清除失败: ${error.message}`);
      }
    });
  }

  // 更新同步状态
  updateSyncStatus(status) {
    // 移除所有状态类
    this.syncDot.classList.remove('status-normal', 'status-syncing', 'status-error', 'status-offline');
    
    // 添加新状态类
    const statusMap = {
      'normal': { class: 'status-normal', text: '同步正常' },
      'syncing': { class: 'status-syncing', text: '同步中...' },
      'error': { class: 'status-error', text: '同步错误' },
      'offline': { class: 'status-offline', text: '离线模式' }
    };

    const statusInfo = statusMap[status] || statusMap['offline'];
    this.syncDot.classList.add(statusInfo.class);
    this.syncText.textContent = statusInfo.text;
  }

  // 更新同步时间
  updateSyncTime() {
    const now = new Date();
    const timeString = now.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    this.syncTime.textContent = `最后更新: ${timeString}`;
  }

  // 定时更新同步状态（模拟实时更新）
  startSyncStatusPolling() {
    // 每30秒检查一次同步状态
    this.syncStatusInterval = setInterval(() => {
      if (this.isChromeApiAvailable && this.historySyncToggle.checked) {
        this.checkSyncStatus();
      }
    }, 30000);
  }

  // 检查同步状态
  async checkSyncStatus() {
    if (!this.isChromeApiAvailable) {
      this.updateSyncStatus('offline');
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getSyncStatus'
      });

      if (response.success) {
        const status = response.status;
        this.updateSyncStatus(status.state);
        if (status.lastSync) {
          const syncTime = new Date(status.lastSync);
          const timeString = syncTime.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
          this.syncTime.textContent = `最后更新: ${timeString}`;
        }
      }
    } catch (error) {
      console.error('检查同步状态失败:', error);
      this.updateSyncStatus('error');
    }
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  window.optionsManager = new OptionsManager();
});