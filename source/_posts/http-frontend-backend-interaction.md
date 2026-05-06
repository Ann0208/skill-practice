---
title: HTTP 协议与前后端交互：从请求响应到 Axios 封装
date: 2022-07-10 20:00:00
tags:
  - HTTP
  - Axios
  - RESTful
  - 网络基础
categories:
  - 前端基础
---

前端不只是写页面，和后端打交道是日常。这篇整理了 HTTP 协议的核心概念、RESTful API 设计规范，以及项目中 Axios 的封装实践。

<!-- more -->

## HTTP 请求与响应

HTTP 是无状态的请求-响应协议。一个请求包含：请求行（方法 + URL + 协议版本）、请求头、请求体。

常用的 HTTP 方法：

| 方法 | 语义 | 幂等 | 典型场景 |
|------|------|------|---------|
| GET | 获取资源 | 是 | 查询列表、获取详情 |
| POST | 创建资源 | 否 | 提交表单、新建数据 |
| PUT | 全量更新 | 是 | 更新整个对象 |
| PATCH | 部分更新 | 否 | 修改某个字段 |
| DELETE | 删除资源 | 是 | 删除数据 |

## 状态码

- **2xx 成功**：200 OK、201 Created、204 No Content
- **3xx 重定向**：301 永久重定向、302 临时重定向、304 Not Modified（缓存命中）
- **4xx 客户端错误**：400 Bad Request、401 Unauthorized、403 Forbidden、404 Not Found
- **5xx 服务端错误**：500 Internal Server Error、502 Bad Gateway、503 Service Unavailable

## Axios 封装

项目中不会直接裸用 Axios，一般会封装一层统一处理：

```javascript
import axios from 'axios';

const request = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

// 请求拦截：注入 token
request.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截：统一错误处理
request.interceptors.response.use(
  res => res.data,
  err => {
    if (err.response?.status === 401) {
      // token 过期，跳转登录
      router.push('/login');
    }
    return Promise.reject(err);
  }
);

export default request;
```

## Cookie、Session、Token

- **Cookie**：浏览器自动携带，有大小限制（4KB），容易被 CSRF 攻击
- **Session**：服务端存储，通过 Cookie 里的 Session ID 关联，有状态
- **JWT Token**：无状态，服务端不存储，适合分布式系统。缺点是无法主动失效

现在主流方案是 JWT + 双 Token（Access Token 短期 + Refresh Token 长期）。Access Token 过期后用 Refresh Token 换新的，用户无感知。
