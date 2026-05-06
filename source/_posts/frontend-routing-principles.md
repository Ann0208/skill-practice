---
title: 前端路由原理：Hash 模式与 History 模式的实现
date: 2023-04-15 20:00:00
tags:
  - 路由
  - SPA
  - Vue Router
  - React Router
categories:
  - 前端框架
---

SPA 的核心是前端路由——URL 变了但页面不刷新，由 JavaScript 控制视图切换。这篇从原理层面理解 Hash 和 History 两种路由模式。

<!-- more -->

## 为什么需要前端路由

传统多页应用（MPA）每次跳转都是一次完整的 HTTP 请求，服务器返回新的 HTML 页面。SPA 只有一个 HTML 文件，页面切换由 JavaScript 完成，体验更流畅。

但 SPA 有个问题：URL 不变的话，用户无法收藏页面、无法前进后退。前端路由就是为了解决这个问题——让 URL 和视图保持同步，同时不触发页面刷新。

## Hash 模式

URL 中 `#` 后面的部分叫 hash，改变 hash 不会触发页面刷新，但会触发 `hashchange` 事件：

```javascript
// 监听 hash 变化
window.addEventListener('hashchange', () => {
  const path = location.hash.slice(1); // 去掉 #
  renderView(path);
});

// 导航
function navigate(path) {
  location.hash = path;
}
```

优点是兼容性好，不需要服务端配置。缺点是 URL 里有个 `#` 不太美观。

## History 模式

HTML5 History API 提供了 `pushState` 和 `replaceState`，可以修改 URL 而不触发页面刷新：

```javascript
// 修改 URL
history.pushState({ page: 'about' }, '', '/about');

// 监听浏览器前进/后退
window.addEventListener('popstate', (event) => {
  renderView(location.pathname);
});
```

URL 干净（没有 `#`），但需要服务端配置——所有路由都返回 `index.html`，否则刷新页面会 404：

```nginx
# Nginx 配置
location / {
  try_files $uri $uri/ /index.html;
}
```

## Vue Router 的使用

```javascript
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/about', component: About },
    { path: '/user/:id', component: UserDetail }, // 动态路由
    { path: '/:pathMatch(.*)*', component: NotFound }, // 404
  ],
});
```

路由守卫是 Vue Router 的重要功能：

```javascript
router.beforeEach((to, from, next) => {
  const isLogin = !!localStorage.getItem('token');
  if (to.meta.requiresAuth && !isLogin) {
    next('/login');
  } else {
    next();
  }
});
```

## 路由懒加载

SPA 的一个问题是首屏加载慢——所有页面的代码都打包在一起。路由懒加载可以按需加载：

```javascript
const routes = [
  {
    path: '/dashboard',
    component: () => import('./views/Dashboard.vue'),
  },
];
```

Webpack/Vite 会自动把懒加载的组件拆成独立的 chunk，访问到对应路由时才下载。
