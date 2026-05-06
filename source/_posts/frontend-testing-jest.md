---
title: 前端自动化测试入门：Jest 单元测试与 Testing Library
date: 2023-12-10 20:00:00
tags:
  - Jest
  - Testing Library
  - 单元测试
  - 前端测试
categories:
  - 前端工程化
---

"写测试浪费时间"是我以前的想法，直到一次上线后回归 bug 让我加了两天班。这篇记录了 Jest 和 Testing Library 的入门实践。

<!-- more -->

## 为什么要写测试

- 重构时有信心：改了代码跑一遍测试，没挂就说明没破坏原有功能
- 减少回归 bug：核心逻辑有测试覆盖，上线前自动检查
- 文档作用：测试用例描述了函数的预期行为

## Jest 基础

Jest 是 JavaScript 最流行的测试框架，零配置开箱即用：

```javascript
// utils.test.js
import { formatPrice, isValidEmail } from './utils';

describe('formatPrice', () => {
  test('格式化整数价格', () => {
    expect(formatPrice(1000)).toBe('¥10.00');
  });

  test('处理小数', () => {
    expect(formatPrice(999)).toBe('¥9.99');
  });

  test('处理 0', () => {
    expect(formatPrice(0)).toBe('¥0.00');
  });
});

describe('isValidEmail', () => {
  test('合法邮箱', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
  });

  test('缺少 @', () => {
    expect(isValidEmail('testexample.com')).toBe(false);
  });
});
```

## 常用匹配器

```javascript
expect(value).toBe(expected);          // 严格相等
expect(value).toEqual(expected);       // 深度相等（对象/数组）
expect(value).toBeTruthy();            // 真值
expect(value).toBeNull();              // null
expect(array).toContain(item);         // 包含
expect(fn).toThrow();                  // 抛出异常
expect(fn).toHaveBeenCalledWith(args); // 函数被调用时的参数
```

## 测试异步代码

```javascript
// async/await
test('获取用户数据', async () => {
  const user = await fetchUser(1);
  expect(user.name).toBe('Ann');
});

// Mock API 请求
jest.mock('./api');
test('加载用户列表', async () => {
  api.getUsers.mockResolvedValue([{ id: 1, name: 'Ann' }]);
  const users = await loadUsers();
  expect(users).toHaveLength(1);
});
```

## Testing Library

Testing Library 的理念是"像用户一样测试"——不测试组件内部实现，而是测试用户能看到和操作的东西：

```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import Counter from './Counter';

test('点击按钮后计数增加', () => {
  render(<Counter />);
  const button = screen.getByRole('button', { name: '增加' });
  fireEvent.click(button);
  expect(screen.getByText('1')).toBeInTheDocument();
});
```

核心查询方法：`getByRole`（按角色）、`getByText`（按文本）、`getByPlaceholderText`（按占位符）。优先用 `getByRole`，因为它同时验证了无障碍性。
