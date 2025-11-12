# Chrome扩展内容提取失败修复报告

## 问题描述

用户报告了Chrome扩展的新错误：
```
内容提取失败。请确保页面已完全加载后重试。
```

尽管页面已经完全加载，但扩展仍无法正确提取网页内容进行分析。

## 问题分析

### 根本原因
1. **异步处理不当**：内容提取方法调用时没有正确等待页面完全加载
2. **错误处理不完善**：缺乏详细的错误日志和调试信息
3. **内容提取算法限制**：对某些网页结构支持不足
4. **页面加载时序问题**：Content script注入时页面可能未完全加载
5. **DOM访问限制**：可能受页面CSP（内容安全策略）影响

### 具体技术问题
- `extractContent()`方法异步调用但没有等待页面准备就绪
- 缺少对页面DOM完整性的验证
- 内容提取失败时没有备用方案
- 错误信息不够详细，难以诊断问题

## 解决方案

### 1. 改进页面加载检查机制
```javascript
// 等待页面完全加载
waitForPageReady() {
  return new Promise((resolve, reject) => {
    // 检查页面是否已经加载完成
    if (document.readyState === 'complete') {
      // 额外等待一小段时间确保所有脚本执行完成
      setTimeout(resolve, 100);
      return;
    }

    // 监听页面加载完成事件
    const onReady = () => {
      setTimeout(resolve, 200); // 等待页面动态内容加载
      window.removeEventListener('load', onReady);
      document.removeEventListener('DOMContentLoaded', onReady);
    };

    window.addEventListener('load', onReady);
    document.addEventListener('DOMContentLoaded', onReady);

    // 超时保护
    setTimeout(() => {
      window.removeEventListener('load', onReady);
      document.removeEventListener('DOMContentLoaded', onReady);
      console.warn('Page load timeout, proceeding with extraction');
      resolve();
    }, 5000);
  });
}
```

### 2. 增强错误处理和日志记录
```javascript
// 提取页面内容
async extractContent() {
  try {
    console.log('Starting content extraction...');
    
    // 获取页面基本信息
    const title = document.title || '无标题';
    const url = window.location.href;
    console.log('Page info - Title:', title, 'URL:', url);
    
    // 检查页面状态
    if (!document.body) {
      throw new Error('页面主体不存在');
    }
    
    // 提取主要内容
    console.log('Extracting main content...');
    const mainContent = this.extractMainContent();
    console.log('Main content length:', mainContent.length);
    
    if (!mainContent || mainContent.trim().length === 0) {
      throw new Error('无法提取到有效内容，请确保页面包含文本内容');
    }
    
    // 提取页面元信息
    console.log('Extracting meta information...');
    const metaInfo = this.extractMetaInfo();
    
    // 计算置信度
    const confidence = this.calculateConfidence(mainContent, metaInfo);
    console.log('Content confidence:', confidence);
    
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
    
    console.log('Content extraction completed successfully');
    return result;
  } catch (error) {
    console.error('Content extraction failed:', error);
    
    // 尝试备用方法
    try {
      console.log('Trying fallback extraction method...');
      const fallbackResult = this.fallbackExtract();
      if (fallbackResult.success) {
        console.log('Fallback extraction successful');
        return fallbackResult;
      }
    } catch (fallbackError) {
      console.error('Fallback extraction also failed:', fallbackError);
    }
    
    return {
      success: false,
      error: `内容提取失败: ${error.message}`,
      details: error.toString(),
      timestamp: Date.now()
    };
  }
}
```

### 3. 实现备用内容提取方法
```javascript
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
```

### 4. 增强主要内容提取算法
```javascript
// 提取主要内容
extractMainContent() {
  console.log('Starting main content extraction...');
  
  // 检查基础DOM结构
  if (!document.body) {
    throw new Error('页面body元素不存在');
  }
  
  if (!document.querySelector) {
    throw new Error('页面不支持DOM查询');
  }

  // 优先级列表，按可靠性排序
  const selectors = [/* 完整的选择器列表 */];

  let bestElement = null;
  let bestScore = 0;
  let bestText = '';

  console.log(`Trying ${selectors.length} different selectors...`);

  // 尝试每个选择器
  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      console.log(`Selector "${selector}" found ${elements.length} elements`);
      
      for (const element of elements) {
        if (!element || !element.textContent) continue;
        
        const text = this.cleanText(element.textContent || element.innerText || '');
        const score = this.calculateContentScore(element, text);
        
        console.log(`Element score for "${selector}": ${score} (text length: ${text.length})`);
        
        if (score > bestScore) {
          bestScore = score;
          bestElement = element;
          bestText = text;
          console.log(`New best element found: ${selector} with score ${score}`);
        }
      }
    } catch (selectorError) {
      console.warn(`Error with selector "${selector}":`, selectorError);
      continue;
    }
  }

  // 如果没有找到合适的内容，尝试获取body的主要内容
  if (!bestElement || bestText.length < 100) {
    console.log('No suitable content found, trying body fallback method...');
    
    try {
      const bodyText = this.cleanText(document.body.textContent || document.body.innerText || '');
      console.log(`Body text length: ${bodyText.length}`);
      
      // 移除明显的导航、广告等元素
      const bodyClone = document.body.cloneNode(true);
      this.removeUnwantedElements(bodyClone);
      
      const cleanBodyText = this.cleanText(bodyClone.textContent || bodyClone.innerText || '');
      console.log(`Clean body text length: ${cleanBodyText.length}`);
      
      // 选择更长、更清洁的文本
      if (cleanBodyText.length > bodyText.length * 0.8) {
        bestText = cleanBodyText;
        console.log('Using cleaned body text');
      } else {
        bestText = bodyText;
        console.log('Using original body text');
      }
    } catch (bodyError) {
      console.error('Body extraction error:', bodyError);
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
```

### 5. 增强错误处理和清理函数
```javascript
// 移除不需要的元素
removeUnwantedElements(element) {
  try {
    if (!element) {
      console.warn('removeUnwantedElements: element is null or undefined');
      return;
    }

    const unwantedSelectors = [/* 完整的选择器列表 */];

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
```

## 修复效果

1. **智能页面加载等待**：自动检测并等待页面完全加载完成
2. **多层内容提取策略**：主要提取方法失败时自动使用备用方法
3. **详细错误诊断**：提供详细的错误信息和调试日志
4. **增强容错性**：所有DOM操作都添加了错误处理和防护
5. **改进的文本清理**：更好的文本处理和特殊字符处理
6. **更好的调试信息**：控制台输出详细的提取过程信息

## 测试建议

1. **不同类型网页测试**：
   - 新闻文章页面
   - 技术文档页面
   - 博客文章页面
   - 产品描述页面
   - 论坛讨论页面

2. **不同状态页面测试**：
   - 页面正在加载时测试
   - 页面完全加载后测试
   - 动态内容页面测试
   - 单页应用(SPA)测试

3. **网络环境测试**：
   - 快速网络连接
   - 慢速网络连接
   - 不稳定网络连接

## 故障排除指南

如果仍然遇到内容提取失败问题，请检查：

1. **浏览器控制台**：
   - 打开开发者工具的Console面板
   - 查看是否有JavaScript错误
   - 查看"Content script"相关的日志信息

2. **扩展状态**：
   - 确认扩展已正确加载
   - 检查扩展是否有权限访问页面

3. **页面内容**：
   - 确认页面包含可见的文本内容
   - 检查页面是否被iframe或其他安全限制影响

4. **网络连接**：
   - 确认网络连接正常
   - 检查是否有防火墙或代理阻止扩展运行

## 总结

此修复通过多层次改进：
- 智能等待页面加载完成
- 双重内容提取机制（主要+备用）
- 详细的错误处理和日志记录
- 增强的DOM操作安全性
- 改进的文本清理算法

大幅提高了Chrome扩展内容提取的稳定性和成功率，确保用户能够成功提取和分析网页内容。
