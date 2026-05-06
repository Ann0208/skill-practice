---
title: 自然语言驱动的需求管理平台：AI Agent 如何操控前端 UI
date: 2026-03-20 20:00:00
tags:
  - AI Agent
  - Function Calling
  - Go
  - Vue 3
  - SSE
categories:
  - AI 项目实战
---

让 AI 通过 Function Calling 直接操作前端界面，用自然语言驱动需求管理。Go + Vue 3 全栈，12 个 AI 工具覆盖数据查询、操作和 UI 控制。

<!-- more -->

## 起因

做 B 端系统的同学应该都有体会——需求管理工具用起来步骤繁琐。想查个需求，得先选项目、选迭代、输关键词、点搜索；想改个状态，得点进详情页、找到字段、改完保存。每个操作都不复杂，但串起来就是一堆重复的点击。尤其是项目经理和测试同学，每天在 TAPD 上花的时间比写代码还多。

我当时在想：如果能直接跟系统说"帮我查一下这个迭代里所有未完成的需求"，然后系统自动帮我填好筛选条件、触发搜索、展示结果，那该多爽？不是那种"AI 帮你生成一段文字回复"的交互，而是 **AI 真的去操作界面**——帮你点按钮、填表单、跳页面。

这就是 sop-ai-helper 的出发点——**让 AI 通过 Function Calling 直接操作前端界面，用自然语言驱动需求管理。**


## 项目核心

这是一个完整的全栈项目：
- **后端**：Go 1.24 + Gin + GORM + SQLite，分层架构（Handler → Service → Repository → DB）
- **前端**：Vue 3 + TypeScript + Vite + Element Plus + Pinia + TinyMCE 富文本编辑器
- **AI 引擎**：OpenAI 兼容 API（claude-4.6-sonnet），Function Calling + Agent Loop 多轮推理
- **数据同步**：Cron 定时任务 + TAPD API 集成，AES-256-GCM 加密存储敏感配置

核心亮点是 AI Agent Loop 架构——AI 不只是回答问题，而是能调用 12 个预定义工具，直接操作数据库、调用 TAPD API、甚至控制前端 UI 组件。整个系统还包括一个配套的 manga-tapd-ai 项目，负责 TAPD 数据的定时同步和管理。

## 探索过程

### 搭建 Agent Loop：让 AI "想-做-看-再想"

Agent Loop 是整个项目的核心引擎。简单说就是一个循环：

```
用户消息 → AI 思考 → 要调工具吗？
  ├─ 是 → 执行工具 → 拿到结果 → 喂回 AI → 继续思考（最多 10 轮）
  └─ 否 → 输出最终回答
```

我在 Go 后端实现了这个循环（`agent/agent.go`）。每一轮的流程是：
1. 构建消息列表（系统提示词 + 历史对话 + 用户消息）
2. 调用 LLM 的 `ChatStreamWithTools()` 接口，流式接收响应
3. 解析响应中的文本内容和 tool_calls
4. 如果有 tool_calls，通过 Tool Executor 逐个执行
5. 把工具执行结果追加到消息历史，回到步骤 2
6. 如果没有 tool_calls，说明 AI 给出了最终回答，循环结束

每一轮的 AI 响应都通过 SSE 实时推送给前端——文本内容直接显示在对话框，工具调用会显示执行日志（"正在查询需求列表..."），UI 操作指令则触发前端组件响应。

一开始我把 Agent Loop 写得很简单，结果发现 AI 经常在工具调用链里"迷路"。举个例子：用户说"帮我把这个需求分配给张三"，AI 会先调 `get_stories` 查需求，再调 `update_story` 改分配人。但有时候第一步查到多个结果，AI 不知道该选哪个，就卡住了——要么随便选一个（选错了），要么反复调用查询工具（浪费轮次）。

后来我在系统提示词里加了 **23 条详细的工具使用规则**，比如：
- "查到多个结果时，列出让用户选择，不要自作主张"
- "当用户说'帮我查询 xxx 的需求'时，优先使用前端筛选操作而非返回文本结果"
- "如果用户不在需求列表页，先调用 `frontend_action navigate` 跳转"
- "状态值映射：规划中=planning，开发中=developing，测试中=testing..."

这些规则直接决定了 AI 的行为质量。没有这些规则，AI 就像一个"有能力但没经验的新人"——知道怎么用工具，但不知道什么场景该用什么工具。

### 12 个 AI 工具：从数据查询到 UI 控制

工具系统是按 OpenAI Function Calling 的 JSON Schema 格式定义的（`tool/definitions.go`）。12 个工具覆盖了需求管理的主要场景：

**数据查询类**：
- `get_stories`：列表查询，支持分页、状态筛选、关键词搜索、迭代筛选
- `get_story`：获取单个需求详情
- `search_stories`：关键词搜索
- `get_iterations`：获取所有迭代
- `get_dashboard_stats`：统计数据（状态分布、迭代进度）
- `get_sync_logs`：同步历史记录

**数据操作类**：
- `update_story`：更新需求（名称、状态、负责人、迭代、优先级）
- `sync_from_tapd`：手动触发 TAPD 数据同步
- `auto_assign_stories`：AI 自动分配需求给团队成员

**AI 分析类**：
- `analyze_requirement`：分析需求质量或生成摘要
- `analyze_codebase`：搜索本地代码库（基于 grep）

**前端控制类**：
- `frontend_action`：这是最有意思的工具——它让 AI 能直接控制前端 UI

`frontend_action` 支持十几种 UI 操作：

| 操作 | 说明 | 示例 |
|------|------|------|
| `navigate` | 页面导航 | 跳转到需求详情页 |
| `fill_filters` | 填充筛选条件 | 自动填入关键词和迭代 |
| `trigger_search` | 触发搜索 | 点击搜索按钮 |
| `edit_story_field` | 编辑需求字段 | 修改状态为"开发中" |
| `save_story` | 保存到 TAPD | 提交修改 |
| `refresh_dashboard` | 刷新看板 | 更新统计数据 |
| `open_link` | 打开外部链接 | 跳转到 TAPD 原始页面 |

完整的调用链路是这样的：

```
用户："帮我搜索登录相关的需求"
  ↓
AI 决定调用 frontend_action
  ↓
后端 Tool Executor 执行，返回 ui_action 事件
  ↓
SSE 推送：{"type": "ui_action", "action": "fill_filters", "payload": {"keyword": "登录"}}
  ↓
前端 SSE Handler 收到事件
  ↓
frontendActions.dispatch("fill_filters", {keyword: "登录"})
  ↓
StoryList 组件的事件处理器触发
  ↓
搜索框自动填入"登录"，触发搜索，结果展示在表格中
```


### SSE 三类事件协议：文本、日志、UI 指令

SSE 流式通信是前后端的桥梁。我设计了三类事件协议：

**text 事件**——AI 的文字回复：
```json
{"type": "text", "content": "好的，我帮你查询一下登录相关的需求..."}
```
前端收到后直接追加到对话气泡中，实现打字机效果。

**progress 事件**——工具执行日志：
```json
{"type": "progress", "step": "tool_call", "detail": "执行工具: get_stories", "elapsed_ms": 1234}
```
前端显示为灰色的执行日志，让用户知道 AI 在干什么。这个很重要——如果 AI 在后台执行工具但前端没有任何反馈，用户会以为系统卡死了。

**ui_action 事件**——前端 UI 操作指令：
```json
{"type": "ui_action", "action": "navigate", "payload": {"params": {"path": "/stories/123/edit"}}}
```
前端收到后通过事件总线分发给对应组件执行。

后端实现上，用 Gin 的 `http.Flusher` 做实时推送：
```go
c.Header("Content-Type", "text/event-stream")
c.Header("Cache-Control", "no-cache")
c.Header("Connection", "keep-alive")
flusher := c.Writer.(http.Flusher)
// 每个事件
fmt.Fprintf(c.Writer, "data: %s\n\n", jsonData)
flusher.Flush()
```

前端用 `fetch` + `ReadableStream` 解析 SSE 流（没有用原生 EventSource，因为需要 POST 请求）。这里有个细节——SSE 的数据格式是 `data: {json}\n\n`，但 `ReadableStream` 的 chunk 边界和 SSE 消息边界不一定对齐，一条消息可能被切成两个 chunk。我维护了一个 buffer 来拼接不完整的行，确保每次解析的都是完整的 JSON。

### 前端事件总线：解耦 AI 指令和 UI 组件

AI 发出的 UI 操作指令，需要分发到不同的 Vue 组件去执行。比如 `fill_filters` 要发给 StoryList 组件，`edit_story_field` 要发给 StoryEdit 组件，`refresh_dashboard` 要发给 Dashboard 组件。

我写了一个轻量的事件总线 `FrontendActionDispatcher`（`frontendActions.ts`）：

```typescript
class FrontendActionDispatcher {
  private handlers = new Map<string, Set<ActionHandler>>()
  on(action: string, handler: ActionHandler) { /* 注册 */ }
  off(action: string, handler: ActionHandler) { /* 注销 */ }
  dispatch(action: string, params: any) { /* 分发 */ }
}
export const frontendActions = new FrontendActionDispatcher()
```

各个组件在 `onMounted` 时注册自己关心的事件，在 `onUnmounted` 时注销。

这里踩了一个经典的坑：**事件处理器的注册/注销时序问题。** 一开始我在 `onMounted` 里用匿名箭头函数注册事件：

```typescript
// 错误写法
onMounted(() => {
  frontendActions.on('fill_filters', (params) => { /* ... */ })
})
onUnmounted(() => {
  frontendActions.off('fill_filters', (params) => { /* ... */ }) // 这是一个新的函数引用！
})
```

`off` 的时候传入的是一个新的匿名函数，和 `on` 时注册的不是同一个引用，所以注销失败，旧的处理器一直留在事件总线里。组件反复挂载/卸载后，同一个事件会触发多次处理器，导致内存泄漏和重复执行。

修复方法是在 `setup` 顶层定义具名函数：

```typescript
// 正确写法
const handleFillFilters = (params: any) => { /* ... */ }
onMounted(() => frontendActions.on('fill_filters', handleFillFilters))
onUnmounted(() => frontendActions.off('fill_filters', handleFillFilters))
```

这样注册和注销引用的是同一个函数对象，问题解决。这个坑在 Vue 3 的事件总线场景里很常见，但文档里很少提到。

### 从前端到后端的认知重构

这个项目对我来说最大的收获，不是某个具体的技术点，而是完成了**从前端到全栈的认知重构**。

以前写前端，后端就是个"黑盒"——调接口、拿数据、渲染页面。接口返回什么格式、数据怎么存的、并发怎么处理的，统统不关心。但自己写 Go 后端之后，才真正理解了分层架构的意义：

- **Handler 层**（`handler/`）：参数校验、响应格式化、SSE 推送。相当于前端的"Controller"
- **Service 层**（`service/`）：业务逻辑编排。比如"同步需求"这个操作，Service 层要协调 TAPD API 调用、数据库 Upsert、同步日志记录
- **Repository 层**（`repository/`）：数据库操作的封装。所有 GORM 查询都在这一层，上层不直接碰数据库

GORM 的 AutoMigrate 让数据库迁移变得很简单——在 `main.go` 里定义好所有 Model struct，启动时自动建表、加字段：

```go
db.AutoMigrate(
  &model.Story{},
  &model.Iteration{},
  &model.SyncLog{},
  &model.StoryChangeLog{},
  &model.TestTask{},
  &model.Project{},
)
```

不用手写 SQL 建表语句，改了 struct 字段重启就自动迁移。对于个人项目来说，这个开发体验太好了。

Cron 定时任务也是第一次写——用 `robfig/cron` 库实现 TAPD 数据的定时同步：
- 每 30 分钟同步一次需求（`*/30 * * * *`）
- 每小时同步一次迭代（`0 * * * *`）

增量同步策略是按 `modified_at` 字段过滤最近 7 天的变更，用 Upsert（有则更新、无则插入）写入本地 SQLite。这样既避免了全量拉取的性能问题，又保证了数据的时效性。

### OpenAI 流式 API 的 Go 实现细节

Go 里处理 OpenAI 的流式 Tool Calling 响应，比想象中复杂。因为一个 tool_call 的参数可能被拆成多个 chunk 发送——第一个 chunk 包含 tool_call 的 ID 和函数名，后续的 chunk 只包含参数的增量片段。

我在 `ai/client.go` 里实现了一个状态机来累积 tool_calls：

```go
// 每个 chunk 可能包含部分 tool_call
for _, choice := range chunk.Choices {
  for _, tc := range choice.Delta.ToolCalls {
    // 按 index 累积参数
    if existing, ok := pendingToolCalls[tc.Index]; ok {
      existing.Arguments += tc.Function.Arguments // 拼接参数片段
    } else {
      pendingToolCalls[tc.Index] = tc // 新的 tool_call
    }
  }
}
```

当 `finish_reason` 为 `"tool_calls"` 时，说明所有 tool_call 都接收完毕，可以开始执行了。超时设为 60 秒。

## 项目成果

经过 25+ 次迭代，交付了一个完整的 AI 驱动需求管理平台，包含 5 个核心页面：

- **需求列表**：支持关键词搜索、迭代筛选、状态筛选，AI 可以直接操作筛选条件
- **迭代管理**：查看所有迭代及其需求分布
- **仪表盘**：需求状态分布饼图、迭代进度条、近期变更时间线
- **需求回归测试**：集成自动化测试，AI 可以触发测试任务
- **项目设置**：TAPD 配置、同步策略、AI 模型选择

核心功能：
- AI 对话式需求管理：自然语言查询、筛选、编辑需求
- AI 控制前端 UI：通过 Function Calling 直接操作界面组件
- 质量分析：AI 自动评估需求文档质量，给出改进建议
- 历史关联分析：找出与当前需求相关的历史需求
- 数据看板：需求状态分布、迭代进度可视化（ECharts）
- 多项目管理：支持切换不同 TAPD 项目空间
- TAPD 数据自动同步：Cron 定时拉取，增量更新，同步日志可追溯
- 需求导出：支持 XLSX 格式导出

## 经验总结

1. **AI 控制 UI 的关键是"精确的工具定义"。** JSON Schema 里的字段描述越清晰，AI 调用工具时的参数就越准确。我发现一个规律：工具的 `description` 字段写得越具体（包括使用场景、参数含义、返回值格式），AI 的调用准确率就越高。模糊的描述会导致 AI 传错参数，用户体验直接崩掉。

2. **系统提示词是 Agent 的"操作手册"。** 我在提示词里写了 23 条工具使用规则和 8 条工作原则。这些规则不是"建议"，而是"必须遵守的操作规范"。比如"当用户说'帮我查询 xxx 的需求'时，优先使用前端筛选操作（fill_filters + trigger_search）而非返回文本结果"——这条规则直接决定了用户体验是"AI 帮我操作界面"还是"AI 给我一段文字"。

3. **SSE 流式通信比想象中复杂。** 不只是"发数据"那么简单，还要处理：事件分类（三种类型）、数据分片（chunk 边界和消息边界不对齐）、连接断开重连、前端状态同步、工具执行过程中的进度反馈。一个看似简单的"AI 回复"，背后是文本流、工具日志、UI 指令三条并行的事件流。

4. **前端工程师写后端，最大的优势是"知道接口该怎么设计"。** 因为自己就是接口的消费者，所以设计出来的 API 天然贴合前端需求。比如需求列表接口，我直接返回了前端表格需要的所有字段（包括迭代名称、状态中文名），不需要前端再做二次查询或映射。联调效率很高——因为根本不需要联调，前后端都是自己写的。

5. **Go 语言对前端工程师很友好。** 静态类型、编译检查、goroutine 并发——这些特性让写后端的心智负担比想象中小。GORM 的 API 设计也很直觉，链式调用 `.Where().Order().Offset().Limit().Find()` 跟前端的链式 API 风格很像。唯一不太习惯的是错误处理——Go 的 `if err != nil` 写多了确实有点烦，但也因此让我养成了更严谨的错误处理习惯。

