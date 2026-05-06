---
title: Node.js 初探：用 Express 搭建 RESTful API
date: 2023-02-20 20:00:00
tags:
  - Node.js
  - Express
  - RESTful
  - 后端入门
categories:
  - 前端工程化
---

前端工程师学 Node.js 的门槛很低——同样是 JavaScript，但能做的事情完全不同。这篇记录了用 Express 搭建第一个后端服务的过程。

<!-- more -->

## 为什么前端要学 Node.js

- 写 BFF（Backend For Frontend）层，聚合后端接口
- 写 CLI 工具、构建脚本
- SSR 服务端渲染
- 理解后端思维，和后端同学沟通更顺畅

## Express 基础

Express 是 Node.js 最流行的 Web 框架，API 设计简洁：

```javascript
const express = require('express');
const app = express();

app.use(express.json()); // 解析 JSON 请求体

// RESTful 路由
app.get('/api/users', (req, res) => {
  res.json({ data: users });
});

app.post('/api/users', (req, res) => {
  const { name, email } = req.body;
  const newUser = { id: Date.now(), name, email };
  users.push(newUser);
  res.status(201).json({ data: newUser });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## 中间件机制

Express 的核心是中间件（Middleware）。每个中间件是一个函数，接收 `req`、`res`、`next` 三个参数：

```javascript
// 日志中间件
function logger(req, res, next) {
  console.log(`${req.method} ${req.url}`);
  next(); // 调用下一个中间件
}

// 鉴权中间件
function auth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }
  req.user = verifyToken(token);
  next();
}

app.use(logger);                    // 全局中间件
app.get('/api/profile', auth, getProfile); // 路由级中间件
```

中间件按注册顺序执行，`next()` 传递控制权。错误处理中间件有四个参数 `(err, req, res, next)`，放在最后兜底。

## 连接数据库

用 SQLite 做了个简单的 CRUD：

```javascript
const Database = require('better-sqlite3');
const db = new Database('app.db');

// 建表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE
  )
`);

// 查询
const getUsers = db.prepare('SELECT * FROM users');
const users = getUsers.all();
```

SQLite 适合个人项目和原型开发，不需要额外装数据库服务。
