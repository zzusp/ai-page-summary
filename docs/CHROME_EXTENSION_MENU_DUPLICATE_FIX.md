# Chrome扩展重复菜单项错误修复报告

## 问题描述

用户遇到了Chrome扩展错误：
```
Unchecked runtime.lastError: Cannot create item with duplicate id summarizePage
```

这个错误表明Chrome扩展在尝试创建ID为"summarizePage"的上下文菜单项时，遇到了重复ID的问题。

## 问题分析

### 根本原因
1. **Service Worker生命周期问题**：Chrome扩展的Service Worker可能会在某些情况下重新启动
2. **重复初始化**：每次Service Worker启动时都调用`setupContextMenus()`方法，但没有清理之前创建的菜单项
3. **缺少错误处理**：没有对Chrome API调用结果进行适当的错误检查

### 技术细节
- 在`background.js`中的`setupContextMenus()`方法中，每次调用都会尝试创建新的上下文菜单项
- Service Worker重启时，会重新执行`init()`方法，导致重复创建菜单项
- Chrome扩展不允许创建具有相同ID的上下文菜单项

## 解决方案

### 1. 添加菜单清理机制
```javascript
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
```

### 2. 改进初始化流程
```javascript
// 初始化
init() {
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

    // 延迟初始化上下文菜单，确保Service Worker完全启动
    setTimeout(() => {
      this.setupContextMenus();
    }, 100);

    this.isInitialized = true;
    console.log('Background service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize background service:', error);
  }
}
```

### 3. 分离菜单创建和监听器设置
```javascript
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
```

### 4. 添加全局错误处理
```javascript
// 全局错误处理
self.addEventListener('error', (event) => {
  console.error('Global error in service worker:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection in service worker:', event.reason);
});
```

### 5. Service Worker生命周期处理
```javascript
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
}
```

## 修复效果

1. **消除重复菜单项**：通过在创建新菜单前先清除所有现有菜单，确保不会出现重复ID
2. **防止重复初始化**：添加初始化状态检查，避免重复设置
3. **增强错误处理**：对所有Chrome API调用进行适当的错误检查和处理
4. **提高稳定性**：添加Service Worker生命周期处理，确保扩展在各种情况下都能正常工作
5. **改善调试**：增加详细的日志输出，便于问题排查

## 测试建议

1. **重新加载扩展**：在Chrome扩展管理页面重新加载扩展，确保修改生效
2. **测试右键菜单**：在任意网页上右键点击，检查是否正确显示"智能总结此页面"菜单项
3. **监控控制台**：检查扩展的后台页面控制台，确认没有重复菜单项错误
4. **功能测试**：点击菜单项测试功能是否正常工作

## 预防措施

1. **代码规范**：在创建Chrome扩展API调用时，始终检查`chrome.runtime.lastError`
2. **生命周期管理**：理解Service Worker的生命周期，合理处理初始化和清理
3. **错误处理**：对所有异步操作添加适当的try-catch和错误处理
4. **测试覆盖**：在多种场景下测试扩展功能，包括Service Worker重启等情况

## 总结

此修复通过添加菜单清理机制、改进初始化流程、增强错误处理等手段，彻底解决了"Cannot create item with duplicate id summarizePage"错误，提高了Chrome扩展的稳定性和可靠性。
