---
title: JavaScript Event Loop 深度剖析：从浏览器进程模型到微任务队列
date: 2026-05-11 10:00:00
tags:
  - JavaScript
  - Event Loop
  - 异步编程
  - 浏览器原理
  - Node.js
categories:
  - JavaScript 核心
---

Event Loop 是 JavaScript 异步编程的底层引擎。很多人知道"宏任务微任务"的口诀，但遇到复杂场景（嵌套 Promise、requestAnimationFrame 时序、Node.js 与浏览器差异）就容易翻车。这篇从进程模型出发，把 Event Loop 的每个环节拆透。

<!-- more -->

## 浏览器的进程与线程模型

现代浏览器（以 Chrome 为例）采用多进程架构：

| 进程 | 职责 |
|------|------|
| Browser 进程 | 地址栏、书签、前进后退，负责网络请求、文件访问等特权操作 |
| Renderer 进程 | 每个 Tab 一个（站点隔离），负责页面渲染、JS 执行 |
| GPU 进程 | 处理 GPU 任务，如 CSS 动画合成、WebGL |
| Plugin 进程 | 运行浏览器插件（如 Flash，已淘汰） |

**关键点：JS 执行和页面渲染在同一个 Renderer 进程的主线程上。** 这意味着 JS 长时间执行会阻塞渲染，用户看到的就是"页面卡死"。

### Renderer 进程中的线程

```
Renderer 进程
├── 主线程（Main Thread）—— JS 执行 + 样式计算 + 布局 + 绘制
├── 合成线程（Compositor Thread）—— 图层合成
├── 光栅化线程池（Raster Threads）—— 图块光栅化
├── IO 线程 —— 与其他进程通信
└── Worker 线程 —— Web Worker / Service Worker
```

主线程是单线程的，Event Loop 就运行在这个主线程上。

## Event Loop 核心机制

### 一次循环的完整流程

```
┌───────────────────────────────┐
│         取一个宏任务执行         │
│   (script / setTimeout / I/O) │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│    清空微任务队列（全部执行）     │
│  (Promise.then / MutationObserver│
│   / queueMicrotask)            │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│   是否需要渲染？（约 16.6ms 一次）│
│   是 → 执行 rAF 回调 → 渲染    │
│   否 → 回到顶部取下一个宏任务    │
└───────────────────────────────┘
```

注意：**每执行完一个宏任务，就会清空所有微任务**，而不是"宏任务队列全部执行完再执行微任务"。

### 宏任务（Macrotask）与微任务（Microtask）

**宏任务来源：**
- `<script>` 整体代码（初始执行）
- `setTimeout` / `setInterval`
- `setImmediate`（Node.js）
- I/O 回调
- UI 渲染
- `MessageChannel`
- `requestAnimationFrame`（严格说是渲染阶段的回调，但时序上在微任务之后）

**微任务来源：**
- `Promise.then` / `.catch` / `.finally`
- `MutationObserver`
- `queueMicrotask()`
- `process.nextTick`（Node.js，优先级高于其他微任务）

### 经典执行顺序分析

```javascript
console.log('1'); // 同步

setTimeout(() => {
  console.log('2'); // 宏任务
  Promise.resolve().then(() => {
    console.log('3'); // 宏任务中的微任务
  });
}, 0);

Promise.resolve().then(() => {
  console.log('4'); // 微任务
  setTimeout(() => {
    console.log('5'); // 微任务中注册的宏任务
  }, 0);
});

console.log('6'); // 同步

// 输出顺序：1 → 6 → 4 → 2 → 3 → 5
```

**分析过程：**
1. 执行同步代码：输出 `1`，注册 setTimeout 回调到宏任务队列，注册 Promise.then 到微任务队列，输出 `6`
2. 同步代码（第一个宏任务）执行完毕，清空微任务队列：输出 `4`，注册 setTimeout 到宏任务队列
3. 取下一个宏任务（第一个 setTimeout）：输出 `2`，注册 Promise.then 到微任务队列
4. 清空微任务队列：输出 `3`
5. 取下一个宏任务（第二个 setTimeout）：输出 `5`

## 微任务的"饥饿"问题

微任务会在当前宏任务结束后**全部执行完**才进入下一个宏任务。如果微任务不断产生新的微任务，就会阻塞渲染：

### ❌ 错误示范：微任务无限递归

```javascript
// 这会导致页面完全卡死！
function blockForever() {
  Promise.resolve().then(() => {
    blockForever(); // 不断产生微任务，永远不会进入渲染阶段
  });
}
blockForever();
```

### ✅ 正确做法：用宏任务让出主线程

```javascript
// 用 setTimeout 让出控制权，允许浏览器渲染
function processChunk(items, index = 0) {
  const CHUNK_SIZE = 100;
  const end = Math.min(index + CHUNK_SIZE, items.length);

  for (let i = index; i < end; i++) {
    // 处理单个 item
    processItem(items[i]);
  }

  if (end < items.length) {
    setTimeout(() => processChunk(items, end), 0); // 宏任务，给渲染机会
  }
}
```

## requestAnimationFrame 的时序

`requestAnimationFrame`（rAF）的执行时机比较特殊：它在微任务之后、渲染之前执行。

```javascript
setTimeout(() => console.log('timeout'), 0);

requestAnimationFrame(() => console.log('rAF'));

Promise.resolve().then(() => console.log('promise'));

// 大多数情况下输出：promise → rAF → timeout
// 但 rAF 和 timeout 的顺序不是 100% 确定的！
```

**为什么不确定？** 因为 rAF 只在浏览器决定渲染时才执行（通常 16.6ms 一次）。如果当前帧不需要渲染，rAF 可能延迟到下一帧。而 setTimeout(fn, 0) 实际最小延迟约 4ms（HTML 规范），两者的竞争取决于具体时机。

### rAF 的正确使用场景

```javascript
// ❌ 用 setTimeout 做动画 —— 时机不精确，可能丢帧
function animateWithTimeout(element) {
  let pos = 0;
  function step() {
    pos += 2;
    element.style.transform = `translateX(${pos}px)`;
    if (pos < 300) {
      setTimeout(step, 16); // 不精确，可能和渲染不同步
    }
  }
  step();
}

// ✅ 用 rAF 做动画 —— 和浏览器渲染节奏同步
function animateWithRAF(element) {
  let pos = 0;
  function step() {
    pos += 2;
    element.style.transform = `translateX(${pos}px)`;
    if (pos < 300) {
      requestAnimationFrame(step); // 精确对齐渲染帧
    }
  }
  requestAnimationFrame(step);
}
```

## async/await 的微任务拆解

`async/await` 是 Promise 的语法糖，理解它的微任务行为需要"脱糖"：

```javascript
async function foo() {
  console.log('foo start'); // 同步执行
  await bar();              // 等价于 bar().then(() => { ... })
  console.log('foo end');   // 这行在微任务中执行
}

async function bar() {
  console.log('bar');
}

console.log('script start');
foo();
console.log('script end');

// 输出：script start → foo start → bar → script end → foo end
```

**关键理解：** `await` 后面的代码相当于放在 `.then()` 回调中，是微任务。

### 复杂案例：多个 async 函数交错

```javascript
async function async1() {
  console.log('async1 start');
  await async2();
  console.log('async1 end');
}

async function async2() {
  console.log('async2 start');
  await Promise.resolve();
  console.log('async2 end');
}

console.log('script start');

setTimeout(() => console.log('setTimeout'), 0);

async1();

new Promise((resolve) => {
  console.log('promise1');
  resolve();
}).then(() => {
  console.log('promise2');
});

console.log('script end');

// 输出：
// script start
// async1 start
// async2 start
// promise1
// script end
// async2 end
// promise2
// async1 end
// setTimeout
```

**逐步分析：**
1. 同步：`script start`
2. 注册 setTimeout 宏任务
3. 调用 async1：输出 `async1 start`，调用 async2
4. async2 中：输出 `async2 start`，遇到 `await Promise.resolve()`，async2 后续代码进入微任务队列
5. async1 中的 await async2() 还在等 async2 完成，所以 `async1 end` 还不能入队
6. 继续同步：输出 `promise1`，resolve 后 `.then` 回调入微任务队列
7. 同步：`script end`
8. 清空微任务：先执行 async2 剩余 → `async2 end`，async2 完成后 async1 的 await 解决 → `promise2` → `async1 end`
9. 宏任务：`setTimeout`

## Node.js Event Loop 的差异

Node.js 的 Event Loop 基于 libuv，和浏览器有显著区别。它分为 6 个阶段：

```
   ┌───────────────────────────┐
┌─▶│         timers            │ ← setTimeout / setInterval 回调
│  └──────────┬────────────────┘
│  ┌──────────▼────────────────┐
│  │     pending callbacks     │ ← 系统级回调（TCP 错误等）
│  └──────────┬────────────────┘
│  ┌──────────▼────────────────┐
│  │       idle, prepare       │ ← 内部使用
│  └──────────┬────────────────┘
│  ┌──────────▼────────────────┐
│  │         poll              │ ← I/O 回调，这里会"阻塞等待"
│  └──────────┬────────────────┘
│  ┌──────────▼────────────────┐
│  │         check             │ ← setImmediate 回调
│  └──────────┬────────────────┘
│  ┌──────────▼────────────────┐
│  │     close callbacks       │ ← socket.on('close') 等
│  └──────────┴────────────────┘
│             │
└─────────────┘
```

### Node.js 微任务执行时机

在 Node.js 11+ 中，微任务的执行时机和浏览器对齐了：**每个宏任务执行完后立即清空微任务队列**。

但在 Node.js 10 及更早版本中，微任务是在阶段切换时才执行的（即一个阶段的所有回调执行完后才清空微任务）。

```javascript
// Node.js 11+ 和浏览器行为一致
setTimeout(() => {
  console.log('timer1');
  Promise.resolve().then(() => console.log('promise1'));
}, 0);

setTimeout(() => {
  console.log('timer2');
  Promise.resolve().then(() => console.log('promise2'));
}, 0);

// Node.js 11+: timer1 → promise1 → timer2 → promise2
// Node.js 10:  timer1 → timer2 → promise1 → promise2（同阶段批量执行）
```

### process.nextTick vs Promise.then

`process.nextTick` 的优先级高于所有微任务（包括 Promise）：

```javascript
Promise.resolve().then(() => console.log('promise'));
process.nextTick(() => console.log('nextTick'));

// 输出：nextTick → promise
```

`process.nextTick` 在当前操作完成后立即执行，甚至在进入微任务队列之前。滥用它同样会导致"饥饿"问题。

### setImmediate vs setTimeout(fn, 0)

```javascript
// 在主模块中，顺序不确定
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
// 可能是 timeout → immediate，也可能反过来

// 在 I/O 回调中，setImmediate 总是先执行
const fs = require('fs');
fs.readFile(__filename, () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
});
// 总是：immediate → timeout
```

**原因：** 在 I/O 回调中，当前处于 poll 阶段，下一个阶段就是 check（setImmediate），而 timers 阶段要等到下一轮循环。

## 实战调试场景

### 场景一：为什么 setTimeout(fn, 0) 不是真正的 0ms？

```javascript
const start = performance.now();
setTimeout(() => {
  console.log(`实际延迟: ${performance.now() - start}ms`);
}, 0);

// 输出通常是 1~4ms，而不是 0ms
```

HTML 规范规定：嵌套层级超过 5 层时，最小延迟为 4ms。即使不嵌套，浏览器实现也有最小精度（通常 1ms）。

### 场景二：DOM 更新时机

```javascript
// ❌ 以为 DOM 更新是同步的
document.getElementById('app').textContent = 'Hello';
console.log('文本已更新'); // 文本确实已更新（DOM 属性是同步修改的）
// 但用户看到的渲染是异步的！

// ✅ 确保在下一帧渲染后执行
document.getElementById('app').textContent = 'Hello';
requestAnimationFrame(() => {
  // 这里渲染已经发生（或即将发生）
  requestAnimationFrame(() => {
    // 这里可以确保上一帧已经渲染完毕
    console.log('用户已经看到更新');
  });
});
```

### 场景三：Vue/React 的 nextTick 原理

Vue 的 `nextTick` 本质上就是利用微任务：

```javascript
// Vue 3 nextTick 简化实现
function nextTick(fn) {
  return fn ? Promise.resolve().then(fn) : Promise.resolve();
}

// 为什么 nextTick 能拿到更新后的 DOM？
// 因为 Vue 的响应式更新也是在微任务中批量执行的
// data 变化 → 标记 dirty → 在微任务中批量更新 DOM → nextTick 的回调排在后面
```

### 场景四：并发请求的执行顺序陷阱

```javascript
// ❌ 以为 Promise.all 中的请求是"同时"发出的
async function fetchData() {
  const [users, posts] = await Promise.all([
    fetch('/api/users'),   // 请求 1
    fetch('/api/posts'),   // 请求 2
  ]);
  // 请求确实是"同时"发出的（在同一个宏任务中调用 fetch）
  // 但回调的执行顺序取决于哪个先返回
}

// ❌ 误用 await 导致串行
async function fetchDataSerial() {
  const users = await fetch('/api/users');   // 等这个完成...
  const posts = await fetch('/api/posts');   // 才发出这个请求
  // 总耗时 = 请求1耗时 + 请求2耗时
}

// ✅ 正确的并发写法
async function fetchDataParallel() {
  const usersPromise = fetch('/api/users');  // 立即发出
  const postsPromise = fetch('/api/posts');  // 立即发出
  const users = await usersPromise;
  const posts = await postsPromise;
  // 总耗时 ≈ max(请求1耗时, 请求2耗时)
}
```

### 场景五：事件处理中的微任务时序

```javascript
const button = document.querySelector('#btn');

button.addEventListener('click', () => {
  console.log('listener 1');
  Promise.resolve().then(() => console.log('micro 1'));
});

button.addEventListener('click', () => {
  console.log('listener 2');
  Promise.resolve().then(() => console.log('micro 2'));
});

// 用户点击按钮：listener 1 → micro 1 → listener 2 → micro 2
// 因为每个 listener 是独立的宏任务（用户触发时）

// 但如果是 JS 触发：
button.click();
// 输出：listener 1 → listener 2 → micro 1 → micro 2
// 因为 button.click() 是同步调用，两个 listener 在同一个宏任务中执行
```

这个差异在实际开发中容易踩坑，尤其是在写测试时用 `.click()` 模拟点击和真实用户点击行为不一致。

## 性能优化中的 Event Loop 应用

### 长任务拆分：Scheduler API

```javascript
// 现代浏览器提供了 scheduler.yield()（Chrome 129+）
async function processLargeList(items) {
  for (let i = 0; i < items.length; i++) {
    processItem(items[i]);

    // 每处理 100 个就让出主线程
    if (i % 100 === 99) {
      await scheduler.yield(); // 让浏览器有机会处理用户输入和渲染
    }
  }
}

// 降级方案
function yieldToMain() {
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
}
```

### 利用 MessageChannel 实现高优先级调度

```javascript
// React Scheduler 的核心思路（简化版）
const channel = new MessageChannel();
const port = channel.port2;

const taskQueue = [];

channel.port1.onmessage = () => {
  const task = taskQueue.shift();
  if (task) {
    task();
  }
};

function scheduleTask(task) {
  taskQueue.push(task);
  port.postMessage(null); // 触发宏任务，但比 setTimeout 更快（无 4ms 限制）
}
```

## 总结：Event Loop 心智模型

1. **JS 是单线程的**，但浏览器不是。网络请求、定时器计时、DOM 事件监听都在其他线程完成，完成后把回调放入任务队列。
2. **执行顺序**：同步代码 → 微任务（全部清空）→ 可能渲染（rAF）→ 下一个宏任务 → 微任务 → ...
3. **微任务优先级高于宏任务**，但微任务会阻塞渲染。不要在微任务中做耗时操作。
4. **Node.js 11+ 和浏览器行为基本一致**，但多了 `process.nextTick`（最高优先级微任务）和 `setImmediate`（check 阶段）。
5. **rAF 不是宏任务也不是微任务**，它是渲染流程的一部分，在微任务之后、Paint 之前执行。

掌握 Event Loop 不是为了应付面试，而是为了在遇到"为什么这个回调执行顺序不对""为什么页面卡了""为什么动画掉帧"时，能快速定位问题根源。
