---
title: Git 工作流实践：分支策略、合并冲突与 Code Review
date: 2022-09-15 20:00:00
tags:
  - Git
  - 团队协作
  - Code Review
categories:
  - 前端工程化
---

从一个人写代码到团队协作，Git 是绕不开的工具。这篇记录了 Git 分支策略、合并冲突的处理方式，以及参与 Code Review 的经验。

<!-- more -->

## 分支策略

团队里用的是 Git Flow 的简化版：

- `main`：生产环境代码，只接受 MR 合入
- `develop`：开发主分支，日常开发基于此分支
- `feature/xxx`：功能分支，从 develop 拉出，完成后合回 develop
- `hotfix/xxx`：紧急修复，从 main 拉出，修完同时合入 main 和 develop

```bash
# 日常开发流程
git checkout develop
git pull origin develop
git checkout -b feature/user-list
# ... 开发 ...
git add .
git commit -m "feat: 用户列表页面"
git push origin feature/user-list
# 在 GitLab 上创建 MR
```

## 合并冲突

冲突的本质是两个分支修改了同一个文件的同一个位置。Git 会用标记标出冲突区域：

```
<<<<<<< HEAD
当前分支的代码
=======
要合入分支的代码
>>>>>>> feature/xxx
```

处理原则：
1. 先理解两边的改动意图
2. 保留正确的逻辑，不是简单地选一边
3. 解决完冲突后一定要本地跑一遍，确认功能正常

## Commit 规范

团队用的是 Conventional Commits 规范：

```
feat: 新功能
fix: 修复 bug
docs: 文档变更
style: 代码格式（不影响逻辑）
refactor: 重构（不是新功能也不是修 bug）
test: 测试相关
chore: 构建/工具变更
```

好的 commit message 能让 `git log` 变成项目的变更日志，回溯问题时特别有用。

## Code Review 心得

参与 CR 之后才发现，写代码和审代码是两种不同的能力：

- **看命名**：变量名、函数名是否清晰表达意图
- **看边界**：空值处理、数组越界、异步错误捕获
- **看重复**：是否有可以抽取的公共逻辑
- **看影响范围**：这个改动会不会影响其他模块

作为被 review 的人，最大的收获是学会了"写代码时就考虑别人怎么读"。
