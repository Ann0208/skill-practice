---
title: MCP 学习笔记：原理、角色、实战搭建与 API / Function Calling 对比
date: 2026-03-10 21:10:00
tags:
  - MCP
  - AI Agent
  - Function Calling
  - 工程实践
categories:
  - AI Agent
---

最近我系统学习了一遍 MCP（Model Context Protocol），这篇文章把核心问题一次讲清楚：

1. MCP 怎么工作（含架构图）
2. MCP Server / Client 分别是什么
3. 如何自己搭建一个 MCP 服务
4. MCP 和 API / Function Calling 到底有什么区别

<!-- more -->

## 一、MCP 怎么工作

可以把 MCP 理解为：**大模型与外部工具/数据之间的一层标准协议**。  
它不关心你背后是数据库、文件系统还是内部平台，只要求双方按统一格式通信。

### 1.1 整体架构图

```text
+-------------------+         MCP 协议          +------------------------+
|   LLM App / IDE   | <-----------------------> |       MCP Server       |
| (Chat/Agent UI)   |                           |  (Tools/Resources/...) |
+---------+---------+                           +-----------+------------+
          |                                                 |
          | 用户问题                                        | 访问真实能力
          v                                                 v
+-------------------+                           +------------------------+
|   MCP Client      |                           |  DB / API / Filesystem |
| (会话编排与调用)   |                           |  企业系统 / 本地脚本     |
+-------------------+                           +------------------------+
```

### 1.2 工作流程（简化版）

1. 用户在 AI 应用里提问
2. MCP Client 与 MCP Server 建立连接（如 `stdio` / `http`）
3. Client 拉取 Server 可用能力（工具、资源、提示模板）
4. 模型决定是否调用工具
5. Client 发起工具调用给 Server
6. Server 执行真实逻辑并返回结构化结果
7. Client 将结果回填给模型，模型产出最终回答

一句话总结：**MCP 让“模型会调用工具”这件事标准化了。**

## 二、MCP Server / Client 是什么

## 1) MCP Client

MCP Client 通常在 AI 应用侧，负责：

- 建立与 MCP Server 的连接
- 发现并管理可用工具
- 在模型与工具之间做调用编排
- 把工具结果回传给模型

你可以把它看成“调度层”。

## 2) MCP Server

MCP Server 是能力提供方，负责：

- 暴露可调用工具（Tools）
- 提供可读取资源（Resources）
- 可选提供提示模板（Prompts）
- 把协议请求转成真实业务执行（查库、调 API、执行脚本）

你可以把它看成“能力适配层”。

## 3) 二者关系

- Client 决定“何时调用什么”
- Server 决定“怎么执行并返回什么”
- 通过 MCP 协议解耦后，应用和工具都更容易替换与复用

## 三、如何自己搭建 MCP 服务（实战）

下面给一个从 0 到 1 的最小可用流程，目标是做一个“需求质量检查” MCP Server。

### 3.1 先定义能力边界

不要一上来写代码，先定义：

- 工具名称：`check_requirement_quality`
- 输入：`title`、`description`
- 输出：问题列表（错别字/歧义/缺失项）+ 改写建议

### 3.2 选择传输方式

- 本地开发优先 `stdio`（简单稳定）
- 多端共享或远程部署可用 `http`

### 3.3 搭建最小 Server（Node.js 示例）

```js
// server.js
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  { name: "tapd-quality-server", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler("tools/list", async () => ({
  tools: [
    {
      name: "check_requirement_quality",
      description: "检查需求文档中的错别字、歧义和缺失信息",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" }
        },
        required: ["title", "description"]
      }
    }
  ]
}));

server.setRequestHandler("tools/call", async (req) => {
  if (req.params.name !== "check_requirement_quality") {
    throw new Error("unknown tool");
  }

  const { title, description } = req.params.arguments;
  const issues = [];

  if (!description || description.length < 30) {
    issues.push("需求描述过短，建议补充业务背景与验收标准");
  }
  if (!/验收|完成标准|预期/.test(description)) {
    issues.push("缺少明确验收标准");
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ title, issues }, null, 2)
      }
    ]
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

### 3.4 在 Client 侧注册并联调

关键检查项：

- Client 能看到 `tools/list` 返回的工具
- 手动触发一次 `tools/call`
- 返回结果结构稳定（便于模型消费）

### 3.5 上线前必做

- 输入参数校验（长度、类型、必填）
- 超时与重试策略
- 权限控制（哪些工具允许谁调用）
- 日志与审计（至少记录调用时间、输入摘要、结果状态）

## 四、MCP vs API / Function Calling：区别是什么

很多人会把这三者混在一起，最直观的理解如下：

| 维度 | MCP | API | Function Calling |
|------|-----|-----|------------------|
| 定位 | 协议标准 | 接口实现 | 模型调用机制 |
| 关注点 | 工具发现、调用、上下文统一 | 某个具体服务能力 | 让模型按 schema 产出调用参数 |
| 复用性 | 高（跨应用复用同一协议） | 中（每个 API 各自定义） | 中（依赖具体模型平台） |
| 开发成本 | 初期稍高，后期扩展低 | 单点低，规模化高 | 中，且受模型平台约束 |
| 适用场景 | 多工具、多数据源、Agent 化场景 | 单一业务服务 | 让模型精准触发函数 |

再说一句大白话：

- **API** 是“你有什么能力”
- **Function Calling** 是“模型怎么决定调用能力”
- **MCP** 是“不同能力如何被统一接入并被模型稳定使用”

它们不是互斥关系，反而常常一起用：  
**MCP Server 的内部实现，往往就是在调用你的现有 API。**

## 五、一个落地建议：从小工具开始，不要一次做全

如果你也想把 MCP 用在自己的项目里，建议顺序是：

1. 先做 1 个高频、低风险工具（如文本检查）
2. 再做 1 个数据读取工具（如查询历史需求）
3. 最后再接入写操作（如回写系统）并加权限审计

这样能快速拿到收益，也能避免一开始就把复杂度拉满。

---

这就是我这一轮的 MCP 学习总结。  
下一篇我会继续写：如何把 MCP 服务接到现有的 TAPD AI 小助手里，做成真正可日常使用的工作流。
