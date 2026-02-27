---
title: 用 Hexo 搭建我的第一个博客
date: 2024-01-15 20:30:00
tags:
  - Hexo
  - GitHub Pages
  - 博客搭建
categories:
  - 技术实践
---

> 从零开始，用 Hexo + GitHub Pages 搭建属于自己的技术博客。这篇文章记录了整个搭建过程与心得。

<!-- more -->

## 为什么选择 Hexo + GitHub Pages

在众多博客方案中，**Hexo + GitHub Pages** 是我认为最适合开发者的组合：

- **免费托管**：GitHub Pages 完全免费，无需服务器
- **版本控制**：博客源码可用 Git 管理，历史可追溯
- **Markdown 写作**：专注内容，告别富文本编辑器
- **主题丰富**：社区有大量精美主题，本站使用 [Butterfly](https://butterfly.js.org/)
- **部署简单**：一条命令 `hexo deploy` 即可发布

## 技术栈

| 工具 | 版本 | 用途 |
|------|------|------|
| Node.js | v25.x | 运行环境 |
| Hexo | 5.5.x | 静态站点生成器 |
| hexo-theme-butterfly | latest | 博客主题 |
| GitHub Pages | - | 静态托管 |
| hexo-deployer-git | latest | 一键部署 |

## 搭建步骤

### 1. 安装 Hexo CLI

```bash
npm install -g hexo-cli
```

### 2. 初始化项目

```bash
hexo init my-blog
cd my-blog
npm install
```

### 3. 安装 Butterfly 主题

```bash
npm install hexo-theme-butterfly
npm install hexo-renderer-pug hexo-renderer-stylus
```

在 `_config.yml` 中设置：

```yaml
theme: butterfly
```

### 4. 配置站点信息

编辑 `_config.yml` 关键字段：

```yaml
title: 你的博客名称
author: 你的名字
url: https://username.github.io/repo-name
root: /repo-name/
```

### 5. 配置部署

```yaml
deploy:
  type: git
  repo: https://github.com/username/repo.git
  branch: gh-pages
```

### 6. 写文章并发布

```bash
# 新建文章
hexo new post "文章标题"

# 本地预览
hexo server

# 生成静态文件并部署
hexo clean && hexo generate && hexo deploy
```

## Butterfly 主题亮点

Butterfly 是目前 Hexo 社区颜值最高的主题之一，特色功能包括：

- 打字机效果：首页副标题支持动态打字动画
- 文章目录：自动生成侧边栏 TOC，阅读体验极佳
- 暗色模式：支持明暗主题切换
- 多种首页布局：支持卡片式、瀑布流等 7 种布局

## 踩坑记录

### 问题 1：hexo init 在非空目录失败

**原因**：项目目录已存在 `.git` 文件夹，hexo init 要求空目录。

**解决**：先在临时目录初始化，再将文件复制过来：

```bash
cd /tmp && hexo init hexo-temp
cp -r /tmp/hexo-temp/. /your/project/
```

### 问题 2：GitHub Pages 部署后样式丢失

**原因**：`_config.yml` 中 `root` 路径配置不正确。

**解决**：在项目仓库（非用户根仓库）部署时，必须同时设置：

```yaml
url: https://username.github.io/repo-name
root: /repo-name/
```

## 下一步计划

- 配置 Algolia 站内搜索
- 开启文章评论功能（Gitalk）
- 自定义 404 页面
- 持续输出技术文章

---

**旅程从这里开始，期待与你共同成长。**
