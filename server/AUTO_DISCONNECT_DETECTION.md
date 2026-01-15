# 自动断连检测功能

## 功能概述

当玩家异常断连（如关闭浏览器、网络中断、设备休眠等）时，系统会自动检测并结束游戏，避免游戏状态一直保持为"playing"导致后台显示不准确。

## 实现机制

### 1. 客户端心跳机制

客户端每10秒向服务器发送一次心跳消息（ping），服务器响应pong：

```javascript
// 心跳消息格式
{
  type: 'ping'
}

// 服务器响应
{
  type: 'pong'
}
```

**位置**: `server/public/tetris-game.js`
- `startHeartbeat()` - 启动心跳定时器
- `stopHeartbeat()` - 停止心跳定时器
- WebSocket连接成功时自动启动心跳
- WebSocket断开时自动停止心跳

### 2. 服务端活跃时间追踪

服务器记录每个正在游戏的玩家的最后活跃时间：

```javascript
// 玩家对象中的新字段
player.lastActiveTime = Date.now();
```

**更新时机**：
- 玩家发送游戏状态更新时
- 玩家请求下一个方块时
- 玩家发送心跳ping时

### 3. 定时超时检测

服务器每10秒检查一次所有正在游戏的玩家：
- 如果玩家超过30秒未发送任何消息，判定为断连
- 自动调用`endGame()`结束游戏
- 记录到玩家历史记录中
- 广播排行榜更新给管理端

**位置**: `server/gameManager.js`
- `startDisconnectDetection()` - 启动定时检测
- `checkPlayerTimeouts()` - 检查所有玩家的超时状态
- `updatePlayerActivity()` - 更新玩家活跃时间

### 4. WebSocket断开立即处理

当WebSocket连接关闭时，如果玩家正在游戏中，立即结束游戏：

```javascript
ws.onclose = () => {
  const playerInfo = gameManager.getPlayerInfo(playerId);
  if (playerInfo && playerInfo.status === 'playing') {
    gameManager.endGame(playerId);
  }
}
```

**位置**: `server/server.js` - WebSocket事件处理

## 配置参数

| 参数 | 值 | 说明 |
|-----|-----|-----|
| 心跳间隔 | 10秒 | 客户端发送ping的频率 |
| 检测间隔 | 10秒 | 服务器检查超时的频率 |
| 超时阈值 | 30秒 | 判定断连的无响应时长 |

## 测试方法

### 测试1: 正常断开（关闭标签页）

1. 登录游戏并开始玩
2. 直接关闭浏览器标签页
3. 在管理后台查看玩家状态

**预期结果**: 玩家立即从"playing"变为"finished"

### 测试2: 网络中断

1. 登录游戏并开始玩
2. 断开设备网络连接（关闭WiFi/拔网线）
3. 等待约30秒
4. 在管理后台查看玩家状态

**预期结果**: 30秒后玩家自动变为"finished"

### 测试3: 设备休眠

1. 登录游戏并开始玩
2. 关闭笔记本盖子或让设备进入休眠
3. 等待约30秒后唤醒
4. 在管理后台查看玩家状态

**预期结果**: 30秒后玩家自动变为"finished"

### 测试4: 浏览器标签页后台运行

1. 登录游戏并开始玩
2. 切换到其他标签页（保持浏览器打开）
3. 持续玩超过30秒

**预期结果**: 游戏正常继续，心跳保持连接

## 日志输出

### 正常心跳日志

```
心跳已启动
```

### 超时检测日志

```
检测到玩家 张三 (player_xxx) 超时未响应，自动结束游戏
  最后活跃时间: 2026-01-15 14:30:00
  超时时长: 35秒
```

### WebSocket断开日志

```
WebSocket连接关闭: type=player, playerId=player_xxx
玩家 张三 (player_xxx) 断开连接时正在游戏中，自动结束游戏
```

## 注意事项

1. **数据保存**: 自动结束的游戏会正常保存到历史记录和排行榜
2. **分数有效**: 断连时的分数会作为最终分数记录
3. **重新登录**: 玩家重新登录后可以开始新游戏
4. **不影响暂停**: 正常的暂停功能不受影响

## 相关文件

- `server/gameManager.js` - 核心逻辑实现
  - 第27-28行: 添加断连检测定时器
  - 第45-110行: 断连检测相关方法
  - 第308-311行: 更新游戏状态时记录活跃时间
  - 第346-349行: 获取下一方块时记录活跃时间

- `server/server.js` - WebSocket处理
  - 第396-408行: WebSocket关闭时自动结束游戏
  - 第372-376行: 处理心跳ping消息

- `server/public/tetris-game.js` - 客户端心跳
  - 第48行: 心跳定时器变量
  - 第362-365行: WebSocket连接时启动心跳
  - 第371-375行: WebSocket断开时停止心跳
  - 第429-449行: 心跳启动/停止函数
  - 第452-455行: 处理pong响应
  - 第456-462行: 处理服务器主动结束游戏通知

## 优化建议

如果需要调整超时阈值或检测频率，可以修改以下位置：

```javascript
// gameManager.js - checkPlayerTimeouts()
const TIMEOUT_THRESHOLD = 30000; // 修改这个值调整超时阈值

// gameManager.js - startDisconnectDetection()
this.disconnectDetectionInterval = setInterval(() => {
  this.checkPlayerTimeouts();
}, 10000); // 修改这个值调整检测频率

// tetris-game.js - startHeartbeat()
heartbeatInterval = setInterval(() => {
  // ...
}, 10000); // 修改这个值调整心跳频率
```

**建议配置**：
- 心跳间隔 ≤ 超时阈值 / 3
- 检测间隔 ≤ 心跳间隔
- 超时阈值应该给网络延迟留出余地（建议≥20秒）
