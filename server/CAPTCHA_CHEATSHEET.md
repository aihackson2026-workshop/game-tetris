# 验证码配置速查卡 🎯

> 打印或保存此页面作为快速参考

---

## 📍 配置文件位置

```
/Users/lvqier/hackson-260116/server/captcha.js
第 3-10 行：基础配置
第 124 行：分数加成
第 127 行：违规惩罚
```

---

## ⚡ 30秒快速修改

### 降低频率（用户抱怨太频繁）

```javascript
// 第 9 行
challengeProbability: 0.01  // 从 0.05 改为 0.01
```

### 提高频率（发现作弊太多）

```javascript
// 第 9 行
challengeProbability: 0.15  // 从 0.05 改为 0.15
```

### 只针对作弊者

```javascript
// 第 9 行
challengeProbability: 0  // 改为 0

// 第 124 行
const scoreProbability = 0;

// 第 127 行
const violationBonus = speedViolations * 0.30;
```

### 完全禁用

```javascript
// 第 122 行，整个函数改为
function shouldTriggerCaptcha() {
  return false;
}
```

---

## 🎮 预设方案速查

| 方案 | 基础概率 | 适用 | 新手遇到 | 高手遇到 |
|-----|---------|-----|---------|---------|
| 1️⃣ 几乎不出现 | 0.01 | 休闲 | 0次 | 0-1次 |
| 2️⃣ 偶尔出现 | 0.05 | 通用 | 1次 | 3-4次 |
| 3️⃣ 经常出现 | 0.15 | 竞技 | 3次 | 8-10次 |
| 4️⃣ 仅作弊者 | 0 | 体验优先 | 0次 | 0次 |
| 5️⃣ 完全禁用 | - | 测试 | 0次 | 0次 |

---

## 📊 概率速算表

| 基础概率 | 0分 | 500分 | 1000分 | 2000分 | 有1次违规 |
|---------|-----|-------|--------|--------|----------|
| 0.01 (1%) | 1% | 1% | 1% | 1% | 6% |
| 0.05 (5%) | 5% | 7% | 9% | 13% | 10% |
| 0.10 (10%) | 10% | 12% | 14% | 18% | 15% |
| 0.15 (15%) | 15% | 17% | 19% | 23% | 20% |

---

## 🔧 参数含义

```javascript
challengeProbability: 0.05  // 基础概率 5%

// 分数加成（每500分+2%，最多10%）
Math.floor(currentScore / 500) * 0.02

// 违规惩罚（每次+5%）
speedViolations * 0.05
```

---

## ⚙️ 修改步骤

```bash
# 1. 编辑文件
nano server/captcha.js

# 2. 找到第9行，修改 challengeProbability

# 3. 保存退出（Ctrl+O, Enter, Ctrl+X）

# 4. 重启服务器
# 停止：Ctrl+C
node server.js
```

---

## 📱 决策树

```
你想要什么？
├─ 最佳用户体验 → 0 或 0.01
├─ 平衡体验和安全 → 0.05（默认）
├─ 最强防作弊 → 0.15
└─ 测试开发 → 禁用函数
```

---

## 💡 常见场景

### 场景：用户说验证码太多
```javascript
challengeProbability: 0.02  // 降低到2%
```

### 场景：排行榜全是作弊者
```javascript
challengeProbability: 0.10  // 提高到10%
const violationBonus = speedViolations * 0.10;  // 加重惩罚
```

### 场景：刚上线，想快速积累用户
```javascript
challengeProbability: 0     // 完全关闭基础概率
const scoreProbability = 0;  // 关闭分数加成
```

### 场景：高分玩家抱怨频繁
```javascript
// 降低分数加成
const scoreProbability = Math.min(0.05, Math.floor(currentScore / 1000) * 0.01);
// 从每500分改为每1000分，从+2%改为+1%，封顶从10%改为5%
```

---

## 🎯 推荐配置

| 游戏类型 | 推荐值 | 理由 |
|---------|--------|------|
| 休闲益智 | 0.01 | 不打扰用户 |
| 竞技排行 | 0.05 | 平衡 |
| 社交娱乐 | 0 | 只防作弊 |
| 测试开发 | 禁用 | 不干扰测试 |

---

## ⚠️ 注意事项

- ✅ 修改后必须重启服务器
- ✅ 记得备份原始配置
- ✅ 测试完记得改回生产配置
- ⚠️ 不要在生产环境禁用验证码
- ⚠️ 太高的概率会导致用户流失

---

## 🆘 紧急修复

### 验证码完全不出现了
```javascript
// 检查第122行函数是否被修改
function shouldTriggerCaptcha() {
  // 如果这里直接返回false，删除这行
  // 恢复原来的逻辑
}

// 检查第9行
challengeProbability: 0.05  // 不应该是0
```

### 验证码出现太频繁
```javascript
// 临时紧急修复
challengeProbability: 0.01  // 立即降低
```

### 作弊者太多
```javascript
// 临时严格模式
challengeProbability: 0.20  // 提高到20%
const violationBonus = speedViolations * 0.15;  // 提高惩罚
```

---

## 📞 获取帮助

- 详细文档：[CAPTCHA_CONFIG.md](./CAPTCHA_CONFIG.md)
- 方案对比：[CAPTCHA_COMPARISON.md](./CAPTCHA_COMPARISON.md)
- 快速配置：[CAPTCHA_QUICK_CONFIG.md](./CAPTCHA_QUICK_CONFIG.md)
- 总览：[../CAPTCHA_SUMMARY.md](../CAPTCHA_SUMMARY.md)

---

## 💾 配置模板

### 模板1：体验优先

```javascript
const CAPTCHA_CONFIG = {
  length: 4,
  width: 150,
  height: 50,
  fontSize: 30,
  expirationTime: 180000,
  challengeProbability: 0.01
};
const scoreProbability = 0;
const violationBonus = speedViolations * 0.20;
```

### 模板2：平衡（当前）

```javascript
const CAPTCHA_CONFIG = {
  length: 4,
  width: 150,
  height: 50,
  fontSize: 30,
  expirationTime: 120000,
  challengeProbability: 0.05
};
const scoreProbability = Math.min(0.1, Math.floor(currentScore / 500) * 0.02);
const violationBonus = speedViolations * 0.05;
```

### 模板3：安全优先

```javascript
const CAPTCHA_CONFIG = {
  length: 6,
  width: 180,
  height: 60,
  fontSize: 28,
  expirationTime: 90000,
  challengeProbability: 0.15
};
const scoreProbability = Math.min(0.2, Math.floor(currentScore / 300) * 0.03);
const violationBonus = speedViolations * 0.10;
```

---

**复制此页面保存到你的笔记中，随时查阅！📌**
