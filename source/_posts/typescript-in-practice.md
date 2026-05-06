---
title: TypeScript 从入门到项目实战：类型系统如何提升代码质量
date: 2022-12-01 20:00:00
tags:
  - TypeScript
  - 类型系统
  - 工程实践
categories:
  - JavaScript 核心
---

从 JavaScript 切到 TypeScript，最大的感受是"编译器帮你 review 代码"。这篇记录了 TS 的核心类型系统、泛型、类型体操，以及在项目中落地的经验。

<!-- more -->

## 基础类型

```typescript
// 原始类型
const name: string = 'Ann';
const age: number = 25;
const isDev: boolean = true;

// 数组
const list: number[] = [1, 2, 3];
const names: Array<string> = ['a', 'b'];

// 对象
interface User {
  id: number;
  name: string;
  email?: string;       // 可选属性
  readonly role: string; // 只读属性
}
```

## 联合类型与类型收窄

```typescript
function format(input: string | number): string {
  if (typeof input === 'string') {
    return input.trim();  // 这里 TS 知道 input 是 string
  }
  return input.toFixed(2); // 这里 TS 知道 input 是 number
}
```

`typeof`、`instanceof`、`in` 操作符都能触发类型收窄，TS 编译器会自动推断收窄后的类型。

## 泛型

泛型让函数和类型可以适配多种数据类型，同时保持类型安全：

```typescript
function getFirst<T>(arr: T[]): T | undefined {
  return arr[0];
}

const num = getFirst([1, 2, 3]);     // 推断为 number
const str = getFirst(['a', 'b']);     // 推断为 string
```

泛型约束用 `extends` 限制类型范围：

```typescript
interface HasId {
  id: number;
}

function findById<T extends HasId>(list: T[], id: number): T | undefined {
  return list.find(item => item.id === id);
}
```

## 实用工具类型

TS 内置了很多工具类型，项目里高频使用的：

```typescript
Partial<User>     // 所有属性变可选
Required<User>    // 所有属性变必填
Pick<User, 'id' | 'name'>  // 选取部分属性
Omit<User, 'email'>        // 排除部分属性
Record<string, number>     // 键值对类型
```

## 项目落地经验

1. **API 响应类型定义**：后端接口的返回值一定要定义类型，不要用 `any`。前后端字段不一致时编译阶段就能发现。

2. **组件 Props 类型**：Vue 和 React 的组件 props 用 interface 定义，比 PropTypes 严格得多。

3. **渐进式迁移**：老项目不需要一次性全改 TS，可以先把 `tsconfig.json` 的 `strict` 关掉，逐步开启严格检查。
