---
title: JavaScript 入门笔记：变量、函数、DOM 操作与事件机制
date: 2021-12-15 20:00:00
tags:
  - JavaScript
  - DOM
  - 前端入门
categories:
  - 前端基础
---

学完 HTML/CSS 开始啃 JavaScript。这篇整理了变量声明、函数定义、DOM 操作和事件机制的核心知识点，都是最基础但最重要的部分。

<!-- more -->

## 变量声明：var、let、const

`var` 有变量提升和函数作用域的问题，容易出 bug。ES6 之后基本用 `let` 和 `const`：

- `let`：块级作用域，可重新赋值
- `const`：块级作用域，不可重新赋值（但对象的属性可以改）

```javascript
const obj = { name: 'Ann' };
obj.name = 'Bob'; // 可以，修改的是属性
obj = {};          // 报错，不能重新赋值
```

## 函数的几种写法

```javascript
// 函数声明（会提升）
function add(a, b) {
  return a + b;
}

// 函数表达式（不会提升）
const multiply = function(a, b) {
  return a * b;
};

// 箭头函数（没有自己的 this）
const subtract = (a, b) => a - b;
```

箭头函数最大的特点是没有自己的 `this`，它会捕获外层的 `this`。这个特性在回调函数里特别有用。

## DOM 操作

DOM 是 JavaScript 操作页面的接口。常用的几个方法：

```javascript
// 获取元素
const el = document.getElementById('app');
const items = document.querySelectorAll('.item');

// 修改内容和样式
el.textContent = '新内容';
el.style.color = 'red';
el.classList.add('active');

// 创建和插入元素
const newDiv = document.createElement('div');
newDiv.textContent = 'Hello';
document.body.appendChild(newDiv);
```

## 事件机制：冒泡与捕获

DOM 事件有三个阶段：捕获（从 window 到目标）→ 目标 → 冒泡（从目标到 window）。

```javascript
// 冒泡阶段触发（默认）
el.addEventListener('click', handler);

// 捕获阶段触发
el.addEventListener('click', handler, true);
```

事件委托是利用冒泡的实用技巧——把事件监听器绑在父元素上，通过 `event.target` 判断实际点击的是哪个子元素。适合列表、表格这种动态内容多的场景。
