---
title: 手搓一个 Code Review Skill：从设计到落地的完整实践
date: 2026-02-27 14:00:00
tags:
  - Claude Code
  - Skill
  - Code Review
  - AI Agent
categories:
  - AI Agent
---

最近在学习 Claude Code 的 Skill 系统，决定用「手搓一个 Code Review Skill」作为实践项目。这篇文章记录整个过程：为什么要做、怎么思考结构、遇到什么坑、最终长什么样。

<!-- more -->

## 一、为什么要做 Code Review Skill

Code Review 是工程团队中最高频也最重要的协作活动之一，但它的质量差异极大：

- 有人只看语法和格式，漏掉安全漏洞
- 有人逐行挑剔风格，忽视架构设计问题
- 有人关注 SOLID 原则，但没有统一的衡量标准
- 团队间的 review 标准不一致，导致质量参差不齐

**我想解决的核心问题：** 让 AI 能够做「有系统性、有优先级、有建设性」的代码 review，而不只是泛泛地说「这段代码可以改进」。

## 二、Skill 是什么？先搞清楚概念

在动手之前，我先搞清楚了 Claude Code 里 Skill 的定义和工作原理。

### Skill 的本质

Skill 是 Claude Code 中**最小的可复用能力单元**。它本质上是一个「知识包」，包含：

1. **触发条件**：什么情况下加载这个 Skill（通过 frontmatter description 定义）
2. **执行知识**：Skill 激活后，Claude 应该怎么做（SKILL.md 正文）
3. **配套资源**：执行过程中需要参考的文档、清单、脚本（references/ 等目录）

### 渐进式披露设计

Skill 系统有一个关键设计原则：**渐进式披露（Progressive Disclosure）**。

```
加载层次：
1. Metadata (name + description)  ← 始终在上下文中，~100 词
2. SKILL.md 正文                  ← Skill 触发时加载，< 5000 词
3. references/ 等资源文件          ← Claude 按需读取，无限制
```

这意味着：把所有内容塞进 SKILL.md 是错误的。核心流程写在 SKILL.md，详细清单和文档放在 references/ 目录，让 Claude 在需要时按需加载。

## 三、设计思路：如何拆分 Code Review 的知识结构

Code Review 涉及的知识面很广，我需要把它拆成可以独立维护的模块。

### 3.1 Review 的维度拆分

经过思考，我把 Code Review 分成三个核心维度：

| 维度 | 优先级 | 原因 |
|------|--------|------|
| 安全性 (Security) | 最高 🔴 | 安全漏洞是阻塞性问题，一旦上线代价极大 |
| 设计原则 (SOLID) | 中等 🟡 | 影响长期可维护性，但通常不阻塞功能 |
| 代码质量 (Quality) | 一般 🔵 | 影响可读性和效率，可以渐进改善 |

**为什么按这个顺序？** 我参考了 OWASP 的建议和团队实际经验：安全问题往往被发现得太晚，因为大家在 review 时更关注逻辑正确性。把安全放第一位，强制先跑一遍安全扫描。

### 3.2 目录结构设计

基于渐进式披露原则，我设计了以下结构：

```
code-review-expert/
├── SKILL.md                    # 主文件：流程定义 + 各阶段入口
├── agents/
│   └── agent.yaml              # 大规模 review 的 Agent 配置
└── references/
    ├── solid-checklist.md      # SOLID 原则详细清单 + 代码示例
    ├── security-checklist.md   # 安全漏洞类别 + 检测模式
    ├── code-quality-checklist.md  # 代码质量维度清单
    └── removal-plan.md         # 代码清理计划模板
```

**关键决策：** 把所有详细清单放在 references/ 而不是 SKILL.md。

原因：如果把四个清单都塞进 SKILL.md，正文会超过 8000 词，每次触发 Skill 都会消耗大量 token。而放在 references/，Claude 只在对应阶段才会读取对应清单，大幅降低 token 消耗。

### 3.3 SKILL.md 的核心内容

SKILL.md 不应该复制清单内容，而应该定义**执行流程**：

1. **Phase 1: Context Collection** — 先了解代码背景和目标
2. **Phase 2: Security Scan** — 优先安全扫描，加载 security-checklist.md
3. **Phase 3: SOLID Analysis** — 设计原则分析，加载 solid-checklist.md
4. **Phase 4: Quality Review** — 代码质量检查，加载 code-quality-checklist.md
5. **Phase 5: Removal Plan** — 发现死代码时，使用 removal-plan.md 模板
6. **Phase 6: Synthesis Report** — 汇总所有发现，输出结构化报告

## 四、实现细节：每个文件怎么写

### 4.1 SKILL.md — frontmatter 的重要性

frontmatter 的 description 决定了 Skill 何时被触发。写好 description 是最关键的一步。

**错误示范：**
```yaml
description: 提供代码审查功能。
```

**正确示范：**
```yaml
description: This skill should be used when the user asks to "review my code",
"do a code review", "check my code quality", "audit this code for security issues",
"analyze SOLID principles", "find code smells", "review pull request",
"check for security vulnerabilities", "create a removal plan", or "clean up dead code".
```

区别在于：正确示范是**第三人称**，包含**具体的触发短语**，让 Claude 能准确识别何时该激活这个 Skill。

### 4.2 security-checklist.md — OWASP Top 10 落地

安全清单参考了 OWASP Top 10 框架，针对每个类别提供：
- 检查项清单（checkbox 形式）
- 漏洞代码示例（❌）
- 修复后代码示例（✅）
- 相关工具命令

以 SQL 注入为例：

```javascript
// ❌ 漏洞代码
const query = `SELECT * FROM users WHERE email = '${req.body.email}'`
// 攻击者输入：' OR '1'='1 即可绕过认证

// ✅ 修复方案
const query = 'SELECT * FROM users WHERE email = ?'
const result = await db.execute(query, [req.body.email])
```

**设计原则：** 每个漏洞都要有可执行的 fix，而不只是说"要参数化查询"。工程师需要看到具体的代码才能快速行动。

### 4.3 solid-checklist.md — 原则 + 代码双维度

SOLID 清单的难点在于：原则本身是抽象的，必须用代码示例才能让 AI 准确识别违反情况。

以 SRP（单一职责原则）为例：

```typescript
// ❌ UserService 同时处理认证、邮件、报告——三个不同的"变化原因"
class UserService {
  async login(email: string, password: string) { ... }
  async sendWelcomeEmail(user: User) { ... }        // 邮件变化会影响这里
  async generateMonthlyReport(): Promise<Report> { ... } // 报告需求变化会影响这里
}

// ✅ 按职责拆分
class AuthService { ... }
class UserEmailService { ... }
class UserReportService { ... }
```

同时，为每个原则提供了**诊断问题**，帮助 Claude 主动发问：
- "这个类的单一职责是什么？如果你需要用 'and' 来描述它，SRP 可能被违反了。"

### 4.4 removal-plan.md — 结构化清理模板

发现死代码后，最危险的做法是直接删除——可能有隐式依赖、动态引用或外部调用者。

removal-plan.md 提供了一个标准化模板，强制走以下流程：

1. **确认范围** — 列出所有涉及文件和行号
2. **风险评估** — grep 搜索确认无外部依赖
3. **迁移指南** — 如果有调用方，提供新旧 API 对比
4. **验证清单** — 删除后必须通过的检查项
5. **沟通计划** — 通知相关团队

这个模板的核心价值是：**把"删代码"变成一个有迹可循的工程过程**，而不是随意的清理行为。

### 4.5 agents/agent.yaml — 扩展到大规模 review

对于单个文件的 review，SKILL.md 够用了。但当需要审查整个 PR（可能涉及 20+ 个文件）时，需要 Agent 来并行处理。

agent.yaml 定义了：
- 使用的模型（claude-opus-4-6，更强的推理能力）
- 可用工具（读文件、搜索代码）
- 执行工作流（按阶段依次调用各清单）
- 输出格式（结构化报告模板）

## 五、遇到的问题与决策

### 问题 1：清单太详细，写进 SKILL.md 还是 references？

**决策过程：**
- 最初把 SOLID 清单直接写在 SKILL.md 里，导致正文超过 5000 词
- 意识到这违反了渐进式披露原则：每次 review 触发时，即使用户只需要安全扫描，所有 SOLID 细节也被加载
- 最终决定：SKILL.md 只写「在哪个阶段读哪个文件」，详细内容全放 references/

**结论：** SKILL.md 是流程图，references/ 是详细手册。

### 问题 2：severity 标签如何统一？

不同维度的问题（安全漏洞 vs SOLID 违反 vs 命名问题）严重程度差异极大，如果混在一起难以优先处理。

**决策：** 统一使用五级标签，跨所有维度一致：

| Emoji | 级别 | 含义 | 行动 |
|-------|------|------|------|
| 🔴 | CRITICAL | 安全漏洞/数据损坏风险 | 阻塞合并 |
| 🟠 | HIGH | 重大正确性或设计问题 | 合并前修复 |
| 🟡 | MEDIUM | SOLID 违反/代码异味 | 后续 PR 修复 |
| 🔵 | LOW | 风格/命名/小改进 | 可选 |
| 🟢 | POSITIVE | 值得肯定的做法 | 无需行动 |

加入 POSITIVE 级别是关键：**好的 review 不只挑毛病，也要肯定做得好的地方**，否则容易打击开发者积极性。

### 问题 3：如何让 AI 的 review 有建设性而非批评性？

在 SKILL.md 的「交互风格」部分，我明确写了：

> "Be constructive, not critical. The goal is better code, not finger-pointing."
> - 解释每个发现的「为什么」，不只说「这是错的」
> - 提供具体的修复示例，不只给抽象建议
> - 承认权衡（"这样写更啰嗦但更安全"）
> - 把相关发现归组，避免让作者感到被压垮

这些原则看似软性，但对 AI 输出的语气影响非常大。

## 六、最终目录结构

```
code-review-expert/
├── SKILL.md                       # 900 词，流程定义
├── agents/
│   └── agent.yaml                 # 大规模 review Agent 配置
└── references/
    ├── solid-checklist.md         # SOLID 原则 + 代码示例，~400 行
    ├── security-checklist.md      # OWASP Top 10 检查清单，~350 行
    ├── code-quality-checklist.md  # 代码质量 8 个维度，~300 行
    └── removal-plan.md            # 代码清理计划模板，~200 行
```

## 七、使用效果预期

当用户说「review 这段代码」时，Skill 触发，Claude 会：

1. 先问背景（文件范围、改动目标）
2. 依次运行安全 → SOLID → 质量三个维度扫描
3. 每个发现都附有：位置、严重级别、原因解释、具体修复建议
4. 最终输出结构化报告，按优先级排列问题

最重要的是：**这个流程是可重复的、可预期的**，不同 session 的 review 质量不会因为 Claude 的"心情"而差异太大。

## 八、反思：Skill 设计的核心思维

做完这个项目，我总结了几个 Skill 设计的核心原则：

**1. 触发词比功能更重要**

Skill 再好，触发不了就没用。description 里的触发短语要贴近用户的真实表达习惯。

**2. 流程 > 内容**

SKILL.md 的价值在于定义「Claude 应该按什么顺序做什么」，不是「把所有知识都写进去」。知识放 references/，流程放 SKILL.md。

**3. 先考虑 token 效率**

每次 Skill 触发，SKILL.md 全文都会被加载。如果 SKILL.md 有 5000 词，每次 review 都额外消耗大量 token。把详细内容外置到 references/ 是显著的成本优化。

**4. 输出格式即产品设计**

Skill 的输出格式（emoji 严重级别、代码块、表格）不是细节，是用户体验设计。统一、一致、可扫描的输出格式，让 review 结果更容易被消化和行动。

---

这个 Skill 现在还在迭代中。后续计划：
- 增加语言特定的 checklist（TypeScript 专项、Python 专项）
- 添加 PR diff 解析能力，自动识别变更范围
- 接入 git blame，为每个发现标注责任人

如果你也在学习 Claude Code Skill 开发，欢迎参考这个项目的设计思路。
