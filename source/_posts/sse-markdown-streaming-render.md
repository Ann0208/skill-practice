---
title: 实时通信与流式渲染：SSE、Markdown 分块渲染与 requestIdleCallback 实践
date: 2025-11-03 20:00:00
tags:
  - SSE
  - WebSocket
  - Markdown
  - 性能优化
  - requestIdleCallback
categories:
  - 前端技术
---

在 AI 对话类产品中，流式输出是核心用户体验。本文深入探讨 SSE 的选型与实现、Markdown 分块渲染算法的设计，以及如何用 `requestIdleCallback` 做节奏控制——这三个技术点背后都有真实的工程取舍。

<!-- more -->

## 一、SSE vs WebSocket：我们为什么选 SSE

### 1.1 两者的本质区别

| 维度 | SSE | WebSocket |
|------|-----|-----------|
| 通信方向 | 单向（服务端 → 客户端） | 双向 |
| 协议 | HTTP/1.1 或 HTTP/2 | 独立 WS 协议 |
| 断线重连 | 浏览器原生自动重连 | 需手动实现 |
| 代理/防火墙穿透 | 优秀（基于 HTTP） | 较差，部分环境会被拦截 |
| 服务端复杂度 | 低（普通 HTTP 接口） | 高（需维护长连接状态） |
| 适用场景 | 服务端推送（LLM 流式输出） | 实时双向交互（聊天、协作编辑） |

**选 SSE 的核心理由：**

AI 对话的流式输出是**单向的**——LLM 逐 token 生成，推送给客户端。用户的每次输入是一次新的 HTTP POST 请求，并不需要双向实时通道。WebSocket 的双向能力在这个场景下完全用不上，却引入了更高的服务端连接管理成本和更差的代理穿透性。

### 1.2 SSE 的实现方案

**服务端（Node.js/Express）：**

```javascript
// server.js
app.post('/api/chat/stream', async (req, res) => {
  const { messages } = req.body

  // 设置 SSE 必要响应头
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  // 禁用 Nginx 缓冲，确保数据实时到达客户端
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  try {
    const stream = await llm.stream(messages)

    for await (const chunk of stream) {
      const data = JSON.stringify({ content: chunk.text, done: false })
      res.write(`data: ${data}\n\n`)
    }

    // 流结束标志
    res.write(`data: ${JSON.stringify({ content: '', done: true })}\n\n`)
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
  } finally {
    res.end()
  }
})
```

**客户端（原生 EventSource + POST 兼容方案）：**

> 注意：原生 `EventSource` 只支持 GET 请求，AI 场景需要 POST 传递消息历史，需要用 `fetch` + `ReadableStream` 模拟 SSE。

```javascript
class SSEClient {
  constructor({ url, body, onChunk, onDone, onError }) {
    this.url = url
    this.body = body
    this.onChunk = onChunk
    this.onDone = onDone
    this.onError = onError
    this.abortController = new AbortController()
  }

  async connect() {
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.body),
        signal: this.abortController.signal
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // 按 SSE 格式解析（以 \n\n 分隔事件）
        const events = buffer.split('\n\n')
        buffer = events.pop() // 最后一段可能不完整，留到下次

        for (const event of events) {
          if (!event.startsWith('data: ')) continue
          const jsonStr = event.slice(6) // 去掉 "data: " 前缀
          try {
            const data = JSON.parse(jsonStr)
            if (data.done) {
              this.onDone?.()
            } else if (data.error) {
              this.onError?.(new Error(data.error))
            } else {
              this.onChunk?.(data.content)
            }
          } catch (e) {
            // 忽略非 JSON 格式的心跳包（如 ": ping"）
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        this.onError?.(err)
      }
    }
  }

  // 主动断开连接
  disconnect() {
    this.abortController.abort()
  }
}
```

### 1.3 断点重连实现

```javascript
class ResilientSSEClient {
  constructor(options) {
    this.options = options
    this.retryCount = 0
    this.maxRetries = 5
    this.retryDelay = 1000 // 初始 1 秒，指数退避
    this.lastEventId = null // 记录最后接收到的事件 ID，用于断点续传
  }

  async connect() {
    while (this.retryCount <= this.maxRetries) {
      try {
        await this._doConnect()
        // 正常结束，重置重试计数
        this.retryCount = 0
        return
      } catch (err) {
        this.retryCount++
        if (this.retryCount > this.maxRetries) {
          this.options.onError?.(new Error('SSE 连接失败，已超过最大重试次数'))
          return
        }
        // 指数退避：1s, 2s, 4s, 8s, 16s
        const delay = this.retryDelay * Math.pow(2, this.retryCount - 1)
        console.warn(`SSE 断开，${delay}ms 后第 ${this.retryCount} 次重连...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  async _doConnect() {
    const headers = { 'Content-Type': 'application/json' }
    // 断点续传：携带上次的事件 ID
    if (this.lastEventId) headers['Last-Event-ID'] = this.lastEventId

    const response = await fetch(this.options.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(this.options.body),
      signal: this.abortController?.signal
    })
    // ... 读取 stream 逻辑同上
  }
}
```

### 1.4 如何判断服务端已断开

监听以下三个信号：

```javascript
// 方法一：fetch ReadableStream 读到 done=true（reader.read() 返回 {done:true}）
const { done, value } = await reader.read()
if (done) {
  console.log('服务端关闭了连接')
}

// 方法二：fetch 抛出 TypeError（网络中断）
try {
  await fetch(...)
} catch (err) {
  if (err instanceof TypeError) {
    console.log('网络连接中断')
  }
}

// 方法三：服务端心跳超时检测
let heartbeatTimer = null
function resetHeartbeat() {
  clearTimeout(heartbeatTimer)
  heartbeatTimer = setTimeout(() => {
    console.warn('超过 30s 未收到数据，判断服务端已断开，触发重连')
    reconnect()
  }, 30000)
}
// 每次收到 chunk 时调用 resetHeartbeat()
```

> 如果使用原生 `EventSource`，则监听 `onerror` 事件：当服务端关闭连接时，`readyState` 会变为 `CONNECTING`（浏览器自动重连）或 `CLOSED`。

---

## 二、Markdown 分块渲染算法

### 2.1 为什么要分块渲染

**不分块的问题：** LLM 流式输出是逐 token 追加的，如果每个 token 都触发全量 Markdown 重新解析和 DOM 更新，会造成：
- 大量重复的字符串解析开销
- React/Vue 频繁 diff，导致页面卡顿
- 滚动位置跳动

**分块渲染的核心思路：**

将 Markdown 文本按**语义块**拆分（段落、代码块、标题等），只对**新增或变化的块**进行重新渲染，已稳定的块不触发更新。

### 2.2 分块拆解策略

```javascript
/**
 * 将流式 Markdown 文本拆分为语义块
 * 核心规则：
 * - 代码块（```...```）作为一个整体块，避免中间渲染破坏语法高亮
 * - 段落以空行（\n\n）分隔
 * - 标题行（# ## ###）单独成块
 * - 列表项（- * 1.）合并为一个列表块
 */
function splitMarkdownToBlocks(markdown) {
  const blocks = []
  let current = ''
  let inCodeBlock = false
  const lines = markdown.split('\n')

  for (const line of lines) {
    // 代码块开始/结束标记
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock
      current += line + '\n'

      // 代码块结束，作为完整块输出
      if (!inCodeBlock && current.trim()) {
        blocks.push({ type: 'code', content: current.trim() })
        current = ''
      }
      continue
    }

    // 在代码块内，直接追加
    if (inCodeBlock) {
      current += line + '\n'
      continue
    }

    // 标题行：单独成块
    if (/^#{1,6}\s/.test(line)) {
      if (current.trim()) {
        blocks.push({ type: 'paragraph', content: current.trim() })
        current = ''
      }
      blocks.push({ type: 'heading', content: line.trim() })
      continue
    }

    // 空行：段落分隔符
    if (line.trim() === '') {
      if (current.trim()) {
        blocks.push({ type: 'paragraph', content: current.trim() })
        current = ''
      }
      continue
    }

    current += line + '\n'
  }

  // 处理末尾未完成的块（正在流式输入中的块）
  if (current.trim()) {
    blocks.push({
      type: inCodeBlock ? 'code-incomplete' : 'paragraph',
      content: current.trim()
    })
  }

  return blocks
}
```

### 2.3 缓存策略：只渲染变化的块

```javascript
// React 实现示例
const MarkdownRenderer = React.memo(({ markdown }) => {
  const blocks = useMemo(() => splitMarkdownToBlocks(markdown), [markdown])

  return (
    <div className="markdown-body">
      {blocks.map((block, index) => (
        // key 用内容 hash，稳定的块不会重新渲染
        <MarkdownBlock key={`${index}-${hashContent(block.content)}`} block={block} />
      ))}
    </div>
  )
})

// 单个块用 React.memo 隔离，只有 content 变化时才重新渲染
const MarkdownBlock = React.memo(({ block }) => {
  const html = useMemo(() => marked.parse(block.content), [block.content])
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}, (prev, next) => prev.block.content === next.block.content)
```

**缓存策略要点：**
- 已稳定的块（前面的段落）通过 `React.memo` + 稳定 `key` 完全跳过重渲染
- 只有最后一个"活跃块"（正在流式写入的块）会频繁更新
- 代码块在 ` ``` ` 闭合前标记为 `incomplete`，不触发语法高亮解析

### 2.4 一万行 Markdown + 滚动卡顿的处理方案

这是典型的**长列表性能问题**，解决方案分两层：

**第一层：虚拟滚动（只渲染视口内的块）**

```javascript
import { FixedSizeList } from 'react-window'

function VirtualMarkdownRenderer({ blocks }) {
  return (
    <FixedSizeList
      height={600}        // 容器高度
      itemCount={blocks.length}
      itemSize={80}       // 每块预估高度（动态高度用 VariableSizeList）
      overscanCount={5}   // 视口外额外渲染 5 个，避免滚动白屏
    >
      {({ index, style }) => (
        <div style={style}>
          <MarkdownBlock block={blocks[index]} />
        </div>
      )}
    </FixedSizeList>
  )
}
```

**第二层：解析任务移出主线程（Web Worker）**

```javascript
// markdown-worker.js
importScripts('marked.min.js')

self.onmessage = ({ data }) => {
  const { blocks, taskId } = data
  const rendered = blocks.map(block => ({
    ...block,
    html: marked.parse(block.content)
  }))
  self.postMessage({ taskId, rendered })
}

// 主线程
const worker = new Worker('/markdown-worker.js')
worker.postMessage({ blocks: pendingBlocks, taskId: Date.now() })
worker.onmessage = ({ data }) => {
  updateRenderedBlocks(data.rendered)
}
```

---

## 三、requestIdleCallback 节奏控制

### 3.1 使用场景与原理

`requestIdleCallback`（rIC）在浏览器**主线程空闲时**才执行回调，适合处理低优先级的非紧急任务（如批量渲染新到的 Markdown 块）。

```javascript
class IdleRenderer {
  constructor() {
    this.queue = []      // 待渲染的任务队列
    this.scheduled = false
  }

  enqueue(task) {
    this.queue.push(task)
    if (!this.scheduled) {
      this.scheduled = true
      this.scheduleFlush()
    }
  }

  scheduleFlush() {
    requestIdleCallback(deadline => {
      // deadline.timeRemaining() 返回当前帧剩余空闲时间（ms）
      while (this.queue.length > 0 && deadline.timeRemaining() > 1) {
        const task = this.queue.shift()
        task()
      }

      if (this.queue.length > 0) {
        // 还有任务，等下一次空闲
        this.scheduleFlush()
      } else {
        this.scheduled = false
      }
    }, { timeout: 2000 }) // 最长等待 2s，防止任务饿死
  }
}
```

### 3.2 如何检测 rIC 被主线程阻塞

```javascript
// 方法：对比 rIC 的计划调用时间与实际触发时间
function monitorIdleCallbackDelay() {
  let scheduledAt = null

  function schedule() {
    scheduledAt = performance.now()
    requestIdleCallback(deadline => {
      const delay = performance.now() - scheduledAt
      if (delay > 100) {
        // 延迟超过 100ms，说明主线程被长任务阻塞
        console.warn(`rIC 被阻塞，延迟 ${delay.toFixed(1)}ms，剩余空闲：${deadline.timeRemaining().toFixed(1)}ms`)
        reportToMonitoring({ type: 'rIC_block', delay })
      }
      schedule() // 持续监测
    })
  }

  schedule()
}
```

### 3.3 测试验证：确认不卡主线程

```javascript
// 测试方法：用 Long Task API 检测主线程是否被阻塞
const observer = new PerformanceObserver(list => {
  for (const entry of list.getEntries()) {
    console.warn('Long Task 检测到：', entry.duration + 'ms', entry.attribution)
  }
})
observer.observe({ entryTypes: ['longtask'] })

// 同时监控帧率
let lastTime = performance.now()
function checkFPS() {
  const now = performance.now()
  const fps = 1000 / (now - lastTime)
  if (fps < 30) console.warn('帧率过低：', fps.toFixed(1))
  lastTime = now
  requestAnimationFrame(checkFPS)
}
requestAnimationFrame(checkFPS)
```

在 Chrome DevTools Performance 面板中，正确使用 rIC 后，主线程 Timeline 上不应出现连续的红色 Long Task 标记。

---

## 总结

- **选 SSE 而非 WebSocket**：AI 流式输出是单向推送，SSE 更轻量，代理穿透更好，浏览器原生支持自动重连
- **断点重连**：监听 fetch stream 的 `done` 信号 + 指数退避重试 + 心跳超时检测
- **Markdown 分块**：按语义边界（代码块、段落、标题）拆分，用 `React.memo` + 内容哈希 key 隔离稳定块
- **万行 Markdown**：虚拟滚动（react-window）+ 解析任务移入 Web Worker
- **rIC 节奏控制**：通过计划时间与实际触发时间差检测阻塞，用 Long Task API + 帧率监控验证效果
