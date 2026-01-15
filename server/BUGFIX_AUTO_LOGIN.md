# 自动登录失败问题修复

## 问题描述
用户登录后，连续刷新页面两次会导致退出登录状态，需要重新登录。

## 问题根源

### 原始代码问题
```javascript
function tryAutoLogin() {
    const savedLoginInfo = localStorage.getItem('tetris_login_info');
    if (savedLoginInfo) {
        try {
            const loginInfo = JSON.parse(savedLoginInfo);
            // ... 设置登录状态
            showGameContainer(); // ⚠️ 这里可能抛出异常
        } catch (error) {
            // ❌ 任何异常都会清除 localStorage
            localStorage.removeItem('tetris_login_info');
        }
    }
}
```

### 异常触发场景

1. **WebSocket 连接异常**
   - 服务器未启动或连接失败
   - `new WebSocket(wsUrl)` 可能抛出异常
   - 导致 catch 块清除 localStorage

2. **DOM 操作异常**
   - 页面加载时机问题
   - 某些 DOM 元素尚未完全加载
   - `getElementById().textContent` 可能失败

3. **游戏初始化异常**
   - `initBoard()` 或 `drawBoard()` 中的错误
   - Canvas 相关操作失败

### 问题流程
```
第一次刷新：
1. tryAutoLogin() 读取 localStorage ✓
2. showGameContainer() 执行时某处抛出异常 ✗
3. catch 块清除 localStorage ✗
4. 用户看到的是已登录状态（部分初始化完成）

第二次刷新：
1. tryAutoLogin() 读取 localStorage ✗ (已被清除)
2. 显示登录界面
```

## 解决方案

### 1. 分离错误处理
将 JSON 解析错误和运行时错误分开处理：

```javascript
function tryAutoLogin() {
    // 第一步：解析 localStorage（只在解析失败时清除）
    let loginInfo;
    try {
        loginInfo = JSON.parse(savedLoginInfo);
    } catch (error) {
        console.error('解析登录信息失败:', error);
        localStorage.removeItem('tetris_login_info');
        return;
    }
    
    // 第二步：验证数据完整性
    if (!loginInfo.playerId || !loginInfo.nickname) {
        localStorage.removeItem('tetris_login_info');
        return;
    }
    
    // 第三步：恢复登录状态
    playerId = loginInfo.playerId;
    playerNickname = loginInfo.nickname;
    highestScore = loginInfo.highestScore || 0;
    
    // 第四步：显示游戏界面（错误不清除 localStorage）
    try {
        showGameContainer();
    } catch (error) {
        console.error('显示游戏界面时出错:', error);
        // 不清除 localStorage，允许下次刷新重试
    }
}
```

### 2. 增强 showGameContainer 的容错性

```javascript
function showGameContainer() {
    isLoggedOut = false;
    
    // DOM 操作用 try-catch 包裹
    try {
        const gameContainer = document.getElementById('gameContainer');
        const playerNicknameEl = document.getElementById('playerNickname');
        const highestScoreEl = document.getElementById('highestScore');
        
        if (gameContainer) gameContainer.classList.add('active');
        if (playerNicknameEl) playerNicknameEl.textContent = playerNickname;
        if (highestScoreEl) highestScoreEl.textContent = highestScore;
    } catch (error) {
        console.error('更新游戏界面元素失败:', error);
    }
    
    // WebSocket 连接独立 try-catch
    try {
        connectWebSocket();
    } catch (error) {
        console.error('连接WebSocket失败:', error);
    }
    
    // 游戏初始化独立 try-catch
    try {
        initBoard();
        drawBoard();
    } catch (error) {
        console.error('初始化游戏板失败:', error);
    }
}
```

### 3. 关键原则

**只在数据确实无效时清除 localStorage：**
- ✅ JSON 解析失败（数据损坏）
- ✅ 必需字段缺失（数据不完整）
- ❌ WebSocket 连接失败（临时网络问题）
- ❌ DOM 操作失败（临时初始化问题）
- ❌ Canvas 渲染失败（临时资源问题）

## 修改的文件
- `server/public/tetris-game.js`
  - `tryAutoLogin()` - 重构错误处理逻辑
  - `showGameContainer()` - 增加容错性

## 测试验证

### 测试场景 1：正常刷新
```
1. 登录游戏
2. 刷新页面 → 应保持登录
3. 连续刷新多次 → 应始终保持登录
```

### 测试场景 2：服务器未启动
```
1. 登录游戏
2. 停止服务器
3. 刷新页面 → 应显示游戏界面（但 WebSocket 未连接）
4. 再次刷新 → 仍应显示游戏界面
5. 启动服务器 → WebSocket 应自动重连
```

### 测试场景 3：页面快速刷新
```
1. 登录游戏
2. 快速连续刷新 5 次
3. 验证：始终保持登录状态
```

### 测试场景 4：数据损坏
```
1. 登录游戏
2. 打开开发者工具
3. 在 localStorage 中修改数据为无效 JSON
4. 刷新页面 → 应清除并返回登录界面
```

## 技术要点

### 1. 错误处理层次
- **数据层错误**：清除 localStorage（数据不可恢复）
- **显示层错误**：记录日志但保留数据（可重试）
- **网络层错误**：记录日志但保留数据（临时性）

### 2. 防御性编程
- 所有 DOM 操作前检查元素存在性
- 所有可能失败的操作都用 try-catch 包裹
- 独立的 try-catch 块，避免一个错误影响其他操作

### 3. 用户体验优先
- 保持登录状态的优先级高于完美的初始化
- 允许部分功能降级（如 WebSocket 未连接）
- 给予用户重试的机会（不急于清除状态）

## 相关问题预防

### localStorage 操作最佳实践
1. 读取后立即 try-catch JSON.parse
2. 写入前验证数据结构
3. 只在数据确实无效时清除
4. 考虑添加版本号和时间戳

### 自动登录最佳实践
1. 分离数据验证和 UI 操作
2. UI 操作失败不影响登录状态
3. 提供降级方案（部分功能可用）
4. 记录详细的错误日志便于调试

## 日志输出

修复后的日志更清晰：
```
✅ 自动登录成功: 玩家昵称
❌ 解析登录信息失败: [具体错误]
❌ 显示游戏界面时出错: [具体错误]（但保留登录状态）
❌ 连接WebSocket失败: [具体错误]（但保留登录状态）
```

这样开发者可以更容易定位问题，而不会因为过度防御导致用户频繁重新登录。
