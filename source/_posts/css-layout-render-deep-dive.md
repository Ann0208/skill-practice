---
title: CSS 布局与渲染原理深度解析：BFC、Flex、盒模型与回流重绘
date: 2025-12-28 21:00:00
tags:
  - CSS
  - BFC
  - Flex
  - 盒模型
  - 回流重绘
  - 垂直居中
categories:
  - 前端技术
---

CSS 是前端工程师必须掌握的核心技术，不仅要会写样式，还需要深入理解布局模型与浏览器渲染机制。本文系统梳理 CSS 中的高频考点：盒模型、BFC、Flex 布局、垂直居中方案，以及浏览器的回流与重绘机制。

<!-- more -->

## 一、CSS 盒模型

### 1.1 盒模型组成

每个 HTML 元素都是一个矩形盒子，由四部分组成：

- **内容区（content）**：元素实际内容区域；
- **内边距（padding）**：内容区与边框之间的空间；
- **边框（border）**：包裹内容和内边距的边框；
- **外边距（margin）**：盒子与外部元素之间的距离。

### 1.2 标准盒模型 vs IE 盒模型

| 盒模型 | width 计算方式 | `box-sizing` 值 |
|--------|----------------|-----------------|
| 标准盒模型（W3C） | width = content 宽度 | `content-box`（默认） |
| IE 盒模型（怪异模式） | width = content + padding + border | `border-box` |

实际开发中，**`border-box` 更常用**，方便计算总宽高，布局更直观：

```css
* {
  box-sizing: border-box;
}
```

---

## 二、BFC（块级格式化上下文）

### 2.1 什么是 BFC

BFC（Block Formatting Context）是一个**独立的渲染区域**，内部元素的布局不受外部影响，外部元素也不影响内部。

### 2.2 触发 BFC 的条件

满足以下任意一条即可触发：

- 根元素（`<html>`）；
- 浮动元素（`float: 非 none`）；
- 绝对定位/固定定位（`position: absolute/fixed`）；
- 行内块元素（`display: inline-block`）；
- `overflow: 非 visible`（如 `hidden`、`auto`）；
- `display: flex/grid`。

### 2.3 BFC 的应用场景

**1. 清除浮动（解决父元素高度塌陷）**：

```css
.parent {
  overflow: hidden; /* 触发 BFC，包含内部浮动元素 */
}
.child {
  float: left;
}
```

**2. 避免 margin 重叠**：

```html
<!-- 相邻兄弟元素 margin 重叠 -->
<div class="box1">box1，margin-bottom: 20px</div>
<div class="bfc-wrapper">
  <!-- 用 BFC 包裹，避免 margin 合并 -->
  <div class="box2">box2，margin-top: 30px</div>
</div>
```

```css
.bfc-wrapper {
  overflow: hidden; /* 触发 BFC */
}
```

**3. 实现两栏布局**：左侧固定宽度浮动，右侧触发 BFC 自适应宽度。

```css
.left {
  float: left;
  width: 200px;
}
.right {
  overflow: hidden; /* 触发 BFC，不与浮动元素重叠 */
}
```

---

## 三、Flex 布局

### 3.1 核心概念

- **Flex 容器**：`display: flex` 开启 flex 布局；
- **主轴（Main Axis）**：默认水平方向；
- **交叉轴（Cross Axis）**：垂直于主轴的方向。

### 3.2 常用容器属性

| 属性 | 作用 | 常用值 |
|------|------|--------|
| `flex-direction` | 设置主轴方向 | `row`（默认）/ `column` |
| `justify-content` | 主轴对齐方式 | `center`/`space-between`/`flex-start` |
| `align-items` | 交叉轴对齐方式 | `center`/`stretch`/`flex-start` |
| `flex-wrap` | 是否换行 | `nowrap`（默认）/ `wrap` |

### 3.3 flex: 1 的含义

`flex: 1` 是 `flex-grow: 1`、`flex-shrink: 1`、`flex-basis: 0%` 的简写：

- `flex-grow: 1`：当容器有剩余空间时，该项目按比例分配（占比1）；
- `flex-shrink: 1`：当容器空间不足时，该项目按比例缩小；
- `flex-basis: 0%`：项目的初始宽度为0，由剩余空间分配决定。

```css
/* 等宽三列布局 */
.container {
  display: flex;
}
.item {
  flex: 1; /* 每列等比占据可用空间 */
}
```

---

## 四、垂直居中的常用方案

### 4.1 Flex 布局（最常用）

```css
.parent {
  display: flex;
  justify-content: center;
  align-items: center;
}
```

### 4.2 绝对定位 + transform

```css
.parent {
  position: relative;
}
.child {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
```

### 4.3 Grid 布局

```css
.parent {
  display: grid;
  place-items: center; /* 等价于 justify-items + align-items */
}
```

### 4.4 table-cell 布局（兼容旧浏览器）

```css
.parent {
  display: table-cell;
  text-align: center;
  vertical-align: middle;
}
```

---

## 五、CSS 定位方式

| 定位方式 | 基准 | 是否脱离文档流 | 应用场景 |
|----------|------|----------------|----------|
| `static`（静态） | 文档流 | 否 | 默认，不需定位 |
| `relative`（相对） | 自身正常位置 | 否（占原空间） | 微调位置，作为绝对定位父容器 |
| `absolute`（绝对） | 最近已定位父元素 | 是 | 精准定位（弹窗、悬浮组件） |
| `fixed`（固定） | 浏览器窗口 | 是 | 导航栏、回到顶部按钮 |
| `sticky`（粘性） | 正常文档流 + 阈值 | 否 | 列表头部吸顶 |

---

## 六、浏览器渲染原理

### 6.1 关键渲染路径

浏览器渲染页面的流程：

1. **解析 HTML** → 生成 DOM 树；
2. **解析 CSS** → 生成 CSSOM 树；
3. **合并** DOM 树与 CSSOM 树 → 生成渲染树（Render Tree，只包含可见节点）；
4. **布局（Layout/Reflow）**：计算每个元素的位置和大小；
5. **绘制（Paint）**：将元素绘制到屏幕；
6. **合成（Composite）**：将绘制的图层合并展示。

### 6.2 回流（Reflow）与重绘（Repaint）

**回流**（Reflow，也叫重排）：当元素的几何属性（位置、大小）发生变化，浏览器需重新计算布局，代价最高。

**触发回流的操作**：
- 修改元素的 `width`、`height`、`padding`、`margin`、`border`；
- 添加/删除 DOM 节点；
- 修改字体大小；
- 读取 `offsetWidth`、`scrollTop` 等布局属性（会强制刷新渲染队列）。

**重绘**（Repaint）：元素样式发生变化，但不影响布局（如颜色、背景），只需重新绘制，不需要重新计算布局。

> **回流一定触发重绘，但重绘不一定触发回流。**

### 6.3 优化回流与重绘

```javascript
// ❌ 错误：每次修改都触发回流
const el = document.getElementById('box');
el.style.width = '100px';
el.style.height = '100px';
el.style.margin = '10px';

// ✅ 优化：批量修改或使用 class
el.className = 'new-size'; // 只触发一次回流

// ✅ 优化：使用 transform 替代 top/left（触发 GPU 加速，不触发回流）
el.style.transform = 'translateX(100px)';

// ✅ 优化：使用 DocumentFragment 批量操作 DOM
const fragment = document.createDocumentFragment();
for (let i = 0; i < 1000; i++) {
  const li = document.createElement('li');
  li.textContent = `item ${i}`;
  fragment.appendChild(li); // 先操作 fragment，不触发回流
}
document.getElementById('list').appendChild(fragment); // 只触发一次回流
```

---

## 七、CSS 层叠与选择器

### 7.1 CSS 优先级

CSS 优先级（从高到低）：

```
!important > 内联样式 > ID 选择器 > 类/伪类/属性选择器 > 元素/伪元素选择器 > 通配符
```

具体计分规则：
- 内联样式：1000；
- ID 选择器（`#id`）：100；
- 类/伪类/属性选择器（`.class`、`:hover`、`[attr]`）：10；
- 元素/伪元素选择器（`div`、`::before`）：1。

### 7.2 BEM 命名规范

推荐使用 BEM（Block-Element-Modifier）命名规范，避免样式冲突：

```css
/* Block（组件块） */
.card {}
/* Element（元素，__连接） */
.card__title {}
.card__content {}
/* Modifier（修饰符，--连接） */
.card--active {}
.card__title--large {}
```

---

## 八、CSS 变量与现代特性

### 8.1 CSS 自定义属性（变量）

```css
:root {
  --primary-color: #3498db;
  --font-size-base: 16px;
}

.button {
  background-color: var(--primary-color);
  font-size: var(--font-size-base);
}
```

### 8.2 媒体查询实现响应式

```css
/* 移动端优先 */
.container {
  padding: 10px;
}

/* 平板 */
@media (min-width: 768px) {
  .container {
    padding: 20px;
    max-width: 768px;
    margin: 0 auto;
  }
}

/* 桌面端 */
@media (min-width: 1200px) {
  .container {
    max-width: 1200px;
  }
}
```

---

## 总结

CSS 的核心知识点可以从以下几个维度掌握：

- **盒模型**：理解 `content-box` 和 `border-box` 的区别，推荐在项目中统一使用 `border-box`；
- **BFC**：掌握触发条件和三大应用场景（清浮动、防 margin 合并、两栏布局）；
- **Flex 布局**：现代布局的首选，需熟练掌握容器属性和项目属性；
- **垂直居中**：首选 Flex 或 Grid，特殊场景使用绝对定位 + transform；
- **回流重绘**：理解两者的关系，减少不必要的 DOM 操作，使用 `transform` 和 `opacity` 实现动画；
- **定位方式**：熟悉 5 种定位的基准和脱流特性，灵活应用于布局设计。

CSS 看似简单，但深入理解渲染原理和布局模型，才能在复杂场景下写出高性能、高可维护的样式代码。
