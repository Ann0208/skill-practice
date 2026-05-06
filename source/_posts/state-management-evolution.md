---
title: 状态管理演进：从 Vuex 到 Pinia，从 Redux 到 Zustand
date: 2023-10-15 20:00:00
tags:
  - 状态管理
  - Vuex
  - Pinia
  - Redux
  - Zustand
categories:
  - 前端框架
---

组件间共享状态是前端开发的经典问题。这篇梳理了 Vue 和 React 生态中状态管理方案的演进，从重量级到轻量级的趋势很明显。

<!-- more -->

## 为什么需要状态管理

组件树层级深了之后，props 逐层传递（prop drilling）变得很痛苦。状态管理库提供了一个"全局仓库"，任何组件都能直接读写。

但不是所有状态都需要放进全局 store。判断标准：这个状态是否被多个不相关的组件共享？如果只是父子组件间传递，props 就够了。

## Vuex → Pinia

Vuex 是 Vue 2 时代的标配，核心概念：`state`（数据）、`getters`（计算属性）、`mutations`（同步修改）、`actions`（异步操作）。

```javascript
// Vuex
const store = new Vuex.Store({
  state: { count: 0 },
  mutations: {
    increment(state) { state.count++; },
  },
  actions: {
    asyncIncrement({ commit }) {
      setTimeout(() => commit('increment'), 1000);
    },
  },
});
```

Vuex 的问题：mutation 和 action 的区分很繁琐，TypeScript 支持差，模块嵌套复杂。

Pinia 是 Vue 3 的官方推荐，简化了很多：

```javascript
// Pinia
export const useCounterStore = defineStore('counter', {
  state: () => ({ count: 0 }),
  actions: {
    increment() { this.count++; },
    async asyncIncrement() {
      await delay(1000);
      this.count++;
    },
  },
});
```

没有 mutation 了，action 里直接改 state。TypeScript 支持开箱即用，DevTools 集成也更好。

## Redux → Zustand

Redux 是 React 生态最老牌的状态管理库，但样板代码太多：action type 常量、action creator、reducer、middleware……一个简单的功能要写好几个文件。

Redux Toolkit 简化了不少，但 Zustand 更进一步——几乎零样板：

```javascript
// Zustand
import { create } from 'zustand';

const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  reset: () => set({ count: 0 }),
}));

// 组件中使用
function Counter() {
  const count = useStore((state) => state.count);
  const increment = useStore((state) => state.increment);
  return <button onClick={increment}>{count}</button>;
}
```

Zustand 的 selector 模式天然支持细粒度订阅——组件只订阅自己用到的状态切片，其他状态变化不会触发重渲染。

## 选型建议

- **Vue 项目**：直接用 Pinia，没有理由再用 Vuex
- **React 小项目**：Context + useReducer 够用
- **React 中大项目**：Zustand 轻量灵活，Redux Toolkit 生态成熟
- **跨框架**：Zustand 不依赖 React，理论上可以在任何框架中使用
