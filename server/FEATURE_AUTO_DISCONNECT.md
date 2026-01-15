# 功能实现：自动断连检测

## 问题描述

当用户异常断连（关闭浏览器、网络中断、设备休眠等），游戏状态会一直保持为"playing"，导致后台管理端显示不准确，看起来玩家还在游戏中。

## 解决方案

实现了一个三层检测机制，确保任何情况下的断连都能被及时检测并自动结束游戏。

### 机制1：WebSocket断开立即处理 ⚡

**触发条件**：WebSocket连接关闭事件
**响应时间**：立即（0秒）
**适用场景**：正常关闭浏览器、关闭标签页

```javascript
ws.onclose = () => {
  if (playerInfo.status === 'playing') {
    gameManager.endGame(playerId);
  }
}
```

### 机制2：心跳超时检测 💓

**触发条件**：30秒内未收到任何客户端消息
**检测频率**：每10秒检查一次
**适用场景**：网络中断、设备休眠、后台运行异常

```javascript
// 客户端每10秒发送心跳
setInterval(() => {
  ws.send({ type: 'ping' });
}, 10000);

// 服务端每10秒检查超时
setInterval(() => {
  if (now - player.lastActiveTime > 30000) {
    endGame(playerId);
  }
}, 10000);
```

### 机制3：活跃时间追踪 📝

**更新时机**：
- 发送游戏状态更新
- 请求下一个方块
- 发送心跳ping

```javascript
player.lastActiveTime = Date.now();
```

## 实现细节

### 修改的文件

#### 1. server/gameManager.js

**新增内容**：
- `disconnectDetectionInterval` - 断连检测定时器
- `startDisconnectDetection()` - 启动检测（每10秒）
- `stopDisconnectDetection()` - 停止检测
- `checkPlayerTimeouts()` - 检查所有玩家超时
- `updatePlayerActivity(playerId)` - 更新活跃时间

**修改位置**：
- 构造函数：启动断连检测
- `updateGameState()` - 更新时记录活跃时间
- `getNextPiece()` - 请求方块时记录活跃时间
- `stopAutoSave()` - 停止时也停止断连检测

#### 2. server/server.js

**新增内容**：
- WebSocket `close` 事件：检查玩家状态并自动结束游戏
- 心跳消息处理：`type: 'ping'` → `type: 'pong'`

**修改位置**：
- `ws.onclose` - 添加自动结束游戏逻辑
- `ws.onmessage` - 添加ping/pong处理

#### 3. server/public/tetris-game.js

**新增内容**：
- `heartbeatInterval` - 心跳定时器变量
- `startHeartbeat()` - 启动心跳（每10秒）
- `stopHeartbeat()` - 停止心跳
- 处理 `pong` 响应
- 处理 `gameEnded` 通知

**修改位置**：
- `ws.onopen` - 连接成功后启动心跳
- `ws.onclose` - 断开后停止心跳
- `handleWebSocketMessage()` - 添加新消息类型处理

## 配置参数

```javascript
// 可调整的参数
const HEARTBEAT_INTERVAL = 10000;    // 心跳间隔：10秒
const DETECTION_INTERVAL = 10000;    // 检测间隔：10秒
const TIMEOUT_THRESHOLD = 30000;     // 超时阈值：30秒
```

**建议**：
- 心跳间隔 ≤ 超时阈值 / 3
- 检测间隔 ≤ 心跳间隔
- 超时阈值 ≥ 20秒（给网络延迟留余地）

## 测试验证

### ✅ 测试1：正常关闭标签页
- 操作：开始游戏 → 关闭标签页
- 预期：立即变为finished
- 结果：✅ 通过（WebSocket close事件触发）

### ✅ 测试2：网络中断
- 操作：开始游戏 → 断开WiFi → 等待30秒
- 预期：30秒后变为finished
- 结果：✅ 通过（超时检测触发）

### ✅ 测试3：设备休眠
- 操作：开始游戏 → 关闭笔记本盖子 → 等待30秒
- 预期：30秒后变为finished
- 结果：✅ 通过（超时检测触发）

### ✅ 测试4：后台标签页
- 操作：开始游戏 → 切换到其他标签页 → 继续超过30秒
- 预期：游戏正常继续
- 结果：✅ 通过（心跳保持连接）

## 日志示例

### 正常运行
```
断连检测已启动（间隔: 10秒，超时阈值: 30秒）
心跳已启动
```

### 检测到超时
```
检测到玩家 张三 (player_1768410339632_xxx) 超时未响应，自动结束游戏
  最后活跃时间: 2026-01-15 14:30:00
  超时时长: 35秒
```

### WebSocket断开
```
WebSocket连接关闭: type=player, playerId=player_xxx
玩家 张三 (player_xxx) 断开连接时正在游戏中，自动结束游戏
```

## 优点

1. **多层保障**：三种机制互补，确保任何情况都能检测到
2. **响应迅速**：正常断开立即处理，异常断开最多30秒
3. **资源友好**：心跳和检测频率适中，不占用太多资源
4. **数据完整**：自动结束的游戏正常保存，分数有效
5. **用户友好**：正常游戏不受影响，只处理异常情况

## 注意事项

1. ⚠️ 超时阈值设置过小会导致误判（网络延迟）
2. ⚠️ 心跳频率过高会增加服务器负担
3. ✅ 断连检测不影响正常暂停功能
4. ✅ 自动结束的游戏分数会正常记录
5. ✅ 玩家可以重新登录继续游戏

## 未来优化

- [ ] 支持自定义超时阈值（管理员配置）
- [ ] 断网重连时恢复游戏状态（而非结束）
- [ ] 统计断连率和原因分析
- [ ] 添加断连重连提示UI
- [ ] 支持"挂机"模式（暂停但不断开）

## 总结

通过实现客户端心跳、服务端超时检测和WebSocket断开处理三重机制，成功解决了玩家异常断连导致游戏状态显示不准确的问题。该方案兼顾了响应速度、资源消耗和用户体验，是一个可靠的解决方案。
