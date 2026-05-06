---
title: 前端安全实践：XSS、CSRF 防御与内容安全策略
date: 2024-04-20 20:00:00
tags:
  - 前端安全
  - XSS
  - CSRF
  - CSP
categories:
  - 前端进阶
---

安全问题不出事的时候没人在意，出事了就是大事。这篇整理了前端最常见的安全威胁和防御方案，都是实际项目中需要注意的。

<!-- more -->

## XSS（跨站脚本攻击）

攻击者把恶意脚本注入到页面中，窃取用户信息（Cookie、Token）或执行恶意操作。

### 三种类型

**存储型 XSS**：恶意脚本存到数据库里（比如评论区），其他用户访问时执行。危害最大。

**反射型 XSS**：恶意脚本在 URL 参数里，服务端把参数直接拼到 HTML 中返回。

**DOM 型 XSS**：前端 JavaScript 直接把不可信数据插入 DOM，比如 `innerHTML = userInput`。

### 防御方案

1. **输出编码**：把 `<`、`>`、`&`、`"` 等特殊字符转义成 HTML 实体

```javascript
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

2. **避免 innerHTML**：用 `textContent` 代替 `innerHTML`，框架（Vue/React）默认会转义

3. **CSP（内容安全策略）**：通过 HTTP 头限制页面能加载的资源来源

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
```

4. **HttpOnly Cookie**：设置 `HttpOnly` 后 JavaScript 无法读取 Cookie，即使 XSS 成功也拿不到

## CSRF（跨站请求伪造）

用户登录了 A 网站，然后访问恶意网站 B，B 偷偷向 A 发请求（浏览器会自动带上 A 的 Cookie），以用户身份执行操作。

### 防御方案

1. **CSRF Token**：服务端生成随机 Token，表单提交时带上，服务端验证。攻击者拿不到这个 Token。

2. **SameSite Cookie**：设置 `SameSite=Strict` 或 `Lax`，限制第三方网站携带 Cookie。

```
Set-Cookie: token=xxx; SameSite=Lax; Secure; HttpOnly
```

3. **检查 Referer/Origin**：验证请求来源是否是自己的域名。

## 其他安全实践

- **HTTPS**：加密传输，防止中间人攻击
- **敏感信息不存 localStorage**：localStorage 没有过期时间，XSS 攻击可以直接读取
- **接口权限校验**：前端隐藏按钮不等于安全，后端必须校验权限
- **依赖安全**：定期 `npm audit`，及时更新有漏洞的依赖包
- **输入校验**：前端校验是为了用户体验，后端校验才是安全保障，两者缺一不可
