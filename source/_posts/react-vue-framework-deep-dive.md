---
title: React & Vue 框架深度解析：Hooks 规则、响应式原理与副作用管理
date: 2024-10-18 20:00:00
tags:
  - React
  - Vue
  - Hooks
  - 响应式
  - 副作用
categories:
  - 前端框架
---

React Hooks 和 Vue 的响应式系统是当下前端面试的必考内容，也是日常开发中最容易踩坑的地方。本文深入剖析 Hooks 的设计约束、Vue 的依赖收集机制，以及副作用管理的最佳实践。

<!-- more -->

## 一、React Hook 为什么不能写在 if 或 for 里面

### 1.1 现象重现

```jsx
// ❌ 这段代码会报错：React Hook "useState" is called conditionally
function UserProfile({ isLoggedIn }) {
  if (isLoggedIn) {
    const [name, setName] = useState('') // 违反 Hook 规则！
  }
  // ...
}
```

### 1.2 根本原因：Hooks 依赖固定的调用顺序

React 在内部用一个**链表**来存储每次渲染中所有 Hook 的状态。每个 Hook 调用对应链表中的一个节点，React 通过**调用顺序（索引）**来确定哪个状态属于哪个 Hook。

```
第一次渲染：
  useState('Ann')   → Fiber.memoizedState[0] = 'Ann'
  useState(0)       → Fiber.memoizedState[1] = 0
  useEffect(...)    → Fiber.memoizedState[2] = effectFn

第二次渲染（重新调用组件函数）：
  React 期望按顺序读取：
  第1个Hook → memoizedState[0]（应该是 useState('Ann') 的状态）
  第2个Hook → memoizedState[1]（应该是 useState(0) 的状态）
  第3个Hook → memoizedState[2]（应该是 useEffect 的状态）
```

如果把 Hook 放在 `if` 里，条件为 `false` 时这个 Hook 不执行，后续 Hook 的索引全部错位：

```
// 错误场景：第一次 if=true，第二次 if=false
第一次：useState → [0], useState → [1], useEffect → [2]
第二次：if=false 跳过 useState，下一个 useState 读到了 [0]（索引错位！）
```

### 1.3 为什么这样设计？

这是一个权衡——React 选择了**简单高效的链表结构**来存储 Hook 状态（O(1) 查找），而不是用 Map/对象（需要 key，有额外开销）。代价是调用顺序必须固定。

**正确写法：把条件逻辑放在 Hook 内部：**

```jsx
// ✅ Hook 始终被调用，条件逻辑在内部处理
function UserProfile({ isLoggedIn }) {
  const [name, setName] = useState('')

  useEffect(() => {
    if (!isLoggedIn) return // 条件在 Hook 内部
    fetchUserName().then(setName)
  }, [isLoggedIn])

  return <div>{name}</div>
}
```

---

## 二、Vue 中 watch 和 watchEffect 的区别

### 2.1 核心对比

| 维度 | `watch` | `watchEffect` |
|------|---------|---------------|
| 监听目标 | 显式指定数据源 | 自动追踪内部用到的响应式数据 |
| 立即执行 | 默认不立即执行（可配置 `immediate: true`） | 立即执行一次（收集依赖） |
| 访问旧值 | ✅ 回调接收 `(newVal, oldVal)` | ❌ 无法获取旧值 |
| 懒执行 | 默认懒（有 `immediate` 选项） | 非懒（立即执行） |
| 适用场景 | 需要对比新旧值、异步操作、精确控制 | 自动同步副作用、数据初始化 |

### 2.2 代码示例

```javascript
import { ref, watch, watchEffect } from 'vue'

const userId = ref(1)
const userInfo = ref(null)

// watch：显式监听 userId，获取新旧值
watch(userId, async (newId, oldId) => {
  console.log(`用户 ID 从 ${oldId} 变为 ${newId}`)
  userInfo.value = await fetchUser(newId)
}, {
  immediate: true  // 立即执行一次（初始化时也触发）
})

// watchEffect：自动追踪，立即执行
// 等价于：只要 userId 变化就重新获取（但拿不到旧值）
watchEffect(async () => {
  // 自动追踪：函数内用到了 userId.value，Vue 会自动收集它为依赖
  userInfo.value = await fetchUser(userId.value)
})
```

**停止监听（避免内存泄漏）：**

```javascript
// watch/watchEffect 都返回停止函数
const stopWatch = watchEffect(() => {
  console.log(userId.value)
})

// 在组件卸载前停止（setup 中会自动清理，手动创建的需要手动停止）
onUnmounted(() => stopWatch())
```

**选择原则：**
- 需要对比新旧值 → `watch`
- 需要懒执行（数据变化才触发，不初始化触发）→ `watch`（默认行为）
- 自动同步效果、不关心旧值 → `watchEffect`（代码更简洁）

---

## 三、Vue 依赖收集原理：Vue2 vs Vue3

### 3.1 Vue2 的响应式：Object.defineProperty

Vue2 通过 `Object.defineProperty` 在初始化时**递归遍历对象所有属性**，为每个属性定义 `getter/setter`：

```javascript
// Vue2 响应式简化实现
function defineReactive(obj, key, val) {
  const dep = new Dep() // 每个属性一个依赖收集器

  Object.defineProperty(obj, key, {
    get() {
      // 依赖收集：读取属性时，把当前 Watcher 加入 dep
      if (Dep.target) {
        dep.depend()
      }
      return val
    },
    set(newVal) {
      if (newVal === val) return
      val = newVal
      // 派发更新：通知所有依赖此属性的 Watcher
      dep.notify()
    }
  })
}

// Dep：依赖收集器
class Dep {
  constructor() {
    this.subs = [] // 依赖此属性的 Watcher 列表
  }
  depend() {
    if (Dep.target) this.subs.push(Dep.target)
  }
  notify() {
    this.subs.forEach(watcher => watcher.update())
  }
}
```

**Vue2 的局限性：**

```javascript
const state = Vue.observable({ list: [1, 2, 3], user: { name: 'Ann' } })

// ❌ 无法检测：直接通过索引修改数组
state.list[0] = 10 // 不会触发视图更新！

// ❌ 无法检测：动态添加新属性
state.user.age = 18 // 不会触发视图更新！

// ✅ 需要使用 Vue.set
Vue.set(state.user, 'age', 18)
Vue.set(state.list, 0, 10)
// 或者
state.list.splice(0, 1, 10) // 数组变异方法被 Vue2 重写，可触发更新
```

### 3.2 Vue3 的响应式：Proxy

Vue3 用 `Proxy` 替代 `Object.defineProperty`，在**对象级别**拦截所有操作：

```javascript
// Vue3 响应式简化实现
function reactive(raw) {
  return new Proxy(raw, {
    get(target, key, receiver) {
      // 依赖收集
      track(target, key)
      const value = Reflect.get(target, key, receiver)
      // 深层对象递归代理（懒代理，按需触发）
      if (typeof value === 'object' && value !== null) {
        return reactive(value)
      }
      return value
    },
    set(target, key, value, receiver) {
      const oldValue = target[key]
      const result = Reflect.set(target, key, value, receiver)
      if (oldValue !== value) {
        // 派发更新
        trigger(target, key)
      }
      return result
    },
    // 还可以拦截：deleteProperty、has、ownKeys 等
    deleteProperty(target, key) {
      const result = Reflect.deleteProperty(target, key)
      trigger(target, key)
      return result
    }
  })
}
```

**Vue3 解决了 Vue2 的全部局限：**

```javascript
const state = reactive({ list: [1, 2, 3], user: { name: 'Ann' } })

// ✅ 直接索引修改数组 → 正常触发更新
state.list[0] = 10

// ✅ 动态添加属性 → 正常触发更新
state.user.age = 18

// ✅ 删除属性 → 也能触发更新
delete state.user.name
```

### 3.3 Vue2 vs Vue3 响应式差异总结

| 维度 | Vue2 | Vue3 |
|------|------|------|
| 实现方式 | `Object.defineProperty` | `Proxy` |
| 初始化 | 递归遍历所有属性（初始化耗时） | 懒代理（访问时才深层代理） |
| 数组索引修改 | ❌ 不支持 | ✅ 支持 |
| 动态新增属性 | ❌ 需要 `Vue.set` | ✅ 支持 |
| 性能 | 大对象初始化慢 | 更快，按需代理 |
| Map/Set 支持 | ❌ 不支持 | ✅ 通过 `reactive` 支持 |

---

## 四、如何理解副作用，使用时需注意什么

### 4.1 什么是副作用

**副作用（Side Effect）** 是指函数在返回值之外，对外部世界产生的影响。在 UI 框架中，凡是不属于"根据数据渲染 UI"的操作，都是副作用：

```
纯函数（无副作用）：输入 → 输出，不影响外部
副作用包括：
  - 网络请求（fetch）
  - 操作 DOM（document.title = ...）
  - 订阅事件（addEventListener）
  - 定时器（setTimeout/setInterval）
  - 写入 localStorage
  - 修改组件外部的变量
```

### 4.2 React useEffect 的注意事项

```jsx
function UserProfile({ userId }) {
  const [user, setUser] = useState(null)

  useEffect(() => {
    let cancelled = false // 防止竞态条件

    fetch(`/api/users/${userId}`)
      .then(r => r.json())
      .then(data => {
        // ✅ 组件已卸载 or userId 已变化时，不更新状态
        if (!cancelled) setUser(data)
      })

    // ✅ 清理函数：组件卸载或 userId 变化时执行
    return () => {
      cancelled = true
    }
  }, [userId]) // ✅ 依赖数组：明确列出所有依赖项

  // ...
}
```

**常见陷阱：**

```jsx
// ❌ 陷阱1：依赖数组缺少依赖（ESLint react-hooks/exhaustive-deps 会警告）
useEffect(() => {
  fetchData(userId) // userId 是依赖，但没有加到数组
}, []) // 只在挂载时执行，userId 变化后不会重新请求！

// ❌ 陷阱2：忘记清理定时器（内存泄漏）
useEffect(() => {
  const timer = setInterval(() => doSomething(), 1000)
  // 缺少 return () => clearInterval(timer)！
}, [])

// ❌ 陷阱3：在 useEffect 中更新依赖自身，导致无限循环
useEffect(() => {
  setCount(count + 1) // count 是依赖，更新 count 又触发 effect，死循环！
}, [count])

// ✅ 正确做法：用函数式更新
useEffect(() => {
  setCount(prev => prev + 1)
}, []) // 不依赖 count
```

### 4.3 Vue watch 的注意事项

```javascript
// ✅ 异步 watch 中的清理（防止竞态）
watch(userId, async (newId, oldId, onCleanup) => {
  let cancelled = false
  onCleanup(() => { cancelled = true }) // Vue3 提供了 onCleanup 参数

  const data = await fetchUser(newId)
  if (!cancelled) userInfo.value = data
})

// ✅ 停止不必要的 watcher（组件卸载后手动创建的 watcher）
const stop = watch(source, handler)
onUnmounted(stop)
```

---

## 总结

- **React Hook 的调用顺序限制**本质上是链表数据结构的索引依赖，条件/循环会破坏索引稳定性
- **watch vs watchEffect**：需要旧值、精确控制时用 watch；自动追踪、代码简洁时用 watchEffect
- **Vue2 vs Vue3 响应式**：Vue3 的 Proxy 从根本上解决了 Vue2 `defineProperty` 对数组索引和动态属性的检测盲区
- **副作用管理的核心原则**：明确依赖 + 正确清理（定时器、请求取消、事件解绑）+ 避免竞态条件

掌握这些原理，不仅能应对面试，更能在日常开发中写出更健壮、性能更优的组件。
