# 人机验证功能测试指南

## 问题原因分析

### 原始问题
验证码机制虽然已经实现，但**从未被调用**，导致游戏过程中始终不会触发人机验证。

### 根本原因
1. `gameManager.js` 中定义了验证码相关方法：
   - `shouldTriggerCaptcha()` - 判断是否应该触发验证码
   - `pauseForCaptcha()` - 暂停游戏并显示验证码
   
2. **但这些方法从未在任何地方被调用**：
   - `/api/game/update` 没有检查验证码触发条件
   - `/api/game/next-piece` 没有检查验证码触发条件
   - 客户端只准备了接收验证码的逻辑，但服务端从未发送

### 已修复内容
1. ✅ 在 `/api/game/update` 中添加验证码检查（消除行后）
2. ✅ 在 `/api/game/next-piece` 中添加验证码检查（获取下一个方块时）
3. ✅ 修改 `/api/captcha/verify` 调用 `gameManager.verifyCaptchaAndResume()`
4. ✅ 客户端验证时添加 `playerId` 参数
5. ✅ 导出 `captchaStore` 供图片API使用

---

## 验证码触发机制

### 触发概率计算
根据 `captcha.js` 中的 `shouldTriggerCaptcha()` 函数：

```javascript
// 基础概率
const baseProbability = 0.05; // 5%

// 分数加成：每500分增加2%概率
const scoreProbability = Math.min(0.1, Math.floor(currentScore / 500) * 0.02);

// 违规加成：每次违规增加5%概率
const violationBonus = speedViolations * 0.05;

// 总概率 = 基础 + 分数 + 违规
const totalProbability = baseProbability + scoreProbability + violationBonus;
```

### 触发时机
验证码会在以下两个时机检查触发：

1. **消除行后** (`/api/game/update`)
   - 每次消除行后检查
   - 概率随分数提高
   
2. **获取下一个方块时** (`/api/game/next-piece`)
   - 每次请求新方块时检查
   - 如果有速度违规会提高概率

---

## 测试步骤

### 1. 启动服务器
```bash
cd server
npm install
node server.js
```

服务器应该在 `http://localhost:3000` 运行

### 2. 正常游戏测试
1. 打开浏览器访问 `http://localhost:3000`
2. 输入昵称和邮箱注册
3. 开始游戏
4. 正常玩几分钟，观察是否随机弹出验证码

**预期结果**：
- 每消除几行可能随机触发验证码（5%基础概率）
- 分数越高，触发概率越大
- 验证码弹出后，游戏暂停
- 输入正确验证码后，游戏继续

### 3. 高分触发测试
为了更容易触发验证码，可以修改 `captcha.js` 临时提高概率：

```javascript
// 临时修改用于测试
const CAPTCHA_CONFIG = {
  challengeProbability: 0.3 // 提高到30%基础概率
};
```

然后重启服务器测试。

### 4. 速度违规触发测试
验证码系统会在检测到速度异常时提高触发概率：

1. 尝试快速按键（超出正常速度）
2. 服务端会检测 `speedViolations`
3. 每次违规增加5%触发概率
4. 多次违规后几乎必定触发验证码

### 5. 查看日志
服务器控制台会输出验证码触发日志：

```
触发验证码挑战: 玩家 player_xxx, 分数 500
触发验证码挑战: 玩家 player_xxx
```

客户端控制台也会显示验证码事件：

```javascript
// 监听验证码事件
window.TetrisSDK.on('captchaRequired', (data) => {
  console.log('需要验证码:', data);
});

window.TetrisSDK.on('captchaVerified', (data) => {
  console.log('验证通过:', data);
});
```

---

## 测试检查清单

- [ ] 服务器正常启动，无报错
- [ ] 能正常注册/登录并开始游戏
- [ ] 消除行后偶尔弹出验证码
- [ ] 验证码图片正常显示
- [ ] 输入正确验证码后游戏继续
- [ ] 输入错误验证码提示错误
- [ ] 高分时验证码触发频率增加
- [ ] 速度异常时验证码触发频率增加
- [ ] 服务器日志显示触发记录
- [ ] WebSocket 正常接收验证码消息

---

## 调试建议

### 如果验证码始终不触发

1. **检查概率设置**
   ```javascript
   // 在 captcha.js 中临时提高概率
   const CAPTCHA_CONFIG = {
     challengeProbability: 0.5 // 50%概率，方便测试
   };
   ```

2. **检查服务器日志**
   - 应该能看到 "触发验证码挑战" 日志
   - 如果没有日志，说明 `shouldTriggerCaptcha()` 返回 false

3. **手动测试触发**
   在浏览器控制台执行：
   ```javascript
   // 查看当前玩家状态
   fetch('/api/player/' + playerId).then(r => r.json()).then(console.log);
   
   // 手动触发验证码（需要修改API添加测试接口）
   ```

### 如果验证码弹出但无法验证

1. **检查 playerId 是否正确传递**
   - 在浏览器控制台查看 Network 标签
   - 验证 `/api/captcha/verify` 请求是否包含 `playerId`

2. **检查验证码存储**
   - 验证码生成后应存在 `captchaStore` 中
   - 有效期 2 分钟

3. **检查验证逻辑**
   - 验证码不区分大小写
   - 验证成功后会调用 `gameManager.verifyCaptchaAndResume()`

---

## 性能调优

### 调整触发频率

如果验证码太频繁：
```javascript
// 降低基础概率
challengeProbability: 0.02  // 2%

// 降低分数加成
const scoreProbability = Math.min(0.05, Math.floor(currentScore / 1000) * 0.01);
```

如果验证码太少：
```javascript
// 提高基础概率
challengeProbability: 0.1  // 10%

// 提高分数加成
const scoreProbability = Math.min(0.2, Math.floor(currentScore / 300) * 0.03);
```

---

## 常见问题

### Q: 验证码图片不显示
A: 检查 `/api/captcha/image/:captchaId` 接口是否正常，确保 `captchaStore` 已导出。

### Q: 验证后游戏没有恢复
A: 检查 `gameManager.verifyCaptchaAndResume()` 是否正确调用，以及 WebSocket 是否正常发送 `gameResumed` 消息。

### Q: 多次输入验证码都提示错误
A: 可能是验证码过期（2分钟），或者输入格式不正确（应该是4位字符）。

### Q: 验证码在管理端不显示
A: 管理端应该收到 `playerCaptchaChallenge` 消息，检查 WebSocket 连接是否正常。

---

## 总结

修复后的验证码系统现在会：
1. ✅ 在消除行后随机触发（5%基础概率 + 分数加成）
2. ✅ 在获取下一个方块时检查速度违规并触发
3. ✅ 验证成功后自动恢复游戏
4. ✅ 通知管理端验证状态
5. ✅ 记录违规次数并调整触发概率

这样既保证了公平性，又不会过度打扰正常玩家。
