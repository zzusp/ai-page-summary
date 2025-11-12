# 选择器记录和路径生成实现文档

## 概述

本文档详细说明了Chrome扩展中实现的选择器记录和路径生成功能，该功能为网页内容提取提供了强大的元素选择和标识能力。

## 核心组件

### 1. SelectorRecorder类 (selector-recorder.js)

SelectorRecorder是核心选择器记录和路径生成器，负责：
- XPath和CSS选择器的智能生成
- 元素唯一标识符的创建和管理
- 选择状态的存储和读取
- 元素数据结构的定义和提取
- 选择元素的文本内容智能提取

## 主要功能模块

### 1. 选择器生成算法

#### 1.1 XPath选择器生成
```javascript
generateXPath(element)
```

**算法策略（按优先级排序）：**
1. **ID选择器**：如果元素有ID，直接使用`//*[@id="elementId"]`
2. **Class选择器**：寻找唯一class组合，使用`//*[contains(@class, "uniqueClass")]`
3. **父元素ID路径**：利用有ID的父元素生成相对路径
4. **属性选择器**：基于唯一属性生成`//*[uniqueAttr="value"]`
5. **递归路径生成**：最终后备方案，递归生成完整DOM路径

**示例：**
```javascript
// 元素: <div id="main"><p class="content">文本内容</p></div>
// 生成的XPath: //*[@id="main"]/p[1]
```

#### 1.2 CSS选择器生成
```javascript
generateCSSSelector(element)
```

**算法策略：**
1. **ID选择器**：#elementId
2. **唯一Class选择器**：.uniqueClass
3. **属性选择器**：[attr="value"]
4. **组合选择器**：tagName.className或tagName[attr="value"]

**示例：**
```javascript
// 元素: <button data-testid="submit-btn" class="btn primary">提交</button>
// 生成的CSS: button[data-testid="submit-btn"]
```

#### 1.3 递归XPath生成
```javascript
recursiveXPath(element)
```
- 当其他方法失败时使用的最终后备方案
- 递归遍历DOM树，从根节点到目标元素
- 处理兄弟元素时使用索引区分：`tagName[index]`

### 2. 元素唯一标识符生成

#### 2.1 标识符生成流程
```javascript
generateElementIdentifier(element) → createUniqueIdentifier(element)
```

**生成策略：**
- 格式：`elem_{elementType}_{timestamp}_{randomString}`
- 元素类型基于：标签名、ID、class、唯一属性组合
- 确保全局唯一性

**示例：**
```javascript
// 生成标识符: elem_div_id_main_content_1640995200000_a1b2c3d4e
```

#### 2.2 元素签名信息
```javascript
getElementSignature(element)
```
```javascript
{
  type: "div_id_main_content",
  tagName: "div",
  attributes: { "data-testid": "main-content" },
  position: { x: 100, y: 200, width: 300, height: 150 }
}
```

### 3. 选择状态存储和读取

#### 3.1 存储结构
```javascript
{
  identifier: "elem_div_id_main_1640995200000_random",
  element: HTMLElement,
  state: "selected", // 'selected', 'deselected', 'highlighted'
  timestamp: 1640995200000,
  elementInfo: { /* 完整元素信息 */ },
  selectors: {
    xpath: "//*[@id='main']",
    css: "#main",
    full: [ /* 多种选择器策略 */ ]
  },
  content: { /* 提取的内容数据 */ }
}
```

#### 3.2 存储管理
- **WeakMap**：存储元素与标识符的映射关系
- **Map**：存储完整选择状态数据
- **自动清理**：超过最大数量时清理最旧的选择器

### 4. 元素数据结构定义

#### 4.1 完整元素信息
```javascript
extractElementInfo(element)
```

**数据结构：**
```javascript
{
  tagName: "div",
  id: "main-content",
  className: "container wrapper",
  classList: ["container", "wrapper"],
  attributes: { "data-testid": "main", "role": "main" },
  computedStyle: {
    display: "block",
    position: "relative",
    // ... 更多样式
  },
  position: { x: 100, y: 200, width: 300, height: 150 },
  textContent: "提取的文本内容",
  innerHTML: "<p>内部HTML内容</p>",
  outerHTML: "完整元素HTML",
  parentInfo: {
    tagName: "body",
    id: null,
    className: "page",
    level: 2
  },
  childrenCount: 5,
  hasChildren: true,
  isVisible: true,
  isInteractive: false
}
```

#### 4.2 位置信息
```javascript
getElementPosition(element)
```
```javascript
{
  x: 100,          // 相对于文档的X坐标
  y: 200,          // 相对于文档的Y坐标
  width: 300,      // 元素宽度
  height: 150,     // 元素高度
  viewportX: 100,  // 相对于视口的X坐标
  viewportY: 200   // 相对于视口的Y坐标
}
```

### 5. 选择元素的文本内容提取

#### 5.1 内容提取策略
```javascript
extractElementContent(element)
```

**提取优先级：**
1. **文本内容**：直接获取`textContent`
2. **图片元素**：获取`alt`或`title`属性
3. **表单元素**：获取`placeholder`属性
4. **属性值**：获取`value`或`title`属性
5. **最终后备**：标签名描述

#### 5.2 结构化内容提取
```javascript
extractStructuredContent(element)
```

**提取类型：**
- **标题**：h1-h6元素
- **段落**：p元素
- **列表**：ul、ol元素及其子项
- **链接**：a元素及其href和文本
- **图片**：img元素及其src和alt
- **表格**：table元素及其行列结构

**示例：**
```javascript
{
  headings: [
    { level: 1, text: "主标题", element: <h1> },
    { level: 2, text: "副标题", element: <h2> }
  ],
  paragraphs: [
    { text: "段落内容", element: <p> }
  ],
  lists: [
    { type: "ul", items: ["列表项1", "列表项2"], element: <ul> }
  ],
  links: [
    { text: "链接文本", href: "https://example.com", element: <a> }
  ],
  images: [
    { alt: "图片描述", src: "image.jpg", element: <img> }
  ],
  tables: [
    { 
      rows: [
        [{ text: "单元格1" }, { text: "单元格2" }],
        [{ text: "单元格3" }, { text: "单元格4" }]
      ],
      element: <table>
    }
  ]
}
```

#### 5.3 内容元数据
```javascript
extractContentMetadata(element)
```

**元数据包含：**
- 词数统计
- 字符数统计
- 链接数量
- 图片数量
- 标题层级信息
- 语言信息
- 编码信息

## 集成到ContentExtractor

### 1. 在ContentExtractor中集成SelectorRecorder

```javascript
class ContentExtractor {
  constructor() {
    this.selectorRecorder = new SelectorRecorder();
    // 其他初始化代码...
  }
}
```

### 2. 增强元素数据提取

```javascript
extractElementData(element) {
  const baseData = {
    // 基础元素数据
    id: this.getElementId(element),
    tagName: element.tagName?.toLowerCase(),
    // ...
  };
  
  // 添加选择器信息
  const selectorId = this.selectorRecorder.storeSelectionState(element, 'selected');
  baseData.selectors = this.selectorRecorder.getSelectionState(selectorId)?.selectors;
  baseData.elementInfo = this.selectorRecorder.extractElementInfo(element);
  baseData.contentData = this.selectorRecorder.extractElementContent(element);
  
  return baseData;
}
```

### 3. 消息处理扩展

```javascript
// 新增选择器相关消息处理
case 'getSelectorData':
  this.getSelectorData(message.selectorId).then(data => {
    sendResponse({ success: true, data: data });
  });
  break;

case 'getAllSelectorStates':
  const allStates = this.selectorRecorder.getAllSelectionStates();
  sendResponse({ success: true, states: allStates });
  break;

case 'generateSelectors':
  const selectors = this.generateSelectorsForElement(message.element);
  sendResponse({ success: true, selectors: selectors });
  break;
```

## 使用示例

### 1. 生成元素选择器
```javascript
// 获取页面元素
const element = document.querySelector('#main-content');

// 生成各种选择器
const xpath = selectorRecorder.generateXPath(element);
const css = selectorRecorder.generateCSSSelector(element);
const full = selectorRecorder.generateFullSelector(element);

console.log('XPath:', xpath);        // //*[@id="main-content"]
console.log('CSS:', css);           // #main-content
console.log('Full:', full);         // [{type: 'css', value: '#main-content', priority: 2}]
```

### 2. 存储和读取选择状态
```javascript
// 存储选择状态
const element = document.querySelector('.article');
const selectorId = selectorRecorder.storeSelectionState(element, 'selected');

// 读取选择状态
const state = selectorRecorder.getSelectionState(selectorId);
console.log('选择状态:', state);
```

### 3. 提取元素内容
```javascript
const element = document.querySelector('.content');
const content = selectorRecorder.extractElementContent(element);

console.log('文本内容:', content.text);
console.log('结构化内容:', content.structured);
console.log('元数据:', content.metadata);
```

## 性能优化

### 1. 选择器生成优化
- **优先级策略**：优先使用最精确、最短的选择器
- **缓存机制**：避免重复生成相同元素的选择器
- **智能回退**：多级回退策略确保总是能生成可用的选择器

### 2. 内存管理
- **WeakMap使用**：避免内存泄漏
- **自动清理**：定期清理过期的选择器状态
- **限制数量**：设置最大选择器数量防止内存溢出

### 3. 文本提取优化
- **智能解析**：根据元素类型使用不同的文本提取策略
- **结构化处理**：分类提取不同类型的内容
- **清理机制**：自动清理和格式化提取的文本

## 错误处理

### 1. 选择器生成失败
```javascript
try {
  const xpath = selectorRecorder.generateXPath(element);
} catch (error) {
  console.warn('XPath生成失败，使用备用方案:', error);
  return `//${element.tagName.toLowerCase()}`;
}
```

### 2. 元素查找失败
```javascript
// 尝试多种选择器策略
for (const selector of fullSelectors) {
  try {
    const found = document.querySelector(selector.value);
    if (found) return found;
  } catch (error) {
    console.warn('选择器失败:', selector, error);
  }
}
```

## 扩展性设计

### 1. 插件式选择器
```javascript
// 支持自定义选择器生成器
SelectorRecorder.prototype.addCustomSelector = function(name, generator) {
  this.customSelectors[name] = generator;
};
```

### 2. 多语言支持
```javascript
// 支持不同语言的内容提取
extractContentWithLanguage(element, language = 'zh') {
  // 根据语言选择不同的文本提取策略
}
```

### 3. 主题识别
```javascript
// 根据网站主题调整选择器策略
adjustStrategyForTheme(theme) {
  switch (theme) {
    case 'react':
      this.useReactSpecificSelectors();
      break;
    case 'vue':
      this.useVueSpecificSelectors();
      break;
  }
}
```

## 总结

选择器记录和路径生成功能为Chrome扩展提供了强大的元素选择和标识能力，主要特点包括：

1. **多策略选择器生成**：XPath、CSS、组合选择器等多种策略
2. **智能标识符生成**：基于元素特征的全局唯一标识
3. **完整状态管理**：存储、读取、清理选择状态的完整流程
4. **丰富数据提取**：结构化内容、元数据、子元素等全面信息
5. **性能优化设计**：缓存、清理、限制等内存和性能优化
6. **强扩展性**：支持自定义选择器、多语言、主题识别等扩展

该实现为网页内容提取和分析提供了坚实的技术基础，能够应对各种复杂的网页结构和选择需求。
