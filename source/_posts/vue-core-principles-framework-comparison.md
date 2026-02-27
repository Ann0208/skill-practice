---
title: Vue 核心原理深度解析：响应式系统、Composition API 与框架对比
date: 2026-01-16 20:30:00
tags:
  - Vue
  - Vue3
  - 响应式
  - Composition API
  - Pinia
  - 框架对比
categories:
  - 前端技术
---

Vue 以其渐进式设计和优雅的响应式系统著称。本文深入解析 Vue3 相对 Vue2 的核心升级——Proxy 响应式系统、Composition API、Pinia 状态管理，以及 Vue 与 React 在设计哲学上的关键差异。

<!-- more -->

## 一、Vue2 vs Vue3 响应式原理

### 1.1 Vue2：Object.defineProperty

Vue2 通过 `Object.defineProperty` 拦截对象属性的 getter/setter，实现依赖收集与触发更新。

```javascript
// Vue2 响应式核心原理（简化）
function defineReactive(obj, key, val) {
  const dep = new Dep(); // 依赖收集器

  Object.defineProperty(obj, key, {
    get() {
      if (Dep.target) dep.depend(); // 收集依赖（Watcher）
      return val;
    },
    set(newVal) {
      if (newVal === val) return;
      val = newVal;
      dep.notify(); // 通知所有 Watcher 更新
    }
  });
}
```

**Vue2 响应式的局限性**：

1. **无法检测新增/删除属性**：需要 `Vue.set(obj, 'key', value)` 或 `Vue.delete(obj, 'key')`；
2. **无法检测数组下标变更**：`arr[0] = 'new'` 不触发响应，需使用 `$set` 或变异方法（`push`、`splice` 等）；
3. **深层对象需遍历递归处理**：初始化时对整个对象树 defineProperty，性能开销较大。

### 1.2 Vue3：Proxy + Reflect

Vue3 使用 ES6 `Proxy` 代理整个对象，配合 `Reflect` 操作对象：

```javascript
// Vue3 响应式核心原理（简化）
function reactive(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      track(target, key); // 依赖追踪
      const res = Reflect.get(target, key, receiver);
      // 懒代理：访问到嵌套对象时才代理
      if (typeof res === 'object' && res !== null) {
        return reactive(res);
      }
      return res;
    },
    set(target, key, value, receiver) {
      const result = Reflect.set(target, key, value, receiver);
      trigger(target, key); // 触发更新
      return result;
    },
    deleteProperty(target, key) {
      const result = Reflect.deleteProperty(target, key);
      trigger(target, key); // 删除属性也能触发响应
      return result;
    }
  });
}
```

**Vue3 Proxy 的优势**：
- 可以检测属性新增、删除、数组下标变更；
- 懒代理（访问时才创建深层 Proxy），性能更好；
- 支持 `Map`、`Set`、`WeakMap` 等数据结构的响应式。

### 1.3 ref vs reactive

```javascript
import { ref, reactive } from 'vue';

// ref：适合基本类型，也可包装对象
const count = ref(0);
count.value++; // 通过 .value 访问

// reactive：适合对象/数组，直接访问属性
const state = reactive({
  count: 0,
  user: { name: '张三', age: 25 }
});
state.count++;          // 直接修改
state.user.name = '李四'; // 深层响应式

// 模板中：ref 自动解包，无需 .value
// <template>{{ count }}（不需要 count.value）</template>
```

**选择建议**：
- 基本类型用 `ref`；
- 对象类型两者都可，`reactive` 更简洁，但不能解构（解构后失去响应式），`ref` 可以配合 `toRefs` 解构。

```javascript
// reactive 解构失去响应式（❌）
const { count } = state; // count 不再是响应式

// 使用 toRefs 保持响应式（✅）
const { count, user } = toRefs(state);
count.value++; // 通过 .value 操作
```

---

## 二、Composition API vs Options API

### 2.1 Options API（Vue2 风格）

```javascript
export default {
  data() {
    return { count: 0, user: null };
  },
  computed: {
    doubleCount() { return this.count * 2; }
  },
  methods: {
    increment() { this.count++; },
    async fetchUser() {
      this.user = await api.getUser();
    }
  },
  mounted() { this.fetchUser(); },
  watch: {
    count(newVal) { console.log('count changed:', newVal); }
  }
}
```

**问题**：同一功能的代码分散在 `data`、`computed`、`methods`、`watch` 等不同选项中，大型组件难以维护。

### 2.2 Composition API（Vue3 风格）

```javascript
import { ref, computed, watch, onMounted } from 'vue';
import { useUserStore } from './stores/user';

export default {
  setup() {
    // 同一功能的代码放在一起
    const count = ref(0);
    const doubleCount = computed(() => count.value * 2);
    const increment = () => count.value++;

    watch(count, (newVal) => {
      console.log('count changed:', newVal);
    });

    // 用户功能
    const user = ref(null);
    const fetchUser = async () => {
      user.value = await api.getUser();
    };
    onMounted(fetchUser);

    return { count, doubleCount, increment, user };
  }
}
```

### 2.3 自定义 Hook（Composable）

Composition API 最大的优势是逻辑复用，通过自定义 Composable 函数提取复用逻辑：

```javascript
// useProvinceCity.js：省市联动 Composable
import { ref, watch } from 'vue';

export function useProvinceCity(initialProvince = '') {
  const selectedProvince = ref(initialProvince);
  const selectedCity = ref('');
  const cityList = ref([]);
  const loading = ref(false);

  const provinceList = ref([
    { code: '110000', name: '北京市' },
    { code: '310000', name: '上海市' },
    // ...
  ]);

  // 监听省份变化，自动加载城市列表
  watch(selectedProvince, async (province) => {
    if (!province) {
      cityList.value = [];
      return;
    }
    loading.value = true;
    try {
      cityList.value = await fetchCities(province);
      selectedCity.value = ''; // 重置城市选择
    } finally {
      loading.value = false;
    }
  });

  return {
    selectedProvince,
    selectedCity,
    provinceList,
    cityList,
    loading
  };
}

// 组件中使用
export default {
  setup() {
    const { selectedProvince, selectedCity, provinceList, cityList, loading }
      = useProvinceCity();

    return { selectedProvince, selectedCity, provinceList, cityList, loading };
  }
}
```

---

## 三、组件通信方式

### 3.1 父子通信：Props + Emits

```vue
<!-- 子组件 -->
<script setup>
const props = defineProps({
  title: String,
  count: { type: Number, default: 0 }
});

const emit = defineEmits(['update', 'close']);

function handleClick() {
  emit('update', props.count + 1);
}
</script>
```

### 3.2 v-model（双向绑定语法糖）

```vue
<!-- 父组件 -->
<MyInput v-model="searchText" />
<!-- 等价于 -->
<MyInput :modelValue="searchText" @update:modelValue="searchText = $event" />

<!-- 子组件 MyInput.vue -->
<script setup>
defineProps(['modelValue']);
const emit = defineEmits(['update:modelValue']);
</script>
<template>
  <input :value="modelValue" @input="emit('update:modelValue', $event.target.value)" />
</template>
```

### 3.3 跨层级通信：provide / inject

```javascript
// 祖先组件
const theme = ref('light');
provide('theme', readonly(theme)); // readonly 防止子组件直接修改
provide('setTheme', (val) => { theme.value = val; });

// 任意后代组件
const theme = inject('theme');
const setTheme = inject('setTheme');
```

### 3.4 Vue 组件通信汇总

| 方式 | 适用场景 |
|------|----------|
| Props + Emits | 父子组件，数据从父流向子 |
| v-model | 表单组件双向绑定 |
| provide / inject | 跨层级，避免 props 逐层传递 |
| Pinia Store | 全局共享状态，跨组件通信 |
| mitt（事件总线） | 无关系组件通信（慎用） |
| ref + expose | 父组件调用子组件方法 |

---

## 四、Pinia 状态管理

### 4.1 Pinia vs Vuex

| 特性 | Pinia | Vuex 4 |
|------|-------|--------|
| TypeScript 支持 | 原生支持，类型推导极佳 | 需要手动类型声明 |
| Mutation | 无需 Mutation，直接修改 | 必须通过 Mutation 修改 |
| 模块化 | 多个 Store，无需嵌套 | 通过 modules 嵌套 |
| Devtools | 完整支持 | 完整支持 |
| 包大小 | ~1KB | ~10KB |
| 组合式写法 | 支持 Setup Store | 不支持 |

### 4.2 Pinia 基本用法

```javascript
// stores/user.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// Setup Store 写法（推荐，更接近 Composition API）
export const useUserStore = defineStore('user', () => {
  const token = ref('');
  const userInfo = ref(null);

  const isLoggedIn = computed(() => !!token.value);

  async function login(credentials) {
    const response = await api.login(credentials);
    token.value = response.token;
    userInfo.value = response.user;
  }

  function logout() {
    token.value = '';
    userInfo.value = null;
  }

  return { token, userInfo, isLoggedIn, login, logout };
});

// 组件中使用
import { useUserStore } from '@/stores/user';
import { storeToRefs } from 'pinia';

const userStore = useUserStore();
// storeToRefs 解构保持响应式
const { userInfo, isLoggedIn } = storeToRefs(userStore);
// 方法可以直接解构（不需要 storeToRefs）
const { login, logout } = userStore;
```

### 4.3 协同标注系统的 Pinia 状态设计

复杂场景（如多人协同标注）的 Store 设计原则：

```javascript
// stores/annotation.js
export const useAnnotationStore = defineStore('annotation', () => {
  // 标注数据
  const annotations = ref(new Map()); // key: annotationId, value: annotation
  const selectedIds = ref(new Set()); // 当前选中的标注 IDs

  // 协作状态
  const collaborators = ref([]); // 在线协作者列表
  const myLocks = ref(new Set()); // 我锁定的标注（防止并发编辑冲突）

  // 历史记录（用于撤销/重做）
  const history = ref([]);
  const historyIndex = ref(-1);

  // 计算属性
  const selectedAnnotations = computed(() => {
    return [...selectedIds.value].map(id => annotations.value.get(id)).filter(Boolean);
  });

  // 原子操作（用于乐观更新 + 服务端同步）
  async function addAnnotation(data) {
    const tempId = `temp_${Date.now()}`;
    const tempAnnotation = { ...data, id: tempId, status: 'pending' };

    // 乐观更新：先在本地加入
    annotations.value.set(tempId, tempAnnotation);

    try {
      const saved = await api.saveAnnotation(data);
      // 用服务端返回的数据替换临时数据
      annotations.value.delete(tempId);
      annotations.value.set(saved.id, saved);
    } catch (error) {
      // 回滚：删除临时数据
      annotations.value.delete(tempId);
      throw error;
    }
  }

  return { annotations, selectedIds, collaborators, selectedAnnotations, addAnnotation };
});
```

---

## 五、Vue2 迁移到 Vue3

### 5.1 主要破坏性变更

| 变更点 | Vue2 | Vue3 |
|--------|------|------|
| 根节点 | 必须有单一根节点 | 支持多根节点（Fragment） |
| v-model | 默认 `value` + `input` | 默认 `modelValue` + `update:modelValue` |
| 过滤器 | `{{ price | currency }}` | 移除，用计算属性/方法替代 |
| `$listeners` | 存在 | 合并进 `$attrs` |
| 全局 API | `Vue.component()`、`Vue.use()` | `app.component()`、`app.use()` |
| 生命周期 | `beforeDestroy`/`destroyed` | `beforeUnmount`/`unmounted` |

### 5.2 迁移策略

```javascript
// 1. 先升级到 Vue 2.7（支持 Composition API，渐进迁移）
// 2. 引入 @vue/compat（兼容模式）逐步迁移
// 3. 使用 Vue Demi 编写同时支持 Vue2/3 的库

// Vue2.7 中使用 Composition API
import { ref, onMounted } from '@vue/composition-api';

// 迁移 Options API 到 Composition API 的映射：
// data()          → ref / reactive
// computed:       → computed()
// methods:        → 普通函数
// watch:          → watch() / watchEffect()
// mounted:        → onMounted()
// beforeDestroy:  → onBeforeUnmount()
```

---

## 六、v-if 与 v-show 的区别

```vue
<!-- v-if：条件为 false 时，DOM 节点不存在（完全销毁/重建） -->
<!-- 适合：切换不频繁，需要条件渲染的场景（权限控制、骨架屏） -->
<div v-if="isLoggedIn">用户面板</div>

<!-- v-show：条件为 false 时，display: none（节点存在但隐藏） -->
<!-- 适合：频繁切换显隐的场景（Tabs、折叠面板） -->
<div v-show="isExpanded">折叠内容</div>
```

| 特性 | v-if | v-show |
|------|------|--------|
| DOM 操作 | 条件为 false 时销毁节点 | 始终存在，切换 display |
| 初始渲染成本 | 低（false 时不渲染） | 高（始终渲染） |
| 切换成本 | 高（涉及组件生命周期） | 低（只改 CSS） |
| 使用场景 | 切换不频繁 | 切换频繁 |

---

## 总结

Vue3 的核心升级体现在：

- **响应式系统**：Proxy 取代 Object.defineProperty，支持更多场景（数组下标、新增属性、Map/Set），性能更好（懒代理）；
- **Composition API**：将相关逻辑聚合在一起，易于提取复用（Composable），TypeScript 友好；
- **Pinia**：取代 Vuex 成为官方推荐，无 Mutation 概念，API 极简，原生 TypeScript 支持；
- **性能提升**：编译时静态提升（hoistStatic）、patch flag 标记动态节点，减少运行时开销；
- **组件通信**：父子用 Props/Emits，跨层级用 provide/inject，全局用 Pinia，按需选择。

Vue3 在保持渐进式特性的同时，向组合式编程迈进，与 React Hooks 的设计理念趋于一致，但保留了模板语法的直观性和响应式的自动追踪优势。
