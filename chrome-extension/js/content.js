// 检查是否在特殊页面（chrome://, edge://, about: 等）
function isSpecialPage() {
  try {
    const url = window.location.href;
    const isSpecialProtocol = /^(chrome|edge|about|moz-extension|chrome-extension):\/\//i.test(url);
    
    if (!isSpecialProtocol) {
      return false;
    }
    
    // 如果是 chrome-extension://，检查是否是当前扩展
    if (url.startsWith('chrome-extension://')) {
      if (isChromeRuntimeAvailable()) {
        try {
          const extensionId = chrome.runtime.id;
          return !url.startsWith('chrome-extension://' + extensionId);
        } catch (e) {
          // 如果无法获取扩展ID，假设是其他扩展的页面
          return true;
        }
      }
      // chrome.runtime 不可用，假设是其他扩展的页面
      return true;
    }
    
    // 其他特殊协议
    return true;
  } catch (e) {
    // 如果无法检查，假设是特殊页面
    return true;
  }
}

// 检查 chrome.runtime 是否可用
function isChromeRuntimeAvailable() {
  try {
    return typeof chrome !== 'undefined' && 
           chrome.runtime && 
           typeof chrome.runtime.getURL === 'function';
  } catch (e) {
    return false;
  }
}

// 引入选择器记录器和悬停高亮系统
// 动态加载SelectorRecorder类和HoverHighlighter类
function loadExternalScripts() {
  return new Promise((resolve) => {
    // 检查 chrome.runtime 是否可用
    if (!isChromeRuntimeAvailable()) {
      console.warn('chrome.runtime 不可用，跳过外部脚本加载');
      resolve();
      return;
    }

    // 检查是否在特殊页面
    if (isSpecialPage()) {
      console.warn('特殊页面，跳过外部脚本加载');
      resolve();
      return;
    }

    let loadedCount = 0;
    const totalScripts = 2;
    let hasError = false;
    
    const checkCompletion = () => {
      loadedCount++;
      if (loadedCount === totalScripts) {
        if (hasError) {
          console.warn('部分外部脚本加载失败，但将继续运行');
        }
        resolve();
      }
    };
    
    // 加载SelectorRecorder
    if (typeof SelectorRecorder === 'undefined') {
      try {
        const selectorScript = document.createElement('script');
        const scriptUrl = chrome.runtime.getURL('js/selector-recorder.js');
        
        // 验证 URL 是否有效
        if (!scriptUrl || scriptUrl.includes('invalid')) {
          console.warn('SelectorRecorder脚本URL无效，使用备用方案');
          hasError = true;
          checkCompletion();
        } else {
          selectorScript.src = scriptUrl;
          selectorScript.onload = checkCompletion;
          selectorScript.onerror = () => {
            console.warn('SelectorRecorder脚本加载失败，使用备用方案');
            hasError = true;
            checkCompletion();
          };
          
          // 检查 head 是否存在
          if (document.head) {
            document.head.appendChild(selectorScript);
          } else {
            console.warn('document.head 不存在，使用备用方案');
            hasError = true;
            checkCompletion();
          }
        }
      } catch (error) {
        console.warn('加载SelectorRecorder时出错:', error);
        hasError = true;
        checkCompletion();
      }
    } else {
      checkCompletion();
    }
    
    // 加载HoverHighlighter
    if (typeof HoverHighlighter === 'undefined') {
      try {
        const hoverScript = document.createElement('script');
        const scriptUrl = chrome.runtime.getURL('js/hover-highlight.js');
        
        // 验证 URL 是否有效
        if (!scriptUrl || scriptUrl.includes('invalid')) {
          console.warn('HoverHighlighter脚本URL无效，使用备用方案');
          hasError = true;
          checkCompletion();
        } else {
          hoverScript.src = scriptUrl;
          hoverScript.onload = checkCompletion;
          hoverScript.onerror = () => {
            console.warn('HoverHighlighter脚本加载失败，使用备用方案');
            hasError = true;
            checkCompletion();
          };
          
          // 检查 head 是否存在
          if (document.head) {
            document.head.appendChild(hoverScript);
          } else {
            console.warn('document.head 不存在，使用备用方案');
            hasError = true;
            checkCompletion();
          }
        }
      } catch (error) {
        console.warn('加载HoverHighlighter时出错:', error);
        hasError = true;
        checkCompletion();
      }
    } else {
      checkCompletion();
    }
  });
}

// 内容脚本 - 从网页提取主要内容
class ContentExtractor {
  constructor() {
    this.isSelectionMode = false;
    this.selectedElements = [];
    this.maxSelections = 10;
    this.selectionHighlights = [];
    this.eventListeners = new Map();
    this.selectionHistory = [];
    this.errorState = null;
    this.selectionStartTime = null;
    this.mutationObserver = null;
    this.resizeTimeout = null;
    this.hoverTimeout = null;
    this.lastHoveredElement = null;
    
    // 先加载外部脚本，然后初始化
    this.initAsync();
  }

  // 异步初始化方法
  async initAsync() {
    try {
      console.log('开始加载外部脚本...');
      await loadExternalScripts();
      console.log('外部脚本加载完成');
      
      // 初始化选择器记录器
      this.selectorRecorder = null;
      await this.waitForSelectorRecorder();
      
      // 初始化内容提取器
      this.init();
      
      console.log('ContentExtractor初始化完成');
    } catch (error) {
      console.error('ContentExtractor初始化失败:', error);
      // 即使失败也要尝试继续初始化
      this.init();
    }
  }

  // 初始化
  init() {
    // 防止重复注册消息监听器
    if (this.messageListenerRegistered) {
      console.log('消息监听器已注册，跳过重复注册');
      return;
    }
    this.messageListenerRegistered = true;
    
    // 监听来自popup的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // 对于异步操作，返回true以保持消息通道开放
      let isAsync = false;
      
      try {
        switch (message.action) {
          case 'ping':
            console.log('Content script received ping request');
            sendResponse({ success: true, message: 'Content script is ready' });
            break;
            
          case 'extractContent':
            console.log('Content script received extractContent request');
            isAsync = true;
            // 确保页面完全加载
            this.waitForPageReady().then(() => {
              return this.extractContent();
            }).then(content => {
              console.log('Content extraction completed:', content);
              sendResponse(content);
            }).catch(error => {
              console.error('Content extraction error:', error);
              sendResponse({ 
                success: false, 
                error: `内容提取失败: ${error.message}`,
                details: error.toString()
              });
            });
            return true; // 保持消息通道开放
            break;
            
          // 选择模式相关消息
          case 'startSelection':
            isAsync = true;
            // 使用异步处理，确保返回响应
            this.startSelection(message.maxSelections || 10).then(() => {
              sendResponse({ success: true, message: 'Selection mode started' });
            }).catch(error => {
              console.error('启动选择模式失败:', error);
              sendResponse({ success: false, error: error.message || '启动选择模式失败' });
            });
            return true; // 保持消息通道开放以支持异步响应
            break;
            
          case 'stopSelection':
            isAsync = true;
            this.stopSelection().then(() => {
              sendResponse({ success: true, message: 'Selection mode stopped' });
            }).catch(error => {
              console.error('停止选择模式失败:', error);
              sendResponse({ success: false, error: error.message || '停止选择模式失败' });
            });
            return true; // 保持消息通道开放
            break;
            
          case 'removeSelection':
            this.removeSelection(message.index).then(() => {
              sendResponse({ success: true });
            }).catch(error => {
              sendResponse({ success: false, error: error.message });
            });
            break;
            
          case 'clearAllSelections':
            this.clearAllSelections().then(() => {
              sendResponse({ success: true });
            }).catch(error => {
              sendResponse({ success: false, error: error.message });
            });
            break;
            
          case 'extractSelectedContent':
            this.extractSelectedContent(message.selectedElements).then(content => {
              // 返回内容以及页面基本信息
              sendResponse({ 
                success: true, 
                content: content,
                url: window.location.href,
                title: document.title || '无标题'
              });
            }).catch(error => {
              sendResponse({ success: false, error: error.message });
            });
            break;
            
          default:
            sendResponse({ success: false, error: 'Unknown action' });
        }
      } catch (error) {
        console.error('Content script message handling error:', error);
        sendResponse({ 
          success: false, 
          error: `消息处理失败: ${error.message}`,
          details: error.toString()
        });
      }
      return true; // 保持消息通道开放
    });
    
    // 标记content script已加载
    console.log('Content script initialized successfully');
  }

  // 立即初始化选择器记录器
  waitForSelectorRecorder() {
    return new Promise((resolve) => {
      const maxRetries = 5;
      let retryCount = 0;
      
      const tryInitialize = () => {
        try {
          if (typeof SelectorRecorder !== 'undefined' && typeof SelectorRecorder === 'function') {
            this.selectorRecorder = new SelectorRecorder();
            console.log('SelectorRecorder已初始化');
            resolve();
          } else if (retryCount < maxRetries) {
            retryCount++;
            console.log(`等待SelectorRecorder类加载... 尝试 ${retryCount}/${maxRetries}`);
            setTimeout(tryInitialize, 500);
          } else {
            // 如果SelectorRecorder类不存在，直接创建实例
            console.info('SelectorRecorder类未定义，使用备用方案');
            this.selectorRecorder = {
              generateXPath: (el) => {
                if (!el || !el.tagName) return '';
                if (el.id) return `//*[@id="${el.id}"]`;
                return `//${el.tagName.toLowerCase()}`;
              },
              generateCSSSelector: (el) => {
                if (!el || !el.tagName) return '';
                if (el.id) return `#${el.id}`;
                return el.tagName.toLowerCase();
              },
              generateElementIdentifier: (el) => {
                if (!el) return `temp_${Date.now()}_${Math.random()}`;
                const tagName = el.tagName?.toLowerCase() || 'unknown';
                const id = el.id ? `_${el.id}` : '';
                const className = el.className ? `_${el.className.replace(/\s+/g, '_')}` : '';
                return `${tagName}${id}${className}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              },
              storeSelectionState: () => true,
              extractElementInfo: (el) => {
                if (!el) return {};
                return {
                  tagName: el.tagName?.toLowerCase(),
                  id: el.id || null,
                  className: el.className || '',
                  textContent: el.textContent?.trim() || '',
                  innerText: el.innerText?.trim() || ''
                };
              },
              extractElementContent: (el) => {
                if (!el) return {};
                return {
                  outerHTML: el.outerHTML?.substring(0, 500) || '',
                  innerHTML: el.innerHTML?.substring(0, 500) || ''
                };
              },
              getSelectionState: () => null
            };
            console.log('备用SelectorRecorder已创建');
            resolve();
          }
        } catch (error) {
          console.error('SelectorRecorder初始化失败:', error);
          // 创建更简单的备用方案
          this.selectorRecorder = {
            generateXPath: (el) => `//${el?.tagName?.toLowerCase() || 'div'}`,
            generateCSSSelector: (el) => el?.tagName?.toLowerCase() || 'div',
            generateElementIdentifier: () => `temp_${Date.now()}_${Math.random()}`,
            storeSelectionState: () => true,
            extractElementInfo: () => ({}),
            extractElementContent: () => ({}),
            getSelectionState: () => null
          };
          console.log('简单备用SelectorRecorder已创建');
          resolve();
        }
      };
      
      // 延迟执行，给脚本加载时间
      setTimeout(tryInitialize, 100);
    });
  }

  // 检测是否为动态页面（SPA、React、Vue等）
  isDynamicPage() {
    const indicators = {
      hasHistory: !!(window.history && window.history.pushState),
      hasReact: !!(document.querySelector('[data-reactroot]') || 
                   document.querySelector('[data-react]') ||
                   document.querySelector('#root')?.getAttribute('data-reactroot') !== null),
      hasVue: !!(document.querySelector('[data-vue-app]') || 
                 document.querySelector('.vue-app') ||
                 document.querySelector('#app')?.getAttribute('v-app') !== null),
      hasAngular: !!(document.querySelector('[ng-app]') || 
                     document.querySelector('[ng-controller]') ||
                     document.querySelector('[ng-version]')),
      hasFramework: !!(document.querySelector('[id*="app"]') || 
                       document.querySelector('[class*="app"]') ||
                       document.querySelector('[class*="application"]')),
      hasAjax: !!document.querySelector('[data-ajax]') || !!document.querySelector('[data-xhr]')
    };
    
    const hasAnyFramework = Object.values(indicators).some(v => v);
    console.log('🔍 动态页面检测:', { ...indicators, isDynamic: hasAnyFramework });
    return hasAnyFramework;
  }

  // 增强的页面等待机制
  waitForPageReady() {
    return new Promise((resolve, reject) => {
      console.log('🔄 开始页面加载等待流程...');
      console.log('📊 初始状态检查:', {
        readyState: document.readyState,
        url: window.location.href,
        title: document.title,
        hasBody: !!document.body,
        bodyTextLength: (document.body?.textContent || '').length
      });
      
      const isDynamic = this.isDynamicPage();
      let networkRequests = 0;
      let contentChanges = 0;
      let maxWaitTime = isDynamic ? 8000 : 3000; // 动态页面等待8秒，静态页面3秒
      let checkCount = 0;
      
      // 监控网络请求
      if (window.performance && window.performance.getEntries) {
        networkRequests = window.performance.getEntries().length;
        console.log('🌐 初始网络请求数:', networkRequests);
      }
      
      // 基础页面状态检查
      const basicReady = () => {
        return document.readyState === 'complete' && 
               !!document.body && 
               (document.body.textContent || '').trim().length > 10;
      };
      
      // 动态内容检查
      const checkDynamicContent = () => {
        const currentRequests = window.performance ? window.performance.getEntries().length : 0;
        const bodyText = (document.body?.textContent || '').trim();
        const currentLength = bodyText.length;
        
        // 监控网络请求变化
        if (currentRequests > networkRequests) {
          console.log('📡 检测到新的网络请求:', currentRequests - networkRequests);
          networkRequests = currentRequests;
        }
        
        // 监控内容变化
        if (currentLength > 50) {
          contentChanges++;
          console.log('📄 内容检测 - 长度:', currentLength, '变化次数:', contentChanges);
        }
        
        return {
          isNetworkIdle: currentRequests <= networkRequests + 2, // 允许2个额外请求
          hasMeaningfulContent: currentLength > 100,
          hasStableContent: contentChanges >= 2 || currentLength > 500
        };
      };
      
      // 逐步检查机制
      const checkPageState = () => {
        checkCount++;
        console.log(`🔍 页面状态检查 #${checkCount}`);
        
        // 基础检查
        if (basicReady()) {
          console.log('✅ 基础页面就绪检查通过');
          
          // 动态页面需要额外检查
          if (isDynamic) {
            const dynamicChecks = checkDynamicContent();
            if (dynamicChecks.isNetworkIdle && (dynamicChecks.hasMeaningfulContent || dynamicChecks.hasStableContent)) {
              console.log('✅ 动态页面完全就绪');
              resolve();
              return;
            }
          } else {
            console.log('✅ 静态页面就绪');
            resolve();
            return;
          }
        }
        
        // 继续等待
        if (Date.now() - startTime < maxWaitTime) {
          setTimeout(checkPageState, 300);
        } else {
          console.warn('⚠️ 页面等待超时，强制开始内容提取');
          console.warn('⏰ 超时详情:', {
            waitTime: Date.now() - startTime,
            maxWaitTime,
            isDynamic,
            checkCount,
            finalReadyState: document.readyState,
            hasBody: !!document.body,
            bodyLength: (document.body?.textContent || '').length
          });
          resolve();
        }
      };
      
      // 传统事件监听作为备用
      const onReady = () => {
        console.log('🎯 传统页面加载事件触发');
        setTimeout(checkPageState, isDynamic ? 500 : 200);
        window.removeEventListener('load', onReady);
        document.removeEventListener('DOMContentLoaded', onReady);
      };
      
      // 启动检查流程
      const startTime = Date.now();
      
      // 立即检查一次
      if (basicReady()) {
        console.log('✅ 页面已就绪，立即开始检查');
        setTimeout(checkPageState, isDynamic ? 500 : 200);
      } else {
        console.log('⏳ 页面未就绪，等待加载事件');
        window.addEventListener('load', onReady);
        document.addEventListener('DOMContentLoaded', onReady);
        setTimeout(checkPageState, 1000); // 1秒后开始检查
      }
      
      // 最终超时保护
      setTimeout(() => {
        console.warn('🛑 强制超时保护激活');
        resolve();
      }, maxWaitTime + 2000);
    });
  }

  // 提取页面内容
  async extractContent() {
    console.log('========================================');
    console.log('开始内容提取流程...');
    console.log('页面URL:', window.location.href);
    console.log('页面标题:', document.title);
    console.log('文档状态:', document.readyState);
    console.log('========================================');
    
    try {
      // 获取页面基本信息
      const title = document.title || '无标题';
      const url = window.location.href;
      console.log('📄 页面信息 - 标题:', title, 'URL:', url);
      
      // 检查页面状态
      if (!document.body) {
        throw new Error('页面主体不存在');
      }
      
      // 检查页面内容是否可见
      const bodyContent = document.body.textContent || document.body.innerText || '';
      console.log('📊 页面内容长度:', bodyContent.length);
      
      if (bodyContent.trim().length < 50) {
        throw new Error('页面内容过少，可能为空白页面或特殊页面');
      }
      
      // 提取主要内容
      console.log('🔍 提取主要内容中...');
      const mainContent = this.extractMainContent();
      console.log('✅ 主要内容提取完成，长度:', mainContent.length);
      
      if (!mainContent || mainContent.trim().length === 0) {
        throw new Error('无法提取到有效内容，请确保页面包含文本内容');
      }
      
      // 提取页面元信息
      console.log('🏷️ 提取元信息中...');
      const metaInfo = this.extractMetaInfo();
      
      // 计算置信度
      console.log('📈 计算内容置信度...');
      const confidence = this.calculateConfidence(mainContent, metaInfo);
      console.log('📊 内容置信度:', confidence);
      
      const result = {
        success: true,
        title: title,
        url: url,
        content: mainContent,
        metaInfo: metaInfo,
        confidence: confidence,
        timestamp: Date.now(),
        extractionMethod: 'intelligent',
        wordCount: mainContent.split(/\s+/).length
      };
      
      console.log('🎉 内容提取成功完成！');
      console.log('========================================');
      return result;
      
    } catch (error) {
      console.error('❌ 主内容提取失败:', error);
      console.log('🔄 尝试备用提取方法...');
      
      // 尝试备用方法
      try {
        const fallbackResult = this.fallbackExtract();
        if (fallbackResult.success) {
          console.log('✅ 备用提取方法成功！');
          return fallbackResult;
        }
      } catch (fallbackError) {
        console.error('❌ 备用提取方法也失败:', fallbackError);
      }
      
      // 尝试最后的后备方法
      console.log('🆘 使用最后的后备方法...');
      try {
        const emergencyResult = this.emergencyExtract();
        if (emergencyResult.success) {
          console.log('✅ 后备提取方法成功！');
          return emergencyResult;
        }
      } catch (emergencyError) {
        console.error('❌ 后备提取方法也失败:', emergencyError);
      }
      
      // 智能错误分类和用户指导
      const errorType = this.determineErrorType(pageAnalysis, error.message);
      const userMessage = this.getUserFriendlyErrorMessage(errorType, pageAnalysis);
      const troubleshooting = this.getTroubleshootingSteps(errorType, pageAnalysis);
      
      console.error('❌ ========== 内容提取失败 ==========');
      console.error('错误类型:', errorType);
      console.error('用户友好消息:', userMessage);
      console.error('排错步骤:', troubleshooting);
      console.error('页面分析:', pageAnalysis);
      console.error('原始错误:', error);
      
      return {
        success: false,
        error: userMessage,
        details: `🔍 技术详情:
错误类型: ${errorType}
错误消息: ${error.message}
时间戳: ${new Date().toLocaleString()}

📊 页面信息:
- URL: ${window.location.href}
- 标题: ${document.title}
- 状态: ${document.readyState}
- 类型: ${pageAnalysis.isDynamic ? '动态页面' : '静态页面'}
- 文本长度: ${(document.body?.textContent || '').length}
- iframe数量: ${window.frames.length}

🛠️ 排错建议:
${troubleshooting}`,
        timestamp: Date.now(),
        errorType: errorType,
        pageAnalysis: pageAnalysis
      };
    }
  }

  // 备用内容提取方法
  fallbackExtract() {
    try {
      const title = document.title || '无标题';
      const url = window.location.href;
      
      // 简单的body文本提取
      let content = '';
      
      if (document.body) {
        // 尝试多种方法获取文本内容
        const methods = [
          () => document.body.textContent || '',
          () => document.body.innerText || '',
          () => this.getPageText()
        ];
        
        for (const method of methods) {
          const text = method();
          if (text && text.length > content.length) {
            content = text;
          }
        }
      }
      
      // 清理内容
      content = this.cleanText(content);
      
      if (!content || content.length < 50) {
        throw new Error('无法提取足够的内容');
      }
      
      // 限制长度
      if (content.length > 10000) {
        content = content.substring(0, 10000) + '...[内容过长，已截断]';
      }
      
      return {
        success: true,
        title: title,
        url: url,
        content: content,
        metaInfo: {
          title: title,
          description: '',
          author: '',
          publishDate: '',
          keywords: '',
          pageType: 'general',
          language: document.documentElement.lang || 'zh'
        },
        confidence: 30, // 较低的置信度，因为是备用方法
        timestamp: Date.now(),
        extractionMethod: 'fallback',
        wordCount: content.split(/\s+/).length
      };
    } catch (error) {
      throw new Error(`备用提取方法失败: ${error.message}`);
    }
  }

  // 获取页面文本的备用方法
  getPageText() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // 过滤隐藏元素
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return NodeFilter.FILTER_REJECT;
          }
          
          const text = node.textContent.trim();
          return text.length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      }
    );
    
    let text = '';
    let node;
    
    while (node = walker.nextNode()) {
      text += node.textContent + ' ';
    }
    
    return text.trim();
  }

  // 智能错误类型判断
  determineErrorType(pageAnalysis, errorMessage) {
    const bodyTextLength = (document.body?.textContent || '').length;
    
    if (errorMessage.includes('body元素不存在') || !pageAnalysis.hasBody) {
      return 'DOM_NOT_READY';
    }
    if (errorMessage.includes('DOM查询') || !pageAnalysis.hasQuerySelector) {
      return 'DOM_API_UNAVAILABLE';
    }
    if (bodyTextLength < 20) {
      return 'CONTENT_TOO_SPARSE';
    }
    if (bodyTextLength < 100) {
      return 'CONTENT_INSUFFICIENT';
    }
    if (pageAnalysis.frameCount > 0) {
      return 'IFRAME_CONTENT_BLOCKED';
    }
    if (pageAnalysis.isDynamic && pageAnalysis.readyState !== 'complete') {
      return 'DYNAMIC_CONTENT_NOT_LOADED';
    }
    return 'GENERAL_EXTRACTION_FAILURE';
  }

  // 获取用户友好的错误消息
  getUserFriendlyErrorMessage(errorType, pageAnalysis) {
    const messages = {
      'DOM_NOT_READY': '页面DOM结构未准备好，请稍等片刻或刷新页面后重试',
      'DOM_API_UNAVAILABLE': '页面DOM接口不可用，请尝试刷新页面或更换浏览器',
      'CONTENT_TOO_SPARSE': '页面内容过少，可能是空白页面、加载中或特殊格式页面',
      'CONTENT_INSUFFICIENT': '页面内容不足，请确保页面已完全加载并包含足够的文本内容',
      'IFRAME_CONTENT_BLOCKED': '内容位于iframe中，某些安全策略可能阻止了内容提取',
      'DYNAMIC_CONTENT_NOT_LOADED': '动态页面内容未完全加载，请等待页面稳定后再试',
      'GENERAL_EXTRACTION_FAILURE': '内容提取失败，请刷新页面后重试'
    };
    
    return messages[errorType] || '内容提取失败，请刷新页面后重试';
  }

  // 获取排错步骤
  getTroubleshootingSteps(errorType, pageAnalysis) {
    const steps = {
      'DOM_NOT_READY': [
        '1. 等待页面完全加载（约3-5秒）',
        '2. 刷新页面（F5）',
        '3. 关闭其他标签页释放内存',
        '4. 重新安装扩展程序'
      ],
      'DOM_API_UNAVAILABLE': [
        '1. 刷新页面（F5）',
        '2. 检查浏览器控制台是否有错误',
        '3. 尝试其他网站测试扩展',
        '4. 更新浏览器到最新版本'
      ],
      'CONTENT_TOO_SPARSE': [
        '1. 确认页面已完全加载',
        '2. 检查是否在登录页面或加载页面',
        '3. 尝试点击页面内容触发加载',
        '4. 尝试其他包含文本的页面'
      ],
      'CONTENT_INSUFFICIENT': [
        '1. 等待页面所有内容加载完成',
        '2. 向下滚动页面加载更多内容',
        '3. 检查网络连接是否稳定',
        '4. 尝试在内容丰富的页面上测试'
      ],
      'IFRAME_CONTENT_BLOCKED': [
        '1. 尝试在父页面上使用扩展',
        '2. 检查是否有内容安全策略限制',
        '3. 确认iframe是否可跨域访问',
        '4. 联系网站管理员了解访问政策'
      ],
      'DYNAMIC_CONTENT_NOT_LOADED': [
        '1. 等待动态内容完全加载（可能需要10-30秒）',
        '2. 与页面交互触发内容加载',
        '3. 检查网络请求是否完成',
        '4. 尝试在静态页面上测试扩展'
      ],
      'GENERAL_EXTRACTION_FAILURE': [
        '1. 刷新页面重试（F5）',
        '2. 检查扩展是否最新版本',
        '3. 清理浏览器缓存和Cookie',
        '4. 在隐身模式下测试'
      ]
    };
    
    return steps[errorType]?.join('\n') || '1. 刷新页面重试\n2. 尝试其他网站\n3. 检查扩展版本\n4. 联系技术支持';
  }

  // 从iframe提取内容
  extractFromIframes() {
    console.log('🖼️ 开始iframe内容提取...');
    const results = [];
    
    try {
      for (let i = 0; i < window.frames.length; i++) {
        try {
          const frame = window.frames[i];
          const frameDoc = frame.document;
          const frameTitle = frameDoc.title || `Frame ${i}`;
          const frameText = frameDoc.body?.textContent || '';
          
          if (frameText.trim().length > 50) {
            console.log(`✅ Frame ${i} 提取成功: ${frameText.length} 字符`);
            results.push({
              title: frameTitle,
              content: this.cleanText(frameText.substring(0, 5000)),
              source: `iframe_${i}`
            });
          }
        } catch (frameError) {
          console.warn(`⚠️ Frame ${i} 提取失败: ${frameError.message}`);
        }
      }
      
      if (results.length > 0) {
        const combinedContent = results.map(r => `【${r.title}】\n${r.content}`).join('\n\n');
        return {
          success: true,
          title: document.title,
          url: window.location.href,
          content: combinedContent,
          metaInfo: {
            title: document.title,
            description: '',
            author: '',
            publishDate: '',
            keywords: '',
            pageType: 'iframe_content',
            language: document.documentElement.lang || 'zh'
          },
          confidence: 70,
          timestamp: Date.now(),
          extractionMethod: 'iframe_extraction',
          wordCount: combinedContent.split(/\s+/).length,
          frameCount: results.length
        };
      } else {
        throw new Error('所有iframe内容都不可访问或为空');
      }
    } catch (error) {
      throw new Error(`iframe内容提取失败: ${error.message}`);
    }
  }

  // 应急内容提取方法 - 最后的后备方案
  emergencyExtract() {
    try {
      console.log('🆘 使用应急提取方法...');
      
      const title = document.title || '无标题';
      const url = window.location.href;
      
      // 最基础的方法：直接获取所有文本
      let content = '';
      
      if (document.body) {
        // 方法1: 尝试innerText
        try {
          content = document.body.innerText || '';
        } catch (e) {
          console.warn('innerText方法失败:', e);
        }
        
        // 方法2: 如果内容不够长，尝试textContent
        if (content.length < 100) {
          try {
            const textContent = document.body.textContent || '';
            if (textContent.length > content.length) {
              content = textContent;
            }
          } catch (e) {
            console.warn('textContent方法失败:', e);
          }
        }
        
        // 方法3: 使用最基础的选择器
        if (content.length < 50) {
          try {
            const commonSelectors = ['p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
            let allText = '';
            
            for (const selector of commonSelectors) {
              try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                  const text = el.textContent || el.innerText || '';
                  if (text && text.trim().length > 20) {
                    allText += text + '\n\n';
                  }
                });
              } catch (e) {
                console.warn(`选择器${selector}失败:`, e);
              }
            }
            
            if (allText.length > content.length) {
              content = allText;
            }
          } catch (e) {
            console.warn('选择器方法失败:', e);
          }
        }
      }
      
      // 清理内容
      content = this.cleanText(content);
      
      if (!content || content.length < 20) {
        throw new Error('无法提取任何有意义的内容');
      }
      
      // 限制长度
      if (content.length > 8000) {
        content = content.substring(0, 8000) + '...[内容过长，已截断]';
      }
      
      console.log('✅ 应急提取成功，内容长度:', content.length);
      
      return {
        success: true,
        title: title,
        url: url,
        content: content,
        metaInfo: {
          title: title,
          description: '',
          author: '',
          publishDate: '',
          keywords: '',
          pageType: 'emergency',
          language: document.documentElement.lang || 'zh'
        },
        confidence: 0.3, // 应急提取的置信度较低
        timestamp: Date.now(),
        extractionMethod: 'emergency',
        wordCount: content.split(/\s+/).length
      };
      
    } catch (error) {
      console.error('❌ 应急提取失败:', error);
      throw new Error(`应急提取失败: ${error.message}`);
    }
  }

  // 提取主要内容 - 增强版
  extractMainContent() {
    console.log('🔍 ========== 开始主要内容提取流程 ==========');
    
    // 详细的页面状态分析
    const pageAnalysis = {
      url: window.location.href,
      title: document.title,
      readyState: document.readyState,
      hasBody: !!document.body,
      hasQuerySelector: !!document.querySelector,
      bodyTextLength: (document.body?.textContent || '').length,
      bodyInnerTextLength: (document.body?.innerText || '').length,
      frameCount: window.frames.length,
      performanceTiming: performance.timing ? {
        loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
        domReadyTime: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart
      } : null,
      isDynamic: this.isDynamicPage()
    };
    
    console.log('📊 详细页面分析:', pageAnalysis);
    
    // 增强的基础检查
    if (!document.body) {
      const errorDetails = {
        type: 'DOM_STRUCTURE_ERROR',
        message: '页面body元素不存在',
        pageInfo: pageAnalysis,
        suggestion: '请确保页面已完全加载，或刷新页面后重试'
      };
      console.error('❌ DOM结构错误:', errorDetails);
      throw new Error(`页面主体不存在: ${errorDetails.message}`);
    }
    
    if (!document.querySelector) {
      const errorDetails = {
        type: 'DOM_API_ERROR',
        message: '页面不支持DOM查询',
        pageInfo: pageAnalysis
      };
      console.error('❌ DOM API错误:', errorDetails);
      throw new Error(`页面DOM查询不可用: ${errorDetails.message}`);
    }

    // 更严格的内容检查
    const bodyText = document.body.textContent || document.body.innerText || '';
    const bodyHtml = document.body.innerHTML || '';
    
    console.log('📄 页面内容分析:', {
      textContentLength: bodyText.length,
      innerTextLength: bodyText.length,
      htmlContentLength: bodyHtml.length,
      textContentPreview: bodyText.substring(0, 100) + '...',
      hasImages: document.querySelectorAll('img').length,
      hasLinks: document.querySelectorAll('a').length,
      hasParagraphs: document.querySelectorAll('p').length,
      hasHeadings: document.querySelectorAll('h1,h2,h3,h4,h5,h6').length
    });
    
    if (bodyText.trim().length < 20) {
      const errorType = this.determineErrorType(pageAnalysis, bodyText);
      const userMessage = this.getUserFriendlyErrorMessage(errorType, pageAnalysis);
      
      console.error('❌ 内容不足错误:', {
        errorType,
        textLength: bodyText.length,
        pageInfo: pageAnalysis,
        userMessage
      });
      
      throw new Error(userMessage);
    }
    
    // 检查iframe内容
    if (window.frames.length > 0) {
      console.log('🖼️ 检测到iframe，分析iframe内容...');
      return this.extractFromIframes();
    }
    
    // 继续标准提取流程
    console.log('✅ 基础检查通过，继续标准提取流程...');

    // 优先级列表，按可靠性排序
    const selectors = [
      // 标准内容区域
      'article',
      '[role="main"]',
      'main',
      
      // 掘金网站专有选择器
      '.post-content',
      '.article-content',
      '.markdown-body',
      '.post-article-content',
      '.juejin-post-content',
      '.post-detail-content',
      
      // CSDN网站选择器
      '.article-content',
      '.post-body',
      '.article-detail',
      '.article-text',
      '.csdn-article-content',
      
      // 博客园选择器
      '.post',
      '.post-body',
      '.postBody',
      '.postBodyContent',
      '.cnblogs-post-body',
      
      // 简书选择器
      '.article',
      '.article-content',
      '.articleDetail',
      '.article-content-content',
      
      // 知乎专栏选择器
      '.Post-RichTextContainer',
      '.PostIndex-first',
      '.RichContent-inner',
      '.ContentItem-richText',
      
      // 思否选择器
      '.article',
      '.question-article',
      '.post-content',
      '.article-body',
      
      // 常见的内容容器
      '.content',
      '.entry-content',
      '.post-body',
      '.story-body',
      
      // 新闻类网站
      '.story-body-text',
      '.article_text',
      '.article-body-text',
      '.article-section',
      
      // 技术文档
      '.documentation-content',
      '.technical-content',
      '.readme-content',
      
      // 通用内容区域
      '#content',
      '#main-content',
      '#article',
      '#post',
      '#story',
      
      // 博客和论坛
      '.entry',
      '.article',
      '.story',
      '.forum-post',
      '.comment-content',
      
      // 学术和论文
      '.abstract',
      '.paper-content',
      '.research-content',
      '.thesis-content',
      
      // 产品页面
      '.product-description',
      '.product-details',
      '.item-description'
    ];
    
    console.log(`🎯 准备测试 ${selectors.length} 个选择器...`);

    let bestElement = null;
    let bestScore = 0;
    let bestText = '';
    let testedSelectors = 0;
    let successfulSelectors = 0;

    console.log(`🔄 开始测试 ${selectors.length} 个选择器...`);

    // 尝试每个选择器
    for (const selector of selectors) {
      testedSelectors++;
      console.log(`🔍 测试选择器 ${testedSelectors}/${selectors.length}: "${selector}"`);
      
      try {
        // 确保document.querySelector存在
        if (typeof document.querySelectorAll !== 'function') {
          console.warn('querySelectorAll方法不存在');
          continue;
        }
        
        const elements = document.querySelectorAll(selector);
        console.log(`   找到 ${elements.length} 个元素`);
        
        if (elements.length === 0) {
          continue;
        }
        
        successfulSelectors++;
        let elementScore = 0;
        let bestElementScore = 0;
        
        for (let i = 0; i < elements.length; i++) {
          const element = elements[i];
          if (!element || !element.textContent) continue;
          
          try {
            const text = this.cleanText(element.textContent || element.innerText || '');
            if (text.length < 20) continue; // 太短的文本不计入
          
            const score = this.calculateContentScore(element, text);
            elementScore = Math.max(elementScore, score);
            
            console.log(`   元素 ${i+1}: 分数=${score}, 文本长度=${text.length}`);
            
            if (score > bestScore) {
              bestScore = score;
              bestElement = element;
              bestText = text;
              console.log(`   🏆 新的最佳元素: ${selector} 分数=${score}`);
            }
          } catch (elementError) {
            console.warn(`   处理元素失败:`, elementError);
          }
        }
        
        console.log(`   选择器 "${selector}" 最佳元素分数: ${elementScore}`);
        
      } catch (selectorError) {
        console.warn(`❌ 选择器 "${selector}" 失败:`, selectorError);
        continue;
      }
    }
    
    console.log(`📊 选择器测试完成: 测试 ${testedSelectors} 个，成功 ${successfulSelectors} 个`);

    // 如果没有找到合适的内容，尝试获取body的主要内容
    if (!bestElement || bestText.length < 100) {
      console.log('⚠️ 未找到合适内容，尝试body fallback方法...');
      console.log('📊 当前最佳内容状态:', {
        hasElement: !!bestElement,
        textLength: bestText.length,
        score: bestScore
      });
      
      try {
        // 方法1: 直接获取body文本
        console.log('🔍 尝试直接获取body文本...');
        const bodyText = this.cleanText(document.body.textContent || document.body.innerText || '');
        console.log(`📄 原始body文本长度: ${bodyText.length}`);
        
        // 方法2: 获取清理后的body文本
        console.log('🧹 尝试清理后的body文本...');
        const bodyClone = document.body.cloneNode(true);
        this.removeUnwantedElements(bodyClone);
        
        const cleanBodyText = this.cleanText(bodyClone.textContent || bodyClone.innerText || '');
        console.log(`✨ 清理后body文本长度: ${cleanBodyText.length}`);
        
        // 方法3: 使用备用方法
        console.log('🆘 尝试备用文本获取方法...');
        const backupText = this.getPageText();
        console.log(`🔄 备用方法文本长度: ${backupText.length}`);
        
        // 选择最佳文本
        let selectedText = '';
        let methodUsed = '';
        
        if (cleanBodyText.length > bodyText.length * 0.8 && cleanBodyText.length > backupText.length * 0.7) {
          selectedText = cleanBodyText;
          methodUsed = '清理后的body文本';
        } else if (bodyText.length > backupText.length) {
          selectedText = bodyText;
          methodUsed = '原始body文本';
        } else {
          selectedText = backupText;
          methodUsed = '备用方法文本';
        }
        
        console.log(`✅ 选择使用: ${methodUsed}, 长度: ${selectedText.length}`);
        bestText = selectedText;
        
      } catch (bodyError) {
        console.error('❌ Body提取错误:', bodyError);
        throw new Error(`body内容提取失败: ${bodyError.message}`);
      }
    }

    // 最终验证
    if (!bestText || bestText.trim().length < 50) {
      throw new Error('提取的内容过短，无法进行有效总结');
    }

    // 限制文本长度
    if (bestText.length > 10000) {
      bestText = bestText.substring(0, 10000) + '...[内容过长，已截断]';
      console.log('Content truncated to 10000 characters');
    }

    console.log(`Main content extraction completed. Final text length: ${bestText.length}`);
    return bestText;
  }

  // 计算内容得分
  calculateContentScore(element, text) {
    if (!text || text.length < 50) return 0;

    let score = 0;
    
    // 基础长度得分
    score += Math.min(text.length / 10, 1000);
    
    // 段落结构得分
    const paragraphs = text.split('\n').filter(p => p.trim().length > 20);
    score += paragraphs.length * 10;
    
    // 标点符号密度得分
    const punctuationDensity = (text.match(/[。！？.!?]/g) || []).length / text.length;
    score += punctuationDensity * 100;
    
    // 位置得分（主要内容通常在页面中部偏下）
    const rect = element.getBoundingClientRect();
    const pageHeight = document.documentElement.scrollHeight;
    const position = (rect.top + rect.height / 2) / pageHeight;
    if (position > 0.3 && position < 0.8) {
      score += 100;
    }
    
    // 特殊标记得分
    const tagName = element.tagName.toLowerCase();
    if (['article', 'main', 'section'].includes(tagName)) {
      score += 200;
    }
    
    // 排除常见的不相关元素
    const excludeClasses = ['nav', 'menu', 'header', 'footer', 'sidebar', 'ad', 'advertisement', 'comment', 'social'];
    const elementClasses = (element.className || '').toLowerCase();
    const excludeId = ['nav', 'menu', 'header', 'footer', 'sidebar', 'ad', 'advertisement', 'comment', 'social'];
    const elementId = (element.id || '').toLowerCase();
    
    if (excludeClasses.some(cls => elementClasses.includes(cls)) ||
        excludeId.some(id => elementId.includes(id))) {
      score -= 500;
    }

    return score;
  }

  // 移除不需要的元素
  removeUnwantedElements(element) {
    try {
      if (!element) {
        console.warn('removeUnwantedElements: element is null or undefined');
        return;
      }

      const unwantedSelectors = [
        // 脚本和样式相关
        'script', 'style', 'noscript',
        '[type="text/javascript"]', '[type="application/javascript"]',
        '[type="text/css"]', '[rel="stylesheet"]',
        
        // 导航相关
        'nav', 'header', 'footer', '.nav', '.header', '.footer',
        'nav[role="navigation"]', 'nav[aria-label]',
        
        // 广告
        '.ad', '.ads', '.advertisement', '.adsbygoogle',
        '[id*="ad"]', '[class*="ad"]', '[id*="advertisement"]',
        
        // 社交分享
        '.share', '.social-share', '.social-media',
        '[class*="share"]', '[class*="social"]',
        
        // 侧边栏
        'aside', '.sidebar', '.side-bar', '.aside',
        
        // 评论系统
        '.comment', '.comments', '.comment-section',
        '.reply', '.replies',
        
        // 搜索框和表单
        'form', '.search', '.search-box', '.search-form',
        'input[type="search"]', 'input[type="text"]',
        
        // 版权信息
        '.copyright', '.credit', '.disclaimer',
        
        // 掘金特殊元素
        '.author-card', '.recommended-content', '.related-articles',
        '.sidebar', '.right-side', '.juejin-sidebar',
        
        // CSDN特殊元素
        '.csdn-share', '.csdn-dashang', '.article-read',
        '.csdn-toolbar', '.csdn-header',
        
        // 其他
        '.menu', '.breadcrumb', '.pagination',
        '.tag', '.category', '.related-posts',
        '.author-bio', '.author-info', '.author-card'
      ];

      let removedCount = 0;
      
      unwantedSelectors.forEach(selector => {
        try {
          const elements = element.querySelectorAll(selector);
          elements.forEach(el => {
            try {
              el.remove();
              removedCount++;
            } catch (elementError) {
              console.warn('Error removing element:', elementError);
            }
          });
        } catch (selectorError) {
          console.warn(`Error with unwanted selector "${selector}":`, selectorError);
        }
      });

      // 移除隐藏元素
      try {
        const hiddenElements = element.querySelectorAll('*');
        hiddenElements.forEach(el => {
          try {
            if (el && el.parentNode) {
              const style = window.getComputedStyle(el);
              if (style && (style.display === 'none' || style.visibility === 'hidden' || 
                  el.offsetWidth === 0 || el.offsetHeight === 0)) {
                el.remove();
                removedCount++;
              }
            }
          } catch (elementError) {
            console.warn('Error checking hidden element:', elementError);
          }
        });
      } catch (hiddenError) {
        console.warn('Error removing hidden elements:', hiddenError);
      }

      // 移除空元素
      try {
        const allElements = element.querySelectorAll('*');
        allElements.forEach(el => {
          try {
            if (el && el.parentNode && !el.textContent?.trim() && 
                !el.querySelector('img') && !el.querySelector('video') && !el.querySelector('iframe')) {
              el.remove();
              removedCount++;
            }
          } catch (elementError) {
            console.warn('Error removing empty element:', elementError);
          }
        });
      } catch (emptyError) {
        console.warn('Error removing empty elements:', emptyError);
      }

      console.log(`Removed ${removedCount} unwanted elements`);
    } catch (error) {
      console.error('Error in removeUnwantedElements:', error);
      // 不抛出错误，继续处理
    }
  }

  // 清理文本
  cleanText(text) {
    try {
      if (!text || typeof text !== 'string') {
        console.warn('cleanText: invalid text input:', typeof text);
        return '';
      }

      let cleaned = text;
      
      try {
        cleaned = cleaned
          // 移除多余的空白字符
          .replace(/\s+/g, ' ')
          // 移除特殊的Unicode字符
          .replace(/[\u200B-\u200D\uFEFF]/g, '')
          // 规范化标点符号
          .replace(/[。]{2,}/g, '...')
          .replace(/[！]{2,}/g, '!')
          .replace(/[？]{2,}/g, '?')
          // 移除过长的重复字符
          .replace(/(.)\1{10,}/g, '$1$1$1')
          // 移除script标签和内容
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          // 移除noscript标签
          .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
          // 移除HTML注释
          .replace(/<!--[\s\S]*?-->/g, '')
          // 移除常见的JavaScript关键词模式
          .replace(/\b(function|var|let|const|if|else|for|while|document\.|\.querySelector|\.getElementById|\.addEventListener)\b.*$/gm, '[代码片段]')
          // 移除潜在的代码行（包含大量特殊字符的短行）
          .split('\n').filter(line => {
            const specialCharCount = (line.match(/[;{}(),=\[\].!@#$%^&*+<>?/\\|]|\$|function|var|let|const/gi) || []).length;
            return specialCharCount < line.length * 0.3 || line.trim().length < 5;
          }).join('\n')
          // 移除可能的代码片段和特殊字符
          .replace(/```[\s\S]*?```/g, '[代码块]')
          .replace(/`[^`]*`/g, '[代码]')
          // 清理
          .trim();
      } catch (replaceError) {
        console.warn('Error during text cleaning:', replaceError);
        // 基础清理
        cleaned = text.replace(/\s+/g, ' ').trim();
      }
      
      return cleaned;
    } catch (error) {
      console.error('Error in cleanText:', error);
      return text || '';
    }
  }

  // 提取元信息
  extractMetaInfo() {
    const meta = {};
    
    // 标题
    meta.title = document.title;
    
    // 描述
    const descriptionMeta = document.querySelector('meta[name="description"]');
    meta.description = descriptionMeta ? descriptionMeta.content : '';
    
    // 作者
    const authorMeta = document.querySelector('meta[name="author"]');
    meta.author = authorMeta ? authorMeta.content : '';
    
    // 关键词
    const keywordsMeta = document.querySelector('meta[name="keywords"]');
    meta.keywords = keywordsMeta ? keywordsMeta.content : '';
    
    // 发布日期
    const dateSelectors = [
      'meta[property="article:published_time"]',
      'meta[name="pubdate"]',
      'meta[name="date"]',
      '.date', '.published', '.post-date', '.article-date'
    ];
    
    let publishDate = '';
    for (const selector of dateSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        publishDate = element.content || element.textContent || '';
        break;
      }
    }
    meta.publishDate = publishDate;
    
    // 页面类型
    meta.pageType = this.detectPageType();
    
    // 语言
    meta.language = document.documentElement.lang || document.querySelector('html')?.getAttribute('lang') || '';
    
    return meta;
  }

  // 检测页面类型
  detectPageType() {
    const bodyClasses = document.body.className.toLowerCase();
    const bodyId = document.body.id.toLowerCase();
    const title = document.title.toLowerCase();
    const url = window.location.href.toLowerCase();
    
    const types = {
      'news': ['news', 'article', 'post', 'blog'],
      'documentation': ['doc', 'documentation', 'api', 'guide', 'tutorial'],
      'academic': ['research', 'paper', 'study', 'academic'],
      'product': ['product', 'shop', 'store', 'buy'],
      'forum': ['forum', 'discussion', 'thread'],
      'social': ['social', 'profile', 'timeline']
    };
    
    for (const [type, keywords] of Object.entries(types)) {
      if (keywords.some(keyword => 
        bodyClasses.includes(keyword) || 
        bodyId.includes(keyword) || 
        title.includes(keyword) || 
        url.includes(keyword)
      )) {
        return type;
      }
    }
    
    return 'general';
  }

  // 计算置信度
  calculateConfidence(content, metaInfo) {
    let confidence = 0;
    
    // 内容长度置信度
    if (content.length > 1000) confidence += 30;
    else if (content.length > 500) confidence += 20;
    else if (content.length > 100) confidence += 10;
    
    // 段落结构置信度
    const paragraphs = content.split('\n').filter(p => p.trim().length > 20);
    if (paragraphs.length > 10) confidence += 25;
    else if (paragraphs.length > 5) confidence += 15;
    else if (paragraphs.length > 2) confidence += 10;
    
    // 元信息置信度
    if (metaInfo.description) confidence += 15;
    if (metaInfo.author) confidence += 10;
    if (metaInfo.publishDate) confidence += 10;
    if (metaInfo.keywords) confidence += 5;
    
    // 页面类型置信度
    if (['news', 'documentation', 'academic'].includes(metaInfo.pageType)) {
      confidence += 15;
    }
    
    // 语言检测置信度
    if (metaInfo.language) confidence += 5;
    
    return Math.min(confidence, 100);
  }

  // ==================== 选择模式功能 ====================
  
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
      this.selectionStartTime = Date.now();
      
      // 清理之前的状态
      await this.cleanupPreviousState();
      
      // 设置全局事件监听器
      this.setupGlobalEventListeners();
      
      // 显示选择UI（在页面上显示悬浮弹窗和工具栏）
      this.showSelectionOverlay();
      this.showSelectionToolbar();
      
      // 监听页面变化（用于动态页面）
      this.setupPageChangeListeners();
      
      // 通知background script选择模式已启动（确保popup关闭后仍能通信）
      chrome.runtime.sendMessage({
        source: 'content-script',
        action: 'selectionModeStarted',
        data: {
          maxSelections: this.maxSelections,
          timestamp: Date.now(),
          pageUrl: window.location.href
        }
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
      
      // 清除悬停相关状态
      if (this.hoverTimeout) {
        clearTimeout(this.hoverTimeout);
        this.hoverTimeout = null;
      }
      if (this.lastHoveredElement) {
        this.removeHighlight(this.lastHoveredElement, 'temp');
        this.lastHoveredElement = null;
      }
      
      // 清除所有临时高亮
      const tempHighlights = document.querySelectorAll('.extension-temp-highlight');
      tempHighlights.forEach(el => {
        el.classList.remove('extension-temp-highlight');
      });
      
      // 保存选择历史
      this.saveSelectionHistory(finalState);
      
      // 清除选择状态
      this.selectedElements = [];
      
      // 清除选择高亮
      this.clearSelectionHighlights();
      
      // 隐藏选择UI
      this.hideSelectionOverlay();
      this.hideSelectionToolbar();
      
      // 通知popup模式已停止，并传递已选择的元素
      this.notifyPopup('selectionStopped', {
        elements: finalState.elements,
        finalSelectionCount: finalState.elementCount,
        duration: finalState.duration,
        timestamp: Date.now()
      });
      
      // 保存选择状态到background script
      if (finalState.elements && finalState.elements.length > 0) {
        // 获取当前标签页ID
        chrome.runtime.sendMessage({ action: 'getCurrentTab' }, (response) => {
          const tabId = response?.tabId || null;
          chrome.runtime.sendMessage({
            source: 'content-script',
            action: 'saveSelectionState',
            selectionState: {
              isSelectionMode: false,
              selectedElements: finalState.elements.map(el => ({
                id: el.id,
                text: el.text || el.textContent || '',
                tagName: el.tagName || '',
                selector: el.selector || ''
              })),
              tabId: tabId,
              timestamp: Date.now()
            }
          }).catch(error => {
            console.warn('保存选择状态失败:', error);
          });
        });
      }
      
      console.log('✅ 选择模式已停止，最终选择数量:', finalState.elementCount);
      this.logSelectionEvent('mode_stopped', finalState);
      
    } catch (error) {
      console.error('❌ 停止选择模式失败:', error);
      this.handleSelectionError('停止选择模式失败', error);
      
      // 即使出错也要强制清理状态
      await this.forceCleanupSelectionState();
    }
  }
  
  // 处理选择点击事件
  handleSelectionClick = (event) => {
    if (!this.isSelectionMode) return;
    
    console.log('选择点击事件:', event.target);
    
    // 首先检查是否点击了扩展创建的元素（工具栏、提示框等）
    const clickedElement = event.target;
    
    // 检查是否点击了扩展工具栏
    const extensionToolbar = document.getElementById('extension-selection-toolbar');
    if (extensionToolbar && extensionToolbar.contains(clickedElement)) {
      console.log('点击了扩展工具栏，忽略');
      return;
    }
    
    // 检查是否点击了扩展提示框
    const extensionTooltip = document.querySelector('.extension-tooltip');
    if (extensionTooltip && extensionTooltip.contains(clickedElement)) {
      console.log('点击了扩展提示框，忽略');
      return;
    }
    
    // 检查是否点击了扩展覆盖层本身（虽然设置了pointer-events: none，但以防万一）
    if (clickedElement.id === 'extension-selection-overlay') {
      console.log('点击了扩展覆盖层，忽略');
      return;
    }
    
    // 阻止默认行为和事件冒泡
    event.preventDefault();
    event.stopPropagation();
    
    // 向上查找有效的父元素（避免点击到文本节点等问题）
    let element = clickedElement;
    
    // 如果点击的是文本节点，向上查找元素节点
    if (element.nodeType === Node.TEXT_NODE) {
      element = element.parentElement;
    }
    
    // 向上查找，直到找到不是扩展元素的父元素
    while (element && element !== document.body) {
      // 检查是否是扩展元素
      if (element.id === 'extension-selection-toolbar' || 
          element.id === 'extension-selection-overlay' ||
          element.classList.contains('extension-tooltip')) {
        console.log('元素在扩展容器内，忽略');
        return;
      }
      
      // 检查是否是基本忽略的标签
      const tagName = element.tagName?.toLowerCase();
      if (tagName && ['script', 'style', 'link', 'meta', 'title'].includes(tagName)) {
        element = element.parentElement;
        continue;
      }
      
      // 如果找到了有效的元素，跳出循环
      if (element.tagName && element.tagName !== 'BODY') {
        break;
      }
      
      element = element.parentElement;
    }
    
    if (!element || element === document.body || !element.tagName) {
      console.log('未找到有效元素');
      return;
    }
    
    // 再次检查是否是扩展元素
    if (this.shouldIgnoreElement(element)) {
      console.log('元素被忽略:', element);
      return;
    }
    
    // 获取元素ID
    const elementId = this.getElementId(element);
    console.log('元素ID:', elementId);
    
    // 检查是否已经选择
    const existingIndex = this.selectedElements.findIndex(el => el.id === elementId);
    
    if (existingIndex !== -1) {
      // 如果已选择，则取消选择
      console.log('取消选择元素:', elementId);
      this.removeSelectionByIndex(existingIndex);
      this.updateSelectionStatus('已取消选择', 'info');
    } else {
      // 如果未选择，则添加选择
      if (this.selectedElements.length >= this.maxSelections) {
        console.log('达到最大选择数量限制');
        this.updateSelectionStatus(`最多只能选择 ${this.maxSelections} 个元素`, 'error');
        return;
      }
      
      console.log('添加新选择:', elementId);
      this.addSelection(element);
      this.updateSelectionStatus(`已选择 ${this.selectedElements.length} 个元素`, 'success');
    }
  }
  
  // 处理右键菜单事件
  handleContextMenu = (event) => {
    if (!this.isSelectionMode) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const element = event.target;
    
    // 检查是否已经选择
    const existingIndex = this.selectedElements.findIndex(el => el.id === this.getElementId(element));
    
    if (existingIndex !== -1) {
      // 如果已选择，则取消选择
      this.removeSelectionByIndex(existingIndex);
      this.updateSelectionStatus('右键取消选择', 'info');
    }
  }
  
  // 处理鼠标悬停
  handleMouseOver = (event) => {
    if (!this.isSelectionMode) return;
    
    const element = event.target;
    
    if (this.shouldIgnoreElement(element)) {
      return;
    }
    
    // 清除之前的悬停定时器
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
    
    // 清除之前的高亮（如果有）
    if (this.lastHoveredElement && this.lastHoveredElement !== element) {
      this.removeHighlight(this.lastHoveredElement, 'temp');
    }
    
    // 保存当前悬停的元素
    this.lastHoveredElement = element;
    
    // 延迟高亮，避免快速移动时的闪烁
    this.hoverTimeout = setTimeout(() => {
      if (this.isSelectionMode && element === this.lastHoveredElement) {
        // 临时高亮元素
        this.highlightElement(element, 'temp');
      }
    }, 50);
  }
  
  // 处理鼠标离开
  handleMouseOut = (event) => {
    if (!this.isSelectionMode) return;
    
    const element = event.target;
    
    // 清除悬停定时器
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
    
    // 移除临时高亮（检查元素及其所有子元素）
    if (element) {
      this.removeHighlight(element, 'temp');
      
      // 同时移除所有子元素的临时高亮
      const tempHighlights = element.querySelectorAll('.extension-temp-highlight');
      tempHighlights.forEach(el => {
        el.classList.remove('extension-temp-highlight');
      });
    }
    
    // 如果这是最后悬停的元素，清除引用
    if (element === this.lastHoveredElement) {
      this.lastHoveredElement = null;
    }
  }
  
  // 检查是否应该忽略元素（只检查扩展创建的元素）
  shouldIgnoreElement(element) {
    if (!element || !element.tagName) {
      return true;
    }
    
    // 基本忽略选择器（与扩展无关）
    const basicIgnoreSelectors = [
      'script', 'style', 'link', 'meta', 'title'
    ];
    
    const tagName = element.tagName?.toLowerCase();
    
    // 先检查基本标签名
    if (basicIgnoreSelectors.includes(tagName)) {
      return true;
    }
    
    // 只检查是否在扩展创建的特定容器内（精确匹配）
    const extensionToolbar = document.getElementById('extension-selection-toolbar');
    if (extensionToolbar && extensionToolbar.contains(element)) {
      return true;
    }
    
    const extensionTooltip = document.querySelector('.extension-tooltip');
    if (extensionTooltip && extensionTooltip.contains(element)) {
      return true;
    }
    
    // 检查元素ID是否以extension-开头（精确匹配）
    if (element.id && element.id.startsWith('extension-')) {
      return true;
    }
    
    // 其他情况都不忽略，允许选择
    return false;
  }
  
  // 获取元素ID
  getElementId(element) {
    if (!element) return null;
    
    // 使用选择器记录器生成唯一ID
    if (this.selectorRecorder) {
      return this.selectorRecorder.generateElementIdentifier(element);
    }
    
    // 备用方案：使用元素特征生成ID
    const tagName = element.tagName?.toLowerCase() || 'unknown';
    const id = element.id ? `_${element.id}` : '';
    const className = element.className ? `_${element.className.replace(/\s+/g, '_')}` : '';
    
    return `${tagName}${id}${className}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // 提取元素数据
  extractElementData(element) {
    if (!element) return null;
    
    const elementId = this.getElementId(element);
    
    return {
      id: elementId,
      text: element.textContent?.trim() || element.innerText?.trim() || '',
      tagName: element.tagName?.toLowerCase(),
      className: element.className || '',
      selector: this.generateElementSelector(element),
      timestamp: Date.now(),
      elementInfo: this.extractElementInfo(element)
    };
  }
  
  // 生成元素选择器
  generateElementSelector(element) {
    if (!element) return '';
    
    // 使用选择器记录器
    if (this.selectorRecorder) {
      return this.selectorRecorder.generateCSSSelector(element);
    }
    
    // 备用方案
    if (element.id) {
      return `#${element.id}`;
    }
    
    const tagName = element.tagName?.toLowerCase();
    const className = element.className ? `.${element.className.split(' ')[0]}` : '';
    
    return `${tagName}${className}`;
  }
  
  // 提取元素信息
  extractElementInfo(element) {
    if (!element) return {};
    
    return {
      tagName: element.tagName?.toLowerCase(),
      id: element.id || null,
      className: element.className || '',
      textContent: element.textContent?.trim() || '',
      innerText: element.innerText?.trim() || '',
      innerHTML: element.innerHTML?.substring(0, 200) || '',
      attributes: this.getElementAttributes(element)
    };
  }
  
  // 获取元素属性
  getElementAttributes(element) {
    const attrs = {};
    if (element.attributes) {
      Array.from(element.attributes).forEach(attr => {
        attrs[attr.name] = attr.value;
      });
    }
    return attrs;
  }
  
  // 获取元素属性
  getElementAttributes(element) {
    const attrs = {};
    if (element.attributes) {
      Array.from(element.attributes).forEach(attr => {
        attrs[attr.name] = attr.value;
      });
    }
    return attrs;
  }
  
  // 添加选择
  addSelection(element) {
    if (!element) return;
    
    console.log('开始添加选择:', element);
    
    try {
      const elementData = this.extractElementData(element);
      
      // 检查是否已经选择
      const existingIndex = this.selectedElements.findIndex(el => el.id === elementData.id);
      if (existingIndex !== -1) {
        console.log('元素已存在，取消选择:', elementData.id);
        this.removeSelectionByIndex(existingIndex);
        return;
      }
      
      // 高亮元素
      this.highlightElement(element, 'selected');
      
      // 添加到已选择列表
      this.selectedElements.push(elementData);
      
      // 更新UI显示
      this.updateSelectionCount();
      
      // 通知popup
      this.notifyPopup('elementSelected', {
        element: elementData
      });
      
      console.log('元素已成功选择:', elementData);
      
    } catch (error) {
      console.error('添加选择失败:', error);
      this.showUserMessage('选择元素失败，请重试', 'error');
    }
  }
  
  // 移除选择
  removeSelection(index) {
    if (index >= 0 && index < this.selectedElements.length) {
      const elementData = this.selectedElements[index];
      this.removeSelectionByIndex(index);
      
      // 通知popup
      this.notifyPopup('elementRemoved', elementData);
      
      // 更新状态
      this.updateSelectionStatus(`已移除选择，剩余 ${this.selectedElements.length} 个`, 'info');
    }
  }
  
  // 通过索引移除选择
  removeSelectionByIndex(index) {
    if (index >= 0 && index < this.selectedElements.length) {
      const elementData = this.selectedElements[index];
      
      // 移除高亮
      this.removeHighlightByData(elementData);
      
      // 从数组中移除
      this.selectedElements.splice(index, 1);
      
      // 更新UI显示
      this.updateSelectionCount();
      
      // 通知popup
      this.notifyPopup('elementRemoved', elementData);
      
      console.log('元素已移除:', elementData);
    }
  }
  
  // 清除所有选择
  async clearAllSelections() {
    this.selectedElements = [];
    this.clearSelectionHighlights();
    
    // 通知popup
    this.notifyPopup('selectionCleared', {});
    
    console.log('所有选择已清除');
  }
  
  // 获取元素文本内容
  getElementText(element) {
    // 优先获取有意义的文本
    const textContent = element.textContent?.trim();
    if (textContent && textContent.length > 0) {
      return textContent;
    }
    
    // 获取alt属性
    const alt = element.getAttribute('alt');
    if (alt) {
      return alt;
    }
    
    // 获取title属性
    const title = element.getAttribute('title');
    if (title) {
      return title;
    }
    
    // 获取placeholder属性
    const placeholder = element.getAttribute('placeholder');
    if (placeholder) {
      return placeholder;
    }
    
    return element.tagName?.toLowerCase() || '未知元素';
  }
  
  // 获取元素HTML
  getElementHTML(element) {
    return element.outerHTML?.substring(0, 500) || ''; // 限制长度
  }
  
  // 获取元素属性
  getElementAttributes(element) {
    const attributes = {};
    for (const attr of element.attributes) {
      if (attr.name.startsWith('data-') || 
          ['class', 'id', 'src', 'href', 'alt', 'title'].includes(attr.name)) {
        attributes[attr.name] = attr.value;
      }
    }
    return attributes;
  }
  
  // 高亮元素
  highlightElement(element, type = 'selected') {
    const className = type === 'selected' ? 'extension-selected' : 'extension-temp-highlight';
    
    // 创建高亮样式（如果不存在）
    this.ensureHighlightStyles();
    
    // 应用高亮
    element.classList.add(className);
    
    // 保存高亮信息
    if (type === 'selected') {
      const id = this.getElementId(element);
      this.selectionHighlights.push({ id, element, className });
    }
  }
  
  // 移除高亮
  removeHighlight(element, type = 'selected') {
    const className = type === 'selected' ? 'extension-selected' : 'extension-temp-highlight';
    element.classList.remove(className);
  }
  
  // 通过数据移除高亮
  removeHighlightByData(elementData) {
    const highlight = this.selectionHighlights.find(h => h.id === elementData.id);
    if (highlight) {
      this.removeHighlight(highlight.element, 'selected');
      this.selectionHighlights = this.selectionHighlights.filter(h => h.id !== elementData.id);
    }
  }
  
  // 清除所有选择高亮
  clearSelectionHighlights() {
    this.selectionHighlights.forEach(highlight => {
      highlight.element.classList.remove('extension-selected');
    });
    this.selectionHighlights = [];
  }
  
  // 确保高亮样式存在
  ensureHighlightStyles() {
    if (document.getElementById('extension-selection-styles')) {
      return;
    }
    
    const style = document.createElement('style');
    style.id = 'extension-selection-styles';
    style.textContent = `
      .extension-selected {
        background-color: rgba(33, 150, 243, 0.2) !important;
        border: 2px solid #2196f3 !important;
        outline: 2px solid #2196f3 !important;
        position: relative !important;
        z-index: 9999 !important;
      }
      
      .extension-temp-highlight {
        background-color: rgba(255, 193, 7, 0.3) !important;
        border: 1px solid #ffc107 !important;
        outline: 1px solid #ffc107 !important;
      }
      
      .extension-selection-overlay {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background: rgba(0, 0, 0, 0.1) !important;
        z-index: 9998 !important;
        pointer-events: none !important;
      }
    `;
    
    document.head.appendChild(style);
  }
  
  // 显示选择覆盖层
  showSelectionOverlay() {
    // 检查是否已存在 - 使用更严格的检查
    if (document.getElementById('extension-selection-overlay')) {
      console.log('选择覆盖层已存在，跳过创建');
      return;
    }
    
    // 创建覆盖层（设置为不阻止点击事件）
    const overlay = document.createElement('div');
    overlay.className = 'extension-selection-overlay';
    overlay.id = 'extension-selection-overlay';
    // 不设置data-extension-selection属性，避免误判
    
    // 不再显示选择模式提示弹窗（已移除）
    
    document.body.appendChild(overlay);
  }
  
  // 隐藏选择覆盖层
  hideSelectionOverlay() {
    const overlay = document.getElementById('extension-selection-overlay');
    const tooltip = document.querySelector('div[style*="position: fixed"][style*="top: 50%"]');
    
    if (overlay) {
      overlay.remove();
    }
    
    if (tooltip) {
      tooltip.remove();
    }
  }
  
  // 提取已选择的内容
  async extractSelectedContent(selectedElements) {
    console.log('🔍 开始提取选择内容，元素数量:', selectedElements.length);
    
    if (!selectedElements || selectedElements.length === 0) {
      console.warn('没有选择任何元素');
      return '';
    }
    
    let combinedContent = '';
    let extractedCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < selectedElements.length; i++) {
      const elementData = selectedElements[i];
      try {
        console.log(`处理元素 ${i+1}/${selectedElements.length}:`, elementData.tagName, elementData.id);
        
        // 尝试通过ID找到元素
        let element = null;
        if (elementData.id && !elementData.id.startsWith('temp-')) {
          element = document.getElementById(elementData.id);
        }
        
        if (!element) {
          // 如果找不到元素，尝试使用其他方法查找
          element = this.findElementByData(elementData);
        }
        
        let content = '';
        
        if (element) {
          // 提取元素内容
          content = this.extractDeepContent(element);
          console.log(`从DOM元素提取内容，长度: ${content.length}`);
        } else {
          // 如果找不到元素，使用存储的数据
          content = elementData.text || elementData.alt || '';
          console.log(`从存储数据提取内容，长度: ${content.length}`);
        }
        
        if (content.trim()) {
          // 格式化内容
          const formattedContent = this.formatExtractedContent(content, elementData);
          combinedContent += formattedContent;
          extractedCount++;
        } else {
          console.warn(`元素 ${i+1} 没有提取到有效内容`);
          failedCount++;
        }
        
      } catch (error) {
        console.error(`提取元素 ${i+1} 内容失败:`, error);
        failedCount++;
        
        // 使用备用文本
        if (elementData.text) {
          combinedContent += `\n\n【备用内容】${elementData.text}\n`;
        }
      }
    }
    
    // 后处理
    combinedContent = this.postProcessContent(combinedContent);
    
    console.log(`✅ 选择内容提取完成，成功: ${extractedCount}, 失败: ${failedCount}, 总长度: ${combinedContent.length}`);
    
    return combinedContent.trim();
  }
  
  // 通过元素数据查找元素
  findElementByData(elementData) {
    try {
      // 尝试通过多种方式查找元素
      const selectors = [
        `.${elementData.className}`,
        `[data-element-id="${elementData.id}"]`,
        elementData.tagName.toLowerCase()
      ];
      
      for (const selector of selectors) {
        if (selector && selector !== '.' && selector !== 'undefined') {
          try {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
              // 通过文本内容进一步匹配
              if (el.textContent && el.textContent.includes(elementData.text?.substring(0, 50))) {
                return el;
              }
            }
          } catch (e) {
            // 忽略选择器错误
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('查找元素失败:', error);
      return null;
    }
  }
  
  // 格式化提取的内容
  formatExtractedContent(content, elementData) {
    if (!content || !content.trim()) {
      return '';
    }
    
    let formatted = content.trim();
    
    // 根据元素类型添加适当的标记
    switch (elementData.tagName?.toLowerCase()) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        formatted = `【${elementData.tagName.toUpperCase()}】${formatted}`;
        break;
      case 'p':
        formatted = `【段落】${formatted}`;
        break;
      case 'ul':
      case 'ol':
        formatted = `【列表】${formatted}`;
        break;
      case 'img':
        formatted = `【图片】${formatted}`;
        break;
      case 'a':
        formatted = `【链接】${formatted}`;
        break;
      case 'blockquote':
        formatted = `【引用】${formatted}`;
        break;
      case 'code':
      case 'pre':
        formatted = `【代码】${formatted}`;
        break;
      default:
        formatted = `【${elementData.tagName || '内容'}】${formatted}`;
    }
    
    return `\n\n${formatted}\n`;
  }
  
  // 后处理内容
  postProcessContent(content) {
    if (!content) return '';
    
    let processed = content;
    
    // 合并连续的空行
    processed = processed.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    // 移除重复的标记
    const tagPattern = /【(段落|内容|DIV|SPAN)】/g;
    processed = processed.replace(tagPattern, '');
    
    // 移除开头和结尾的空行
    processed = processed.replace(/^\s*\n/, '').replace(/\n\s*$/, '');
    
    // 限制总长度
    if (processed.length > 8000) {
      processed = processed.substring(0, 8000) + '\n\n[内容过长，已截断]';
    }
    
    return processed;
  }
  
  // 深度提取元素内容
  extractDeepContent(element) {
    // 优先提取有意义的文本内容
    const textContent = element.textContent?.trim();
    if (textContent && textContent.length > 0) {
      return textContent;
    }
    
    // 提取图片alt文本
    if (element.tagName?.toLowerCase() === 'img') {
      return element.getAttribute('alt') || element.getAttribute('title') || '';
    }
    
    // 提取链接文本
    if (element.tagName?.toLowerCase() === 'a') {
      return element.textContent?.trim() || element.getAttribute('title') || element.getAttribute('href') || '';
    }
    
    // 提取表单元素值
    if (['input', 'textarea', 'select'].includes(element.tagName?.toLowerCase())) {
      return element.value || element.getAttribute('placeholder') || element.getAttribute('title') || '';
    }
    
    return element.textContent?.trim() || '';
  }
  
  // ==================== 选择工具栏功能 ====================
  
  // 显示选择工具栏
  showSelectionToolbar() {
    // 移除已存在的工具栏
    this.hideSelectionToolbar();
    
    // 创建工具栏容器
    const toolbar = document.createElement('div');
    toolbar.id = 'extension-selection-toolbar';
    toolbar.className = 'extension-toolbar';
    toolbar.setAttribute('data-extension-selection', 'false');
    toolbar.style.cssText = `
      position: fixed !important;
      top: 20px !important;
      left: 20px !important;
      background: #ffffff !important;
      border: 2px solid #2196f3 !important;
      border-radius: 12px !important;
      padding: 16px !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2) !important;
      z-index: 10000 !important;
      min-width: 320px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 14px !important;
      color: #333 !important;
      pointer-events: auto !important;
      user-select: none !important;
    `;
    
    // 工具栏内容
    toolbar.innerHTML = `
      <div style="font-weight: bold; color: #2196f3; margin-bottom: 12px; display: flex; align-items: center;">
        <span style="margin-right: 8px;">🎯</span>
        元素选择模式
      </div>
      
      <div id="selection-status" style="margin-bottom: 12px; padding: 8px; background: #f5f5f5; border-radius: 6px; font-size: 12px;" data-extension-selection="false">
        <span style="color: #666;">状态：</span>
        <span id="status-text" style="color: #2196f3; font-weight: bold;">准备选择元素</span>
      </div>
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;" data-extension-selection="false">
        <div>
          <span style="color: #666;">已选择：</span>
          <span id="selection-count" style="color: #2196f3; font-weight: bold;">0</span>
          <span style="color: #999;">/</span>
          <span id="max-selections" style="color: #999;">10</span>
        </div>
        
        <div style="background: #e3f2fd; padding: 4px 8px; border-radius: 4px;">
          <span style="color: #1976d2; font-size: 11px;">最多选择10个元素</span>
        </div>
      </div>
      
      <div id="selection-progress" style="margin-bottom: 12px;" data-extension-selection="false">
        <div style="background: #e0e0e0; height: 6px; border-radius: 3px; overflow: hidden;">
          <div id="progress-bar" style="background: linear-gradient(90deg, #2196f3, #21cbf3); height: 100%; width: 0%; transition: width 0.3s ease; border-radius: 3px;"></div>
        </div>
      </div>
      
      <div style="border-top: 1px solid #e0e0e0; padding-top: 12px;" data-extension-selection="false">
        <div style="font-size: 11px; color: #666; margin-bottom: 8px; line-height: 1.4;" data-extension-selection="false">
          <div>• 左键点击：选择/取消选择元素</div>
          <div>• 右键点击：快速取消选择</div>
          <div>• 点击空白处：继续选择其他元素</div>
        </div>
        
        <div style="display: flex; gap: 8px; margin-top: 12px; flex-direction: column;" data-extension-selection="false">
          <div style="display: flex; gap: 8px;" data-extension-selection="false">
            <button id="btn-clear-all" class="extension-btn" data-extension-selection="false" style="flex: 1; padding: 8px 12px; border: 1px solid #f44336; background: #ffebee; color: #d32f2f; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; user-select: none;">
              清除全部
            </button>
            <button id="btn-stop-selection" class="extension-btn" data-extension-selection="false" style="flex: 1; padding: 8px 12px; border: 1px solid #757575; background: #f5f5f5; color: #424242; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; user-select: none;">
              退出模式
            </button>
          </div>
          <button id="btn-confirm-selection" class="extension-btn" data-extension-selection="false" style="width: 100%; padding: 10px 12px; border: none; background: linear-gradient(135deg, #2196f3, #21cbf3); color: white; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; user-select: none; box-shadow: 0 2px 8px rgba(33, 150, 243, 0.3);" disabled>
            确定选择
          </button>
        </div>
      </div>
    `;
    
    // 添加到页面
    document.body.appendChild(toolbar);
    
    // 绑定事件
    this.bindToolbarEvents();
    
    // 初始化显示
    this.updateSelectionCount();
    this.updateProgressBar();
  }
  
  // 隐藏选择工具栏
  hideSelectionToolbar() {
    const toolbar = document.getElementById('extension-selection-toolbar');
    if (toolbar) {
      toolbar.remove();
    }
  }
  
  // 绑定工具栏事件
  bindToolbarEvents() {
    // 清除全部选择
    const clearBtn = document.getElementById('btn-clear-all');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearAllSelections();
        this.updateSelectionStatus('已清除所有选择', 'info');
      });
    }
    
    // 停止选择模式
    const stopBtn = document.getElementById('btn-stop-selection');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        this.stopSelection();
        this.notifyPopup('selectionStopped', {});
      });
    }
    
    // 确定选择
    const confirmBtn = document.getElementById('btn-confirm-selection');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('确认选择按钮被点击，已选择元素数:', this.selectedElements.length);
        this.confirmSelection();
      });
    }
  }
  
  // 确认选择
  async confirmSelection() {
    console.log('开始确认选择，已选择元素数:', this.selectedElements.length);
    
    if (this.selectedElements.length === 0) {
      this.updateSelectionStatus('请至少选择一个元素', 'warning');
      return;
    }
    
    try {
      // 先保存选择状态（在停止选择模式之前）
      // 在content script中无法直接使用chrome.tabs，需要通过background script获取tabId
      // 或者让background script从sender.tab.id自动获取（已在background.js中实现）
      // 这里先设置为null，background script会自动填充
      let currentTabId = null;
      
      // 尝试通过消息获取当前标签页ID（可选，background会自动填充）
      try {
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { action: 'getCurrentTabId' },
            (response) => {
              if (chrome.runtime.lastError) {
                resolve(null);
              } else {
                resolve(response);
              }
            }
          );
        });
        if (response && response.success && response.tabId) {
          currentTabId = response.tabId;
          console.log('✅ 通过background script获取到tabId:', currentTabId);
        }
      } catch (error) {
        console.warn('获取标签页ID失败（将使用null，background会自动填充）:', error);
      }
      
      // 确保元素数据格式正确
      const selectedElementsData = this.selectedElements.map(el => {
        // 处理不同的数据结构
        let elementData = {};
        if (typeof el === 'string') {
          elementData = { id: `element_${Date.now()}_${Math.random()}`, text: el };
        } else if (el && typeof el === 'object') {
          elementData = {
            id: el.id || `element_${Date.now()}_${Math.random()}`,
            text: el.text || el.textContent || '',
            tagName: el.tagName || '',
            selector: el.selector || ''
          };
        }
        return elementData;
      });
      
      const selectionState = {
        isSelectionMode: false,
        selectedElements: selectedElementsData,
        tabId: currentTabId,
        timestamp: Date.now(),
        pageUrl: window.location.href
      };
      
      console.log('准备保存选择状态:', {
        tabId: currentTabId,
        elementCount: selectionState.selectedElements.length,
        elements: selectionState.selectedElements.map(el => ({
          id: el.id,
          text: (el.text || '').substring(0, 50)
        }))
      });
      
      // 使用Promise确保保存完成（这是Google推荐的方式）
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ selectionState: selectionState }, () => {
          if (chrome.runtime.lastError) {
            console.error('❌ 保存到storage.local失败:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            console.log('✅ 选择状态已保存到storage.local，元素数:', selectionState.selectedElements.length);
            console.log('✅ 保存的数据:', JSON.stringify(selectionState, null, 2));
            resolve();
          }
        });
      });
      
      // 同时保存到background script（background会自动填充tabId）
      // 注意：background script会从sender.tab.id自动获取tabId并更新selectionState
      chrome.runtime.sendMessage({
        source: 'content-script',
        action: 'saveSelectionState',
        selectionState: selectionState
      }, async (response) => {
        if (chrome.runtime.lastError) {
          console.warn('保存到background script失败:', chrome.runtime.lastError);
        } else {
          console.log('✅ 选择状态已保存到background script');
          // 如果background script填充了tabId，更新storage.local中的数据
          if (response && response.updatedState && response.updatedState.tabId) {
            const updatedState = { ...selectionState, tabId: response.updatedState.tabId };
            chrome.storage.local.set({ selectionState: updatedState }, () => {
              if (!chrome.runtime.lastError) {
                console.log('✅ 已更新storage.local中的tabId:', response.updatedState.tabId);
              }
            });
          }
        }
      });
      
      // 通知popup选择已完成
      this.notifyPopup('selectionStopped', {
        elements: this.selectedElements,
        confirmed: true
      });
      
      // 显示确认消息
      this.updateSelectionStatus(`已确认选择 ${this.selectedElements.length} 个元素`, 'success');
      this.showUserMessage(`已确认选择 ${this.selectedElements.length} 个元素，可以在弹窗中查看`, 'success');
      
      // 延迟停止选择模式，让用户看到确认消息
      setTimeout(async () => {
        await this.stopSelection();
      }, 1000);
      
    } catch (error) {
      console.error('确认选择失败:', error);
      this.updateSelectionStatus('确认选择失败', 'error');
      this.showUserMessage('确认选择失败，请重试', 'error');
    }
  }
  
  // 更新选择状态
  updateSelectionStatus(message, type = 'info') {
    const statusElement = document.getElementById('status-text');
    const statusContainer = document.getElementById('selection-status');
    
    if (statusElement && statusContainer) {
      statusElement.textContent = message;
      
      // 根据类型设置不同的颜色
      const colors = {
        'success': '#4caf50',
        'error': '#f44336',
        'warning': '#ff9800',
        'info': '#2196f3'
      };
      
      statusElement.style.color = colors[type] || colors.info;
      statusContainer.style.backgroundColor = type === 'error' ? '#ffebee' : 
                                             type === 'warning' ? '#fff3e0' : 
                                             type === 'success' ? '#e8f5e8' : '#f5f5f5';
    }
    
    // 增强的用户消息显示
    this.showUserMessage(message, type);
  }
  
  // 显示用户消息
  showUserMessage(message, type = 'info') {
    // 创建消息元素
    const messageDiv = document.createElement('div');
    messageDiv.className = `extension-user-message extension-${type}`;
    messageDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'error' ? '#f8d7da' : type === 'warning' ? '#fff3cd' : type === 'success' ? '#d1edff' : '#e2e3e5'};
      color: ${type === 'error' ? '#721c24' : type === 'warning' ? '#856404' : type === 'success' ? '#0c5460' : '#383d41'};
      border: 1px solid ${type === 'error' ? '#f5c6cb' : type === 'warning' ? '#ffeaa7' : type === 'success' ? '#bee5eb' : '#d6d8db'};
      padding: 12px 16px;
      border-radius: 4px;
      z-index: 10000;
      font-size: 14px;
      max-width: 300px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      animation: slideIn 0.3s ease-out;
    `;
    messageDiv.textContent = message;
    
    // 添加到页面
    document.body.appendChild(messageDiv);
    
    // 3秒后自动移除
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
          if (messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
          }
        }, 300);
      }
    }, 3000);
  }
  
  // 通知popup（如果popup存在）或background script（如果popup关闭）
  notifyPopup(action, data) {
    // 优先尝试直接发送到popup
    chrome.runtime.sendMessage({
      source: 'content-script',
      action: action,
      data: data
    }, (response) => {
      // 如果popup不存在（即popup已关闭），发送到background script
      if (chrome.runtime.lastError) {
        chrome.runtime.sendMessage({
          source: 'content-script',
          action: 'selectionEvent',
          data: {
            originalAction: action,
            ...data,
            timestamp: Date.now(),
            pageUrl: window.location.href
          }
        }).catch(error => {
          console.warn('通知background script失败:', error);
        });
      }
    });
  }
  
  // 更新选择计数
  updateSelectionCount() {
    const countElement = document.getElementById('selection-count');
    const maxElement = document.getElementById('max-selections');
    const confirmBtn = document.getElementById('btn-confirm-selection');
    
    if (countElement) {
      countElement.textContent = this.selectedElements.length;
    }
    
    if (maxElement) {
      maxElement.textContent = this.maxSelections;
    }
    
    // 更新确定按钮状态
    if (confirmBtn) {
      if (this.selectedElements.length > 0) {
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
        confirmBtn.style.cursor = 'pointer';
      } else {
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.5';
        confirmBtn.style.cursor = 'not-allowed';
      }
    }
  }
  
  // 更新进度条
  updateProgressBar() {
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
      const percentage = (this.selectedElements.length / this.maxSelections) * 100;
      progressBar.style.width = `${percentage}%`;
      
      // 根据选择比例改变颜色
      if (percentage >= 90) {
        progressBar.style.background = 'linear-gradient(90deg, #f44336, #ff5722)';
      } else if (percentage >= 70) {
        progressBar.style.background = 'linear-gradient(90deg, #ff9800, #ffb74d)';
      } else {
        progressBar.style.background = 'linear-gradient(90deg, #2196f3, #21cbf3)';
      }
    }
  }
  
  // 清除所有选择
  async clearAllSelections() {
    this.selectedElements = [];
    this.clearSelectionHighlights();
    this.updateSelectionCount();
    this.updateProgressBar();
    
    // 通知popup
    this.notifyPopup('selectionCleared', {});
    
    console.log('所有选择已清除');
  }

  // 通知popup
  notifyPopup(action, data) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          source: 'content-script',
          action: action,
          data: data
        }).catch(error => {
          // 如果popup不存在（已关闭），发送到background script
          if (error.message && (error.message.includes('Receiving end does not exist') || 
              error.message.includes('Could not establish connection'))) {
            chrome.runtime.sendMessage({
              source: 'content-script',
              action: 'selectionEvent',
              data: {
                originalAction: action,
                ...data,
                timestamp: Date.now(),
                pageUrl: window.location.href
              }
            }).catch(err => {
              console.warn('通知background script失败:', err);
            });
          } else {
            console.error('通知popup失败:', error);
          }
        });
      }
    } catch (error) {
      console.error('通知popup出错:', error);
    }
  }
  

  // ==================== 增强的选择模式管理方法 ====================
  
  // 设置全局事件监听器
  setupGlobalEventListeners() {
    console.log('📡 设置全局事件监听器');
    
    // 移除之前的事件监听器（避免重复绑定）
    this.cleanupEventListeners();
    
    // 核心选择事件 - 直接绑定到document
    document.addEventListener('click', this.handleSelectionClick, { capture: true, passive: false });
    document.addEventListener('mouseover', this.handleMouseOver, { capture: true, passive: true });
    document.addEventListener('mouseout', this.handleMouseOut, { capture: true, passive: true });
    document.addEventListener('contextmenu', this.handleContextMenu, { capture: true, passive: false });
    
    // 记录事件监听器以便清理
    this.eventListeners.set('click', this.handleSelectionClick);
    this.eventListeners.set('mouseover', this.handleMouseOver);
    this.eventListeners.set('mouseout', this.handleMouseOut);
    this.eventListeners.set('contextmenu', this.handleContextMenu);
    
    console.log('✅ 全局事件监听器已绑定到document');
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

  // 更新选择UI
  updateSelectionUI() {
    this.updateSelectionCount();
    this.updateSelectionStatus();
  }

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

  // 添加防抖事件监听器
  addThrottledEventListener(event, handler, delay = 100) {
    const throttledHandler = (e) => {
      if (!throttledHandler.timeoutId) {
        throttledHandler.timeoutId = setTimeout(() => {
          throttledHandler.timeoutId = null;
          handler(e);
        }, delay);
      }
    };
    
    const key = `${event}_throttled`;
    this.eventListeners.set(key, { 
      event, 
      handler: throttledHandler, 
      useCapture: false, 
      timeoutId: null 
    });
    document.addEventListener(event, throttledHandler, false);
    
    console.log(`📎 添加防抖事件监听器: ${key} (延迟: ${delay}ms)`);
  }
  
  // 设置页面变化监听器
  setupPageChangeListeners() {
    // 使用MutationObserver监听DOM变化
    if (window.MutationObserver) {
      this.mutationObserver = new MutationObserver((mutations) => {
        if (!this.isSelectionMode) return;
        
        let relevantChanges = false;
        mutations.forEach((mutation) => {
          // 监听子元素变化
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            relevantChanges = true;
          }
          // 监听属性变化
          if (mutation.type === 'attributes') {
            relevantChanges = true;
          }
        });
        
        if (relevantChanges) {
          // 延迟处理，避免频繁调用
          clearTimeout(this.pageChangeTimeout);
          this.pageChangeTimeout = setTimeout(() => {
            this.handlePageContentChange();
          }, 500);
        }
      });
      
      this.mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style']
      });
      
      console.log('🔍 页面变化监听器已设置');
    }
  }
  
  // 清理页面变化监听器
  cleanupPageChangeListeners() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
      console.log('🔍 页面变化监听器已清理');
    }
    
    if (this.pageChangeTimeout) {
      clearTimeout(this.pageChangeTimeout);
      this.pageChangeTimeout = null;
    }
  }
  
  // 处理页面内容变化
  handlePageContentChange() {
    if (!this.isSelectionMode) return;
    
    console.log('🔄 检测到页面内容变化');
    
    // 检查已选择的元素是否仍然存在
    this.selectedElements = this.selectedElements.filter(elementData => {
      if (elementData.id && !elementData.id.startsWith('temp-')) {
        const element = document.getElementById(elementData.id);
        if (!element) {
          // 元素已不存在，移除高亮
          const highlight = this.selectionHighlights.find(h => h.id === elementData.id);
          if (highlight) {
            this.selectionHighlights = this.selectionHighlights.filter(h => h.id !== elementData.id);
          }
          
          // 通知popup元素已移除
          this.notifyPopup('elementRemoved', elementData);
          console.warn(`选择的元素已不存在: ${elementData.id}`);
          return false;
        }
      }
      return true;
    });
    
    // 更新UI
    this.updateSelectionCount();
    this.updateProgressBar();
  }
  
  // 保存选择历史
  saveSelectionHistory(state) {
    try {
      const history = JSON.parse(localStorage.getItem('extension_selection_history') || '[]');
      history.push({
        ...state,
        url: window.location.href,
        timestamp: Date.now()
      });
      
      // 保留最近20条历史
      if (history.length > 20) {
        history.splice(0, history.length - 20);
      }
      
      localStorage.setItem('extension_selection_history', JSON.stringify(history));
      console.log('选择历史已保存');
    } catch (error) {
      console.error('保存选择历史失败:', error);
    }
  }
  
  // 日志记录选择事件
  logSelectionEvent(event, data) {
    try {
      const logs = JSON.parse(localStorage.getItem('extension_selection_logs') || '[]');
      logs.push({
        event,
        data,
        url: window.location.href,
        timestamp: Date.now()
      });
      
      // 保留最近50条日志
      if (logs.length > 50) {
        logs.splice(0, logs.length - 50);
      }
      
      localStorage.setItem('extension_selection_logs', JSON.stringify(logs));
    } catch (error) {
      console.error('记录选择事件失败:', error);
    }
  }
  
  // 处理选择错误
  handleSelectionError(message, error) {
    this.errorState = {
      message,
      error: error.toString(),
      timestamp: Date.now()
    };
    
    // 更新UI显示错误
    this.updateSelectionStatus(message, 'error');
    
    // 通知popup错误
    this.notifyPopup('selectionError', {
      message,
      error: error.toString()
    });
    
    console.error(message, error);
  }
  
  // 显示用户消息
  showUserMessage(message, type = 'info') {
    // 创建消息提示
    const messageElement = document.createElement('div');
    messageElement.style.cssText = `
      position: fixed !important;
      bottom: 20px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      background: ${type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : type === 'success' ? '#4caf50' : '#2196f3'} !important;
      color: white !important;
      padding: 12px 16px !important;
      border-radius: 6px !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
      z-index: 10001 !important;
      font-size: 14px !important;
      max-width: 300px !important;
      text-align: center !important;
      animation: slideUp 0.3s ease !important;
    `;
    messageElement.textContent = message;
    
    document.body.appendChild(messageElement);
    
    // 3秒后自动消失
    setTimeout(() => {
      if (messageElement.parentNode) {
        messageElement.style.opacity = '0';
        messageElement.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
          if (messageElement.parentNode) {
            messageElement.remove();
          }
        }, 300);
      }
    }, 3000);
  }
  
  // 保存用户偏好
  saveUserPreference(key, value) {
    try {
      const preferences = JSON.parse(localStorage.getItem('extension_preferences') || '{}');
      preferences[key] = value;
      localStorage.setItem('extension_preferences', JSON.stringify(preferences));
    } catch (error) {
      console.error('保存用户偏好失败:', error);
    }
  }
  
  // 获取用户偏好
  getUserPreference(key, defaultValue = null) {
    try {
      const preferences = JSON.parse(localStorage.getItem('extension_preferences') || '{}');
      return preferences[key] !== undefined ? preferences[key] : defaultValue;
    } catch (error) {
      console.error('获取用户偏好失败:', error);
      return defaultValue;
    }
  }
  
  // 其他事件处理方法
  handleKeyUp = (event) => {
    if (!this.isSelectionMode) return;
    
    // 可以添加按键释放后的处理逻辑
  };
  
  handleScroll = (event) => {
    if (!this.isSelectionMode) return;
    
    // 检查滚动是否影响了工具栏位置
    const toolbar = document.getElementById('extension-selection-toolbar');
    if (toolbar) {
      const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
      if (scrollPosition > 100) {
        toolbar.style.top = '60px'; // 滚动后工具栏向下移动
      } else {
        toolbar.style.top = '20px';
      }
    }
  };
  
  handlePageChange = (event) => {
    if (!this.isSelectionMode) return;
    
    console.log('页面变化事件:', event);
    // 可以添加页面变化后的处理逻辑
  };
  
  handleOnline = (event) => {
    console.log('网络已连接');
    // 可以添加网络恢复后的处理逻辑
  };
  
  handleOffline = (event) => {
    console.log('网络已断开');
    // 可以添加网络断开后的处理逻辑
    this.showUserMessage('网络连接已断开', 'warning');
  };
  
  handleSelectStart = (event) => {
    if (!this.isSelectionMode) return;
    
    // 在选择模式下禁用文本选择
    event.preventDefault();
  };
  
  handleDragStart = (event) => {
    if (!this.isSelectionMode) return;
    
    // 在选择模式下禁用拖拽
    event.preventDefault();
  };
  
  handlePageContentChange = (event) => {
    if (!this.isSelectionMode) return;
    
    console.log('页面内容变化:', event);
    // 可以添加内容变化后的处理逻辑
  };
  
  selectAllElements = () => {
    if (!this.isSelectionMode) return;
    
    // 尝试选择主要内容区域中的所有段落、标题等
    const contentSelectors = [
      'main p', 'article p', 'section p',
      'main h1', 'main h2', 'main h3', 'main h4', 'main h5', 'main h6',
      'article h1', 'article h2', 'article h3', 'article h4', 'article h5', 'article h6',
      'section h1', 'section h2', 'section h3', 'section h4', 'section h5', 'section h6',
      '.content p', '.content h1', '.content h2', '.content h3', '.content h4', '.content h5', '.content h6'
    ];
    
    const elements = [];
    
    contentSelectors.forEach(selector => {
      try {
        const els = document.querySelectorAll(selector);
        els.forEach(el => {
          if (!this.shouldIgnoreElement(el) && 
              el.textContent && el.textContent.trim().length > 10 &&
              !elements.includes(el)) {
            elements.push(el);
          }
        });
      } catch (error) {
        console.warn(`选择器 "${selector}" 执行失败:`, error);
      }
    });
    
    // 按最大选择数量限制
    const elementsToAdd = elements.slice(0, this.maxSelections - this.selectedElements.length);
    
    if (elementsToAdd.length === 0) {
      this.updateSelectionStatus('未找到可选择的元素', 'warning');
      return;
    }
    
    elementsToAdd.forEach(el => {
      if (this.selectedElements.length < this.maxSelections) {
        this.addSelection(el);
      }
    });
    
    this.updateSelectionStatus(`已选择 ${this.selectedElements.length} 个元素`, 'success');
  };
}

// 防止重复初始化 - 检查是否已经在当前 window 中初始化
if (typeof window !== 'undefined' && !window.__CONTENT_EXTRACTOR_INITIALIZED__) {
  // 标记为已初始化
  window.__CONTENT_EXTRACTOR_INITIALIZED__ = true;
  
  // 检查是否在特殊页面或 iframe 中
  const isTopFrame = window === window.top;
  const isSpecial = isSpecialPage();
  
  // 只在顶层 frame 或非特殊页面中初始化
  if (isTopFrame || !isSpecial) {
    try {
      // 初始化内容提取器和悬停高亮系统
      const contentExtractor = new ContentExtractor();
      window.__contentExtractor = contentExtractor;
    } catch (error) {
      console.error('ContentExtractor 初始化失败:', error);
      // 即使失败也标记为已初始化，避免重复尝试
    }
  } else {
    console.log('在特殊页面或子 frame 中，跳过 ContentExtractor 初始化');
  }
} else {
  console.log('ContentExtractor 已初始化，跳过重复初始化');
}

// 立即初始化悬停高亮系统
function initializeHoverHighlighter() {
  try {
    // 防止重复初始化
    if (typeof window !== 'undefined' && !window.__HOVER_HIGHLIGHTER_INITIALIZED__) {
      window.__HOVER_HIGHLIGHTER_INITIALIZED__ = true;
      
      if (!window.hoverHighlighter) {
        // 检查HoverHighlighter类是否可用
        if (typeof HoverHighlighter !== 'undefined') {
          // 直接创建悬停高亮实例
          window.hoverHighlighter = new HoverHighlighter();
          console.log('悬停高亮系统初始化成功');
        } else {
          // HoverHighlighter类不可用，使用备用方案（静默处理，不输出警告）
          window.hoverHighlighter = {
            activate: () => {},
            deactivate: () => {},
            isActive: false,
            highlightElement: () => {},
            removeHighlight: () => {}
          };
        }
      }
    }
  } catch (error) {
    // 静默处理错误，使用备用方案
    if (typeof window !== 'undefined' && !window.hoverHighlighter) {
      window.hoverHighlighter = {
        activate: () => {},
        deactivate: () => {},
        isActive: false,
        highlightElement: () => {},
        removeHighlight: () => {}
      };
    }
  }
}

// 确保页面完全加载后初始化（只在顶层 frame 中）
if (typeof window !== 'undefined' && window === window.top) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeHoverHighlighter();
    });
  } else {
    initializeHoverHighlighter();
  }
}

// 暴露全局控制接口
window.HoverHighlighterControl = {
  activate: () => {
    if (window.hoverHighlighter && window.hoverHighlighter.activate) {
      window.hoverHighlighter.activate();
    } else {
      console.warn('悬停高亮系统未加载或不可用');
    }
  },
  
  deactivate: () => {
    if (window.hoverHighlighter && window.hoverHighlighter.deactivate) {
      window.hoverHighlighter.deactivate();
    } else {
      console.warn('悬停高亮系统未加载或不可用');
    }
  },
  
  isActive: () => {
    return window.hoverHighlighter && window.hoverHighlighter.isActive;
  },
  
  getInstance: () => {
    return window.hoverHighlighter;
  }
};

console.log('Chrome扩展内容脚本已完全加载，悬停高亮系统准备就绪');