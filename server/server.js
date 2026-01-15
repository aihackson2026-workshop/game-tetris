const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const gameManager = require('./gameManager');
const captcha = require('./captcha');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// 创建 HTTP 服务器
const server = http.createServer(app);

// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ server });

// 解析 JSON 请求体
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务 - 提供 public 目录下的静态文件
app.use(express.static(path.join(__dirname, 'public')));

// ===== API 路由 =====

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// 玩家注册/登录
app.post('/api/player/register', (req, res) => {
  try {
    const { nickname, email } = req.body;
    
    // 验证昵称
    if (!nickname || nickname.trim() === '') {
      return res.status(400).json({ error: '昵称不能为空' });
    }

    // 验证邮箱
    if (!email || email.trim() === '') {
      return res.status(400).json({ error: '邮箱不能为空' });
    }

    // 简单的邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: '请输入有效的邮箱地址' });
    }

    // 注册或登录玩家
    const result = gameManager.registerPlayer(nickname.trim(), email.trim());
    
    res.json({
      success: true,
      isNewPlayer: result.isNewPlayer,
      player: {
        id: result.player.id,
        nickname: result.player.nickname,
        email: result.player.email,
        highestScore: result.player.highestScore
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 检查昵称是否可用
app.get('/api/player/check-nickname/:nickname', (req, res) => {
  const { nickname } = req.params;
  const available = gameManager.isNicknameAvailable(nickname);
  res.json({ available });
});

// 开始游戏
app.post('/api/game/start', (req, res) => {
  try {
    const { playerId } = req.body;
    
    if (!playerId) {
      return res.status(400).json({ error: '玩家ID不能为空' });
    }

    const result = gameManager.startGame(playerId);
    res.json({
      success: true,
      gameState: result.gameState,
      pieceSequence: result.pieceSequence // 初始方块序列
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 获取下一个方块
app.post('/api/game/next-piece', (req, res) => {
  try {
    const { playerId } = req.body;
    
    if (!playerId) {
      return res.status(400).json({ error: '玩家ID不能为空' });
    }

    const result = gameManager.getNextPiece(playerId);
    
    // 检查是否需要触发验证码（基于速度违规）
    if (gameManager.shouldTriggerCaptcha(playerId)) {
      console.log(`触发验证码挑战: 玩家 ${playerId}`);
      gameManager.pauseForCaptcha(playerId);
    }
    
    res.json({
      success: true,
      currentPiece: result.currentPiece,
      nextPiece: result.nextPiece,
      pieceIndex: result.pieceIndex
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 更新游戏状态（带作弊检测）
app.post('/api/game/update', (req, res) => {
  try {
    const { playerId, gameState, validatePiece } = req.body;
    
    if (!playerId || !gameState) {
      return res.status(400).json({ error: '参数不完整' });
    }

    const player = gameManager.updateGameState(playerId, gameState, validatePiece);
    
    // 检查是否需要触发验证码（在消除行后）
    if (gameState.lines && gameState.lines > 0) {
      if (gameManager.shouldTriggerCaptcha(playerId)) {
        console.log(`触发验证码挑战: 玩家 ${playerId}, 分数 ${player.currentScore}`);
        gameManager.pauseForCaptcha(playerId);
      }
    }
    
    res.json({
      success: true,
      currentScore: player.currentScore,
      highestScore: player.highestScore
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 结束游戏
app.post('/api/game/end', (req, res) => {
  try {
    const { playerId } = req.body;
    
    if (!playerId) {
      return res.status(400).json({ error: '玩家ID不能为空' });
    }

    const player = gameManager.endGame(playerId);
    const rank = gameManager.getPlayerRank(playerId);
    
    res.json({
      success: true,
      finalScore: player.currentScore,
      highestScore: player.highestScore,
      rank: rank
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 暂停游戏
app.post('/api/game/pause', (req, res) => {
  try {
    const { playerId } = req.body;
    
    if (!playerId) {
      return res.status(400).json({ error: '玩家ID不能为空' });
    }

    const result = gameManager.pauseGame(playerId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 恢复游戏
app.post('/api/game/resume', (req, res) => {
  try {
    const { playerId } = req.body;
    
    if (!playerId) {
      return res.status(400).json({ error: '玩家ID不能为空' });
    }

    const result = gameManager.resumeGame(playerId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 获取排行榜
app.get('/api/leaderboard', (req, res) => {
  const leaderboard = gameManager.getLeaderboard();
  res.json(leaderboard);
});

// 获取玩家信息
app.get('/api/player/:playerId', (req, res) => {
  const { playerId } = req.params;
  const player = gameManager.getPlayerInfo(playerId);
  
  if (!player) {
    return res.status(404).json({ error: '玩家不存在' });
  }

  const rank = gameManager.getPlayerRank(playerId);
  res.json({
    ...player,
    rank: rank
  });
});

// 获取所有正在玩的玩家
app.get('/api/players/playing', (req, res) => {
  const players = gameManager.getPlayingPlayers();
  res.json(players);
});

// 获取玩家游戏状态（管理端查看）
app.get('/api/player/:playerId/gamestate', (req, res) => {
  const { playerId } = req.params;
  const data = gameManager.getPlayerGameState(playerId);
  
  if (!data) {
    return res.status(404).json({ error: '玩家不存在' });
  }

  res.json(data);
});

// ===== 数据管理 API =====

// 获取存储统计信息
app.get('/api/storage/stats', (req, res) => {
  const stats = gameManager.getStorageStats();
  res.json(stats);
});

// 手动保存数据
app.post('/api/storage/save', async (req, res) => {
  try {
    await gameManager.saveToFileAsync();
    res.json({ success: true, message: '数据已保存' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建数据备份
app.post('/api/storage/backup', (req, res) => {
  try {
    const backupFile = gameManager.backupData();
    if (backupFile) {
      res.json({ success: true, backupFile: backupFile });
    } else {
      res.status(500).json({ error: '备份失败' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除已结束的玩家记录
app.delete('/api/player/:playerId', (req, res) => {
  try {
    const { playerId } = req.params;
    const result = gameManager.deletePlayer(playerId);
    
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 生成验证码图片
app.get('/api/captcha/image/:captchaId', (req, res) => {
  const { captchaId } = req.params;
  const captchaModule = require('./captcha');
  const captcha = captchaModule.captchaStore.get(captchaId);
  
  if (!captcha) {
    return res.status(404).send('验证码不存在');
  }
  
  const svgBuffer = captchaModule.generateCaptchaImage(captcha.code);
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(svgBuffer);
});

// 创建验证码
app.post('/api/captcha/create', (req, res) => {
  const { playerId } = req.body;
  const captchaModule = require('./captcha');
  const captcha = captchaModule.createCaptcha(playerId);
  
  res.json({
    success: true,
    captchaId: captcha.id,
    expiresAt: captcha.expiresAt
  });
});

// 验证验证码
app.post('/api/captcha/verify', (req, res) => {
  const { captchaId, inputCode, playerId } = req.body;
  
  if (!playerId) {
    return res.status(400).json({ success: false, error: '缺少玩家ID' });
  }
  
  // 使用 gameManager 的验证方法，会自动恢复游戏
  const result = gameManager.verifyCaptchaAndResume(playerId, captchaId, inputCode);
  
  if (result.success) {
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, error: result.error });
  }
});

// ===== WebSocket 处理 =====

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const type = url.searchParams.get('type'); // player 或 admin
  const playerId = url.searchParams.get('playerId');

  console.log(`WebSocket连接建立: type=${type}, playerId=${playerId}`);

  if (type === 'admin') {
    // 管理端连接
    gameManager.addAdminConnection(ws);
    
    // 为管理端连接添加订阅列表
    ws.subscribedPlayers = new Set();
    
    // 发送当前状态
    ws.send(JSON.stringify({
      type: 'init',
      players: gameManager.getPlayingPlayers(),
      leaderboard: gameManager.getLeaderboard()
    }));

  } else if (type === 'player' && playerId) {
    // 玩家连接
    gameManager.addPlayerConnection(playerId, ws);
    
    // 发送当前排名
    const rank = gameManager.getPlayerRank(playerId);
    const leaderboard = gameManager.getLeaderboard();
    ws.send(JSON.stringify({
      type: 'init',
      rank: rank,
      leaderboard: leaderboard.all.slice(0, 10)
    }));
  }

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // 处理不同类型的消息
      if (data.type === 'ping' && playerId) {
        // 心跳消息 - 更新活跃时间并响应pong
        gameManager.updatePlayerActivity(playerId);
        ws.send(JSON.stringify({ type: 'pong' }));
        
      } else if (data.type === 'gameUpdate' && playerId) {
        // 玩家游戏状态更新
        gameManager.updateGameState(playerId, data.gameState);
        
        // 立即推送给订阅了这个玩家的管理端
        gameManager.broadcastPlayerGameState(playerId, data.gameState);
        
      } else if (data.type === 'subscribePlayer' && type === 'admin' && data.playerId) {
        // 管理端订阅玩家
        ws.subscribedPlayers.add(data.playerId);
        console.log(`管理端订阅玩家: ${data.playerId}`);
        
        // 立即发送当前状态
        const gameState = gameManager.getPlayerGameState(data.playerId);
        if (gameState && gameState.gameState) {
          ws.send(JSON.stringify({
            type: 'gameStateUpdate',
            playerId: data.playerId,
            gameState: gameState.gameState
          }));
        }
        
      } else if (data.type === 'unsubscribePlayer' && type === 'admin' && data.playerId) {
        // 管理端取消订阅
        ws.subscribedPlayers.delete(data.playerId);
        console.log(`管理端取消订阅玩家: ${data.playerId}`);
        
      } else if (data.type === 'requestGameState' && type === 'admin' && data.playerId) {
        // 管理端请求查看某个玩家的游戏状态（兼容旧版）
        const gameState = gameManager.getPlayerGameState(data.playerId);
        ws.send(JSON.stringify({
          type: 'gameStateResponse',
          data: gameState
        }));
      }
    } catch (error) {
      console.error('WebSocket消息处理错误:', error);
    }
  });

  ws.on('close', () => {
    console.log(`WebSocket连接关闭: type=${type}, playerId=${playerId}`);
    
    if (type === 'admin') {
      gameManager.removeAdminConnection(ws);
    } else if (type === 'player' && playerId) {
      // 检查玩家是否正在游戏中
      const playerInfo = gameManager.getPlayerInfo(playerId);
      if (playerInfo && playerInfo.status === 'playing') {
        console.log(`玩家 ${playerInfo.nickname} (${playerId}) 断开连接时正在游戏中，自动结束游戏`);
        try {
          gameManager.endGame(playerId);
        } catch (error) {
          console.error(`自动结束游戏失败:`, error.message);
        }
      }
      
      gameManager.removePlayerConnection(playerId);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket错误:', error);
  });
});

// 启动服务器
server.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
  console.log(`Static files served from /public directory`);
  console.log(`WebSocket server is ready`);
});

// 优雅关闭 - 在服务器关闭时保存数据
process.on('SIGINT', async () => {
  console.log('\n正在关闭服务器...');
  
  // 停止自动保存
  gameManager.stopAutoSave();
  
  // 保存数据
  console.log('正在保存数据...');
  await gameManager.saveToFileAsync();
  
  console.log('数据已保存，服务器已关闭');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n正在关闭服务器...');
  
  // 停止自动保存
  gameManager.stopAutoSave();
  
  // 保存数据
  console.log('正在保存数据...');
  await gameManager.saveToFileAsync();
  
  console.log('数据已保存，服务器已关闭');
  process.exit(0);
});
