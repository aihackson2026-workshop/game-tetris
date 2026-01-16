# Bug 修复：验证码通过后状态不同步

## 问题描述
验证码弹出并通过验证后，通过 JS API (`getGameState()`) 获取游戏状态仍然显示需要通过验证码（`captchaRequired: true`）。

## 根本原因
在 `tetris-game.js` 中，有两个函数处理验证码验证成功的逻辑：

1. **`verifyCaptcha()`** - 传统界面验证码验证（第564行）
   - ✅ 隐藏验证码模态框
   - ✅ 恢复游戏状态 `gameState.playing = true`
   - ✅ 重启游戏循环
   - ❌ **没有清除 `captchaPending` 变量**

2. **`handleCaptchaSubmit()`** - SDK API 验证码验证（第1685行）
   - ✅ 清除 `captchaPending = null`
   - ✅ 恢复游戏状态
   - ✅ 重启游戏循环

3. **WebSocket `captchaVerified` 消息处理** - 服务器推送验证成功（第515行）
   - ✅ 隐藏验证码模态框
   - ✅ 显示通知
   - ❌ **没有清除 `captchaPending` 变量**

而 `handleGetState()` 函数（第1529行）判断是否需要验证码的逻辑是：
```javascript
captchaRequired: captchaPending !== null
```

因此，即使验证码验证成功并恢复了游戏，`captchaPending` 变量仍然不是 `null`，导致 API 返回的状态中 `captchaRequired` 仍然是 `true`。

## 修复方案

### 修改 1：`verifyCaptcha()` 函数
在验证码验证成功后，添加清除 `captchaPending` 的逻辑。

**文件：** `public/tetris-game.js` (约第588行)

**修改前：**
```javascript
if (result.success) {
    // 验证成功，恢复游戏
    hideCaptchaModal();
    gameState.playing = true;
    lastDropTime = Date.now();
    gameLoop = requestAnimationFrame(update);
}
```

**修改后：**
```javascript
if (result.success) {
    // 验证成功，清除验证码状态
    captchaPending = null;
    // 恢复游戏
    hideCaptchaModal();
    gameState.playing = true;
    lastDropTime = Date.now();
    gameLoop = requestAnimationFrame(update);
}
```

### 修改 2：WebSocket `captchaVerified` 消息处理
在收到服务器推送的验证成功消息后，也要清除 `captchaPending`。

**文件：** `public/tetris-game.js` (约第515行)

**修改前：**
```javascript
case 'captchaVerified':
    if (message.success) {
        hideCaptchaModal();
        showNotification('验证通过，游戏继续！');
        emitSdkEvent('captchaVerified', { success: true });
    }
    break;
```

**修改后：**
```javascript
case 'captchaVerified':
    if (message.success) {
        captchaPending = null;
        hideCaptchaModal();
        showNotification('验证通过，游戏继续！');
        emitSdkEvent('captchaVerified', { success: true });
    }
    break;
```

## 验证步骤

### 方式1：传统界面测试
1. 启动服务器
2. 访问游戏界面并开始游戏
3. 等待验证码弹出（或手动触发）
4. 输入正确的验证码并提交
5. 打开浏览器控制台，执行：
   ```javascript
   // 在 SDK 模式下
   const state = await tetris.getGameState();
   console.log('captchaRequired:', state.captchaRequired); // 应该是 false
   ```

### 方式2：API 测试
验证码通过后，通过外部调用 SDK API：
```javascript
const iframe = document.querySelector('iframe');
const tetris = new TetrisGameSDK(iframe);
await tetris.init();

// 验证码通过后立即获取状态
const state = await tetris.getGameState();
console.log('Captcha Required:', state.captchaRequired);  // 应该是 false
console.log('Captcha ID:', state.captchaId);              // 应该是 null
console.log('Game Status:', state.status);                // 应该是 'playing'
```

### 预期结果
- ✅ `captchaRequired` 应该为 `false`
- ✅ `captchaId` 应该为 `null`
- ✅ `captchaDataUri` 应该为 `null`
- ✅ 游戏可以正常继续进行
- ✅ 可以正常调用移动、旋转等 API

## 受影响的功能
- ✅ SDK API `getGameState()` 
- ✅ 传统界面验证码验证
- ✅ WebSocket 推送验证成功消息
- ✅ 第三方集成（通过 SDK 获取游戏状态）

## 相关文件
- `public/tetris-game.js` - 主要游戏逻辑和 SDK 消息处理
- `public/tetris-sdk.js` - SDK API 定义
- `server.js` - 验证码验证 API
- `gameManager.js` - 验证码验证和游戏恢复逻辑

## 测试清单
- [x] 修复 `verifyCaptcha()` 函数
- [x] 修复 WebSocket `captchaVerified` 消息处理
- [ ] 传统界面验证码测试
- [ ] SDK API 验证码测试
- [ ] WebSocket 推送测试
- [ ] 验证后游戏继续测试

## 注意事项
此修复确保所有验证码验证成功的路径都正确清除 `captchaPending` 状态，使得 API 返回的状态与实际游戏状态保持一致。
