---
title: JavaScript 核心知识深度解析：闭包、原型链、事件循环与深浅拷贝
date: 2025-12-21 20:30:00
tags:
  - JavaScript
  - 闭包
  - 原型链
  - 事件循环
  - 深拷贝
  - ES6
categories:
  - 前端技术
---

JavaScript 是前端工程师的核心语言，也是面试中必考的重点领域。本文系统梳理 JavaScript 中最高频、最核心的知识点，包括数据类型、闭包、原型链、事件循环、深浅拷贝等，帮助你构建扎实的 JS 知识体系。

<!-- more -->

## 一、JavaScript 数据类型

### 1.1 基本类型与引用类型

JS 数据类型分为**基本类型（原始类型）**和**引用类型**：

**基本类型（7种）**：`String`、`Number`、`Boolean`、`Null`、`Undefined`、`Symbol`（ES6，唯一且不可变）、`BigInt`（ES10，处理大整数）。

特点：存储在栈内存，值不可变，按值传递。

**引用类型**：`Object`（包含 `Array`、`Function`、`Date`、`RegExp`、`Map`、`Set` 等）。

特点：存储在堆内存，栈内存仅存指向堆的引用地址，按引用传递。

### 1.2 let、const 与 var 的区别

| 特性 | var | let/const |
|------|-----|-----------|
| 作用域 | 函数级作用域/全局 | 块级作用域（`{}` 内） |
| 变量提升 | 提升且初始化为 `undefined` | 提升但未初始化（暂时性死区） |
| 重复声明 | 允许 | 不允许 |
| 全局污染 | 声明全局变量会挂载到 `window` | 不会挂载到 `window` |
| 初始化 | 可先声明后赋值 | `const` 必须声明时赋值且不可修改引用 |

```javascript
function test() {
  console.log(a); // undefined（var 提升）
  // console.log(b); // 报错：Cannot access 'b' before initialization（TDZ）
  var a = 1;
  let b = 2;
  const c = 3;

  console.log(a); // 1
  console.log(b); // 2
  console.log(c); // 3

  // c = 4; // 报错：Assignment to constant variable
}
test();
```

---

## 二、闭包（Closure）

### 2.1 什么是闭包

闭包是指**有权访问另一个函数作用域中变量的函数**，本质是函数作用域链的保留。

**形成条件**：
1. 函数嵌套（内层函数嵌套外层函数）；
2. 内层函数引用外层函数的变量/参数；
3. 内层函数被外部调用（脱离外层函数作用域）。

```javascript
function outer() {
  let count = 0; // 被闭包引用，不会被 GC
  return function inner() {
    count++;
    console.log(count);
  };
}
const fn = outer();
fn(); // 1
fn(); // 2
```

### 2.2 闭包的应用场景

- **私有化变量**：模块模式封装工具函数，避免全局污染；
- **防抖/节流函数**：在闭包中保存定时器 ID；
- **函数柯里化**：分步传递参数；
- **维持函数状态**：如计数器、缓存函数结果。

### 2.3 闭包的潜在风险

闭包会持有外层函数的变量，若长期不释放，可能导致**内存泄漏**。需注意及时释放引用（如赋值为 `null`）。

---

## 三、原型链（Prototype Chain）

### 3.1 核心概念

JS 基于原型的继承机制：

- 每个对象都有 `__proto__`（隐式原型），指向其构造函数的 `prototype`（显式原型）；
- 访问对象属性时，若对象自身没有，会通过 `__proto__` 向上查找，直到 `Object.prototype.__proto__ = null`，这个查找链条就是**原型链**。

**三者关系**：
1. 构造函数通过 `prototype` 属性指向原型对象；
2. 原型对象通过 `constructor` 属性指向构造函数；
3. 实例通过 `__proto__` 属性指向原型对象。

```javascript
const arr = [];
arr.__proto__ === Array.prototype;         // true
Array.prototype.__proto__ === Object.prototype; // true
Object.prototype.__proto__ === null;         // true
```

### 3.2 prototype 与 __proto__ 的区别

- `prototype` 是**构造函数**的属性，用于存放实例共享的属性/方法；
- `__proto__` 是**实例对象**的属性，指向其构造函数的 `prototype`，是原型链查找的关键。

---

## 四、事件循环（Event Loop）

### 4.1 为什么 JS 单线程能实现异步

JS 单线程指**执行代码的主线程只有一个**，但浏览器/Node 提供了**多线程的运行环境**（如事件触发线程、定时器线程、网络请求线程等）。

异步实现依赖：
- **事件循环**：主线程执行同步代码 → 遇到异步任务丢给对应线程处理 → 异步任务完成后推入任务队列 → 主线程空闲时从队列取任务执行；
- **调用栈（Call Stack）**：执行同步代码的栈结构，遵循"先进后出"。

### 4.2 宏任务与微任务

| 类型 | 包含内容 |
|------|----------|
| 宏任务 | `script`（整体代码）、`setTimeout`、`setInterval`、`I/O`、`UI 交互事件` |
| 微任务 | `Promise.then/catch/finally`、`MutationObserver`、`queueMicrotask` |

**执行优先级**：同步代码 → 微任务队列清空 → 宏任务队列取一个执行 → 微任务队列清空 → 重复

```javascript
console.log('同步1');
Promise.resolve().then(() => console.log('Promise 微任务'));
setTimeout(() => console.log('setTimeout 宏任务'), 0);
console.log('同步2');
// 执行顺序：同步1 → 同步2 → Promise 微任务 → setTimeout 宏任务
```

### 4.3 浏览器 vs Node 事件循环差异

- **浏览器**：`宏任务1` → 清空所有微任务 → `宏任务2` → 清空所有微任务；
- **Node.js**（v11+ 趋近浏览器）：事件循环分6个阶段（timers → I/O callbacks → idle/prepare → poll → check → close callbacks），`process.nextTick` 优先级高于所有微任务。

---

## 五、箭头函数与普通函数的区别

1. **this 绑定**：箭头函数没有自己的 `this`，继承自外层作用域，且不可修改；普通函数的 `this` 取决于调用方式；
2. **构造函数**：箭头函数不能作为构造函数（不能用 `new`），普通函数可以；
3. **arguments 对象**：箭头函数没有 `arguments` 对象，需用剩余参数 `...args` 替代；
4. **原型**：箭头函数没有 `prototype` 属性，普通函数有。

---

## 六、深拷贝与浅拷贝

### 6.1 核心区别

- **浅拷贝**：只复制对象的第一层属性，引用类型属性仍指向原对象的引用（修改拷贝会影响原对象）；
- **深拷贝**：递归复制所有层级属性，拷贝后与原对象完全独立。

### 6.2 常用浅拷贝方法

- 扩展运算符：`{...obj}`（对象）、`[...arr]`（数组）；
- `Object.assign(target, ...sources)`；
- 数组专用：`Array.prototype.slice()`、`Array.prototype.concat()`。

**关键细节**：`Object.assign()` 和扩展运算符**只拷贝可枚举属性**，且不拷贝原型链上的属性。

### 6.3 深拷贝实现

**简单场景（有局限性）**：
```javascript
JSON.parse(JSON.stringify(obj))
// 缺点：无法拷贝函数、undefined、Symbol、循环引用对象
```

**完整版（支持循环引用）**：
```javascript
function deepClone(target, cache = new WeakMap()) {
  // 基本类型 / null 直接返回
  if (target === null || typeof target !== 'object') return target;

  // 处理循环引用：缓存中存在则直接返回
  if (cache.has(target)) return cache.get(target);

  let cloneResult;
  if (target instanceof Date) {
    cloneResult = new Date(target);
  } else if (target instanceof RegExp) {
    cloneResult = new RegExp(target.source, target.flags);
    cloneResult.lastIndex = target.lastIndex;
  } else if (Array.isArray(target)) {
    cloneResult = [];
  } else {
    cloneResult = {};
  }

  // 先缓存再递归（防止循环引用）
  cache.set(target, cloneResult);

  // 遍历所有自身属性（包括 Symbol 键）
  Reflect.ownKeys(target).forEach(key => {
    cloneResult[key] = deepClone(target[key], cache);
  });

  return cloneResult;
}
```

**为什么用 WeakMap 而不是 Map**：WeakMap 是弱引用，原对象被垃圾回收时，缓存自动释放，避免内存泄漏。

---

## 七、防抖与节流

### 7.1 防抖（Debounce）

触发事件后，延迟 n 秒执行函数，若 n 秒内再次触发，重新计时。

**应用场景**：搜索框输入联想、窗口 resize 事件。

```javascript
function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}
```

### 7.2 节流（Throttle）

触发事件后，n 秒内只执行一次函数，避免高频触发。

**应用场景**：按钮点击防重复提交、滚动加载数据。

```javascript
function throttle(fn, delay) {
  let lastTime = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastTime >= delay) {
      fn.apply(this, args);
      lastTime = now;
    }
  };
}
```

---

## 八、Promise 与 async/await

### 8.1 Promise 的三种状态

- **Pending（等待中）**：初始状态；
- **Fulfilled（成功）**：操作成功完成；
- **Rejected（失败）**：操作失败。

**状态一旦改变不可逆**。

### 8.2 async/await 与 Promise 的关系

`async/await` 是 Promise 的语法糖，基于 Promise 实现，简化了链式调用写法：

```javascript
// Promise 链式调用
fetchData()
  .then(data => processData(data))
  .then(result => console.log(result))
  .catch(err => console.error(err));

// async/await 等价写法
async function run() {
  try {
    const data = await fetchData();
    const result = await processData(data);
    console.log(result);
  } catch (err) {
    console.error(err);
  }
}
```

### 8.3 Promise.all vs Promise.allSettled

- **Promise.all**：所有 Promise 都成功才 resolve，任一失败则 reject；
- **Promise.allSettled**：等所有 Promise 完成（无论成功失败），返回所有结果；
- **Promise.race**：第一个 Promise 完成（resolve 或 reject）即返回。

---

## 九、模块化规范对比

| 规范 | 加载时机 | 导出/导入语法 | 特点 |
|------|----------|---------------|------|
| CommonJS | 运行时加载 | `module.exports` / `require()` | 输出值的拷贝，Node.js 默认 |
| ES6 Module | 编译时加载（静态） | `export` / `import` | 输出值的引用，支持 Tree-Shaking |

```javascript
// CommonJS
const utils = require('./utils');
module.exports = { add };

// ES6 Module
import { add } from './utils';
export const multiply = (a, b) => a * b;
```

---

## 十、实战代码题：两数之和

给定数组和目标值，返回所有不重复的下标对（O(n) 时间复杂度）：

```javascript
function twoSumAllPairs(nums, target) {
  const numIndexMap = new Map(); // key: 数值, value: 下标数组
  const result = [];
  const used = new Set(); // 避免重复

  // 构建数值→下标映射
  nums.forEach((num, index) => {
    if (!numIndexMap.has(num)) numIndexMap.set(num, []);
    numIndexMap.get(num).push(index);
  });

  // 遍历查找差值
  nums.forEach((num, i) => {
    const diff = target - num;
    if (!numIndexMap.has(diff)) return;

    numIndexMap.get(diff).forEach((j) => {
      if (i === j) return;
      const pair = [i, j].sort((a, b) => a - b);
      const pairKey = pair.join(',');
      if (!used.has(pairKey)) {
        used.add(pairKey);
        result.push(pair);
      }
    });
  });

  return result;
}

console.log(twoSumAllPairs([3, 3, 2, 4], 6)); // [[0,1], [2,3]]
```

---

## 总结

JavaScript 核心知识的掌握需要从"概念→原理→应用→代码"四个维度深入理解：

- **数据类型**：区分基本类型与引用类型的存储和传递方式；
- **闭包**：理解作用域链保留机制及其应用场景；
- **原型链**：掌握 JS 继承的本质；
- **事件循环**：理解宏任务/微任务的执行顺序，是异步编程的基础；
- **深浅拷贝**：面试高频考点，需掌握手写实现；
- **Promise/async**：异步编程的核心，理解状态机制和语法糖关系。

这些知识点相互关联，深入理解任一点都有助于构建整体 JS 知识体系，在实际开发中写出更高质量的代码。
