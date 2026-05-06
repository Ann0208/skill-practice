---
title: 写测试、跑测试、改 Bug 全自动：一个 LLM 驱动的全链路测试平台
date: 2026-03-25 20:00:00
tags:
  - AI
  - 自动化测试
  - Playwright
  - E2E
  - Tool Calling
categories:
  - AI 项目实战
---

LLM 驱动的智能测试平台，支持浏览器 E2E 和 HTTP API 双模式，7 阶段渐进式测试结构，还能自动修复 Go 源码 Bug。120+ 次迭代提交。

<!-- more -->

## 为什么做这个

测试是开发流程里最容易被"将就"的环节。手动测试覆盖不全，写自动化测试又费时间，尤其是 E2E 测试——每次需求变更都要更新用例，维护成本很高。我之前做前端的时候，写 Playwright 测试脚本的时间经常比写功能代码还长，而且页面一改，测试脚本就废了。

我当时的想法是：既然 AI 能理解需求、能写代码，那能不能让它**自己决定怎么测、自己执行测试、发现 Bug 后自己修**？不是生成测试脚本让人跑，而是 AI 全程自主控制浏览器和 HTTP 请求，实时判断结果对不对。就像一个"AI 测试工程师"，你告诉它测什么，它自己搞定剩下的。

这个想法最终变成了三个项目：
- **ai-test-agent**：完整版，E2E + API 双模式测试，带 Electron 进度面板
- **ai-test-agent-api**：精简版，纯 API 测试，不依赖浏览器
- **test-agent-for-sop**：针对 SOP 平台的定制版，集成了 TAPD 需求抓取

三个项目共享核心架构，但各有侧重。累计 120+ 次提交，是我所有 AI 探索项目里迭代最多的一个。

## 项目核心

**一个 LLM 驱动的智能测试平台，支持浏览器 E2E 和 HTTP API 双模式测试，7 阶段渐进式测试结构，YAML API 定义引擎，以及 Go 源码自动修复闭环。**

技术栈：
- **CLI 框架**：TypeScript + Commander，支持丰富的命令行参数
- **浏览器自动化**：Playwright，通过 CDP 协议控制 Chromium
- **HTTP 测试**：Node.js 原生 `http`/`https` 模块（不用 axios，减少依赖）
- **AI 引擎**：多 LLM Provider 适配（Claude / GPT-4 / OpenCode），统一的 Tool Calling 接口
- **协议集成**：MCP（Model Context Protocol）SDK，支持外部工具扩展
- **进度展示**：零依赖终端 UI（纯 ANSI 转义码）+ Electron 可视化面板

## 探索过程

### 双模式测试引擎：浏览器 + HTTP

**浏览器 E2E 模式**用 Playwright 控制，我定义了 18 个原生工具（`browser-tools.ts`）给 AI 使用：

交互类工具：
- `click`：点击元素（支持 CSS 选择器和文本匹配）
- `type_text`：输入文字
- `press_key`：按键（Enter、Tab、Escape 等）
- `scroll`：滚动页面
- `hover`：悬停
- `navigate`：导航到 URL
- `wait`：等待条件满足
- `go_back`：返回上一页

断言类工具：
- `assert_visible`：断言元素可见
- `assert_text`：断言文本内容
- `assert_not_visible`：断言元素不可见
- `assert_url`：断言当前 URL
- `assert_count`：断言元素数量

页面分析工具：
- `get_page_state`：获取页面状态（URL、标题、可交互元素列表）
- `take_screenshot`：截图（用于 AI 视觉分析）
- `get_accessibility_tree`：获取无障碍树（DOM 结构的语义化表示）

AI 的工作方式是：拿到测试用例后，自己决定调用哪些工具、按什么顺序执行、怎么判断结果。比如测试"登录功能"，AI 会自己导航到登录页、调用 `get_page_state` 分析页面结构、找到用户名和密码输入框、输入测试账号、点击登录按钮、用 `assert_url` 检查是否跳转到首页。整个过程不需要人写一行测试脚本。

**API 模式**用 Node.js 原生 HTTP/HTTPS 客户端（`api-tools.ts`），工具更精简但功能完整：

- `send_request`：发送 HTTP 请求（支持 GET/POST/PUT/DELETE）
- `execute_yaml_api`：执行 YAML 定义的 API（自动合并三层参数）
- `assert_status`：断言 HTTP 状态码
- `assert_body_contains`：断言响应体包含指定内容
- `assert_header`：断言响应头
- `extract_value`：从响应中提取值（JSONPath）存为变量
- `set_variable`：设置变量（用于跨请求传递数据）
- `mark_item` / `skip_item`：标记测试项通过/跳过

API 模式有个特殊处理——UAT 环境的 TLS 证书经常是自签名的，我在 HTTP 客户端里加了 `rejectUnauthorized: false` 的可选配置，避免证书校验失败导致测试跑不起来。

### 7 阶段渐进式测试：从冒烟到回归

一开始我让 AI 自由发挥，结果测试用例质量参差不齐——有时候测得太浅（只检查页面能打开），有时候又钻牛角尖（反复测一个边界条件，花了 80% 的 Token 预算）。

后来我设计了 7 个阶段的渐进式结构，每个阶段有明确的目标和范围：

**Phase 1 - 冒烟测试**：基本可用性验证。接口能通、页面能开、核心流程能走通。这是最基础的"活着"检查。

**Phase 2 - MR 巡检**（M20 版本新增）：这个阶段比较特别——它从 GitLab MR 的代码变更自动生成检查项。流程是：从 TAPD 需求的评论里提取 MR 链接 → 调用 GitLab API 获取 Diff → AI 分析变更文件，识别受影响的 API 端点 → 自动生成针对性的测试用例（标记为 `[P2-xxx]` 格式）。这样每次代码提交后，测试能自动覆盖变更点。

**Phase 3 - 交互测试**：参数组合、状态流转。比如搜索接口，测试不同的关键词、分页参数、排序方式的组合。

**Phase 4 - 断言测试**：字段类型、业务码、数据正确性。不只是"接口返回 200"，还要检查返回的数据结构是否符合预期、业务状态码是否正确。

**Phase 5 - 复杂流程**：多步骤链式请求。比如"创建订单 → 支付 → 查询订单状态"这种需要多个接口串联的场景。

**Phase 6 - 边界条件**：异常参数、权限校验、空值处理。比如传一个超长字符串、传一个不存在的 ID、用没有权限的账号访问。

**Phase 7 - 回归测试**：与历史响应对比，检查稳定性。用 `response-diff.ts` 比较当前响应和上次的基线响应，检测是否有字段新增/删除/类型变化。

每个阶段独立执行、独立缓存（`spec-cache.ts` 基于哈希判断输入是否变化）。已通过的用例自动跳过（`item-cache.ts` 记录在 `.ai-test-cache/` 目录），支持 `--phases 1,3,5` 选择性执行，支持 `--reuse-passed` 复用上次结果。这样迭代测试时不用每次从头跑。

### YAML API 定义引擎：三层参数合并

API 测试需要知道"调哪个接口、传什么参数"。手动在代码里写死不现实——不同环境的域名不同、认证方式不同、默认参数不同。我设计了一个 YAML 引擎（`yaml-engine/`），支持三层参数合并：

**第一层：API 定义文件**（`api_def/*.yaml`）

```yaml
name: 搜索漫画
host: https://api.example.com
path: /api/v1/comics/search
method: POST
contentType: application/x-www-form-urlencoded
params:
  keyword: ""
  page: "1"
  pageSize: "20"
headers:
  X-Platform: web
```

这是接口的"身份证"，定义了基本信息和默认参数。

**第二层：环境配置**（`envconfig.yaml`）

```yaml
env: uat
host: https://uat-api.example.com
credentials:
  token: "xxx"
  userId: "12345"
headersGlobal:
  X-Env: uat
tls:
  rejectUnauthorized: false
```

覆盖域名、注入认证信息、配置 TLS。不同环境用不同配置文件。`credentials` 里的字段会自动注入到请求参数中。

**第三层：LLM 动态覆盖**（`RequestOverrides`）

AI 在测试过程中根据需要动态修改参数。比如测试"搜索"接口时，AI 会自己构造不同的关键词：

```typescript
interface RequestOverrides {
  params?: Record<string, string>   // 覆盖请求参数
  headers?: Record<string, string>  // 覆盖请求头
  body?: Record<string, unknown>    // 覆盖请求体
  cookies?: Record<string, string>  // 覆盖 Cookie
}
```

三层按优先级合并（`executor.ts`），后面的覆盖前面的。合并逻辑是：API 定义提供默认值 → 环境配置覆盖域名和认证 → LLM 动态注入测试参数。Cookie 管理也是独立的——每个测试 Session 维护自己的 Cookie Jar，自动从响应头提取 `Set-Cookie` 并在后续请求中携带。

### Go 源码自动修复：测试发现 Bug 后自动改代码

这是整个项目最"疯狂"的部分，也是我最有成就感的部分。当 API 测试发现某个接口返回错误时，系统不只是报告"这个接口挂了"，而是会尝试**自动修复**。

整个修复链路（`fix-engine/`）：

**Step 1：提取失败信息**
从测试结果中提取：接口路径、HTTP 方法、请求参数、响应内容、失败原因。

**Step 2：Go 源码发现**（`go-source-discovery.ts`）
在 Go 项目中沿着调用链找到相关源码：
```
路由定义（router.go）→ Handler 函数 → Service 方法 → DAO/Repository → Model 定义
```
这一步用的是文本搜索（grep），不是 AST 解析——因为 Go 项目的代码风格比较统一，用正则匹配路由路径就能找到对应的 Handler。

**Step 3：AI 生成修复代码**（`go-fixer.ts`）
把失败信息和源码上下文一起给 AI，让它生成修复代码。提示词里有几个硬性约束：
- 永远不修改 `.pb.go` 文件（protobuf 生成的代码）
- 遵循项目现有的代码风格
- 生成的代码必须能编译通过

**Step 4：Git 提交**（`git-ops.ts`）
用 AI 专用账号自动 `git add` + `git commit` + `git push`。Commit message 格式统一为 `fix: [AI] 修复 xxx 接口的 xxx 问题`。

**Step 5：CI/CD 轮询**（`cicd-poller.ts`）
Push 后轮询 GitLab CI/CD Pipeline 状态，等待部署完成。超时时间可配置。

**Step 6：回归验证**
部署完成后，用 YAML 引擎重新跑失败的用例。最多重试 3 次。

**Step 7：创建 MR**（`mr-creator.ts`）
如果回归验证全部通过，自动创建 GitLab Merge Request。

这条链路很长，任何一个环节都可能出问题。我的策略是**每个环节独立容错**——源码发现失败就跳过修复、AI 生成的代码编译不过就放弃、CI/CD 超时就放弃重试、回归验证不通过就不创建 MR。宁可少做，不能做错。实际使用中，大概 60% 的简单 Bug（参数校验缺失、字段映射错误）能被自动修复，复杂的逻辑 Bug 还是需要人工介入。

### 多 LLM Provider 适配

不同的 AI 模型在 Tool Calling 上的表现差异很大。Claude 的工具调用最稳定，GPT-4 偶尔会生成格式不对的参数，OpenCode（Kimi K2.5）在中文场景下理解力更好。

我抽象了一个 `LLMProvider` 接口（`llm/types.ts`）：

```typescript
interface LLMProvider {
  name: string
  chat(messages: Message[], options?: ChatOptions): Promise<string>
  chatWithTools?(messages: Message[], options: ChatOptions): Promise<ChatWithToolsResult>
  dispose(): Promise<void>
  // MCP 集成
  mcpClient?: any
  discoverMCPTools?(): Promise<ToolDefinition[]>
  executeMCPTool?(toolName: string, args: Record<string, unknown>): Promise<any>
}
```

三个 Provider 实现：
- **OpencodeProvider**：连接本地 OpenCode Server（Kimi K2.5）
- **ResponsesApiProvider**：Codex SDK，支持 SSE 流式 + Tool Calling
- **OpenAICompatibleProvider**：兼容 OpenAI API 格式的任意模型（Claude、GPT-4、Ollama 等）

Token 计费按模型分别计算，价格表内置在代码里：

| 模型 | 输入价格（/1M tokens） | 输出价格（/1M tokens） |
|------|----------------------|----------------------|
| Claude Sonnet 4.6 | $3 | $15 |
| Claude Opus 4.6 | $5 | $25 |
| GPT-4o | $2.5 | $10 |
| GPT-4o-mini | $0.15 | $0.6 |

每个测试阶段结束后，会输出该阶段的 Token 消耗和成本，帮你做出"这个阶段值不值得跑"的决策。

### 终端 UI：零依赖的进度展示

CLI 工具的用户体验很重要——如果只是一行行打印日志，用户根本不知道测试跑到哪了。我没有用 `ora`、`chalk` 这些库，而是纯 ANSI 转义码手写了一套终端渲染引擎（`terminal-renderer.ts`）：

- **TTY 检测**：在终端里渲染富文本（颜色、动画、进度条），在 CI/CD 环境里降级为纯文本
- **旋转动画**：10 帧 Unicode 旋转器（`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`），200ms 刷新
- **实时进度**：当前阶段、已通过/失败/跳过的用例数、耗时
- **JSON 模式**：设置 `JSON_PROGRESS=1` 环境变量后，所有进度事件以 JSON Lines 格式输出到 stdout，方便外部程序（Electron 面板、CI/CD Dashboard）消费

进度事件系统（`progress-events.ts`）定义了十几种事件类型：`pipeline-step`（流水线步骤）、`phase-start`（阶段开始）、`test-run-result`（单个用例结果）、`plan-end`（测试计划结束，包含总成本和 Token 消耗）等。

### 踩过的坑

**AI 测试的不确定性。** AI 有时候会生成无效操作（比如点击一个不存在的按钮），或者陷入重复循环（反复尝试同一个失败的操作，每次都用相同的方式）。我加了几层防护：最大轮次限制（每个用例最多 N 轮工具调用）、Token 用量追踪（超过预算强制结束）、重复检测（连续 3 次相同的工具调用自动跳过）。

**Playwright 的 CDP 连接稳定性。** 长时间运行的测试（几十个用例连续跑）偶尔会遇到 CDP 连接断开。我加了自动重连机制——检测到连接断开后，重新启动浏览器实例，恢复到断开前的页面状态。

**Cookie 管理的复杂性。** API 测试中，很多接口依赖登录态（Cookie）。不同的测试用例可能需要不同的登录账号，同一个账号的 Cookie 又需要在多个请求间共享。我实现了一个独立的 Cookie Manager（`http-session.ts`），按 Session 维度管理 Cookie，自动从 `Set-Cookie` 响应头提取并在后续请求中携带。

**MR 巡检的 TAPD 集成。** 从 TAPD 需求的评论里提取 MR 链接，听起来简单，实际上评论格式五花八门——有的是纯 URL，有的是 Markdown 链接，有的是嵌在一段文字里。我用正则匹配 `git.bilibili.co` 域名的 URL，再调用 GitLab API 获取 MR 详情和 Diff。

## 项目成果

累计 120+ 次迭代提交，交付了完整的 AI 测试平台：

- **双模式测试引擎**：浏览器 E2E（18 个工具）+ HTTP API（8 个工具），共享 LLM 调用层
- **7 阶段渐进式测试**：冒烟 → MR 巡检 → 交互 → 断言 → 复杂流程 → 边界 → 回归，支持选择性执行和缓存复用
- **YAML API 定义引擎**：三层参数合并（定义 → 环境 → LLM 动态），独立 Cookie 管理
- **Go 源码自动修复闭环**：测试 → 源码发现 → AI 修复 → Git Push → CI/CD → 回归验证 → MR
- **MR 巡检**：从 TAPD 需求 + GitLab MR 自动生成测试用例
- **多 LLM Provider**：Claude / GPT-4 / OpenCode，运行时切换，分模型计费
- **零依赖终端 UI**：ANSI 渲染 + JSON 进度输出，适配终端和 CI/CD
- **MCP 集成**：支持通过 MCP 协议扩展外部工具（文件系统访问等）
- **5 个 CLI 命令**：`test`（主测试）、`report`（报告服务器）、`explore`（交互式浏览器探索）、`build-library`（测试库生成）、`recommend`（测试推荐）

## 经验总结

1. **AI 测试的核心不是"让 AI 写测试脚本"，而是"让 AI 实时决策"。** 预生成脚本的方式太死板，遇到页面变化就废了。让 AI 实时观察页面状态、动态决定下一步操作，适应性强得多。这也是为什么我选择了 Tool Calling 而不是代码生成——工具调用的粒度更细，AI 可以根据每一步的结果调整策略。

2. **渐进式测试结构很重要。** 从冒烟到回归，由浅入深，既保证了基本覆盖，又避免了 AI 在不重要的边界条件上浪费时间和 Token。每个阶段独立缓存的设计也很关键——迭代开发时，只需要重跑变更相关的阶段。

3. **自动修复链路要"宁缺毋滥"。** 每个环节都可能出错，与其追求全自动，不如在每个节点设好兜底——修不了就不修，比修错了强。实际效果是：简单 Bug 自动修复率约 60%，复杂 Bug 至少能提供定位信息和修复建议。

4. **成本意识要贯穿始终。** AI 测试的 Token 消耗不低，尤其是浏览器模式下每次都要传页面状态（accessibility tree 可能有几千行）。按模型分别计费、实时展示成本、支持设置预算上限——这些不是"锦上添花"，而是让 AI 测试在实际项目中可持续使用的前提。

5. **CLI 工具的用户体验值得投入。** 一个好的进度展示、清晰的错误信息、灵活的参数配置，能让工具的使用门槛大幅降低。零依赖的终端 UI 虽然写起来麻烦，但换来的是"任何环境都能跑"的可移植性。

