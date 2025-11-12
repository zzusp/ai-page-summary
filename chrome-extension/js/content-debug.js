// 调试版本的内容脚本 - 用于测试和诊断
console.log('🔄 Content script debug version loaded!');

// 立即执行测试
function debugTest() {
  console.log('📊 调试测试开始...');
  console.log('🌐 当前URL:', window.location.href);
  console.log('📄 页面标题:', document.title);
  console.log('📋 Document状态:', document.readyState);
  console.log('👤 Body存在:', !!document.body);
  console.log('📏 Body文本长度:', (document.body?.textContent || '').length);
  console.log('🖼️ Frame数量:', window.frames.length);
  
  // 检测动态页面
  const isReact = !!document.querySelector('[data-reactroot]');
  const isVue = !!document.querySelector('[data-vue-app]');
  const isAngular = !!document.querySelector('[ng-app]');
  const isDynamic = isReact || isVue || isAngular;
  
  console.log('⚛️ React检测:', isReact);
  console.log('💚 Vue检测:', isVue);
  console.log('🅰️ Angular检测:', isAngular);
  console.log('🚀 动态页面:', isDynamic);
  
  // 检查网络请求
  if (window.performance && window.performance.getEntries) {
    const entries = window.performance.getEntries();
    console.log('🌐 网络请求数量:', entries.length);
    entries.forEach((entry, i) => {
      console.log(`请求 ${i + 1}:`, entry.name);
    });
  }
  
  // 简单内容提取测试
  const bodyText = (document.body?.textContent || '').trim();
  console.log('📄 提取的文本预览:', bodyText.substring(0, 100) + '...');
  
  console.log('✅ 调试测试完成');
}

// 监听消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 收到消息:', message);
  
  if (message.action === 'extractContent') {
    debugTest();
    
    // 执行简单的内容提取
    setTimeout(() => {
      try {
        const title = document.title || '无标题';
        const url = window.location.href;
        const content = (document.body?.textContent || '').trim();
        
        const result = {
          success: true,
          title: title,
          url: url,
          content: content.substring(0, 2000),
          metaInfo: {
            title: title,
            description: '',
            author: '',
            publishDate: '',
            keywords: '',
            pageType: 'debug_test',
            language: document.documentElement.lang || 'zh'
          },
          confidence: 100,
          timestamp: Date.now(),
          extractionMethod: 'debug_simple',
          wordCount: content.split(/\s+/).length
        };
        
        console.log('🎉 调试提取成功:', result);
        sendResponse(result);
      } catch (error) {
        console.error('❌ 调试提取失败:', error);
        sendResponse({
          success: false,
          error: `调试提取失败: ${error.message}`,
          details: error.toString()
        });
      }
    }, 1000);
    
    return true; // 保持消息通道开放
  }
  
  if (message.action === 'ping') {
    sendResponse({ success: true, message: 'Debug content script is ready' });
  }
});

// 立即运行调试测试
debugTest();
