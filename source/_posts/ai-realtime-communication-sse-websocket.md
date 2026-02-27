---
title: AI 实时通信技术：SSE、WebSocket 与大模型流式输出实践
date: 2026-02-19 21:00:00
tags:
  - SSE
  - WebSocket
  - AI
  - 流式输出
  - 实时通信
  - 断连重连
categories:
  - AI Agent
---

随着 AI 对话应用的普及，实时通信技术成为前端工程师的必备技能。本文深入对比 SSE 与 WebSocket 的技术选型，解析大模型流式输出的前后端实现，以及断连重连、Markdown 实时渲染等工程化方案。

<!-- more -->

## 一、SSE vs WebSocket：技术选型

### 1.1 核心对比

| 维度 | SSE（Server-Sent Events） | WebSocket |
|------|---------------------------|-----------|
| 通信方向 | 单向（服务器 → 客户端） | 双向（全双工） |
| 协议 | HTTP/HTTPS（基于 HTTP） | WS/WSS（独立协议，握手后升级） |
| 数据格式 | 文本（UTF-8） | 文本或二进制 |
| 自动重连 | 浏览器原生支持 | 需手动实现 |
| 心跳机制 | 原生不支持，需服务端定期发送注释行 | 需手动实现 |
| 并发限制 | HTTP/1.1 最多 6 个连接/域名 | 无限制 |
| 适用场景 | 消息推送、AI 流式输出、日志流 | 聊天室、协同编辑、实时游戏 |
| 实现复杂度 | 简单，前端直接用 EventSource | 较复杂，需处理断线重连等 |

### 1.2 为什么 AI 对话优选 SSE

大模型流式输出（Streaming）是典型的**服务端单向推送**场景：

1. 模型生成 token，一个字一个字推送给前端；
2. 用户不需要向服务端发送实时数据（只有初始请求）；
3. SSE 基于 HTTP，与现有 CDN、负载均衡、代理天然兼容；
4. 前端实现成本极低，`EventSource` API 原生支持自动重连。

---

## 二、SSE 实现：大模型流式对话

### 2.1 服务端（Node.js / Express）

```javascript
// server.js
const express = require('express');
const { OpenAI } = require('openai');

const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/api/chat/stream', async (req, res) => {
  const { messages } = req.body;

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders(); // 立即发送头部

  try {
    // 调用大模型 API（流式模式）
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      stream: true, // 开启流式
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        // SSE 数据格式：data: {json}\n\n
        res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
    }

    // 流结束标记
    res.write('data: [DONE]\n\n');
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
  } finally {
    res.end();
  }
});
```

### 2.2 前端（EventSource API）

```javascript
// 基础 SSE 接收
function startSSEChat(messages) {
  // GET 请求用 EventSource，POST 请求需要 fetch 手动读流
  const eventSource = new EventSource(`/api/chat/stream?query=${encodeURIComponent(query)}`);

  eventSource.onmessage = (event) => {
    if (event.data === '[DONE]') {
      eventSource.close();
      return;
    }
    const { content } = JSON.parse(event.data);
    appendToMessage(content);
  };

  eventSource.onerror = () => {
    // 浏览器会自动重连（默认 3 秒后）
    console.log('SSE 连接断开，浏览器自动重连...');
  };
}
```

### 2.3 POST 请求的流式读取（Fetch + ReadableStream）

由于 `EventSource` 只支持 GET，AI 应用通常需要 POST 发送较长消息，需要手动读取流：

```javascript
async function streamChat(messages, onChunk, onDone, onError) {
  const controller = new AbortController();
  let buffer = ''; // 处理分包问题

  try {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        onDone?.();
        break;
      }

      // 解码字节流，处理分包（一次可能收到多个 SSE 事件）
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || ''; // 最后一个可能是未完整的事件

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue;
        const data = line.slice(6); // 去掉 "data: " 前缀
        if (data === '[DONE]') {
          onDone?.();
          return;
        }
        try {
          const { content, error } = JSON.parse(data);
          if (error) { onError?.(error); return; }
          if (content) onChunk(content);
        } catch {} // 忽略解析错误
      }
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      onError?.(error.message);
    }
  }

  // 返回 abort 函数，供用户中断
  return () => controller.abort();
}

// 组件中使用
function ChatComponent() {
  const [messages, setMessages] = useState([]);
  const [currentReply, setCurrentReply] = useState('');
  const abortRef = useRef(null);

  async function sendMessage(userInput) {
    setCurrentReply('');
    const newMessages = [...messages, { role: 'user', content: userInput }];
    setMessages(newMessages);

    abortRef.current = await streamChat(
      newMessages,
      (chunk) => setCurrentReply(prev => prev + chunk), // 增量追加
      () => {
        // 完成：将当前回复加入历史
        setMessages(prev => [...prev, { role: 'assistant', content: currentReply }]);
        setCurrentReply('');
      },
      (err) => console.error('Stream error:', err)
    );
  }

  function stopGeneration() {
    abortRef.current?.(); // 中断请求
  }
}
```

---

## 三、断连重连与心跳机制

### 3.1 大模型流式对话的断连重连

AI 长对话中，网络波动可能导致流中断，需要实现续传：

```javascript
class ResilientSSEClient {
  constructor(url, options = {}) {
    this.url = url;
    this.maxRetries = options.maxRetries || 5;
    this.retryCount = 0;
    this.lastEventId = null; // 记录最后收到的事件 ID（服务端支持时可续传）
  }

  connect(onChunk, onDone, onError) {
    const controller = new AbortController();

    const attemptConnect = async () => {
      try {
        const headers = {
          'Content-Type': 'application/json',
          // 发送最后事件 ID，支持服务端续传
          ...(this.lastEventId && { 'Last-Event-ID': this.lastEventId })
        };

        const response = await fetch(this.url, {
          method: 'POST',
          headers,
          body: this.body,
          signal: controller.signal
        });

        // 连接成功，重置重试计数
        this.retryCount = 0;

        // 读取流...（同上）

      } catch (error) {
        if (error.name === 'AbortError') return;

        this.retryCount++;
        if (this.retryCount <= this.maxRetries) {
          // 指数退避：1s, 2s, 4s, 8s...
          const delay = Math.min(1000 * Math.pow(2, this.retryCount - 1), 30000);
          console.log(`连接断开，${delay}ms 后第 ${this.retryCount} 次重试...`);
          setTimeout(attemptConnect, delay);
        } else {
          onError?.('超过最大重试次数，连接失败');
        }
      }
    };

    attemptConnect();
    return () => controller.abort();
  }
}
```

### 3.2 WebSocket 心跳机制

```javascript
class WebSocketClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.isManualClose = false;
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('WebSocket 连接成功');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // 处理心跳 pong
      if (data.type === 'pong') return;

      this.onMessage?.(data);
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      if (!this.isManualClose) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket 错误:', error);
    };
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));

        // 设置 pong 超时检测
        this.pongTimeout = setTimeout(() => {
          console.log('心跳超时，主动断开重连');
          this.ws.close();
        }, 5000);
      }
    }, 30000); // 每 30 秒发送心跳
  }

  stopHeartbeat() {
    clearInterval(this.heartbeatTimer);
    clearTimeout(this.pongTimeout);
  }

  scheduleReconnect() {
    this.reconnectAttempts++;
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.error('WebSocket 超过最大重连次数');
      return;
    }

    // 指数退避重连
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 60000);
    console.log(`${delay}ms 后进行第 ${this.reconnectAttempts} 次重连...`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      // 消息队列：连接恢复后发送
      this.messageQueue = this.messageQueue || [];
      this.messageQueue.push(data);
    }
  }

  close() {
    this.isManualClose = true;
    this.stopHeartbeat();
    clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}
```

---

## 四、Markdown 实时渲染

### 4.1 流式 Markdown 渲染的挑战

大模型流式输出 Markdown 时，渲染面临的问题：

1. **代码块未闭合**：`` ``` `` 开始后，未收到结束符时如何处理？
2. **中文截断**：多字节 UTF-8 字符可能被截断在两个 chunk 之间；
3. **频繁重渲染**：每个 token 都触发 DOM 更新，性能差。

### 4.2 实现方案

```javascript
import { marked } from 'marked';
import DOMPurify from 'dompurify';

function useMarkdownStream() {
  const [content, setContent] = useState('');
  const rawContent = useRef(''); // 原始 Markdown 文本
  const renderTimer = useRef(null);

  const appendChunk = useCallback((chunk) => {
    rawContent.current += chunk;

    // 节流渲染：最多每 50ms 渲染一次
    if (!renderTimer.current) {
      renderTimer.current = setTimeout(() => {
        const markdown = processIncompleteMarkdown(rawContent.current);
        const html = DOMPurify.sanitize(marked.parse(markdown));
        setContent(html);
        renderTimer.current = null;
      }, 50);
    }
  }, []);

  return { content, appendChunk };
}

// 处理未完整的 Markdown（临时闭合未关闭的代码块）
function processIncompleteMarkdown(text) {
  // 计算未闭合的代码块数量
  const codeBlockMatches = text.match(/```/g) || [];
  const isUnclosed = codeBlockMatches.length % 2 !== 0;

  if (isUnclosed) {
    // 临时添加结束符，使其成为合法 Markdown
    return text + '\n```';
  }
  return text;
}

// 组件使用
function StreamingMessage({ isStreaming }) {
  const { content, appendChunk } = useMarkdownStream();

  // 渲染 HTML（使用 dangerouslySetInnerHTML 时务必 DOMPurify 消毒）
  return (
    <div
      className="message-content"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
```

---

## 五、HTTP/1.1 vs HTTP/2.0

### 5.1 关键差异

| 特性 | HTTP/1.1 | HTTP/2.0 |
|------|----------|----------|
| 协议格式 | 文本 | 二进制帧 |
| 多路复用 | 无（队头阻塞，同域最多 6 连接） | 有（单连接多流并发） |
| 头部压缩 | 无 | HPACK 压缩 |
| 服务器推送 | 无 | 有（Server Push） |
| 对 SSE 的影响 | 最多 6 个 SSE 连接/域名 | 无限制，同一连接多路复用 |

**SSE 在 HTTP/1.1 下的限制**：浏览器对同一域名最多保持 6 个 HTTP 长连接，多个标签页开 SSE 可能互相阻塞。HTTP/2 解决了这个问题。

---

## 六、前端安全：XSS 与 CSRF

### 6.1 XSS（跨站脚本攻击）

**攻击方式**：注入恶意脚本，在用户浏览器执行。

**防御**：

```javascript
// 1. 输出编码（最关键）
// ❌ 危险：直接插入用户输入
element.innerHTML = userInput;

// ✅ 安全：使用 textContent
element.textContent = userInput;

// ✅ 安全：使用 DOMPurify 消毒后再 innerHTML
element.innerHTML = DOMPurify.sanitize(userInput);

// 2. Content Security Policy（CSP 响应头）
// 限制页面可以加载的资源来源
Content-Security-Policy: default-src 'self'; script-src 'self' cdn.example.com

// 3. HttpOnly Cookie（防止 JS 读取 Cookie）
Set-Cookie: session=abc; HttpOnly; Secure; SameSite=Strict
```

### 6.2 CSRF（跨站请求伪造）

**攻击方式**：诱导用户访问恶意页面，利用已有的 Cookie 发送伪造请求。

**防御**：

```javascript
// 1. SameSite Cookie
Set-Cookie: session=abc; SameSite=Strict // 严格模式，跨站不携带 Cookie

// 2. CSRF Token（服务端生成，表单隐藏域携带）
<form>
  <input type="hidden" name="_csrf" value="{{csrfToken}}">
</form>

// 3. 自定义请求头（简单跨域请求不能携带自定义头）
// 在 Ajax 请求中添加自定义头，CSRF 攻击无法做到
headers: { 'X-Requested-With': 'XMLHttpRequest' }

// 4. 验证 Referer / Origin 头
// 服务端验证请求来源是否合法
```

---

## 总结

实时通信技术选型原则：

- **AI 流式输出、消息推送、日志流** → 优选 **SSE**：实现简单、HTTP 兼容好、浏览器原生支持自动重连；
- **聊天室、协同编辑、实时游戏** → 优选 **WebSocket**：全双工通信，延迟更低；
- **断连重连**：SSE 浏览器自动处理（EventSource），WebSocket 需手动实现指数退避重连 + 心跳；
- **Markdown 渲染**：节流渲染（50ms 间隔）+ 临时补全未闭合语法 + DOMPurify 防 XSS；
- **安全**：XSS 防御用输出编码 + CSP，CSRF 防御用 SameSite Cookie + CSRF Token。

掌握这些技术，能够构建稳定、高性能的 AI 对话和实时应用。
