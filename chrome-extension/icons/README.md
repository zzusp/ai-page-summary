# 扩展图标文件说明

本目录包含Chrome扩展所需的各种尺寸图标文件。

## 图标规格

- **icon16.png** - 16x16px，工具栏显示用
- **icon32.png** - 32x32px，扩展管理页面用
- **icon48.png** - 48x48px，扩展列表显示用
- **icon128.png** - 128x128px，Chrome Web Store显示用

## 图标设计

图标采用了现代扁平化设计风格，主要元素包括：
- 渐变背景 (蓝色到紫色)
- AI大脑图形
- 神经网络节点
- 页面文档图标

## 图标生成

由于版权和复杂性考虑，建议使用以下工具生成所需尺寸的图标：

1. **在线工具**：
   - Canva (https://www.canva.com/)
   - Favicon.io (https://favicon.io/)
   - RealFaviconGenerator (https://realfavicongenerator.net/)

2. **本地工具**：
   - GIMP
   - Photoshop
   - Figma

## SVG源文件

`icon.svg` 文件包含了完整的矢量图形，可以作为图标生成的基础。

### 使用方法：
1. 打开 SVG 文件
2. 导出为 PNG 格式
3. 调整到所需尺寸
4. 保存为对应文件名

## 替换方法

如果需要使用自定义图标：
1. 准备四种尺寸的 PNG 文件
2. 将文件放入本目录
3. 更新 manifest.json 中的图标引用
4. 重新加载扩展

## 注意事项

- 图标文件必须是 PNG 格式
- 保持图标风格的一致性
- 确保在深色和浅色主题下都清晰可见
- 图标内容应与扩展功能相关