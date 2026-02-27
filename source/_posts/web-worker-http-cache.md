---
title: Web Worker 实践：多线程通信设计与 HTTP 缓存策略
date: 2026-02-27 10:00:00
tags:
  - Web Worker
  - 多线程
  - HTTP 缓存
  - 性能优化
categories:
  - 前端技术
---

前端性能优化的两个核心战场：一是把耗时任务移出主线程（Web Worker），二是让资源加载快起来（HTTP 缓存）。本文结合 AI 流程图项目的实际案例，深入拆解这两个技术方向的工程实践。

<!-- more -->

## 一、Web Worker：主线程的减负方案

### 1.1 为什么要用 Web Worker

JavaScript 是单线程的，所有 UI 渲染、事件处理、业务逻辑都跑在主线程上。一旦某个任务执行超过 50ms（Long Task 标准），页面就会出现可感知的卡顿。

Web Worker 提供了**在后台线程运行 JS 代码**的能力，它与主线程完全隔离（无法访问 DOM），通过消息传递通信。

### 1.2 消息通信设计

我们在 AI 流程图项目中定义了以下消息类型（基于消息类型常量统一管理）：

```javascript
// worker-message-types.js（主线程和 Worker 共享此常量）
export const WorkerMessageType = {
  // 主线程 → Worker
  PARSE_MARKDOWN: 'PARSE_MARKDOWN',        // 解析 Markdown 内容
  COMPUTE_LAYOUT: 'COMPUTE_LAYOUT',        // 计算流程图节点布局
  DIFF_AST: 'DIFF_AST',                   // 对比两个 AST 树的差异
  VALIDATE_SCHEMA: 'VALIDATE_SCHEMA',      // JSON Schema 校验

  // Worker → 主线程
  PARSE_MARKDOWN_DONE: 'PARSE_MARKDOWN_DONE',
  COMPUTE_LAYOUT_DONE: 'COMPUTE_LAYOUT_DONE',
  DIFF_AST_DONE: 'DIFF_AST_DONE',
  VALIDATE_SCHEMA_DONE: 'VALIDATE_SCHEMA_DONE',
  WORKER_ERROR: 'WORKER_ERROR'
}
```

**Worker 内部实现：**

```javascript
// compute-worker.js
import { WorkerMessageType } from './worker-message-types.js'
import { marked } from 'marked'
import Ajv from 'ajv'

const ajv = new Ajv()

self.onmessage = async ({ data }) => {
  const { type, payload, taskId } = data

  try {
    let result

    switch (type) {
      case WorkerMessageType.PARSE_MARKDOWN:
        result = parseMarkdown(payload.content)
        self.postMessage({
          type: WorkerMessageType.PARSE_MARKDOWN_DONE,
          taskId,
          result
        })
        break

      case WorkerMessageType.COMPUTE_LAYOUT:
        result = computeDAGLayout(payload.nodes, payload.edges)
        self.postMessage({
          type: WorkerMessageType.COMPUTE_LAYOUT_DONE,
          taskId,
          result
        })
        break

      case WorkerMessageType.DIFF_AST:
        result = diffAST(payload.oldAST, payload.newAST)
        self.postMessage({
          type: WorkerMessageType.DIFF_AST_DONE,
          taskId,
          result
        })
        break

      case WorkerMessageType.VALIDATE_SCHEMA:
        result = ajv.validate(payload.schema, payload.data)
        self.postMessage({
          type: WorkerMessageType.VALIDATE_SCHEMA_DONE,
          taskId,
          result,
          errors: ajv.errors
        })
        break
    }
  } catch (err) {
    self.postMessage({
      type: WorkerMessageType.WORKER_ERROR,
      taskId,
      error: { message: err.message, stack: err.stack }
    })
  }
}

function parseMarkdown(content) {
  return marked.parse(content)
}

function computeDAGLayout(nodes, edges) {
  // 使用 Dagre 算法计算有向无环图布局
  // 这是 CPU 密集型操作，非常适合移入 Worker
  // ...
  return { positions: {}, dimensions: {} }
}
```

**主线程封装（Promise 化 Worker 调用）：**

```javascript
// worker-client.js
class WorkerClient {
  constructor(workerUrl) {
    this.worker = new Worker(workerUrl, { type: 'module' })
    this.pendingTasks = new Map() // taskId → { resolve, reject }

    this.worker.onmessage = ({ data }) => {
      const { taskId, type, result, error } = data

      if (!this.pendingTasks.has(taskId)) return
      const { resolve, reject } = this.pendingTasks.get(taskId)
      this.pendingTasks.delete(taskId)

      if (type === WorkerMessageType.WORKER_ERROR) {
        reject(new Error(error.message))
      } else {
        resolve(result)
      }
    }
  }

  // 将 Worker 消息封装为 Promise
  send(type, payload, options = {}) {
    const taskId = `${type}_${Date.now()}_${Math.random()}`
    const { timeout = 10000 } = options

    return new Promise((resolve, reject) => {
      // 超时处理
      const timer = setTimeout(() => {
        this.pendingTasks.delete(taskId)
        reject(new Error(`Worker 任务超时：${type}`))
      }, timeout)

      this.pendingTasks.set(taskId, {
        resolve: (result) => { clearTimeout(timer); resolve(result) },
        reject: (err) => { clearTimeout(timer); reject(err) }
      })

      this.worker.postMessage({ type, payload, taskId })
    })
  }

  // Transferable Objects：零拷贝传输大型 ArrayBuffer
  sendBuffer(type, buffer) {
    const taskId = `${type}_${Date.now()}`
    return new Promise((resolve, reject) => {
      this.pendingTasks.set(taskId, { resolve, reject })
      // 第二个参数指定 transfer list，buffer 所有权转移给 Worker（零拷贝）
      this.worker.postMessage({ type, payload: buffer, taskId }, [buffer])
    })
  }

  terminate() {
    this.worker.terminate()
    this.pendingTasks.forEach(({ reject }) => reject(new Error('Worker 已终止')))
    this.pendingTasks.clear()
  }
}

// 使用
const workerClient = new WorkerClient('/compute-worker.js')

// 解析 Markdown
const html = await workerClient.send(WorkerMessageType.PARSE_MARKDOWN, {
  content: markdownText
})

// 计算流程图布局（CPU 密集，移入 Worker 收益最大）
const layout = await workerClient.send(WorkerMessageType.COMPUTE_LAYOUT, {
  nodes,
  edges
})
```

### 1.3 哪些任务适合移入 Worker，哪些不能

**适合移入 Worker 的判断标准：**
- 执行时间 > 16ms（会导致掉帧）
- 纯计算，不需要访问 DOM
- 输入/输出数据可序列化（JSON 或 ArrayBuffer）

| 任务 | 是否适合 Worker | 理由 |
|------|----------------|------|
| Markdown 解析（大文本） | ✅ 适合 | CPU 密集，纯计算 |
| 流程图布局计算（Dagre） | ✅ 适合 | 图算法，耗时明显 |
| JSON Schema 校验 | ✅ 适合 | 大 Schema 校验耗时 |
| AST Diff | ✅ 适合 | 树遍历，纯计算 |
| DOM 操作 | ❌ 不能 | Worker 无法访问 DOM |
| 动画（requestAnimationFrame） | ❌ 不能 | 需要在主线程与渲染帧同步 |
| WebSocket / fetch | ❌ 不建议 | 网络 IO 在主线程处理即可，Worker 无收益 |
| 少量数据的简单计算 | ❌ 不值得 | 消息传递本身有序列化开销（约 0.1~1ms） |

**消息传参注意事项：**

```javascript
// ❌ 避免传递不可序列化的数据
worker.postMessage({ fn: () => {} }) // 函数无法被序列化，直接丢失

// ✅ 传递大型二进制数据时使用 Transferable
const buffer = new ArrayBuffer(10 * 1024 * 1024) // 10MB
worker.postMessage({ buffer }, [buffer]) // 零拷贝，主线程 buffer 变为空

// ✅ 普通对象使用结构化克隆（自动处理，无需特殊配置）
worker.postMessage({ nodes: [...], edges: [...] })
```

---

## 二、HTTP 缓存策略设计

### 2.1 整体策略：按资源类型分层

不同资源的更新频率不同，缓存策略应差异化配置：

```
资源分类：
├── HTML 入口（index.html）         → 不缓存 / 短缓存
├── 带 hash 的 JS/CSS（app.a1b2c3.js）→ 永久缓存（1年）
├── 图片、字体                       → 长缓存（30天）+ ETag
└── API 接口                         → 不缓存 / 协商缓存
```

**Nginx 配置示例：**

```nginx
server {
    # HTML 入口：禁止强缓存，每次验证是否有更新
    location ~* \.html$ {
        add_header Cache-Control "no-cache, must-revalidate";
        add_header ETag $request_filename;
    }

    # 带内容 hash 的静态资源：永久缓存（Webpack/Vite 会自动在文件名注入 hash）
    location ~* \.(js|css)$ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # 图片字体：较长缓存 + ETag 协商
    location ~* \.(png|jpg|gif|woff2|svg)$ {
        add_header Cache-Control "public, max-age=2592000"; # 30天
        etag on;
    }

    # API 接口：禁止缓存
    location /api/ {
        add_header Cache-Control "no-store";
        proxy_pass http://backend;
    }
}
```

### 2.2 Cache-Control 字段解析

```
Cache-Control: public, max-age=31536000, immutable
│              │       │                  └─ 资源内容不会改变，跳过过期后的验证请求
│              │       └─ 强缓存有效期（秒），31536000 = 1年
│              └─ 允许代理服务器缓存（CDN 可缓存）
└─ 响应头指令
```

| 指令 | 含义 |
|------|------|
| `no-store` | 完全不缓存（含敏感数据的 API 接口） |
| `no-cache` | 缓存但每次使用前验证（HTML 入口） |
| `max-age=N` | 强缓存有效期 N 秒 |
| `immutable` | 强缓存期间不发验证请求（配合 hash 文件名使用） |
| `must-revalidate` | 过期后必须验证，不使用过期缓存 |
| `ETag` | 协商缓存标识，内容变化则 ETag 变化 |

### 2.3 线上 JS 出 bug，用户拿到旧缓存怎么办

**根本解决方案（构建时）：** 基于内容 hash 的文件名，打包工具（Webpack/Vite）会自动生成：

```
app.a1b2c3d4.js  →  修改代码后  →  app.e5f6g7h8.js（hash 变化，URL 变化）
```

URL 变化意味着旧缓存自然失效，浏览器会请求新文件。这是**最根本的缓存破坏方案**，通过 HTML 入口的不缓存策略保证 HTML 拉到最新的 JS 文件名。

**紧急修复场景（已出 bug）：**

```javascript
// 方案一：Service Worker 强制更新（推荐）
// 在 SW 的 activate 阶段清除旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CURRENT_CACHE_VERSION)
          .map(name => caches.delete(name))
      )
    )
  )
})

// 方案二：在 HTML 中强制指定版本 query（紧急回退方案）
// 修改 Nginx 配置让 HTML 返回最新的，HTML 中的 script src 带版本号
// <script src="/app.js?v=20260227-hotfix"></script>

// 方案三：通知用户刷新
// 轮询检测版本接口，版本不一致时提示刷新
async function checkAppVersion() {
  const res = await fetch('/api/version')
  const { version } = await res.json()
  const currentVersion = window.__APP_VERSION__

  if (version !== currentVersion) {
    showUpdateBanner('检测到新版本，请刷新页面获取最新内容')
  }
}
setInterval(checkAppVersion, 5 * 60 * 1000) // 每5分钟检查一次
```

---

## 总结

**Web Worker** 的价值在于将 CPU 密集型任务移出主线程，保证 UI 的 60fps 流畅度。选择移入 Worker 的判断标准是：执行耗时 > 16ms + 纯计算 + 数据可序列化。消息通信设计上，用常量统一消息类型，用 Promise 封装异步调用，大型二进制数据用 Transferable 实现零拷贝。

**HTTP 缓存**的核心是分层策略：HTML 入口不缓存（确保拿到最新的资源引用），带内容 hash 的 JS/CSS 永久缓存 + immutable（最大化缓存命中），图片字体长缓存 + ETag 协商（兼顾缓存效率与更新能力）。线上出 bug 的根本解法是构建时的 content hash，紧急情况辅以 Service Worker 强制更新或版本号 query 破缓存。
