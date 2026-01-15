# 登录状态持久化功能说明

## 功能概述
实现了页面刷新后保持登录状态的功能，用户登录后刷新页面无需重新登录。

## 实现的功能

### 1. 自动登录
- **localStorage存储**：用户登录成功后，将登录信息保存到 `localStorage`
  - 保存内容：playerId、nickname、highestScore、loginTime
- **页面加载检查**：页面加载时自动检查 localStorage 中是否有登录信息
- **自动登录**：如果有有效的登录信息，自动登录并显示游戏界面

### 2. 退出登录
- 添加了**退出登录按钮**（位于玩家信息面板右上角）
- 点击退出后会：
  - 清除 localStorage 中的登录信息
  - 断开 WebSocket 连接
  - 停止游戏循环
  - 重置所有游戏状态
  - 返回登录界面

### 3. 实时同步
- 当玩家的最高分更新时，自动更新 localStorage 中的数据
- 确保刷新后显示最新的最高分

## 修改的文件

### 1. tetris-game.js
添加了以下函数：
- `tryAutoLogin()` - 尝试从 localStorage 自动登录
- `updateLoginInfo()` - 更新 localStorage 中的登录信息
- `logout()` - 退出登录功能

修改的地方：
- 页面加载时调用 `tryAutoLogin()`
- 登录成功后保存信息到 localStorage
- 更新最高分时同步更新 localStorage

### 2. game.html
- 在玩家信息面板添加了退出登录按钮
- 添加了退出按钮的 CSS 样式

## 测试步骤

1. **首次登录测试**
   ```
   1. 打开游戏页面
   2. 输入昵称和邮箱登录
   3. 登录成功后刷新页面
   4. 验证：应该自动登录，无需重新输入信息
   ```

2. **退出登录测试**
   ```
   1. 在登录状态下，点击右上角的"退出"按钮
   2. 验证：返回登录界面
   3. 刷新页面
   4. 验证：仍在登录界面，需要重新登录
   ```

3. **最高分同步测试**
   ```
   1. 登录并开始游戏
   2. 玩游戏并创建新的最高分
   3. 刷新页面
   4. 验证：显示更新后的最高分
   ```

## 技术细节

### localStorage 数据结构
```javascript
{
  "playerId": "player-uuid",
  "nickname": "玩家昵称",
  "highestScore": 12345,
  "loginTime": "2026-01-15T12:00:00.000Z"
}
```

### 安全考虑
- localStorage 数据存储在客户端，任何人都可以修改
- 真实的验证仍然在服务端进行
- localStorage 仅用于改善用户体验，不影响服务端的安全性
- 所有关键操作（如分数提交）仍需服务端验证

## 浏览器兼容性
- 支持所有现代浏览器（Chrome、Firefox、Safari、Edge）
- localStorage API 兼容性：IE 8+

## 注意事项
1. 清除浏览器数据会导致登录状态丢失
2. 隐私模式/无痕模式下 localStorage 可能不可用或在关闭后清除
3. 多个标签页之间共享相同的 localStorage
