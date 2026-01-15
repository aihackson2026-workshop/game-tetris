# 俄罗斯方块游戏厅

一个基于 Express 和 WebSocket 的实时多人在线俄罗斯方块游戏系统。

## 功能特性

### 玩家端
- ✅ **邮箱验证账号系统**（昵称-邮箱绑定）
- ✅ 新玩家注册（昵称 + 邮箱）
- ✅ 老玩家登录（邮箱身份验证）
- ✅ 防止昵称被恶意占用
- ✅ 完整的俄罗斯方块游戏
- ✅ 实时显示当前分数和历史最高分
- ✅ 实时显示全局排名
- ✅ 实时更新的排行榜（TOP 10）
- ✅ 游戏结束后显示最终排名

### 后台管理端
- ✅ 查看所有正在游戏的玩家列表
- ✅ **实时查看游戏画面**（20fps高频推送）
- ✅ **观看每一帧操作**（移动、旋转、下落）
- ✅ 智能订阅机制（按需推送，节省带宽）
- ✅ 实时更新的完整排行榜
- ✅ 区分正在进行和已结束的游戏
- ✅ WebSocket 双向实时通信
- ✅ 优化渲染性能（requestAnimationFrame）

### 数据持久化
- ✅ 本地 JSON 文件存储
- ✅ 自动保存（每30秒）
- ✅ 优雅关闭时保存数据
- ✅ 服务器重启后数据恢复
- ✅ 自动备份功能（保留最近10个备份）
- ✅ 玩家历史记录和最高分持久化

### 防作弊系统
- ✅ **服务端控制方块序列** - 所有方块由服务端生成
- ✅ **唯一方块标识** - 每个方块有唯一 ID
- ✅ **实时作弊检测** - 验证方块 ID 和类型
- ✅ **速度作弊检测** - 验证方块下落时间
- ✅ **暂停检测** - 防止暂停游戏作弊
- ✅ **自动拦截** - 检测到作弊立即终止游戏
- ✅ **日志记录** - 记录所有作弊行为
- ✅ **管理端通知** - 作弊时通知管理员

### 难度递增系统
- ✅ **动态难度调整** - 根据分数自动调整速度
- ✅ **12 个难度等级** - 从新手到神级
- ✅ **人类极限保护** - 最快 200ms（科学验证）
- ✅ **平滑过渡** - 自然的难度曲线
- ✅ **视觉提示** - 难度提升时显示动画
- ✅ **服务端验证** - 防止速度作弊

## 技术栈

- **后端**: Node.js + Express + WebSocket (ws)
- **前端**: 原生 HTML5 + CSS3 + JavaScript
- **实时通信**: WebSocket
- **游戏渲染**: Canvas API
- **数据存储**: JSON 文件（本地持久化）

## 项目结构

```
hackson/
├── server.js              # Express 服务器主文件
├── gameManager.js         # 游戏管理器（核心业务逻辑）
├── dataStorage.js         # 数据持久化模块
├── package.json           # 项目配置
├── data/                  # 数据存储目录（自动创建）
│   ├── players.json       # 玩家数据文件
│   └── players_backup_*.json  # 自动备份文件
└── public/                # 静态文件目录
    ├── index.html         # 首页导航
    ├── game.html          # 玩家游戏界面
    ├── tetris-game.js     # 俄罗斯方块游戏逻辑
    └── admin.html         # 后台管理界面
```

## 快速开始

### 1. 启动服务器

```bash
source ~/.nvm/nvm.sh && npm start
```

服务器将在 `http://localhost:3000` 启动

### 2. 访问游戏

- **首页**: http://localhost:3000
- **玩家游戏**: http://localhost:3000/game.html
- **后台管理**: http://localhost:3000/admin.html

## 游戏说明

### 玩家操作

1. 访问游戏页面
2. 输入昵称（2-20个字符，不能重复）
3. 点击"开始游戏"按钮
4. 使用键盘控制：
   - `←` `→` : 左右移动
   - `↓` : 快速下落
   - `↑` : 旋转方块
   - `空格` : 直接落下

### 计分规则

- 消除1行: 100分 × 等级
- 消除2行: 300分 × 等级
- 消除3行: 500分 × 等级
- 消除4行: 800分 × 等级
- 每消除10行，等级提升1级
- 等级越高，方块下落速度越快

### 后台管理

1. 访问后台管理页面
2. 查看正在游戏的玩家列表
3. 点击任意玩家查看实时游戏画面
4. 查看完整排行榜（实时更新）

## API 接口

### 玩家相关

- `POST /api/player/register` - 注册玩家
- `GET /api/player/check-nickname/:nickname` - 检查昵称可用性
- `GET /api/player/:playerId` - 获取玩家信息

### 游戏相关

- `POST /api/game/start` - 开始游戏
- `POST /api/game/update` - 更新游戏状态
- `POST /api/game/end` - 结束游戏

### 数据相关

- `GET /api/leaderboard` - 获取排行榜
- `GET /api/players/playing` - 获取正在游戏的玩家
- `GET /api/player/:playerId/gamestate` - 获取玩家游戏状态

### 存储管理

- `GET /api/storage/stats` - 获取存储统计信息
- `POST /api/storage/save` - 手动保存数据到文件
- `POST /api/storage/backup` - 创建数据备份

### WebSocket

- 连接参数:
  - `type=player&playerId=xxx` - 玩家连接
  - `type=admin` - 管理端连接

## 数据结构

### 玩家对象
```javascript
{
  id: "player_xxx",
  nickname: "玩家昵称",
  currentScore: 0,
  highestScore: 0,
  status: "playing", // registered, playing, finished
  gameState: {...},
  startTime: timestamp,
  endTime: timestamp
}
```

### 游戏状态
```javascript
{
  board: Array(20x10),
  currentPiece: {...},
  nextPiece: {...},
  score: 0,
  lines: 0,
  level: 1
}
```

## 开发说明

### 添加新功能

1. 修改 `gameManager.js` 添加业务逻辑
2. 在 `server.js` 中添加 API 路由
3. 更新前端页面和 JavaScript

### 调试

- 查看浏览器控制台了解 WebSocket 连接状态
- 检查网络面板查看 API 请求
- 服务端日志会显示 WebSocket 连接信息和数据保存状态

## 数据持久化说明

### 自动保存机制

系统会在以下情况自动保存数据：

1. **定时保存**: 每30秒自动保存一次
2. **玩家注册**: 新玩家注册时立即保存
3. **游戏结束**: 玩家游戏结束时立即保存
4. **服务器关闭**: 优雅关闭时保存所有数据

### 数据存储位置

- 数据文件: `data/players.json`
- 备份文件: `data/players_backup_*.json`（自动保留最近10个）

### 数据恢复

服务器启动时会自动从 `data/players.json` 加载数据，恢复：
- 所有已注册的玩家信息
- 玩家的历史最高分
- 玩家的游戏历史记录
- 昵称唯一性约束

**注意**: 正在进行中的游戏不会恢复，玩家需要重新开始游戏。

### 手动操作

**使用 npm 脚本**:

```bash
# 运行存储测试
npm run test:storage

# 查看存储统计
npm run stats

# 创建备份
npm run backup
```

**使用管理脚本**:

```bash
# 查看帮助
./manage-data.sh

# 查看存储状态
./manage-data.sh stats

# 查看排行榜
./manage-data.sh leaderboard

# 手动保存数据
./manage-data.sh save

# 创建备份
./manage-data.sh backup

# 列出所有备份
./manage-data.sh list-backups

# 查看原始数据
./manage-data.sh view-data
```

**使用 API**:

```bash
# 查看存储状态
curl http://localhost:3001/api/storage/stats

# 手动保存数据
curl -X POST http://localhost:3001/api/storage/save

# 创建备份
curl -X POST http://localhost:3001/api/storage/backup
```

## 注意事项

- ✅ 游戏数据已支持本地文件持久化存储
- ✅ 服务器重启后数据自动恢复
- WebSocket 连接断开会自动重连
- 昵称一旦注册不可更改（除非手动删除数据文件）
- 数据文件采用 JSON 格式，可手动编辑（建议先备份）

## 未来优化方向

- [ ] 实现房间系统（多个游戏房间）
- [ ] 添加游戏回放功能
- [ ] 支持自定义游戏难度
- [ ] 添加音效和背景音乐
- [ ] 实现排行榜历史记录导出
- [ ] 支持移动端触摸控制
- [ ] 添加数据库支持（可选 MongoDB、Redis）
- [ ] 实现玩家账号系统

## 许可证

MIT
