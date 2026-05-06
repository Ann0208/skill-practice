---
title: 移动端适配方案：rem、vw 与响应式布局实战
date: 2023-06-28 20:00:00
tags:
  - 移动端适配
  - rem
  - vw
  - 响应式布局
categories:
  - 前端基础
---

PC 端写好的页面在手机上一看全乱了。移动端适配是前端必须掌握的技能，这篇对比了 rem、vw、媒体查询三种方案的原理和适用场景。

<!-- more -->

## viewport 设置

移动端适配的第一步是设置 viewport：

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

不加这行的话，手机浏览器会用 980px 的默认宽度渲染页面，然后缩小显示，字小得看不清。

## rem 方案

rem 是相对于根元素 `<html>` 的 `font-size` 的单位。核心思路：根据屏幕宽度动态设置根字号，所有尺寸用 rem 表示。

```javascript
// 设置根字号：以 375px 设计稿为基准
function setRem() {
  const width = document.documentElement.clientWidth;
  const fontSize = (width / 375) * 100; // 1rem = 100px（设计稿尺寸）
  document.documentElement.style.fontSize = fontSize + 'px';
}
setRem();
window.addEventListener('resize', setRem);
```

设计稿上 `32px` 的字号，写成 `0.32rem`。配合 PostCSS 插件可以自动转换，不用手动算。

## vw 方案

`1vw = 视口宽度的 1%`。375px 宽的屏幕上，`1vw = 3.75px`。

```css
/* 设计稿 375px 宽，元素宽 200px */
.box {
  width: 53.33vw;  /* 200 / 375 * 100 */
  font-size: 4.267vw; /* 16 / 375 * 100 */
}
```

vw 方案不需要 JavaScript，纯 CSS 实现。同样可以用 PostCSS 插件（`postcss-px-to-viewport`）自动转换。

## 媒体查询

媒体查询适合做断点式的响应式布局，不同屏幕宽度用不同的样式：

```css
/* 手机 */
@media (max-width: 768px) {
  .container { padding: 16px; }
  .sidebar { display: none; }
}

/* 平板 */
@media (min-width: 769px) and (max-width: 1024px) {
  .container { padding: 24px; }
}

/* 桌面 */
@media (min-width: 1025px) {
  .container { max-width: 1200px; margin: 0 auto; }
}
```

## 方案选择

- **rem**：适合还原设计稿的移动端页面，等比缩放
- **vw**：和 rem 类似但更简洁，不需要 JS，推荐新项目使用
- **媒体查询**：适合 PC + 移动端共用一套代码的响应式网站
- **Flex + 百分比**：简单布局够用，不需要精确还原设计稿时首选

实际项目中经常混合使用：整体布局用 Flex，间距和字号用 vw/rem，特殊断点用媒体查询。
