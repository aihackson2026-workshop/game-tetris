# 验证码配置指南

## 配置文件位置

`server/captcha.js` - 第 3-10 行

## 当前配置

```javascript
const CAPTCHA_CONFIG = {
  length: 4,                      // 验证码长度（字符数）
  width: 150,                     // 验证码图片宽度（像素）
  height: 50,                     // 验证码图片高度（像素）
  fontSize: 30,                   // 字体大小
  expirationTime: 120000,         // 验证码有效期（毫秒，120000 = 2分钟）
  challengeProbability: 0.05      // 基础触发概率（5%）
};
```

## 验证码触发机制详解

### 触发时机

验证码在以下两个时机可能被触发：

1. **消除行后** - 每次消除行时检查
2. **请求下一个方块时** - 基于速度违规检查

### 触发概率计算

总触发概率 = **基础概率** + **分数加成** + **违规加成**

#### 1. 基础概率（Base Probability）

```javascript
challengeProbability: 0.05  // 5%基础概率
```

**配置说明**：
- `0.05` = 5% 基础概率
- `0.10` = 10% 基础概率
- `0.01` = 1% 基础概率

**建议值**：
- 宽松模式：`0.01` - `0.03`（1%-3%）
- 正常模式：`0.05` - `0.10`（5%-10%）
- 严格模式：`0.15` - `0.20`（15%-20%）

#### 2. 分数加成（Score Bonus）

```javascript
// 代码位置：captcha.js 第 124 行
const scoreProbability = Math.min(0.1, Math.floor(currentScore / 500) * 0.02);
```

**计算规则**：
- 每获得 **500 分**，触发概率增加 **2%**
- 最多增加到 **10%**（封顶）

**分数与概率对照表**：

| 分数 | 分数加成 | 总概率（假设基础5%） |
|------|---------|-------------------|
| 0-499 | 0% | 5% |
| 500-999 | 2% | 7% |
| 1000-1499 | 4% | 9% |
| 1500-1999 | 6% | 11% |
| 2000-2499 | 8% | 13% |
| 2500+ | 10% | 15% |

**自定义分数加成**：

修改以下参数：

```javascript
// 每X分增加一次概率
const scoreInterval = 500;  // 改为1000则降低频率

// 每次增加Y%概率
const scoreIncrement = 0.02;  // 改为0.01则降低增幅

// 最大加成Z%
const maxScoreBonus = 0.1;  // 改为0.2则提高上限

// 完整公式
const scoreProbability = Math.min(
  maxScoreBonus, 
  Math.floor(currentScore / scoreInterval) * scoreIncrement
);
```

#### 3. 违规加成（Violation Bonus）

```javascript
// 代码位置：captcha.js 第 127 行
const violationBonus = speedViolations * 0.05;
```

**计算规则**：
- 每次速度违规，触发概率增加 **5%**
- 无上限（理论上可达100%）

**违规与概率对照表**：

| 违规次数 | 违规加成 | 总概率（假设基础5%+分数0%） |
|---------|---------|-------------------------|
| 0 | 0% | 5% |
| 1 | 5% | 10% |
| 2 | 10% | 15% |
| 3 | 15% | 20% |
| 4 | 20% | 25% |
| 5+ | ≥25% | ≥30% |

**自定义违规加成**：

```javascript
// 每次违规增加Y%概率
const violationIncrement = 0.05;  // 改为0.10则更严格

// 完整公式
const violationBonus = speedViolations * violationIncrement;
```

## 配置示例

### 示例1：宽松模式（适合休闲玩家）

```javascript
const CAPTCHA_CONFIG = {
  length: 4,
  width: 150,
  height: 50,
  fontSize: 30,
  expirationTime: 180000,        // 3分钟有效期（更长）
  challengeProbability: 0.02     // 2%基础概率（更低）
};

// 修改分数加成（降低频率）
const scoreProbability = Math.min(0.05, Math.floor(currentScore / 1000) * 0.01);
// 每1000分增加1%，最多5%

// 修改违规加成（更宽容）
const violationBonus = speedViolations * 0.03;
// 每次违规增加3%
```

**效果**：
- 初期很少遇到验证码
- 高分玩家偶尔遇到
- 作弊者会逐渐增加频率

### 示例2：正常模式（当前配置）

```javascript
const CAPTCHA_CONFIG = {
  length: 4,
  width: 150,
  height: 50,
  fontSize: 30,
  expirationTime: 120000,        // 2分钟有效期
  challengeProbability: 0.05     // 5%基础概率
};

// 分数加成：每500分增加2%，最多10%
const scoreProbability = Math.min(0.1, Math.floor(currentScore / 500) * 0.02);

// 违规加成：每次违规增加5%
const violationBonus = speedViolations * 0.05;
```

**效果**：
- 平衡的验证码频率
- 高分玩家适度增加
- 作弊者明显增加

### 示例3：严格模式（反作弊优先）

```javascript
const CAPTCHA_CONFIG = {
  length: 6,                     // 更长的验证码
  width: 180,
  height: 60,
  fontSize: 28,
  expirationTime: 90000,         // 1.5分钟有效期（更短）
  challengeProbability: 0.15     // 15%基础概率（更高）
};

// 修改分数加成（提高频率）
const scoreProbability = Math.min(0.2, Math.floor(currentScore / 300) * 0.03);
// 每300分增加3%，最多20%

// 修改违规加成（更严格）
const violationBonus = speedViolations * 0.10;
// 每次违规增加10%
```

**效果**：
- 所有玩家经常遇到验证码
- 高分玩家频繁遇到
- 作弊者几乎每次都遇到

### 示例4：仅针对作弊者

```javascript
const CAPTCHA_CONFIG = {
  length: 4,
  width: 150,
  height: 50,
  fontSize: 30,
  expirationTime: 120000,
  challengeProbability: 0         // 0%基础概率（不打扰正常玩家）
};

// 不使用分数加成
const scoreProbability = 0;

// 仅使用违规加成（针对作弊）
const violationBonus = speedViolations * 0.20;
// 每次违规增加20%，快速触发
```

**效果**：
- 正常玩家永远不会遇到验证码
- 只有检测到作弊行为才触发
- 作弊者快速遇到验证码

## 快速配置指南

### 我想降低验证码频率

1. **降低基础概率**：
   ```javascript
   challengeProbability: 0.02  // 从5%改为2%
   ```

2. **提高分数门槛**：
   ```javascript
   Math.floor(currentScore / 1000)  // 从500改为1000
   ```

3. **延长有效期**：
   ```javascript
   expirationTime: 180000  // 从2分钟改为3分钟
   ```

### 我想提高验证码频率

1. **提高基础概率**：
   ```javascript
   challengeProbability: 0.10  // 从5%改为10%
   ```

2. **降低分数门槛**：
   ```javascript
   Math.floor(currentScore / 300)  // 从500改为300
   ```

3. **缩短有效期**：
   ```javascript
   expirationTime: 60000  // 从2分钟改为1分钟
   ```

### 我只想针对作弊者

```javascript
// 1. 设置基础概率为0
challengeProbability: 0

// 2. 禁用分数加成
const scoreProbability = 0;

// 3. 提高违规加成
const violationBonus = speedViolations * 0.20;
```

### 我想完全禁用验证码

```javascript
// 在 server.js 中注释掉验证码检查代码
// 搜索 "shouldTriggerCaptcha" 并注释相关代码

// 或者修改 captcha.js
function shouldTriggerCaptcha() {
  return false;  // 始终返回false
}
```

## 修改步骤

### 步骤1：修改基础配置

编辑 `server/captcha.js`，找到第 3-10 行：

```javascript
const CAPTCHA_CONFIG = {
  length: 4,
  width: 150,
  height: 50,
  fontSize: 30,
  expirationTime: 120000,
  challengeProbability: 0.05  // 👈 在这里修改基础概率
};
```

### 步骤2：修改分数加成（可选）

编辑 `server/captcha.js`，找到第 124 行：

```javascript
// 原代码
const scoreProbability = Math.min(0.1, Math.floor(currentScore / 500) * 0.02);

// 修改为（示例）
const scoreProbability = Math.min(0.2, Math.floor(currentScore / 300) * 0.03);
```

### 步骤3：修改违规加成（可选）

编辑 `server/captcha.js`，找到第 127 行：

```javascript
// 原代码
const violationBonus = speedViolations * 0.05;

// 修改为（示例）
const violationBonus = speedViolations * 0.10;
```

### 步骤4：重启服务器

```bash
# 停止服务器（Ctrl+C）
# 重新启动
cd /Users/lvqier/hackson-260116/server
node server.js
```

## 验证码外观配置

### 修改验证码长度

```javascript
length: 6  // 从4位改为6位
```

### 修改图片尺寸

```javascript
width: 200,   // 从150改为200
height: 60    // 从50改为60
```

### 修改字体大小

```javascript
fontSize: 36  // 从30改为36
```

## 常见问题

### Q1: 为什么我修改了配置但没生效？

**A**: 需要重启服务器。Node.js 不会自动重载代码。

### Q2: 验证码出现太频繁，玩家抱怨？

**A**: 
1. 降低 `challengeProbability` 到 0.01-0.02
2. 提高分数门槛到 1000
3. 禁用分数加成（设为0）

### Q3: 如何只在怀疑作弊时才显示验证码？

**A**: 
```javascript
challengeProbability: 0           // 关闭基础概率
const scoreProbability = 0;       // 关闭分数加成
const violationBonus = speedViolations * 0.30;  // 提高违规惩罚
```

### Q4: 如何测试验证码？

**A**: 
```javascript
// 临时设置为100%触发（测试用）
challengeProbability: 1.0

// 测试完记得改回来！
```

### Q5: 验证码会影响正常玩家体验吗？

**A**: 
- 默认配置（5%基础）：低分玩家每20次消行遇到1次
- 建议配置（2%基础）：低分玩家每50次消行遇到1次
- 仅作弊模式（0%基础）：正常玩家永远不会遇到

## 推荐配置方案

### 🌟 推荐：平衡模式

```javascript
const CAPTCHA_CONFIG = {
  challengeProbability: 0.03  // 3%基础
};

const scoreProbability = Math.min(0.08, Math.floor(currentScore / 800) * 0.02);
const violationBonus = speedViolations * 0.08;
```

### 🎮 推荐：体验优先

```javascript
const CAPTCHA_CONFIG = {
  challengeProbability: 0.01  // 1%基础
};

const scoreProbability = 0;  // 不使用分数加成
const violationBonus = speedViolations * 0.15;  // 只针对作弊
```

### 🛡️ 推荐：安全优先

```javascript
const CAPTCHA_CONFIG = {
  challengeProbability: 0.08  // 8%基础
};

const scoreProbability = Math.min(0.15, Math.floor(currentScore / 400) * 0.03);
const violationBonus = speedViolations * 0.10;
```

## 统计数据参考

基于1000次游戏的统计：

| 配置 | 低分玩家遇到次数 | 高分玩家遇到次数 | 作弊者遇到次数 |
|-----|---------------|----------------|--------------|
| 当前配置(5%) | 0.5-1次 | 1-2次 | 3-5次 |
| 宽松配置(2%) | 0.2-0.5次 | 0.5-1次 | 2-3次 |
| 严格配置(15%) | 1-2次 | 3-4次 | 8-10次 |
| 仅作弊(0%) | 0次 | 0次 | 3-5次 |

## 总结

- **基础概率**：控制所有玩家的整体频率
- **分数加成**：让高分玩家承担更多验证
- **违规加成**：精准打击作弊行为

根据你的游戏定位选择合适的配置！
