---
title: 第一次用 Vue 2 写项目：组件化思维与数据驱动的理解
date: 2022-04-22 20:00:00
tags:
  - Vue
  - 组件化
  - 前端框架
categories:
  - 前端框架
---

从原生 JS 操作 DOM 切换到 Vue 的数据驱动模式，思维方式变化很大。这篇记录第一次用 Vue 2 写完整项目的过程，从模板语法到组件通信。

<!-- more -->

## 数据驱动 vs DOM 操作

以前写原生 JS，逻辑是"拿到数据 → 手动更新 DOM"。Vue 的思路完全不同：你只管修改数据，DOM 自动更新。

```javascript
// 原生 JS
document.getElementById('count').textContent = count;

// Vue
this.count = newValue; // DOM 自动更新
```

这个转变一开始不太习惯，总想去 `document.querySelector`，后来才慢慢建立起"数据驱动视图"的思维。

## 模板语法

Vue 的模板语法很直觉：

```html
<template>
  <div>
    <p>{{ message }}</p>
    <input v-model="keyword" placeholder="搜索" />
    <ul>
      <li v-for="item in filteredList" :key="item.id">
        {{ item.name }}
      </li>
    </ul>
    <button @click="handleAdd" :disabled="!canAdd">添加</button>
  </div>
</template>
```

`v-model` 是双向绑定的语法糖，`v-for` 渲染列表，`@click` 绑定事件，`:disabled` 动态绑定属性。

## 组件通信

父子组件通信是 Vue 的核心概念：

- **父 → 子**：`props` 传数据，单向数据流
- **子 → 父**：`$emit` 触发事件，父组件监听
- **兄弟组件**：通过共同的父组件中转，或者用 EventBus

```javascript
// 子组件
this.$emit('update', newValue);

// 父组件
<ChildComponent @update="handleUpdate" />
```

## 生命周期

Vue 2 的生命周期钩子：`created` → `mounted` → `updated` → `destroyed`。

- `created`：数据已初始化，DOM 还没渲染，适合发请求
- `mounted`：DOM 已渲染，可以操作 DOM 元素
- `beforeDestroy`：组件销毁前，清理定时器、取消订阅

## 踩坑记录

1. **直接给对象添加新属性不会触发响应式更新**，必须用 `Vue.set(obj, 'key', value)` 或 `this.$set`。这是 Vue 2 用 `Object.defineProperty` 实现响应式的局限。

2. **v-for 必须加 :key**，不加的话列表更新时会出现渲染错乱。key 要用唯一标识（id），不要用 index。

3. **异步更新队列**：修改数据后 DOM 不会立即更新，需要用 `this.$nextTick()` 等待下一次渲染。
