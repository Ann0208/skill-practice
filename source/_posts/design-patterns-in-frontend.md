---
title: 设计模式在前端中的应用：观察者、策略与发布订阅
date: 2024-08-15 20:00:00
tags:
  - 设计模式
  - JavaScript
  - 架构设计
categories:
  - 前端进阶
---

设计模式不是后端的专利。前端项目中很多场景天然用到了设计模式，只是我们可能没意识到。这篇整理了前端最常用的几种模式。

<!-- more -->

## 观察者模式

一个对象（Subject）维护一组依赖它的对象（Observer），状态变化时自动通知所有观察者。

Vue 的响应式系统就是观察者模式：数据是 Subject，组件是 Observer，数据变化时自动更新组件。

```javascript
class EventEmitter {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  off(event, callback) {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event, ...args) {
    this.listeners.get(event)?.forEach(cb => cb(...args));
  }
}
```

## 发布订阅模式

和观察者模式的区别：发布订阅有一个中间的"事件中心"，发布者和订阅者互不知道对方的存在，完全解耦。

Vue 2 的 EventBus、Node.js 的 EventEmitter、浏览器的 DOM 事件系统都是发布订阅模式。

## 策略模式

把一组算法封装成独立的策略，运行时动态选择。避免大量的 `if-else`：

```javascript
// 表单验证策略
const validators = {
  required: (value) => value !== '' || '不能为空',
  email: (value) => /^[^\s@]+@[^\s@]+$/.test(value) || '邮箱格式不正确',
  minLength: (min) => (value) => value.length >= min || `至少 ${min} 个字符`,
};

function validate(value, rules) {
  for (const rule of rules) {
    const result = rule(value);
    if (result !== true) return result;
  }
  return true;
}

// 使用
validate(email, [validators.required, validators.email]);
```

## 单例模式

全局只有一个实例。前端常见场景：全局状态管理（Store）、弹窗管理器、WebSocket 连接。

```javascript
class WebSocketClient {
  static instance = null;

  static getInstance(url) {
    if (!WebSocketClient.instance) {
      WebSocketClient.instance = new WebSocketClient(url);
    }
    return WebSocketClient.instance;
  }
}
```

## 代理模式

控制对目标对象的访问。Vue 3 的响应式系统用 `Proxy` 实现，图片懒加载也是代理模式——先显示占位图，进入视口后再加载真实图片。

## 实际应用

设计模式不是为了"用模式而用模式"。好的做法是：遇到问题时，看看有没有成熟的模式可以借鉴。如果一个简单的 `if-else` 就能解决，没必要硬套策略模式。模式是工具，不是目的。
