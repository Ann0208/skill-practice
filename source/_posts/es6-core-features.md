---
title: ES6+ 核心特性实践：解构、Promise、async/await 与模块化
date: 2022-02-18 20:00:00
tags:
  - JavaScript
  - ES6
  - Promise
  - async/await
categories:
  - JavaScript 核心
---

系统学习 ES6+ 的新特性。解构赋值、模板字符串这些语法糖提升了编码效率，Promise 和 async/await 彻底改变了异步编程的写法。

<!-- more -->

## 解构赋值

从数组或对象中提取值，写法简洁很多：

```javascript
// 对象解构
const { name, age, hobby = '编程' } = user;

// 数组解构
const [first, , third] = [1, 2, 3];

// 函数参数解构
function createUser({ name, role = 'viewer' }) {
  return { name, role };
}
```

## 展开运算符

`...` 在不同场景下有不同含义：

```javascript
// 展开数组
const merged = [...arr1, ...arr2];

// 展开对象（浅拷贝）
const newObj = { ...oldObj, name: '新名字' };

// 剩余参数
function sum(...nums) {
  return nums.reduce((a, b) => a + b, 0);
}
```

## Promise

Promise 解决了回调地狱的问题。三种状态：`pending` → `fulfilled` / `rejected`，状态一旦改变就不可逆。

```javascript
function fetchData(url) {
  return new Promise((resolve, reject) => {
    fetch(url)
      .then(res => res.json())
      .then(data => resolve(data))
      .catch(err => reject(err));
  });
}

// 并行执行
Promise.all([fetchUsers(), fetchPosts()])
  .then(([users, posts]) => { /* 两个都完成 */ });

// 竞速
Promise.race([fetchData(), timeout(5000)])
  .then(result => { /* 谁先完成用谁 */ });
```

## async/await

async/await 是 Promise 的语法糖，让异步代码看起来像同步的：

```javascript
async function loadDashboard() {
  try {
    const user = await fetchUser();
    const posts = await fetchPosts(user.id);
    return { user, posts };
  } catch (err) {
    console.error('加载失败:', err);
  }
}
```

注意 `await` 只能在 `async` 函数里用。如果多个异步操作之间没有依赖关系，应该用 `Promise.all` 并行执行，而不是逐个 `await`。

## 模块化

ES Module 是现在的标准：

```javascript
// 导出
export const API_URL = '/api';
export function fetchUser() { /* ... */ }
export default class UserService { /* ... */ }

// 导入
import UserService, { API_URL, fetchUser } from './user';
```

和 CommonJS（`require/module.exports`）的区别：ESM 是静态分析的，编译时就确定依赖关系，支持 Tree Shaking；CJS 是运行时加载，不支持。
