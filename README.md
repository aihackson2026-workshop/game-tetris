# 俄罗斯方块游戏厅 🎮

一个功能完整的在线俄罗斯方块游戏系统，支持实时排行榜、防作弊、验证码保护等功能。

## ⚡ 快速开始

```bash
# 启动服务器
cd server
node server.js

# 访问游戏
浏览器打开: http://localhost:3000

# 管理后台
浏览器打开: http://localhost:3000/admin.html
```

## 🎯 主要功能

- ✅ 完整的俄罗斯方块游戏
- ✅ 实时排行榜和玩家状态
- ✅ 邮箱账号系统
- ✅ 防作弊检测
- ✅ 验证码保护
- ✅ 自动断连检测
- ✅ 难度动态调整
- ✅ 游戏数据持久化

## 📚 配置指南

### 🔐 验证码频率配置

验证码用于防止作弊，但可能影响用户体验。根据你的需求调整：

#### 快速配置（推荐）
查看 **[验证码配置总览](./CAPTCHA_SUMMARY.md)** - 30秒快速上手

#### 详细文档
- [验证码快速配置](./server/CAPTCHA_QUICK_CONFIG.md) - 5个预设方案
- [验证码配置详解](./server/CAPTCHA_CONFIG.md) - 完整参数说明
- [方案效果对比](./server/CAPTCHA_COMPARISON.md) - 数据化对比

#### 一键配置

```javascript
// 编辑 server/captcha.js 第 9 行

// 几乎不出现（休闲游戏）
challengeProbability: 0.01

// 平衡体验和安全（推荐，当前默认）
challengeProbability: 0.05

// 经常出现（竞技游戏）
challengeProbability: 0.15

// 只针对作弊者（体验优先）
challengeProbability: 0
```

修改后重启服务器即可生效。

### 其他配置

- [自动断连检测](./server/AUTO_DISCONNECT_DETECTION.md)
- [防作弊系统](./server/ANTI_CHEAT.md)
- [难度系统](./server/DIFFICULTY_SYSTEM.md)
- [邮箱验证](./server/EMAIL_AUTH.md)

## 📖 完整文档

详细文档请查看 [server/README.md](./server/README.md)

## 🎮 游戏界面

- 游戏主页: http://localhost:3000
- 管理后台: http://localhost:3000/admin.html
- 玩家游戏页: http://localhost:3000/play.html

## 🛠️ 技术栈

- **后端**: Node.js + Express + WebSocket
- **前端**: 原生 JavaScript + Canvas
- **数据**: JSON 文件存储

## 📝 许可证

MIT License

---

**快速链接**：
- [验证码配置](./CAPTCHA_SUMMARY.md) 👈 调整验证码频率
- [完整文档](./server/README.md)
- [API文档](./server/API_DOCUMENTATION.md)
