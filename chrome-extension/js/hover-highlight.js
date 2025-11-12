// 悬停高亮系统
// 专门用于实现网页元素悬停高亮效果
class HoverHighlighter {
  constructor() {
    this.isActive = false;
    this.hoveredElement = null;
    this.highlightTimeout = null;
    this.ignoreElements = new Set();
    this.maxHighlights = 50;
    this.activeHighlights = [];
    this.eventListeners = [];
    this.observer = null;
    this.init();
  }

  // 初始化
  init() {
    console.log('悬停高亮系统初始化中...');
    this.setupIgnoredElements();
    this.ensureStyles();
    this.setupMutationObserver();
    console.log('悬停高亮系统初始化完成');
  }

  // 设置需要忽略的元素类型
  setupIgnoredElements() {
    this.ignoredSelectors = [
      // 基础系统元素
      'script', 'style', 'link', 'meta', 'title', 'base',
      'head', 'html', 'body',
      
      // 表单元素
      'input', 'button', 'select', 'textarea', 'option', 'optgroup',
      'fieldset', 'legend', 'label',
      
      // 媒体元素
      'audio', 'video', 'source', 'track',
      
      // 图形元素
      'canvas', 'svg', 'path', 'circle', 'rect', 'polygon',
      
      // 框架元素
      'iframe', 'frame', 'frameset',
      
      // 特殊属性元素
      '[contenteditable="true"]',
      '[data-extension-ignore]',
      '[data-no-hover]',
      
      // 特定类名和ID
      '.extension-ignore', '#extension-ignore',
      '.no-highlight', '#no-highlight',
      '.hover-ignore', '.hover-disabled',
      
      // 导航和布局元素
      'nav[role="navigation"]', 'nav[aria-label]',
      '.nav', '.navigation', '.menu', '.navbar',
      '.header', '.footer', '.sidebar', '.aside',
      
      // 隐藏元素
      '[style*="display: none"]',
      '[style*="visibility: hidden"]',
      '[hidden]',
      
      // 特殊用途元素
      '.advertisement', '.ad', '.adsbygoogle',
      '.social-share', '.share', '.social-buttons',
      '.comment-form', '.search-form', '.login-form',
      '.breadcrumb', '.pagination', '.tag-list',
      
      // 小元素
      'i', 'b', 'strong', 'em', 'u', 'small', 'sub', 'sup'
    ];
  }

  // 确保样式存在
  ensureStyles() {
    if (document.getElementById('hover-highlight-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'hover-highlight-styles';
    style.textContent = `
      /* 悬停高亮基础样式 */
      .hover-highlight-active {
        cursor: default !important;
      }

      /* 悬停高亮效果 */
      .hover-highlight {
        position: relative !important;
        z-index: 1000 !important;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
      }

      .hover-highlight::before {
        content: '' !important;
        position: absolute !important;
        top: -3px !important;
        left: -3px !important;
        right: -3px !important;
        bottom: -3px !important;
        background: linear-gradient(45deg, 
          rgba(59, 130, 246, 0.15), 
          rgba(99, 102, 241, 0.15), 
          rgba(59, 130, 246, 0.15)) !important;
        background-size: 200% 200% !important;
        border: 2px solid rgba(59, 130, 246, 0.6) !important;
        border-radius: 6px !important;
        animation: hover-highlight-pulse 2s ease-in-out infinite !important;
        z-index: -1 !important;
        pointer-events: none !important;
      }

      .hover-highlight::after {
        content: attr(data-hover-title) !important;
        position: absolute !important;
        top: -30px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        background: rgba(0, 0, 0, 0.9) !important;
        color: white !important;
        padding: 4px 8px !important;
        border-radius: 4px !important;
        font-size: 12px !important;
        white-space: nowrap !important;
        z-index: 1001 !important;
        opacity: 0 !important;
        transition: opacity 0.2s ease !important;
        pointer-events: none !important;
        max-width: 200px !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      .hover-highlight:hover::after {
        opacity: 1 !important;
      }

      /* 高亮动画 */
      @keyframes hover-highlight-pulse {
        0%, 100% {
          opacity: 0.6;
          background-position: 0% 50%;
        }
        50% {
          opacity: 0.9;
          background-position: 100% 50%;
        }
      }

      /* 内容区域高亮样式 */
      .hover-highlight-content {
        position: relative !important;
      }

      .hover-highlight-content::before {
        content: '' !important;
        position: absolute !important;
        top: -4px !important;
        left: -4px !important;
        right: -4px !important;
        bottom: -4px !important;
        background: linear-gradient(45deg, 
          rgba(34, 197, 94, 0.1), 
          rgba(59, 130, 246, 0.1), 
          rgba(34, 197, 94, 0.1)) !important;
        background-size: 200% 200% !important;
        border: 3px solid rgba(34, 197, 94, 0.7) !important;
        border-radius: 8px !important;
        animation: hover-content-pulse 2.5s ease-in-out infinite !important;
        z-index: -1 !important;
        pointer-events: none !important;
      }

      @keyframes hover-content-pulse {
        0%, 100% {
          opacity: 0.7;
          background-position: 0% 50%;
        }
        50% {
          opacity: 1;
          background-position: 100% 50%;
        }
      }

      /* 文本内容高亮样式 */
      .hover-highlight-text {
        position: relative !important;
        background: rgba(255, 193, 7, 0.2) !important;
        border: 1px solid rgba(255, 193, 7, 0.5) !important;
        border-radius: 3px !important;
        padding: 1px 2px !important;
        transition: all 0.2s ease !important;
      }

      .hover-highlight-text:hover {
        background: rgba(255, 193, 7, 0.3) !important;
        border-color: rgba(255, 193, 7, 0.8) !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 2px 8px rgba(255, 193, 7, 0.3) !important;
      }

      /* 链接高亮样式 */
      .hover-highlight-link {
        position: relative !important;
        text-decoration: underline !important;
        text-decoration-color: rgba(59, 130, 246, 0.5) !important;
        text-decoration-thickness: 2px !important;
        text-underline-offset: 2px !important;
        transition: all 0.2s ease !important;
      }

      .hover-highlight-link:hover {
        text-decoration-color: rgba(59, 130, 246, 1) !important;
        color: rgba(59, 130, 246, 0.8) !important;
        background: rgba(59, 130, 246, 0.1) !important;
        border-radius: 2px !important;
        padding: 1px 2px !important;
        margin: -1px -2px !important;
      }

      /* 媒体元素高亮样式 */
      .hover-highlight-media {
        position: relative !important;
        filter: brightness(1.05) saturate(1.05) !important;
        transition: filter 0.3s ease !important;
      }

      .hover-highlight-media::before {
        content: '' !important;
        position: absolute !important;
        top: -3px !important;
        left: -3px !important;
        right: -3px !important;
        bottom: -3px !important;
        border: 2px dashed rgba(139, 92, 246, 0.7) !important;
        border-radius: 8px !important;
        z-index: -1 !important;
        pointer-events: none !important;
      }

      .hover-highlight-media:hover {
        filter: brightness(1.1) saturate(1.1) !important;
        transform: scale(1.02) !important;
      }

      /* 容器元素高亮样式 */
      .hover-highlight-container {
        position: relative !important;
        background: rgba(168, 85, 247, 0.1) !important;
        border: 2px solid rgba(168, 85, 247, 0.6) !important;
        border-radius: 8px !important;
        transition: all 0.3s ease !important;
      }

      .hover-highlight-container::before {
        content: '📦' !important;
        position: absolute !important;
        top: -10px !important;
        left: -10px !important;
        background: rgba(168, 85, 247, 0.9) !important;
        color: white !important;
        width: 20px !important;
        height: 20px !important;
        border-radius: 50% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 10px !important;
        z-index: 1002 !important;
      }

      .hover-highlight-container:hover {
        background: rgba(168, 85, 247, 0.2) !important;
        border-color: rgba(168, 85, 247, 1) !important;
        transform: translateY(-2px) !important;
        box-shadow: 0 4px 16px rgba(168, 85, 247, 0.3) !important;
      }

      /* 交互状态高亮 */
      .hover-highlight-interactive {
        position: relative !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
      }

      .hover-highlight-interactive::before {
        content: '🖱️' !important;
        position: absolute !important;
        top: -8px !important;
        right: -8px !important;
        background: rgba(34, 197, 94, 0.9) !important;
        color: white !important;
        width: 16px !important;
        height: 16px !important;
        border-radius: 50% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 8px !important;
        z-index: 1002 !important;
      }

      .hover-highlight-interactive:hover {
        transform: translateY(-1px) !important;
        box-shadow: 0 3px 12px rgba(0, 0, 0, 0.2) !important;
      }

      /* 状态指示器 */
      .hover-highlight-status {
        position: fixed !important;
        top: 20px !important;
        left: 20px !important;
        background: rgba(0, 0, 0, 0.8) !important;
        color: white !important;
        padding: 8px 12px !important;
        border-radius: 6px !important;
        font-size: 12px !important;
        z-index: 10000 !important;
        opacity: 0 !important;
        transition: opacity 0.3s ease !important;
        pointer-events: none !important;
      }

      .hover-highlight-status.show {
        opacity: 1 !important;
      }

      .hover-highlight-status.active {
        background: rgba(34, 197, 94, 0.9) !important;
      }

      .hover-highlight-status.error {
        background: rgba(239, 68, 68, 0.9) !important;
      }

      /* 减少动画支持 */
      @media (prefers-reduced-motion: reduce) {
        .hover-highlight,
        .hover-highlight-content,
        .hover-highlight-text,
        .hover-highlight-link,
        .hover-highlight-media,
        .hover-highlight-container,
        .hover-highlight-interactive {
          transition: none !important;
        }
        
        .hover-highlight::before,
        .hover-highlight-content::before,
        .hover-highlight-pulse,
        .hover-content-pulse {
          animation: none !important;
        }
      }

      /* 深色主题适配 */
      @media (prefers-color-scheme: dark) {
        .hover-highlight::after {
          background: rgba(255, 255, 255, 0.9) !important;
          color: black !important;
        }
        
        .hover-highlight-text {
          background: rgba(255, 193, 7, 0.3) !important;
        }
        
        .hover-highlight-container {
          background: rgba(168, 85, 247, 0.2) !important;
        }
      }

      /* 高对比度模式支持 */
      @media (prefers-contrast: high) {
        .hover-highlight::before {
          border-width: 3px !important;
        }
        
        .hover-highlight-content::before {
          border-width: 4px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // 设置DOM变化观察器
  setupMutationObserver() {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new MutationObserver((mutations) => {
      let shouldRefresh = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // 检查是否添加了新的可高亮元素
          for (let node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.matches && !this.shouldIgnoreElement(node)) {
                shouldRefresh = true;
                break;
              }
            }
          }
        }
      });

      if (shouldRefresh) {
        this.refreshHighlighting();
      }
    });

    this.observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // 启动悬停高亮
  activate() {
    if (this.isActive) {
      console.log('悬停高亮已经启动');
      return;
    }

    console.log('启动悬停高亮系统');
    this.isActive = true;
    document.body.classList.add('hover-highlight-active');
    
    // 绑定事件监听器
    this.bindEventListeners();
    
    // 显示状态指示器
    this.showStatus('悬停高亮已启用', 'active');
    
    // 延迟显示提示
    setTimeout(() => {
      this.showTooltip('将鼠标悬停在元素上查看高亮效果');
    }, 1000);
  }

  // 停止悬停高亮
  deactivate() {
    if (!this.isActive) {
      console.log('悬停高亮已经停止');
      return;
    }

    console.log('停止悬停高亮系统');
    this.isActive = false;
    
    // 移除所有高亮
    this.clearAllHighlights();
    
    // 移除事件监听器
    this.unbindEventListeners();
    
    // 移除状态指示器
    this.hideStatus();
    this.hideTooltip();
    
    document.body.classList.remove('hover-highlight-active');
  }

  // 绑定事件监听器
  bindEventListeners() {
    this.unbindEventListeners(); // 确保没有重复绑定

    // 鼠标进入事件（使用事件委托）
    this.mouseOverListener = this.handleMouseOver.bind(this);
    this.mouseOutListener = this.handleMouseOut.bind(this);
    this.clickListener = this.handleClick.bind(this);
    
    document.addEventListener('mouseover', this.mouseOverListener, true);
    document.addEventListener('mouseout', this.mouseOutListener, true);
    document.addEventListener('click', this.clickListener, true);
    
    // 记录绑定的监听器
    this.eventListeners = [
      { type: 'mouseover', listener: this.mouseOverListener },
      { type: 'mouseout', listener: this.mouseOutListener },
      { type: 'click', listener: this.clickListener }
    ];
  }

  // 取消绑定事件监听器
  unbindEventListeners() {
    this.eventListeners.forEach(({ type, listener }) => {
      document.removeEventListener(type, listener, true);
    });
    this.eventListeners = [];
  }

  // 处理鼠标进入事件
  handleMouseOver(event) {
    if (!this.isActive) return;

    // 忽略来自扩展的事件
    if (event.target.closest('[data-extension-highlight="false"]')) {
      return;
    }

    const element = this.findValidElement(event.target);
    if (!element || this.shouldIgnoreElement(element)) {
      return;
    }

    // 清除之前的高亮定时器
    if (this.highlightTimeout) {
      clearTimeout(this.highlightTimeout);
    }

    // 延迟高亮，避免过于频繁的闪烁
    this.highlightTimeout = setTimeout(() => {
      this.highlightElement(element, event);
    }, 50);
  }

  // 处理鼠标离开事件
  handleMouseOut(event) {
    if (!this.isActive) return;

    const element = this.findValidElement(event.target);
    if (!element) return;

    // 清除高亮定时器
    if (this.highlightTimeout) {
      clearTimeout(this.highlightTimeout);
    }

    // 延迟取消高亮，给用户时间移动到子元素
    setTimeout(() => {
      if (!element.matches(':hover')) {
        this.removeHighlight(element);
      }
    }, 50);
  }

  // 处理点击事件
  handleClick(event) {
    if (!this.isActive) return;
    
    const element = this.findValidElement(event.target);
    if (element && !this.shouldIgnoreElement(element)) {
      this.showElementInfo(element, event.pageX, event.pageY);
    }
  }

  // 查找有效的元素
  findValidElement(target) {
    let element = target;
    
    // 向上查找直到找到非忽略元素
    while (element && element !== document.body) {
      if (!this.shouldIgnoreElement(element)) {
        return element;
      }
      element = element.parentElement;
    }
    
    return null;
  }

  // 检查是否应该忽略元素
  shouldIgnoreElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return true;
    }

    const tagName = element.tagName?.toLowerCase();
    
    // 检查标签名
    for (const selector of this.ignoredSelectors) {
      if (selector.startsWith('.')) {
        if (element.classList.contains(selector.substring(1))) {
          return true;
        }
      } else if (selector.startsWith('#')) {
        if (element.id === selector.substring(1)) {
          return true;
        }
      } else if (selector.startsWith('[') && selector.endsWith(']')) {
        if (element.matches(selector)) {
          return true;
        }
      } else if (tagName === selector) {
        return true;
      }
    }

    // 检查父元素是否要求忽略子元素
    if (element.closest('[data-hover-ignore-children="true"]')) {
      return true;
    }

    // 检查是否是隐藏元素
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || 
        style.visibility === 'hidden' || 
        element.offsetWidth === 0 || 
        element.offsetHeight === 0) {
      return true;
    }

    // 检查文本内容是否过少
    const textContent = (element.textContent || '').trim();
    if (textContent.length === 0 && 
        !element.querySelector('img') && 
        !element.querySelector('video') && 
        !element.querySelector('svg')) {
      return true;
    }

    return false;
  }

  // 高亮元素
  highlightElement(element, event) {
    if (this.hoveredElement === element || this.activeHighlights.length >= this.maxHighlights) {
      return;
    }

    // 移除之前的高亮
    if (this.hoveredElement) {
      this.removeHighlight(this.hoveredElement);
    }

    // 确定高亮类型
    const highlightType = this.getHighlightType(element);
    const className = `hover-highlight-${highlightType}`;
    
    // 应用高亮
    element.classList.add('hover-highlight', className);
    
    // 设置工具提示
    const title = this.getElementTitle(element);
    if (title && element.classList.contains('hover-highlight-content')) {
      element.setAttribute('data-hover-title', title);
    }

    this.hoveredElement = element;
    this.activeHighlights.push({
      element,
      className,
      type: highlightType,
      timestamp: Date.now()
    });

    console.log(`高亮元素:`, {
      tagName: element.tagName.toLowerCase(),
      className: element.className,
      type: highlightType,
      text: this.getElementPreview(element)
    });
  }

  // 移除元素高亮
  removeHighlight(element) {
    element.classList.remove('hover-highlight');
    
    // 移除所有高亮相关类名
    const highlightClasses = Array.from(element.classList).filter(cls => 
      cls.startsWith('hover-highlight-')
    );
    highlightClasses.forEach(cls => element.classList.remove(cls));
    
    // 移除数据属性
    element.removeAttribute('data-hover-title');
    
    // 从活跃高亮列表中移除
    this.activeHighlights = this.activeHighlights.filter(h => h.element !== element);
    
    if (this.hoveredElement === element) {
      this.hoveredElement = null;
    }
  }

  // 清除所有高亮
  clearAllHighlights() {
    this.activeHighlights.forEach(highlight => {
      highlight.element.classList.remove('hover-highlight');
      const highlightClasses = Array.from(highlight.element.classList).filter(cls => 
        cls.startsWith('hover-highlight-')
      );
      highlightClasses.forEach(cls => highlight.element.classList.remove(cls));
      highlight.element.removeAttribute('data-hover-title');
    });
    this.activeHighlights = [];
    this.hoveredElement = null;
  }

  // 获取高亮类型
  getHighlightType(element) {
    const tagName = element.tagName?.toLowerCase();
    const className = element.className?.toLowerCase() || '';
    const id = element.id?.toLowerCase() || '';
    const hasText = (element.textContent || '').trim().length > 10;
    
    // 交互元素
    if (['button', 'a', 'input', 'select', 'textarea'].includes(tagName) ||
        element.matches('[onclick], [data-click], .clickable, .btn')) {
      return 'interactive';
    }
    
    // 内容区域
    if (['article', 'main', 'section', 'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName) &&
        (hasText || className.includes('content') || className.includes('text') ||
         id.includes('content') || id.includes('text') || id.includes('main'))) {
      return 'content';
    }
    
    // 文本元素
    if (['p', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th'].includes(tagName) &&
        hasText) {
      return 'text';
    }
    
    // 链接
    if (tagName === 'a' || element.matches('a[href]')) {
      return 'link';
    }
    
    // 媒体元素
    if (['img', 'video', 'audio', 'canvas', 'svg'].includes(tagName)) {
      return 'media';
    }
    
    // 容器元素
    if (['div', 'section', 'article', 'main', 'aside', 'header', 'footer', 'nav'].includes(tagName) &&
        element.children.length > 0) {
      return 'container';
    }
    
    // 默认为内容类型
    return 'content';
  }

  // 获取元素标题
  getElementTitle(element) {
    const tagName = element.tagName?.toLowerCase();
    const text = (element.textContent || '').trim();
    
    // 如果有alt或title属性，优先使用
    if (element.alt) {
      return `图片: ${element.alt}`;
    }
    if (element.title) {
      return element.title;
    }
    
    // 根据元素类型返回描述
    const typeDescriptions = {
      'a': '链接',
      'button': '按钮',
      'img': '图片',
      'video': '视频',
      'audio': '音频',
      'input': '输入框',
      'select': '选择框',
      'textarea': '文本域',
      'article': '文章',
      'section': '区域',
      'div': '容器',
      'p': '段落',
      'h1': '标题1',
      'h2': '标题2',
      'h3': '标题3',
      'h4': '标题4',
      'h5': '标题5',
      'h6': '标题6',
      'ul': '列表',
      'ol': '有序列表',
      'li': '列表项',
      'table': '表格',
      'form': '表单'
    };
    
    const description = typeDescriptions[tagName] || '元素';
    
    // 如果有可见文本，截取前20个字符
    if (text && text.length > 0) {
      const preview = text.length > 20 ? text.substring(0, 20) + '...' : text;
      return `${description}: ${preview}`;
    }
    
    return description;
  }

  // 获取元素预览文本
  getElementPreview(element) {
    const text = (element.textContent || '').trim();
    if (text.length > 0) {
      return text.length > 50 ? text.substring(0, 50) + '...' : text;
    }
    
    // 尝试获取其他有用的信息
    if (element.alt) return `图片: ${element.alt}`;
    if (element.title) return element.title;
    if (element.value) return element.value;
    if (element.placeholder) return element.placeholder;
    
    return element.tagName?.toLowerCase() || '未知元素';
  }

  // 显示元素信息
  showElementInfo(element, x, y) {
    console.log('元素详情:', {
      tagName: element.tagName.toLowerCase(),
      className: element.className,
      id: element.id,
      text: this.getElementPreview(element),
      attributes: Array.from(element.attributes).map(attr => ({
        name: attr.name,
        value: attr.value
      })),
      position: {
        x: element.getBoundingClientRect().left,
        y: element.getBoundingClientRect().top,
        width: element.offsetWidth,
        height: element.offsetHeight
      }
    });
  }

  // 显示状态指示器
  showStatus(message, type = 'info') {
    this.hideStatus();
    
    const status = document.createElement('div');
    status.className = `hover-highlight-status ${type}`;
    status.textContent = message;
    status.id = 'hover-highlight-status';
    
    document.body.appendChild(status);
    
    // 显示动画
    setTimeout(() => {
      status.classList.add('show');
    }, 10);
    
    // 3秒后自动隐藏
    setTimeout(() => {
      this.hideStatus();
    }, 3000);
  }

  // 隐藏状态指示器
  hideStatus() {
    const status = document.getElementById('hover-highlight-status');
    if (status) {
      status.remove();
    }
  }

  // 显示工具提示
  showTooltip(message) {
    if (document.getElementById('hover-highlight-tooltip')) {
      return;
    }
    
    const tooltip = document.createElement('div');
    tooltip.id = 'hover-highlight-tooltip';
    tooltip.className = 'hover-highlight-status';
    tooltip.style.top = '60px';
    tooltip.textContent = message;
    
    document.body.appendChild(tooltip);
    
    setTimeout(() => {
      tooltip.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      this.hideTooltip();
    }, 4000);
  }

  // 隐藏工具提示
  hideTooltip() {
    const tooltip = document.getElementById('hover-highlight-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  }

  // 刷新高亮
  refreshHighlighting() {
    if (!this.isActive) return;
    
    // 清除无效的高亮
    this.activeHighlights = this.activeHighlights.filter(highlight => {
      if (!document.contains(highlight.element)) {
        highlight.element.classList.remove('hover-highlight');
        const highlightClasses = Array.from(highlight.element.classList).filter(cls => 
          cls.startsWith('hover-highlight-')
        );
        highlightClasses.forEach(cls => highlight.element.classList.remove(cls));
        return false;
      }
      return true;
    });
  }

  // 清理资源
  cleanup() {
    this.deactivate();
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// 创建全局实例
let hoverHighlighter;

// DOM加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    hoverHighlighter = new HoverHighlighter();
  });
} else {
  hoverHighlighter = new HoverHighlighter();
}

// 导出到全局作用域（用于调试）
if (typeof window !== 'undefined') {
  window.HoverHighlighter = HoverHighlighter;
  window.hoverHighlighter = hoverHighlighter;
}