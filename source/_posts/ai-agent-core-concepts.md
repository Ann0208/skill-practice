---
title: AI Agent 核心概念与技术选型解析
date: 2026-02-10 20:00:00
tags:
  - AI Agent
  - MCP
  - 技术选型
categories:
  - AI Agent
---

在大语言模型（LLM）工程化落地的浪潮中，**Skill、Agent、MCP** 已成为前端工程师必须理解的三个核心概念。本文结合一线实践，系统梳理这三个概念的定义与边界，并深入探讨 Agent 系统的技术选型逻辑。

<!-- more -->

## 一、如何理解 Skill、Agent、MCP

### 1.1 Skill（技能）

Skill 是 Agent 系统中**最小的可执行能力单元**。可以将其理解为一个封装好的函数或工具，它接收特定输入、执行某种操作、返回结构化输出。

**典型 Skill 示例：**

```javascript
// 一个"搜索网页"的 Skill 定义
const searchWebSkill = {
  name: 'search_web',
  description: '根据关键词搜索互联网并返回摘要结果',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '搜索关键词' },
      limit: { type: 'number', description: '返回结果数量，默认5' }
    },
    required: ['query']
  },
  // 实际执行逻辑
  execute: async ({ query, limit = 5 }) => {
    const results = await searchAPI(query, limit)
    return results.map(r => ({ title: r.title, snippet: r.snippet, url: r.url }))
  }
}
```

Skill 的核心价值在于**原子性与可复用性**：同一个"发送邮件"Skill 可以被不同的 Agent 调用，实现能力共享。

### 1.2 Agent（智能体）

Agent 是一个**能够自主感知环境、规划任务、调用 Skill、执行行动的自治系统**。它的核心在于"ReAct 循环"——Reason（推理）+ Act（行动）的交替迭代。

```
用户输入 → [LLM 推理：我需要做什么？] → [选择并调用 Skill] → [观察结果] → [继续推理] → 输出最终答案
```

**Agent 与普通 LLM 调用的本质区别：**

| 维度 | 普通 LLM 调用 | Agent |
|------|-------------|-------|
| 任务处理 | 单轮问答 | 多步骤规划执行 |
| 工具使用 | 无 | 可调用外部 Skill |
| 自主性 | 被动响应 | 主动决策 |
| 状态管理 | 无记忆 | 维护上下文与状态 |

从工程实现角度，一个 Agent 通常包含以下模块：

```javascript
class Agent {
  constructor({ llm, skills, memory, maxIterations = 10 }) {
    this.llm = llm           // 大语言模型（推理核心）
    this.skills = skills     // 可调用的 Skill 列表
    this.memory = memory     // 上下文记忆
    this.maxIterations = maxIterations
  }

  async run(userInput) {
    let iteration = 0
    let context = [{ role: 'user', content: userInput }]

    while (iteration < this.maxIterations) {
      // 1. LLM 推理：决定下一步动作
      const response = await this.llm.chat(context, {
        tools: this.skills.map(s => s.toToolDefinition())
      })

      // 2. 如果 LLM 决定调用工具
      if (response.tool_calls) {
        for (const toolCall of response.tool_calls) {
          const skill = this.skills.find(s => s.name === toolCall.name)
          const result = await skill.execute(toolCall.arguments)
          // 将工具结果追加到上下文
          context.push({ role: 'tool', content: JSON.stringify(result) })
        }
        iteration++
        continue
      }

      // 3. LLM 决定直接回答，退出循环
      return response.content
    }
    throw new Error('Agent 超过最大迭代次数')
  }
}
```

### 1.3 MCP（Model Context Protocol）

MCP 是 Anthropic 提出的**开放标准协议**，用于标准化 LLM 与外部工具/数据源之间的通信方式。可以类比理解为 AI 领域的"USB 接口标准"——不同厂商的工具只要遵循 MCP 规范，就能被任意支持 MCP 的 LLM 调用。

**MCP 解决的核心问题：**

在 MCP 出现之前，每个 Agent 框架都有自己的工具调用格式，造成大量重复适配工作。MCP 通过定义统一的 JSON-RPC 通信协议，实现了工具的即插即用。

```json
// MCP 工具调用请求示例
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "search_web",
    "arguments": {
      "query": "前端性能优化最佳实践",
      "limit": 5
    }
  },
  "id": 1
}
```

**三者的关系总结：**

```
MCP（协议标准）
   ↓ 规范了工具的注册与调用方式
Skill（工具/能力单元）
   ↓ Agent 按需调用
Agent（智能体）
   ↓ 接收用户指令，规划并执行
用户目标
```

---

## 二、Agent 系统的技术选型

构建一个生产级 Agent 系统，技术选型涉及多个维度。以下结合实际落地经验逐一拆解。

### 2.1 LLM 选型

LLM 是 Agent 的推理核心，选型需考量：

- **工具调用能力**：优先选择原生支持 Function Calling 的模型（如 GPT-4o、Claude 3.5、Qwen2.5）
- **上下文窗口**：多步骤 Agent 需要较长上下文，建议 ≥ 32K tokens
- **响应速度**：Agent 每轮推理都有延迟，模型越快用户体验越好
- **成本**：Agent 一次任务可能调用 LLM 数十次，token 成本需纳入考量

```javascript
// 多模型路由策略示例（复杂任务用强模型，简单任务用快模型）
function selectModel(taskComplexity) {
  if (taskComplexity === 'high') return 'claude-opus-4-6'
  if (taskComplexity === 'medium') return 'claude-sonnet-4-6'
  return 'claude-haiku-4-5-20251001'
}
```

### 2.2 框架选型

| 框架 | 适用场景 | 优势 | 劣势 |
|------|---------|------|------|
| LangChain.js | 快速原型、工具链丰富 | 生态完善 | 抽象过重，调试困难 |
| 自研轻量框架 | 定制化需求强 | 灵活可控 | 开发成本高 |
| Vercel AI SDK | Next.js 项目 | 流式集成优秀 | 功能相对基础 |
| AutoGen | 多 Agent 协作 | 支持 Agent 间通信 | 学习曲线陡 |

我们团队最终选择**自研轻量 Agent 框架 + Vercel AI SDK 处理流式输出**。原因在于：业务逻辑定制化程度高，LangChain.js 的黑盒抽象导致问题排查困难，而自研框架每一步的状态都完全可控、可观测。

### 2.3 记忆系统选型

Agent 的记忆分为三层：

```javascript
const memorySystem = {
  // 短期记忆：当前会话上下文，存储在内存
  shortTerm: new ConversationBuffer({ maxTokens: 8000 }),

  // 中期记忆：用户偏好、历史操作摘要，存储在 Redis
  midTerm: new RedisMemory({ ttl: 7 * 24 * 3600 }),

  // 长期记忆：知识库、文档向量，存储在向量数据库
  longTerm: new VectorStore({ provider: 'pinecone' })
}
```

### 2.4 编排模式选型

**单 Agent 模式** vs **多 Agent 协作模式**：

- 任务相对单一 → 单 Agent + 多 Skill
- 任务复杂、需并行执行 → Orchestrator（调度 Agent）+ 多个 Worker Agent

```javascript
// 多 Agent 编排示例
class OrchestratorAgent {
  async run(complexTask) {
    // 1. 任务拆解
    const subTasks = await this.decompose(complexTask)

    // 2. 并行分发给专业 Agent
    const results = await Promise.all(
      subTasks.map(task => {
        const workerAgent = this.selectWorker(task.type)
        return workerAgent.run(task)
      })
    )

    // 3. 聚合结果
    return this.aggregate(results)
  }
}
```

### 2.5 可观测性方案

Agent 系统的调试难点在于多步骤链路追踪。我们接入了以下方案：

```javascript
// 每次 Skill 调用都记录追踪信息
class TracedSkill {
  async execute(params) {
    const traceId = generateTraceId()
    const startTime = Date.now()

    try {
      const result = await this.skill.execute(params)
      logger.info({ traceId, skill: this.skill.name, params, result, duration: Date.now() - startTime })
      return result
    } catch (err) {
      logger.error({ traceId, skill: this.skill.name, params, error: err.message })
      throw err
    }
  }
}
```

---

## 总结

Skill 是能力的最小单元，Agent 是自主执行复杂任务的智能体，MCP 是连接二者的标准协议。技术选型上，没有银弹——LLM 选性能与成本的平衡点，框架选可控性与开发效率的最优解，记忆系统按任务时效性分层设计，最终用可观测性保障系统稳定运行。

理解这三个概念的边界与协作关系，是构建工程级 AI 系统的第一步。
