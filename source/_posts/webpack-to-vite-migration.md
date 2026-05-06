---
title: Webpack 到 Vite：构建工具的演进与项目迁移实践
date: 2024-09-20 20:00:00
tags:
  - Webpack
  - Vite
  - 构建工具
  - 工程化
categories:
  - 前端工程化
---

从 Webpack 迁移到 Vite 后，开发服务器启动从 30 秒变成 1 秒，热更新从 2 秒变成毫秒级。这篇对比两者的原理差异，记录迁移过程中的踩坑。

<!-- more -->

## Webpack 的工作原理

Webpack 是打包器（Bundler），核心流程：

1. 从入口文件开始，递归分析依赖关系，构建依赖图
2. 用 Loader 转换文件（babel-loader 转 JS、css-loader 转 CSS、vue-loader 转 Vue SFC）
3. 用 Plugin 在构建生命周期的各个阶段执行额外操作（压缩、提取 CSS、生成 HTML）
4. 输出打包后的 bundle 文件

开发模式下，Webpack 也要先打包整个项目，然后启动 dev server。项目大了之后启动很慢。

## Vite 为什么快

Vite 在开发模式下不打包，利用浏览器原生的 ES Module：

1. 启动 dev server，不做任何打包
2. 浏览器请求模块时，Vite 按需编译并返回
3. 用 esbuild（Go 编写）做预构建，把 CommonJS 依赖转成 ESM

```
浏览器请求 /src/App.vue
  → Vite 拦截请求
  → 编译 App.vue（SFC → JS）
  → 返回编译结果
  → 浏览器继续请求 App.vue 的依赖
```

这就是为什么 Vite 启动快——它不需要分析整个依赖图，只编译当前页面用到的模块。

生产构建时 Vite 用 Rollup 打包，输出优化后的静态文件。

## 热更新（HMR）对比

- **Webpack HMR**：修改一个文件后，需要重新构建受影响的 chunk，项目越大越慢
- **Vite HMR**：只重新编译修改的那个模块，通过 WebSocket 推送给浏览器，和项目大小无关

## 迁移踩坑

**环境变量**：Webpack 用 `process.env.VUE_APP_XXX`，Vite 用 `import.meta.env.VITE_XXX`。前缀和访问方式都不同，需要全局替换。

**CommonJS 依赖**：有些老的 npm 包只提供 CJS 格式，Vite 的预构建会自动转换，但偶尔会出问题。可以在 `optimizeDeps.include` 里显式声明。

**路径别名**：Webpack 在 `resolve.alias` 里配置，Vite 也是，但语法略有不同：

```javascript
// vite.config.js
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
```

**CSS 预处理器**：Vite 内置支持 Sass/Less/Stylus，不需要额外配置 loader，只需要安装对应的预处理器包。

## 选型建议

- **新项目**：直接用 Vite，开发体验好，生态已经成熟
- **老项目**：如果 Webpack 配置不复杂，值得迁移；如果有大量自定义 loader/plugin，评估迁移成本
- **库开发**：Rollup 或 Vite 的 library mode
