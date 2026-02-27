---
title: JavaScript 核心：数据类型、instanceof 原理与百万数据 TopK 算法
date: 2026-02-27 11:30:00
tags:
  - JavaScript
  - 数据类型
  - 算法
  - instanceof
categories:
  - JavaScript 核心
---

JavaScript 的数据类型是一切基础，instanceof 的原型链原理是面试高频考点，而百万数据中找 TopK 则考验算法思维与工程实现能力。本文对这三个知识点进行深度拆解。

<!-- more -->

## 一、JS 数据类型全解析

### 1.1 基本类型（Primitive）

共 7 种，存储在**栈内存**中，赋值时拷贝值本身：

```javascript
// 1. undefined
let a  // a === undefined

// 2. null
let b = null

// 3. boolean
let c = true

// 4. number（整数和浮点数统一为 IEEE 754 双精度浮点）
let d = 42
let e = 3.14
let f = NaN      // Not a Number，但 typeof NaN === 'number'
let g = Infinity

// 5. string
let h = 'hello'

// 6. symbol（ES6，唯一标识符）
const sym1 = Symbol('desc')
const sym2 = Symbol('desc')
console.log(sym1 === sym2) // false，每个 Symbol 都唯一

// 7. bigint（ES2020，任意精度整数）
const big = 9007199254740993n // Number 无法精确表示的大整数
```

**基本类型的不可变性：**

```javascript
let str = 'hello'
str.toUpperCase()  // 返回新字符串，不修改原始值
console.log(str)   // 'hello'，未变

let num = 42
let copy = num     // 值拷贝
copy = 100
console.log(num)   // 42，num 不受影响
```

### 1.2 引用类型（Reference）

Object 及其子类型，存储在**堆内存**中，变量保存的是内存地址（引用）：

```javascript
// Object、Array、Function、Date、RegExp、Map、Set、WeakMap、WeakSet 等
const obj1 = { name: 'Ann' }
const obj2 = obj1       // 拷贝的是引用（内存地址），不是值
obj2.name = 'Bob'
console.log(obj1.name)  // 'Bob'，obj1 和 obj2 指向同一个对象
```

### 1.3 类型判断的四种方法

**方法一：typeof**

```javascript
typeof undefined    // 'undefined'
typeof null         // 'object'（历史遗留 bug，null 不是对象！）
typeof true         // 'boolean'
typeof 42           // 'number'
typeof 'str'        // 'string'
typeof Symbol()     // 'symbol'
typeof 42n          // 'bigint'
typeof {}           // 'object'
typeof []           // 'object'（无法区分数组和普通对象）
typeof function(){} // 'function'（函数是特殊的 object）
```

**局限：** 无法区分 `null` 和 `object`，无法区分 `Array`、`Date`、`RegExp` 等。

**方法二：instanceof**

```javascript
[] instanceof Array       // true
[] instanceof Object      // true（Array 是 Object 的子类型）
{} instanceof Object      // true
function(){} instanceof Function  // true

// 局限：跨 iframe 失效（不同 iframe 的 Array 原型链不同）
```

**方法三：Object.prototype.toString.call()（最准确）**

```javascript
const toString = Object.prototype.toString

toString.call(undefined)   // '[object Undefined]'
toString.call(null)        // '[object Null]'
toString.call(42)          // '[object Number]'
toString.call('str')       // '[object String]'
toString.call(true)        // '[object Boolean]'
toString.call(Symbol())    // '[object Symbol]'
toString.call([])          // '[object Array]'
toString.call({})          // '[object Object]'
toString.call(new Date())  // '[object Date]'
toString.call(/regex/)     // '[object RegExp]'
toString.call(function(){})// '[object Function]'

// 封装为通用工具函数
function getType(value) {
  return Object.prototype.toString.call(value).slice(8, -1).toLowerCase()
}
getType([])      // 'array'
getType(null)    // 'null'
getType(new Map()) // 'map'
```

**方法四：Array.isArray()（专用于数组判断）**

```javascript
Array.isArray([])          // true
Array.isArray({})          // false
Array.isArray('string')    // false
// 跨 iframe 也有效（推荐用于数组判断）
```

**选择建议：**
- 判断是否为数组 → `Array.isArray()`
- 精确判断任意类型 → `Object.prototype.toString.call()`
- 区分原始类型（非 null）→ `typeof`
- 判断实例关系 → `instanceof`

---

## 二、instanceof 的判断原理

### 2.1 核心：沿原型链向上查找

`a instanceof B` 的本质是：**在 `a` 的原型链上，是否能找到 `B.prototype`**。

```javascript
// instanceof 的等价实现
function myInstanceof(obj, Constructor) {
  // 基本类型直接返回 false
  if (obj === null || typeof obj !== 'object' && typeof obj !== 'function') {
    return false
  }

  let proto = Object.getPrototypeOf(obj) // 等价于 obj.__proto__
  const prototype = Constructor.prototype

  while (proto !== null) {
    if (proto === prototype) return true   // 找到匹配，返回 true
    proto = Object.getPrototypeOf(proto)   // 沿原型链向上
  }
  return false  // 到达原型链顶端（null），未找到
}

console.log(myInstanceof([], Array))    // true
console.log(myInstanceof([], Object))   // true
console.log(myInstanceof({}, Array))    // false
```

### 2.2 原型链图示

```
[] (数组实例)
│
└─ __proto__ → Array.prototype     ← instanceof Array 找到这里 → true
                │
                └─ __proto__ → Object.prototype  ← instanceof Object 找到这里 → true
                                │
                                └─ __proto__ → null（原型链终点）
```

### 2.3 实战示例

```javascript
function Animal(name) {
  this.name = name
}
function Dog(name) {
  Animal.call(this, name)
}
Dog.prototype = Object.create(Animal.prototype)
Dog.prototype.constructor = Dog

const dog = new Dog('旺财')

console.log(dog instanceof Dog)    // true（Dog.prototype 在 dog 的原型链上）
console.log(dog instanceof Animal) // true（Animal.prototype 也在原型链上）
console.log(dog instanceof Object) // true（所有对象最终都指向 Object.prototype）

// 原型链：dog → Dog.prototype → Animal.prototype → Object.prototype → null
```

### 2.4 instanceof 的特殊场景

```javascript
// Symbol.hasInstance：自定义 instanceof 行为
class EvenNumber {
  static [Symbol.hasInstance](num) {
    return typeof num === 'number' && num % 2 === 0
  }
}
console.log(2 instanceof EvenNumber)  // true
console.log(3 instanceof EvenNumber)  // false

// 跨 iframe 失效示例
const iframe = document.createElement('iframe')
document.body.appendChild(iframe)
const iframeArray = new iframe.contentWindow.Array()
console.log(iframeArray instanceof Array) // false！两个不同的 Array.prototype
console.log(Array.isArray(iframeArray))   // true（isArray 不受此影响）
```

---

## 三、手撕：100万个数字中找最大的1000个

### 3.1 思路分析

| 方法 | 时间复杂度 | 空间复杂度 | 适用场景 |
|------|-----------|-----------|---------|
| 全量排序（sort） | O(n log n) | O(n) | 数据量小，代码简单 |
| 最小堆（Min-Heap） | O(n log k) | O(k) | **最优**，大数据量 |
| 快速选择（QuickSelect） | O(n) 平均 | O(1) | 数据在内存中，不需要边读边处理 |
| 分治（外部排序） | O(n log n) | O(k) | 数据超大，无法一次性放入内存 |

**最优方案：最小堆**

- 维护一个大小为 K（1000）的最小堆
- 遍历所有 N（1,000,000）个数：
  - 堆未满：直接入堆
  - 堆已满：若当前数 > 堆顶（堆中最小值），则替换堆顶并重新堆化
- 时间复杂度：O(n log k)，远优于 O(n log n)

### 3.2 手写最小堆

```javascript
class MinHeap {
  constructor() {
    this.heap = []
  }

  get size() {
    return this.heap.length
  }

  peek() {
    return this.heap[0] // 堆顶（最小值）
  }

  push(val) {
    this.heap.push(val)
    this._bubbleUp(this.heap.length - 1) // 上浮
  }

  pop() {
    const min = this.heap[0]
    const last = this.heap.pop()
    if (this.heap.length > 0) {
      this.heap[0] = last
      this._sinkDown(0) // 下沉
    }
    return min
  }

  // 上浮：子节点与父节点比较，若更小则交换
  _bubbleUp(index) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2)
      if (this.heap[parentIndex] <= this.heap[index]) break
      ;[this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]]
      index = parentIndex
    }
  }

  // 下沉：父节点与两个子节点比较，若更大则与最小子节点交换
  _sinkDown(index) {
    const length = this.heap.length
    while (true) {
      let smallest = index
      const left = 2 * index + 1
      const right = 2 * index + 2

      if (left < length && this.heap[left] < this.heap[smallest]) {
        smallest = left
      }
      if (right < length && this.heap[right] < this.heap[smallest]) {
        smallest = right
      }
      if (smallest === index) break

      ;[this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]]
      index = smallest
    }
  }
}

/**
 * 在 N 个数字中找最大的 K 个
 * @param {number[]} nums - 输入数组（100万个数字）
 * @param {number} k - 需要找的最大值数量（1000）
 * @returns {number[]} - 最大的 K 个数字（升序）
 */
function topK(nums, k) {
  const heap = new MinHeap()

  for (const num of nums) {
    if (heap.size < k) {
      // 堆未满，直接加入
      heap.push(num)
    } else if (num > heap.peek()) {
      // 当前数比堆顶（已知最大K个中的最小值）还大
      // 替换堆顶，维持堆大小为 K
      heap.pop()
      heap.push(num)
    }
    // 否则：当前数 <= 堆顶，不可能进入 Top K，直接跳过
  }

  return heap.heap.sort((a, b) => a - b) // 最终堆中的 K 个数即为答案
}

// 测试
const nums = Array.from({ length: 1_000_000 }, () => Math.floor(Math.random() * 1_000_000))
console.time('topK')
const result = topK(nums, 1000)
console.timeEnd('topK') // 约 50~100ms，远快于全量排序的 500ms+

console.log('最大1000个中的最小值：', result[0])
console.log('最大1000个中的最大值：', result[result.length - 1])
```

### 3.3 复杂度验证

```
N = 1,000,000，K = 1000

最小堆方案：
  - 建堆阶段：前 K 个数入堆，O(K log K) = O(1000 × 10) ≈ 10,000 次操作
  - 遍历阶段：剩余 N-K 个数，每次堆操作 O(log K)
    ≈ 999,000 × 10 = 9,990,000 次操作
  - 总计：约 10,000,000 次操作

全量排序方案：
  - O(N log N) = 1,000,000 × 20 = 20,000,000 次操作
  - 且内存占用是堆方案的 1000 倍（O(N) vs O(K)）
```

### 3.4 工程扩展：数据量超过内存怎么办

当 100 万个数字无法一次性放入内存（比如存储在文件中），使用**分治 + 外部排序**：

```javascript
// 伪代码思路
async function topKFromFile(filePath, k) {
  const CHUNK_SIZE = 100000 // 每次读取 10万条

  // 1. 分块处理，每块找 topK
  const chunkTopKs = []
  for await (const chunk of readChunks(filePath, CHUNK_SIZE)) {
    chunkTopKs.push(...topK(chunk, k)) // 每块找出 K 个最大值
  }

  // 2. 对所有块的 TopK 结果再次求 TopK
  return topK(chunkTopKs, k)
}
```

---

## 总结

- **数据类型**：7 种基本类型（undefined、null、boolean、number、string、symbol、bigint）+ 引用类型。类型判断首选 `Object.prototype.toString.call()`，判断数组用 `Array.isArray()`
- **instanceof 原理**：沿原型链向上遍历，查找是否存在构造函数的 `prototype`，自定义类可通过 `Symbol.hasInstance` 改变行为，跨 iframe 场景失效
- **TopK 算法**：最小堆是最优解，时间复杂度 O(n log k)，空间复杂度 O(k)；面试时能手写最小堆的 push/pop 并解释堆化过程，会加分很多

这三个知识点从类型系统到原型机制再到算法，覆盖了 JS 面试的核心考查维度，掌握其原理远比记忆结论更有价值。
