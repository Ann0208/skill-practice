---
title: HTML 与 CSS 基础：从零搭建第一个静态网页
date: 2021-10-20 20:00:00
tags:
  - HTML
  - CSS
  - 前端入门
categories:
  - 前端基础
---

搭完博客之后开始系统学 HTML 和 CSS。这篇记录从语义化标签到盒模型、浮动布局的学习过程，以及第一次手写完整网页的踩坑经历。

<!-- more -->

## 语义化标签

刚开始写 HTML 全是 `div` 套 `div`，后来才知道有 `header`、`nav`、`main`、`section`、`article`、`footer` 这些语义化标签。语义化的好处：

- 代码可读性好，一眼能看出页面结构
- 对 SEO 友好，搜索引擎能理解内容层级
- 对无障碍访问友好，屏幕阅读器能正确解读

```html
<header>
  <nav>导航栏</nav>
</header>
<main>
  <article>
    <h1>文章标题</h1>
    <section>第一部分</section>
  </article>
</main>
<footer>页脚</footer>
```

## 盒模型

CSS 盒模型是理解布局的基础。每个元素都是一个盒子：`content → padding → border → margin`。

最容易踩的坑是 `box-sizing`。默认的 `content-box` 下，`width` 只包含内容区，加上 padding 和 border 后实际宽度会超出预期。改成 `border-box` 后，`width` 包含了 padding 和 border，计算尺寸直觉多了：

```css
* {
  box-sizing: border-box;
}
```

## 浮动与清除浮动

浮动布局是老一代的排版方式。`float: left` 让元素脱离文档流向左浮动，但父容器会塌陷（高度变成 0）。清除浮动的经典方案：

```css
.clearfix::after {
  content: '';
  display: block;
  clear: both;
}
```

不过现在基本用 Flexbox 了，浮动布局了解原理就好。
