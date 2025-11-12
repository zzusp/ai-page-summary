/**
 * 选择器记录和路径生成器类
 * 负责元素的XPath和CSS选择器生成、元素唯一标识符生成、选择状态存储等功能
 */
class SelectorRecorder {
  constructor() {
    this.selectors = new Map(); // 存储元素选择器
    this.identifiers = new WeakMap(); // 元素唯一标识符
    this.selectionStates = new Map(); // 选择状态存储
    this.maxSelectorsPerPage = 1000; // 每页最大选择器数量
    this.init();
  }

  // 初始化
  init() {
    console.log('SelectorRecorder initialized');
  }

  // ==================== 选择器生成算法 ====================
  
  /**
   * 生成XPath选择器
   * @param {HTMLElement} element - 目标元素
   * @returns {string} XPath选择器字符串
   */
  generateXPath(element) {
    if (!element || !element.tagName) {
      return '';
    }

    try {
      // 优先级1: 元素有ID，使用ID优先
      if (element.id) {
        return `//*[@id="${element.id}"]`;
      }

      // 优先级2: 元素有唯一的class组合
      const classSelector = this.getUniqueClassSelector(element);
      if (classSelector) {
        return `//*[contains(@class, "${classSelector}")]`;
      }

      // 优先级3: 父元素有ID的情况
      const parentWithId = this.getParentWithId(element);
      if (parentWithId) {
        const relativePath = this.getRelativeXPath(element, parentWithId);
        return `//*[@id="${parentWithId.id}"]${relativePath}`;
      }

      // 优先级4: 使用属性选择器
      const attrSelector = this.getAttributeSelector(element);
      if (attrSelector) {
        return `//*[${attrSelector}]`;
      }

      // 优先级5: 递归生成路径（最终后备方案）
      return this.recursiveXPath(element);

    } catch (error) {
      console.warn('XPath生成失败:', error);
      return `//${element.tagName.toLowerCase()}`;
    }
  }

  /**
   * 生成CSS选择器
   * @param {HTMLElement} element - 目标元素
   * @returns {string} CSS选择器字符串
   */
  generateCSSSelector(element) {
    if (!element || !element.tagName) {
      return '';
    }

    try {
      // 优先级1: 元素有ID，ID选择器最精确
      if (element.id) {
        return `#${element.id}`;
      }

      // 优先级2: 唯一的class选择器
      const uniqueClass = this.getUniqueClassSelector(element);
      if (uniqueClass) {
        return `.${uniqueClass}`;
      }

      // 优先级3: 属性选择器
      const attrSelector = this.getAttributeSelector(element, 'css');
      if (attrSelector) {
        return attrSelector;
      }

      // 优先级4: 组合选择器
      return this.generateCompoundSelector(element);

    } catch (error) {
      console.warn('CSS选择器生成失败:', error);
      return element.tagName.toLowerCase();
    }
  }

  /**
   * 递归生成XPath路径
   * @param {HTMLElement} element - 目标元素
   * @returns {string} 递归XPath路径
   */
  recursiveXPath(element) {
    if (!element || !element.parentNode || element.parentNode.tagName === 'HTML') {
      return `//${element.tagName.toLowerCase()}`;
    }

    const parent = element.parentNode;
    const siblings = Array.from(parent.children).filter(
      child => child.tagName === element.tagName
    );

    // 如果没有兄弟元素，直接使用标签名
    if (siblings.length === 1) {
      return this.recursiveXPath(parent) + `/${element.tagName.toLowerCase()}`;
    }

    // 有兄弟元素，需要区分索引
    const index = siblings.indexOf(element) + 1;
    return this.recursiveXPath(parent) + 
           `/${element.tagName.toLowerCase()}[${index}]`;
  }

  /**
   * 获取唯一的class选择器
   * @param {HTMLElement} element - 目标元素
   * @returns {string|null} 唯一的class选择器
   */
  getUniqueClassSelector(element) {
    const classes = element.className?.split(' ').filter(cls => cls.trim());
    if (!classes || classes.length === 0) return null;

    // 尝试单独的class
    for (const className of classes) {
      if (this.isUniqueClass(className, element)) {
        return className;
      }
    }

    // 尝试class组合
    for (let i = 1; i < Math.min(classes.length, 4); i++) {
      const combinations = this.getClassCombinations(classes, i);
      for (const combo of combinations) {
        if (this.isUniqueClass(combo, element, true)) {
          return combo;
        }
      }
    }

    return null;
  }

  /**
   * 检查class是否在页面中唯一
   * @param {string} className - class名称
   * @param {HTMLElement} element - 目标元素
   * @param {boolean} isCombination - 是否为组合class
   * @returns {boolean} 是否唯一
   */
  isUniqueClass(className, element, isCombination = false) {
    try {
      const selector = isCombination 
        ? `.${className.split(' ').join('.')}`
        : `.${className}`;
      
      const matches = document.querySelectorAll(selector);
      return matches.length === 1 && matches[0] === element;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取class的组合
   * @param {string[]} classes - class数组
   * @param {number} size - 组合大小
   * @returns {string[]} class组合数组
   */
  getClassCombinations(classes, size) {
    const combinations = [];
    const visited = new Set();

    const backtrack = (start, current) => {
      if (current.length === size) {
        combinations.push([...current].join(' '));
        return;
      }

      for (let i = start; i < classes.length; i++) {
        if (!visited.has(i)) {
          visited.add(i);
          current.push(classes[i]);
          backtrack(i + 1, current);
          current.pop();
          visited.delete(i);
        }
      }
    };

    backtrack(0, []);
    return combinations;
  }

  /**
   * 获取属性选择器
   * @param {HTMLElement} element - 目标元素
   * @param {string} type - 选择器类型（'xpath' 或 'css'）
   * @returns {string|null} 属性选择器字符串
   */
  getAttributeSelector(element, type = 'xpath') {
    const attributes = ['data-testid', 'data-test', 'data-cy', 'name', 'value', 'type'];
    
    for (const attr of attributes) {
      const value = element.getAttribute(attr);
      if (value && this.isUniqueAttribute(attr, value, element)) {
        if (type === 'xpath') {
          return `@${attr}="${value}"`;
        } else {
          return `[${attr}="${value}"]`;
        }
      }
    }

    return null;
  }

  /**
   * 检查属性在页面中是否唯一
   * @param {string} attr - 属性名
   * @param {string} value - 属性值
   * @param {HTMLElement} element - 目标元素
   * @returns {boolean} 是否唯一
   */
  isUniqueAttribute(attr, value, element) {
    try {
      const selector = `[${attr}="${value}"]`;
      const matches = document.querySelectorAll(selector);
      return matches.length === 1 && matches[0] === element;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取有ID的父元素
   * @param {HTMLElement} element - 目标元素
   * @returns {HTMLElement|null} 有ID的父元素
   */
  getParentWithId(element) {
    let parent = element.parentNode;
    while (parent && parent.tagName !== 'HTML') {
      if (parent.id) {
        return parent;
      }
      parent = parent.parentNode;
    }
    return null;
  }

  /**
   * 获取相对XPath路径
   * @param {HTMLElement} element - 目标元素
   * @param {HTMLElement} ancestor - 祖先元素
   * @returns {string} 相对路径
   */
  getRelativeXPath(element, ancestor) {
    let path = '';
    let current = element;
    
    while (current && current !== ancestor) {
      const siblings = Array.from(current.parentNode.children)
        .filter(child => child.tagName === current.tagName);
      
      if (siblings.length === 1) {
        path = `/${current.tagName.toLowerCase()}${path}`;
      } else {
        const index = siblings.indexOf(current) + 1;
        path = `/${current.tagName.toLowerCase()}[${index}]${path}`;
      }
      
      current = current.parentNode;
    }
    
    return path;
  }

  /**
   * 生成组合选择器
   * @param {HTMLElement} element - 目标元素
   * @returns {string} 组合选择器
   */
  generateCompoundSelector(element) {
    const selectors = [];
    
    // 标签名
    selectors.push(element.tagName.toLowerCase());
    
    // ID选择器
    if (element.id) {
      selectors.push(`#${element.id}`);
      return selectors.join('');
    }
    
    // Class选择器
    const classes = element.className?.split(' ').filter(cls => cls.trim());
    if (classes && classes.length > 0) {
      // 选择最长的class
      const longestClass = classes.reduce((a, b) => a.length > b.length ? a : b);
      selectors.push(`.${longestClass}`);
    }
    
    // 属性选择器
    const attrSelector = this.getAttributeSelector(element, 'css');
    if (attrSelector) {
      selectors.push(attrSelector);
    }
    
    // 伪类选择器增强唯一性
    const pseudoClass = this.getUniquePseudoClass(element);
    if (pseudoClass) {
      selectors.push(`:${pseudoClass}`);
    }
    
    return selectors.join('');
  }

  /**
   * 获取唯一伪类选择器
   * @param {HTMLElement} element - 目标元素
   * @returns {string|null} 伪类选择器
   */
  getUniquePseudoClass(element) {
    const parent = element.parentNode;
    if (!parent) return null;
    
    const siblings = Array.from(parent.children);
    const sameTagSiblings = siblings.filter(s => s.tagName === element.tagName);
    
    if (sameTagSiblings.length > 1) {
      const index = sameTagSiblings.indexOf(element);
      if (index === 0) return 'first-of-type';
      if (index === sameTagSiblings.length - 1) return 'last-of-type';
      return `nth-of-type(${index + 1})`;
    }
    
    return null;
  }

  // ==================== 元素唯一标识符生成 ====================
  
  /**
   * 生成元素唯一标识符
   * @param {HTMLElement} element - 目标元素
   * @returns {string|null} 唯一标识符
   */
  generateElementIdentifier(element) {
    if (!element) return null;
    
    // 如果已经为该元素生成过标识符，直接返回
    if (this.identifiers.has(element)) {
      return this.identifiers.get(element);
    }
    
    const identifier = this.createUniqueIdentifier(element);
    this.identifiers.set(element, identifier);
    
    return identifier;
  }

  /**
   * 创建唯一标识符
   * @param {HTMLElement} element - 目标元素
   * @returns {string} 唯一标识符
   */
  createUniqueIdentifier(element) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const elementInfo = this.getElementSignature(element);
    
    return `elem_${elementInfo.type}_${timestamp}_${random}`;
  }

  /**
   * 获取元素签名信息
   * @param {HTMLElement} element - 目标元素
   * @returns {Object} 元素签名信息
   */
  getElementSignature(element) {
    const tagName = element.tagName?.toLowerCase() || 'unknown';
    const id = element.id ? `id_${element.id}` : '';
    const classInfo = element.className ? 
      `class_${element.className.split(' ').join('_')}` : '';
    const attributes = this.getUniqueAttributes(element);
    
    const type = [tagName, id, classInfo, ...Object.keys(attributes)]
      .filter(Boolean).join('_');
    
    return {
      type: type || tagName,
      tagName,
      attributes: this.getUniqueAttributes(element),
      position: this.getElementPosition(element)
    };
  }

  /**
   * 获取元素唯一属性
   * @param {HTMLElement} element - 目标元素
   * @returns {Object} 唯一属性集合
   */
  getUniqueAttributes(element) {
    const uniqueAttrs = {};
    const importantAttrs = ['data-testid', 'data-test', 'data-cy', 'name', 'role', 'aria-label'];
    
    for (const attr of importantAttrs) {
      const value = element.getAttribute(attr);
      if (value && this.isAttributeUnique(attr, value, element)) {
        uniqueAttrs[attr] = value;
      }
    }
    
    return uniqueAttrs;
  }

  /**
   * 检查属性在页面中是否唯一
   * @param {string} attr - 属性名
   * @param {string} value - 属性值
   * @param {HTMLElement} element - 目标元素
   * @returns {boolean} 是否唯一
   */
  isAttributeUnique(attr, value, element) {
    const selector = `[${attr}="${value}"]`;
    try {
      const matches = document.querySelectorAll(selector);
      return matches.length === 1 && matches[0] === element;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取元素在页面中的位置信息
   * @param {HTMLElement} element - 目标元素
   * @returns {Object} 位置信息
   */
  getElementPosition(element) {
    const rect = element.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    
    return {
      x: rect.left + scrollX,
      y: rect.top + scrollY,
      width: rect.width,
      height: rect.height,
      viewportX: rect.left,
      viewportY: rect.top
    };
  }

  // ==================== 选择状态存储和读取 ====================
  
  /**
   * 存储元素选择状态
   * @param {HTMLElement} element - 目标元素
   * @param {string} state - 选择状态 ('selected', 'deselected', 'highlighted')
   * @returns {string|false} 选择器ID或失败返回false
   */
  storeSelectionState(element, state) {
    if (!element) return false;
    
    const identifier = this.generateElementIdentifier(element);
    if (!identifier) return false;
    
    const selectionData = {
      identifier: identifier,
      element: element,
      state: state,
      timestamp: Date.now(),
      elementInfo: this.extractElementInfo(element),
      selectors: {
        xpath: this.generateXPath(element),
        css: this.generateCSSSelector(element),
        full: this.generateFullSelector(element)
      },
      content: this.extractElementContent(element)
    };
    
    this.selectionStates.set(identifier, selectionData);
    this.cleanupOldSelections(); // 清理旧的选择器
    
    return identifier;
  }

  /**
   * 读取元素选择状态
   * @param {string} identifier - 选择器ID
   * @returns {Object|null} 选择状态数据
   */
  getSelectionState(identifier) {
    return this.selectionStates.get(identifier);
  }

  /**
   * 获取所有选择状态
   * @returns {Array} 所有选择状态数组
   */
  getAllSelectionStates() {
    return Array.from(this.selectionStates.values());
  }

  /**
   * 通过元素获取选择状态
   * @param {HTMLElement} element - 目标元素
   * @returns {Object|null} 选择状态数据
   */
  getSelectionStateByElement(element) {
    const identifier = this.identifiers.get(element);
    if (identifier) {
      return this.getSelectionState(identifier);
    }
    return null;
  }

  /**
   * 移除选择状态
   * @param {string} identifier - 选择器ID
   */
  removeSelectionState(identifier) {
    const state = this.selectionStates.get(identifier);
    if (state) {
      this.selectionStates.delete(identifier);
      this.identifiers.delete(state.element);
    }
  }

  /**
   * 清理旧的选择器
   */
  cleanupOldSelections() {
    if (this.selectionStates.size <= this.maxSelectorsPerPage) {
      return;
    }
    
    const states = Array.from(this.selectionStates.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp); // 按时间排序
    
    const toRemove = states.slice(0, this.selectionStates.size - this.maxSelectorsPerPage);
    toRemove.forEach(([identifier]) => {
      this.removeSelectionState(identifier);
    });
  }

  /**
   * 生成完整选择器（包含多种策略）
   * @param {HTMLElement} element - 目标元素
   * @returns {Array} 按优先级排序的选择器数组
   */
  generateFullSelector(element) {
    const selectors = [];
    
    // 尝试不同的选择器策略
    const xpath = this.generateXPath(element);
    const css = this.generateCSSSelector(element);
    
    if (xpath) selectors.push({ type: 'xpath', value: xpath, priority: 1 });
    if (css) selectors.push({ type: 'css', value: css, priority: 2 });
    
    // 添加备用选择器
    const fallbackSelectors = this.generateFallbackSelectors(element);
    selectors.push(...fallbackSelectors);
    
    // 按优先级排序
    return selectors.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 生成备用选择器
   * @param {HTMLElement} element - 目标元素
   * @returns {Array} 备用选择器数组
   */
  generateFallbackSelectors(element) {
    const fallbacks = [];
    const tagName = element.tagName?.toLowerCase();
    
    if (tagName) {
      // 基础标签选择器
      fallbacks.push({ type: 'tag', value: tagName, priority: 10 });
      
      // 带索引的标签选择器
      const siblings = Array.from(element.parentNode?.children || [])
        .filter(child => child.tagName === element.tagName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(element) + 1;
        fallbacks.push({ 
          type: 'tag-index', 
          value: `${tagName}:nth-of-type(${index})`, 
          priority: 9 
        });
      }
    }
    
    return fallbacks;
  }

  // ==================== 元素数据结构定义 ====================
  
  /**
   * 提取元素完整信息
   * @param {HTMLElement} element - 目标元素
   * @returns {Object} 元素完整信息
   */
  extractElementInfo(element) {
    if (!element) return null;
    
    return {
      tagName: element.tagName?.toLowerCase(),
      id: element.id || null,
      className: element.className || '',
      classList: Array.from(element.classList || []),
      attributes: this.getAllAttributes(element),
      computedStyle: this.getRelevantComputedStyles(element),
      position: this.getElementPosition(element),
      textContent: this.getElementText(element),
      innerHTML: element.innerHTML?.substring(0, 200) || '',
      outerHTML: element.outerHTML?.substring(0, 500) || '',
      parentInfo: this.getParentElementInfo(element),
      childrenCount: element.children?.length || 0,
      hasChildren: element.children?.length > 0,
      isVisible: this.isElementVisible(element),
      isInteractive: this.isInteractiveElement(element)
    };
  }

  /**
   * 获取所有属性
   * @param {HTMLElement} element - 目标元素
   * @returns {Object} 属性集合
   */
  getAllAttributes(element) {
    const attributes = {};
    if (!element.attributes) return attributes;
    
    Array.from(element.attributes).forEach(attr => {
      attributes[attr.name] = attr.value;
    });
    
    return attributes;
  }

  /**
   * 获取相关计算样式
   * @param {HTMLElement} element - 目标元素
   * @returns {Object} 样式对象
   */
  getRelevantComputedStyles(element) {
    const style = window.getComputedStyle(element);
    const relevantProps = [
      'display', 'visibility', 'opacity', 'position', 'top', 'left', 
      'width', 'height', 'backgroundColor', 'color', 'fontSize',
      'fontWeight', 'textAlign', 'padding', 'margin', 'border'
    ];
    
    const computedStyle = {};
    relevantProps.forEach(prop => {
      computedStyle[prop] = style.getPropertyValue(prop);
    });
    
    return computedStyle;
  }

  /**
   * 获取父元素信息
   * @param {HTMLElement} element - 目标元素
   * @returns {Object|null} 父元素信息
   */
  getParentElementInfo(element) {
    const parent = element.parentElement;
    if (!parent) return null;
    
    return {
      tagName: parent.tagName?.toLowerCase(),
      id: parent.id || null,
      className: parent.className || '',
      level: this.getElementLevel(element, document.body)
    };
  }

  /**
   * 获取元素层级
   * @param {HTMLElement} element - 目标元素
   * @param {HTMLElement} root - 根元素
   * @returns {number} 层级数
   */
  getElementLevel(element, root) {
    let level = 0;
    let current = element;
    
    while (current && current !== root) {
      current = current.parentElement;
      level++;
    }
    
    return level;
  }

  /**
   * 检查元素是否可见
   * @param {HTMLElement} element - 目标元素
   * @returns {boolean} 是否可见
   */
  isElementVisible(element) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           element.offsetWidth > 0 && 
           element.offsetHeight > 0;
  }

  /**
   * 检查元素是否可交互
   * @param {HTMLElement} element - 目标元素
   * @returns {boolean} 是否可交互
   */
  isInteractiveElement(element) {
    const interactiveTags = ['a', 'button', 'input', 'select', 'textarea'];
    const interactiveAttrs = ['onclick', 'onmousedown', 'onmouseup', 'onkeydown', 'onkeyup'];
    
    const tagName = element.tagName?.toLowerCase();
    if (interactiveTags.includes(tagName)) {
      return true;
    }
    
    return interactiveAttrs.some(attr => element.hasAttribute(attr));
  }

  // ==================== 选择元素的文本内容提取 ====================
  
  /**
   * 提取元素内容
   * @param {HTMLElement} element - 目标元素
   * @returns {Object} 元素内容对象
   */
  extractElementContent(element) {
    if (!element) return '';
    
    const content = {
      text: this.getElementText(element),
      html: this.getElementHTML(element),
      structured: this.extractStructuredContent(element),
      metadata: this.extractContentMetadata(element),
      children: this.extractChildrenContent(element)
    };
    
    return content;
  }

  /**
   * 获取元素文本内容
   * @param {HTMLElement} element - 目标元素
   * @returns {string} 文本内容
   */
  getElementText(element) {
    // 优先获取有意义的文本
    const textContent = element.textContent?.trim();
    if (textContent && textContent.length > 0) {
      return this.cleanExtractedText(textContent);
    }
    
    // 获取alt属性（图片元素）
    if (element.tagName?.toLowerCase() === 'img') {
      return element.getAttribute('alt') || element.getAttribute('title') || '';
    }
    
    // 获取placeholder（表单元素）
    if (['input', 'textarea'].includes(element.tagName?.toLowerCase())) {
      return element.getAttribute('placeholder') || '';
    }
    
    // 获取value属性
    if (element.hasAttribute('value')) {
      return element.getAttribute('value');
    }
    
    // 获取title属性
    if (element.hasAttribute('title')) {
      return element.getAttribute('title');
    }
    
    return '';
  }

  /**
   * 获取元素HTML内容
   * @param {HTMLElement} element - 目标元素
   * @returns {string} HTML内容
   */
  getElementHTML(element) {
    try {
      return element.innerHTML?.trim() || '';
    } catch (error) {
      console.warn('获取元素HTML失败:', error);
      return '';
    }
  }

  /**
   * 提取结构化内容
   * @param {HTMLElement} element - 目标元素
   * @returns {Object} 结构化内容
   */
  extractStructuredContent(element) {
    const structured = {
      headings: [],
      paragraphs: [],
      lists: [],
      links: [],
      images: [],
      tables: []
    };
    
    // 递归提取结构化元素
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          const tagName = node.tagName?.toLowerCase();
          if (['script', 'style', 'nav', 'header', 'footer', 'aside'].includes(tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    
    let node;
    while (node = walker.nextNode()) {
      const tagName = node.tagName?.toLowerCase();
      const text = node.textContent?.trim();
      
      if (text && text.length > 0) {
        switch (tagName) {
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
            structured.headings.push({
              level: parseInt(tagName.charAt(1)),
              text: text,
              element: node
            });
            break;
          case 'p':
            structured.paragraphs.push({
              text: text,
              element: node
            });
            break;
          case 'ul':
          case 'ol':
            const listItems = Array.from(node.querySelectorAll('li'))
              .map(li => li.textContent?.trim())
              .filter(Boolean);
            structured.lists.push({
              type: tagName,
              items: listItems,
              element: node
            });
            break;
          case 'a':
            structured.links.push({
              text: text,
              href: node.href || node.getAttribute('href'),
              element: node
            });
            break;
          case 'img':
            structured.images.push({
              alt: node.getAttribute('alt') || '',
              src: node.src || node.getAttribute('src'),
              element: node
            });
            break;
          case 'table':
            structured.tables.push({
              rows: this.extractTableContent(node),
              element: node
            });
            break;
        }
      }
    }
    
    return structured;
  }

  /**
   * 提取表格内容
   * @param {HTMLElement} table - 表格元素
   * @returns {Array} 表格行数据
   */
  extractTableContent(table) {
    const rows = [];
    const tableRows = table.querySelectorAll('tr');
    
    tableRows.forEach(row => {
      const cells = Array.from(row.children).map(cell => {
        return {
          text: cell.textContent?.trim(),
          tagName: cell.tagName?.toLowerCase(),
          colspan: cell.getAttribute('colspan') || 1,
          rowspan: cell.getAttribute('rowspan') || 1
        };
      });
      
      if (cells.length > 0) {
        rows.push(cells);
      }
    });
    
    return rows;
  }

  /**
   * 提取内容元数据
   * @param {HTMLElement} element - 目标元素
   * @returns {Object} 内容元数据
   */
  extractContentMetadata(element) {
    return {
      wordCount: this.getWordCount(element),
      charCount: this.getCharCount(element),
      linkCount: element.querySelectorAll('a').length,
      imageCount: element.querySelectorAll('img').length,
      headingLevels: this.getHeadingLevels(element),
      language: element.getAttribute('lang') || document.documentElement.lang || 'unknown',
      encoding: document.characterSet
    };
  }

  /**
   * 提取子元素内容
   * @param {HTMLElement} element - 目标元素
   * @returns {Array} 子元素信息数组
   */
  extractChildrenContent(element) {
    const children = [];
    const childElements = Array.from(element.children);
    
    childElements.forEach((child, index) => {
      children.push({
        index: index,
        tagName: child.tagName?.toLowerCase(),
        id: child.id || null,
        className: child.className || '',
        text: child.textContent?.trim() || '',
        isVisible: this.isElementVisible(child),
        isInteractive: this.isInteractiveElement(child)
      });
    });
    
    return children;
  }

  /**
   * 获取词数
   * @param {HTMLElement} element - 目标元素
   * @returns {number} 词数
   */
  getWordCount(element) {
    const text = element.textContent || '';
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * 获取字符数
   * @param {HTMLElement} element - 目标元素
   * @returns {number} 字符数
   */
  getCharCount(element) {
    return (element.textContent || '').length;
  }

  /**
   * 获取标题层级
   * @param {HTMLElement} element - 目标元素
   * @returns {Array} 标题信息数组
   */
  getHeadingLevels(element) {
    const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
    return Array.from(headings).map(heading => {
      return {
        level: parseInt(heading.tagName.charAt(1)),
        text: heading.textContent?.trim() || ''
      };
    });
  }

  /**
   * 清理提取的文本
   * @param {string} text - 原始文本
   * @returns {string} 清理后的文本
   */
  cleanExtractedText(text) {
    if (!text) return '';
    
    return text
      .replace(/\s+/g, ' ') // 合并多个空白字符
      .replace(/[\r\n]+/g, '\n') // 统一换行符
      .trim();
  }
}

// 在浏览器环境中导出
if (typeof window !== 'undefined') {
  window.SelectorRecorder = SelectorRecorder;
}

// 在Node.js环境中导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SelectorRecorder;
}
