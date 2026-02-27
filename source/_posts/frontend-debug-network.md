---
title: 前端工程排查与网络优化：接口监控、CORS 处理与线上问题定位
date: 2025-03-05 19:30:00
tags:
  - 工程化
  - 性能监控
  - CORS
  - axios
  - 白屏排查
categories:
  - 前端技术
---

生产环境的问题排查能力，是区分初级和高级前端工程师的重要标准之一。本文结合 AI 流程图项目的实际经验，系统梳理前端在排查链路问题、接口监控、CORS 处理、白屏定位等方面的工程实践。

<!-- more -->

## 一、AI 流程图节点报错的排查思路

### 1.1 问题背景

AI 流程图中，每个节点（Node）都是一个独立的执行单元，节点间通过边（Edge）传递数据。当某节点逻辑出 bug 导致运行时报错，如何快速定位到具体是哪一步出问题？

### 1.2 前端如何感知"哪一步挂了"

**关键设计：节点执行状态机 + 错误上下文携带**

```javascript
// 节点执行状态定义
const NodeStatus = {
  IDLE: 'idle',
  RUNNING: 'running',
  SUCCESS: 'success',
  ERROR: 'error',
  SKIPPED: 'skipped'
}

// 每个节点执行时，前端维护其状态和错误信息
class WorkflowExecutor {
  constructor(nodes, edges) {
    this.nodes = nodes
    this.edges = edges
    // 节点执行状态 Map
    this.nodeStatus = new Map(nodes.map(n => [n.id, { status: NodeStatus.IDLE }]))
  }

  async executeNode(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId)
    // 1. 更新 UI：节点变为"运行中"
    this.updateStatus(nodeId, { status: NodeStatus.RUNNING, startTime: Date.now() })

    try {
      // 2. 调用后端执行接口，携带节点 ID
      const result = await fetch('/api/workflow/execute-node', {
        method: 'POST',
        body: JSON.stringify({
          nodeId,
          nodeType: node.type,
          input: this.getNodeInput(nodeId), // 从上游节点获取输入
          traceId: this.traceId            // 全链路追踪 ID
        })
      }).then(r => r.json())

      // 3. 成功：更新状态，传递输出给下游
      this.updateStatus(nodeId, {
        status: NodeStatus.SUCCESS,
        output: result.output,
        duration: Date.now() - this.nodeStatus.get(nodeId).startTime
      })
      return result.output

    } catch (err) {
      // 4. 失败：记录错误上下文，UI 高亮出错节点
      const errorContext = {
        status: NodeStatus.ERROR,
        error: {
          message: err.message,
          nodeId,
          nodeType: node.type,
          input: this.getNodeInput(nodeId),
          timestamp: Date.now(),
          traceId: this.traceId
        }
      }
      this.updateStatus(nodeId, errorContext)

      // 5. 上报错误监控
      reportError(errorContext)
      throw err
    }
  }

  // 拓扑排序执行所有节点
  async run() {
    this.traceId = generateTraceId()
    const sortedNodes = topologicalSort(this.nodes, this.edges)

    for (const nodeId of sortedNodes) {
      try {
        await this.executeNode(nodeId)
      } catch (err) {
        // 节点失败：中断后续依赖节点
        const dependents = getDependentNodes(nodeId, this.edges)
        dependents.forEach(id => this.updateStatus(id, { status: NodeStatus.SKIPPED }))
        break
      }
    }
  }
}
```

**排查步骤：**
1. 前端 UI 高亮出错节点（红色边框），鼠标悬停显示错误信息
2. 控制台打印完整错误上下文（nodeId、input、traceId）
3. 用 traceId 在日志系统（Sentry/Loki）中查找后端对应的链路日志
4. 检查该节点的输入数据是否符合预期（排除上游节点输出问题）
5. 检查节点类型对应的处理逻辑是否有边界条件未覆盖

---

## 二、页面白屏的排查方法论

### 2.1 白屏的常见根因分类

```
白屏根因
├── JS 资源加载失败（404、CORS、CDN 故障）
├── JS 运行时报错（语法错误、未处理的 Promise 拒绝）
├── React/Vue 渲染报错（组件 throw，无 ErrorBoundary 兜底）
├── 接口请求失败（数据未加载，组件渲染依赖数据）
└── 内存溢出导致页面崩溃
```

### 2.2 第一时间排查步骤

```
Step 1: 打开 Chrome DevTools → Console
   → 有无红色错误？定位第一个报错

Step 2: Network 面板
   → 有无资源 404/500？
   → 有无接口请求失败（红色）？

Step 3: 查看错误监控（Sentry）
   → 搜索该用户 ID / Session 的错误事件
   → 查看 Breadcrumbs（面包屑）还原操作路径

Step 4: Source 面板
   → 启用 source map，定位到具体源码行
```

### 2.3 生产白屏案例：React 组件报错无兜底

```jsx
// ❌ 没有 ErrorBoundary：组件报错会导致整棵树卸载 → 白屏
function App() {
  return <UserDashboard />  // 如果这里报错，整个页面白屏
}

// ✅ 加上 ErrorBoundary：组件报错只影响局部
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // 上报错误到监控系统
    reportError(error, {
      componentStack: info.componentStack,
      userId: getCurrentUser()?.id
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>页面加载出现问题</h2>
          <button onClick={() => window.location.reload()}>刷新重试</button>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  return (
    <ErrorBoundary>
      <UserDashboard />
    </ErrorBoundary>
  )
}
```

**前端监控埋点（白屏检测）：**

```javascript
// 检测页面是否白屏：检查关键 DOM 节点是否存在
function detectBlankPage() {
  setTimeout(() => {
    const root = document.getElementById('app')
    const hasContent = root && root.children.length > 0

    if (!hasContent) {
      // 白屏！上报监控
      reportToMonitoring({
        type: 'blank_page',
        url: location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      })
    }
  }, 3000) // 3s 后检测
}

// 监听全局未捕获错误
window.addEventListener('error', (event) => {
  reportError({
    type: 'js_error',
    message: event.message,
    filename: event.filename,
    line: event.lineno,
    col: event.colno,
    stack: event.error?.stack
  })
}, true)

// 监听未处理的 Promise 拒绝
window.addEventListener('unhandledrejection', (event) => {
  reportError({
    type: 'unhandled_rejection',
    reason: event.reason?.message || String(event.reason)
  })
})
```

---

## 三、Axios 接口耗时统计方案

### 3.1 基础：用拦截器记录耗时

```javascript
import axios from 'axios'

// 存储每个请求的开始时间
const requestTimings = new Map()

// 请求拦截器：记录开始时间
axios.interceptors.request.use(config => {
  config.metadata = { startTime: performance.now() }
  return config
})

// 响应拦截器：计算耗时
axios.interceptors.response.use(
  response => {
    const duration = performance.now() - response.config.metadata.startTime
    // 记录本次请求耗时
    recordTiming({
      url: response.config.url,
      method: response.config.method,
      status: response.status,
      duration
    })
    return response
  },
  error => {
    if (error.config) {
      const duration = performance.now() - error.config.metadata.startTime
      recordTiming({
        url: error.config.url,
        method: error.config.method,
        status: error.response?.status,
        duration,
        isError: true
      })
    }
    return Promise.reject(error)
  }
)
```

### 3.2 进阶：统计 10 个 API 的平均响应时间和最慢 URL

```javascript
class APIPerformanceMonitor {
  constructor() {
    this.records = [] // 所有请求记录
  }

  record({ url, duration, status }) {
    this.records.push({ url, duration, status, timestamp: Date.now() })
  }

  // 统计平均响应时间和最慢 URL
  getStats(topN = 10) {
    if (this.records.length === 0) return null

    // 按 URL 分组统计
    const urlStats = this.records.reduce((acc, { url, duration }) => {
      if (!acc[url]) acc[url] = { total: 0, count: 0, max: 0 }
      acc[url].total += duration
      acc[url].count++
      acc[url].max = Math.max(acc[url].max, duration)
      return acc
    }, {})

    // 计算每个 URL 的平均耗时
    const statsArray = Object.entries(urlStats).map(([url, { total, count, max }]) => ({
      url,
      avgDuration: total / count,
      maxDuration: max,
      requestCount: count
    }))

    // 按平均耗时降序排列
    statsArray.sort((a, b) => b.avgDuration - a.avgDuration)

    // 全局平均响应时间
    const totalDuration = this.records.reduce((sum, r) => sum + r.duration, 0)
    const globalAvg = totalDuration / this.records.length

    return {
      globalAvgDuration: globalAvg.toFixed(2) + 'ms',
      slowestURL: statsArray[0]?.url,
      slowestAvgDuration: statsArray[0]?.avgDuration.toFixed(2) + 'ms',
      // Top N 最慢接口
      topSlowest: statsArray.slice(0, topN)
    }
  }
}

const monitor = new APIPerformanceMonitor()

// 在 axios 响应拦截器中调用
function recordTiming(data) {
  monitor.record(data)
}

// 定期输出报告（或在页面卸载前上报）
setInterval(() => {
  const stats = monitor.getStats()
  if (stats) {
    console.table(stats.topSlowest)
    reportToMonitoring({ type: 'api_perf', ...stats })
  }
}, 60000)
```

---

## 四、CORS 处理：不支持 OPTIONS 的场景

### 4.1 理解 CORS 预检请求

当跨域请求满足以下任一条件，浏览器会先发 `OPTIONS` 预检请求：
- 请求方法不是 GET/POST/HEAD
- 请求头包含 `Content-Type: application/json`（非简单请求头）
- 自定义请求头（如 `Authorization`）

### 4.2 场景：A 系统调 B 系统，B 不支持 OPTIONS

**方案一：代理转发（推荐，最根本）**

```javascript
// Vite 开发环境代理
// vite.config.js
export default {
  server: {
    proxy: {
      '/api/b-system': {
        target: 'https://b-system.internal.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/b-system/, '')
      }
    }
  }
}

// 生产环境：Nginx 反向代理
// A 系统前端请求 /api/proxy/b-system/xxx
// Nginx 将其转发给 B 系统，绕过浏览器 CORS 限制（服务端无同源限制）
```

```nginx
location /api/proxy/b-system/ {
    proxy_pass https://b-system.internal.com/;
    proxy_set_header Host b-system.internal.com;
    proxy_set_header X-Forwarded-For $remote_addr;
}
```

**方案二：发送简单请求（避免触发 OPTIONS）**

```javascript
// 使用 Content-Type: text/plain 并在 body 中携带 JSON 字符串
// 这是一个简单请求，不会触发 OPTIONS 预检
// ⚠️ 需要服务端也支持这种格式解析
fetch('https://b-system.com/api/data', {
  method: 'POST',
  headers: {
    'Content-Type': 'text/plain'  // 避免触发预检
  },
  body: JSON.stringify({ key: 'value' })
})

// 服务端（B 系统）：手动解析 body 字符串
```

**方案三：JSONP（仅限 GET 请求的历史方案）**

```javascript
// 仅适用于 GET 请求，且 B 系统需要支持 JSONP
function jsonp(url, callbackName = 'callback') {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    const fnName = `__jsonp_${Date.now()}`
    window[fnName] = (data) => {
      resolve(data)
      document.head.removeChild(script)
      delete window[fnName]
    }
    script.src = `${url}?${callbackName}=${fnName}`
    script.onerror = reject
    document.head.appendChild(script)
  })
}
```

**方案四：让 B 系统添加 CORS 响应头（最正规的解决方案）**

```
Access-Control-Allow-Origin: https://a-system.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400  // OPTIONS 预检缓存 24 小时，减少后续预检次数
```

---

## 总结

- **节点报错排查**：前端维护状态机 + 全链路 traceId，通过监控系统关联前后端日志快速定位
- **白屏排查**：第一时间看 Console 和 Network，配合 ErrorBoundary 防止全量白屏，用 Sentry Breadcrumbs 还原用户操作路径
- **接口耗时监控**：Axios 拦截器 + 按 URL 分组统计，定期上报平均耗时和最慢接口
- **CORS 处理**：最优先选反向代理（Nginx/BFF）绕过浏览器限制，其次让服务端正确配置 CORS 响应头，Content-Type: text/plain 是紧急临时方案
