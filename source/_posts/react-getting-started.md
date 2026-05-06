---
title: React 入门：JSX、组件生命周期与 Hooks 初体验
date: 2023-08-20 20:00:00
tags:
  - React
  - Hooks
  - JSX
  - 前端框架
categories:
  - 前端框架
---

学完 Vue 之后开始学 React。两个框架的设计哲学差异很大——Vue 是渐进式的模板驱动，React 是"一切皆 JavaScript"。这篇记录 React 的核心概念和 Hooks 的使用。

<!-- more -->

## JSX

JSX 是 JavaScript 的语法扩展，看起来像 HTML 但本质是 `React.createElement` 的语法糖：

```jsx
// JSX
const element = <h1 className="title">Hello</h1>;

// 编译后
const element = React.createElement('h1', { className: 'title' }, 'Hello');
```

和 Vue 模板的区别：JSX 里可以直接写 JavaScript 表达式，条件渲染用三元运算符，列表渲染用 `map`：

```jsx
function UserList({ users, isAdmin }) {
  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>
          {user.name}
          {isAdmin && <button>删除</button>}
        </li>
      ))}
    </ul>
  );
}
```

## 函数组件与 Hooks

React 16.8 之后，函数组件 + Hooks 成为主流写法：

```jsx
import { useState, useEffect } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    document.title = `点击了 ${count} 次`;
  }, [count]); // 依赖数组：count 变化时执行

  return (
    <div>
      <p>{count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
    </div>
  );
}
```

## 常用 Hooks

- **useState**：状态管理，返回 `[state, setState]`
- **useEffect**：副作用处理（请求数据、订阅事件、操作 DOM）
- **useRef**：保存可变值，不触发重渲染，也用于获取 DOM 引用
- **useMemo**：缓存计算结果，避免重复计算
- **useCallback**：缓存函数引用，避免子组件不必要的重渲染

## useEffect 的依赖数组

这是 React 最容易踩坑的地方：

```jsx
// 每次渲染都执行（没有依赖数组）
useEffect(() => { /* ... */ });

// 只在挂载时执行一次（空依赖数组）
useEffect(() => { /* ... */ }, []);

// 依赖变化时执行
useEffect(() => { /* ... */ }, [userId]);

// 清理函数：组件卸载或依赖变化前执行
useEffect(() => {
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer); // 清理
}, []);
```

## Vue vs React 初步对比

| 维度 | Vue | React |
|------|-----|-------|
| 模板 | HTML 模板 + 指令 | JSX（JavaScript） |
| 响应式 | 自动追踪依赖 | 手动声明依赖（useEffect） |
| 状态更新 | 直接赋值 | 调用 setState |
| 学习曲线 | 平缓，上手快 | 稍陡，概念多 |
| 灵活性 | 约定优于配置 | 自由度高 |

两个框架没有绝对的好坏，选择取决于团队和项目需求。
