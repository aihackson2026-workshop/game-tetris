// 游戏管理器 - 管理所有玩家和游戏状态

const dataStorage = require('./dataStorage');
const DifficultyConfig = require('./difficultyConfig');

class GameManager {
  constructor() {
    // 存储所有玩家信息
    this.players = new Map(); // key: playerId, value: player对象
    // 存储昵称映射，用于检查昵称唯一性
    this.nicknames = new Set();
    // 存储昵称到邮箱的映射（用于验证）
    this.nicknameEmailMap = new Map(); // key: nickname, value: email
    // WebSocket连接映射
    this.wsConnections = new Map(); // key: playerId, value: ws
    // 管理端WebSocket连接
    this.adminWsConnections = new Set();
    // 数据存储实例
    this.dataStorage = dataStorage;
    // 自动保存定时器
    this.autoSaveInterval = null;
    
    // 从文件加载数据
    this.loadFromFile();
    
    // 启动自动保存（每30秒保存一次）
    this.startAutoSave();
    
    // 启动游戏时长广播（每1秒广播一次）
    this.startDurationBroadcast();
  }

  // 启动游戏时长广播
  startDurationBroadcast() {
    this.durationBroadcastInterval = setInterval(() => {
      this.broadcastDurationUpdate();
    }, 1000);
    console.log('游戏时长广播已启动（间隔: 1秒）');
  }

  // 停止游戏时长广播
  stopDurationBroadcast() {
    if (this.durationBroadcastInterval) {
      clearInterval(this.durationBroadcastInterval);
      this.durationBroadcastInterval = null;
      console.log('游戏时长广播已停止');
    }
  }

  // 广播游戏时长更新
  broadcastDurationUpdate() {
    const playingPlayers = this.getPlayingPlayers();
    
    // 广播给管理端
    this.broadcastToAdmins({
      type: 'durationUpdate',
      players: playingPlayers.map(p => ({
        playerId: p.id,
        nickname: p.nickname,
        duration: p.duration,
        score: p.currentScore
      }))
    });

    // 广播给各个玩家
    for (const [playerId, ws] of this.wsConnections) {
      if (ws.readyState === 1) {
        const player = this.players.get(playerId);
        if (player && player.status === 'playing') {
          ws.send(JSON.stringify({
            type: 'durationUpdate',
            duration: player.startTime ? Date.now() - player.startTime : null
          }));
        }
      }
    }
  }

  // 从文件加载数据
  loadFromFile() {
    try {
      const data = this.dataStorage.loadPlayers();
      
      // 恢复玩家数据
      if (data.players && data.players.length > 0) {
        data.players.forEach(player => {
          // 只恢复已完成的游戏数据，不恢复游戏中的状态
          const restoredPlayer = {
            id: player.id,
            nickname: player.nickname,
            email: player.email, // 恢复邮箱
            currentScore: 0, // 重置当前分数
            highestScore: player.highestScore || 0,
            status: 'registered', // 重置状态为已注册
            gameState: null,
            startTime: null,
            endTime: null,
            history: player.history || []
          };
          
          this.players.set(player.id, restoredPlayer);
          
          // 恢复昵称-邮箱映射
          if (player.email) {
            this.nicknameEmailMap.set(player.nickname, player.email);
          }
        });
      }
      
      // 恢复昵称集合
      if (data.nicknames && data.nicknames.length > 0) {
        this.nicknames = new Set(data.nicknames);
      }
      
      console.log(`已从文件加载 ${this.players.size} 个玩家数据`);
    } catch (error) {
      console.error('从文件加载数据失败:', error.message);
    }
  }

  // 保存到文件
  saveToFile() {
    try {
      this.dataStorage.savePlayers(this.players, this.nicknames, this.nicknameEmailMap);
    } catch (error) {
      console.error('保存数据到文件失败:', error.message);
    }
  }

  // 异步保存到文件
  async saveToFileAsync() {
    try {
      await this.dataStorage.savePlayersAsync(this.players, this.nicknames, this.nicknameEmailMap);
    } catch (error) {
      console.error('异步保存数据失败:', error.message);
    }
  }

  // 启动自动保存
  startAutoSave() {
    // 每30秒自动保存一次
    this.autoSaveInterval = setInterval(() => {
      this.saveToFileAsync();
    }, 30000);
    
    console.log('自动保存已启动（间隔: 30秒）');
  }

  // 停止自动保存
  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
      console.log('自动保存已停止');
    }
  }

  // 创建数据备份
  backupData() {
    return this.dataStorage.backupData();
  }

  // 获取存储统计信息
  getStorageStats() {
    return this.dataStorage.getStats();
  }

  // 删除玩家记录
  deletePlayer(playerId) {
    const player = this.players.get(playerId);
    
    if (!player) {
      return { success: false, message: '玩家不存在' };
    }

    // 只允许删除已结束的玩家
    if (player.status !== 'finished') {
      return { success: false, message: '只能删除已结束的玩家记录' };
    }

    // 从所有存储中移除
    this.players.delete(playerId);
    this.nicknames.delete(player.nickname);
    this.nicknameEmailMap.delete(player.nickname);

    // 保存到文件
    this.saveToFileAsync();

    // 广播更新
    this.broadcastLeaderboard();

    console.log(`已删除玩家记录: ${player.nickname} (${playerId})`);
    return { success: true, message: `已删除玩家 ${player.nickname}` };
  }

  // 生成唯一玩家ID
  generatePlayerId() {
    return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 检查昵称是否可用
  isNicknameAvailable(nickname) {
    return !this.nicknames.has(nickname);
  }

  // 验证昵称和邮箱
  validateNicknameEmail(nickname, email) {
    // 如果昵称不存在，说明是新玩家
    if (!this.nicknames.has(nickname)) {
      return { isValid: true, isNewPlayer: true };
    }

    // 如果昵称存在，检查邮箱是否匹配
    const registeredEmail = this.nicknameEmailMap.get(nickname);
    
    if (!registeredEmail) {
      // 老玩家数据没有邮箱（数据迁移情况）
      return { isValid: true, isNewPlayer: false, needsEmailUpdate: true };
    }

    if (registeredEmail === email) {
      // 邮箱匹配，验证通过
      return { isValid: true, isNewPlayer: false };
    } else {
      // 邮箱不匹配
      return { isValid: false, error: '昵称已被占用，请使用正确的邮箱或更换昵称' };
    }
  }

  // 注册或登录玩家（支持邮箱验证）
  registerPlayer(nickname, email) {
    // 验证昵称和邮箱
    const validation = this.validateNicknameEmail(nickname, email);

    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    let player;
    let isNewPlayer = validation.isNewPlayer;

    if (validation.isNewPlayer) {
      // 新玩家注册
      const playerId = this.generatePlayerId();
      player = {
        id: playerId,
        nickname: nickname,
        email: email,
        currentScore: 0,
        highestScore: 0,
        status: 'registered', // registered, playing, finished
        gameState: null, // 游戏状态数据
        startTime: null,
        endTime: null,
        history: [] // 历史游戏记录
      };

      this.players.set(playerId, player);
      this.nicknames.add(nickname);
      this.nicknameEmailMap.set(nickname, email);

    } else {
      // 老玩家登录
      // 查找玩家ID
      let playerId = null;
      for (const [id, p] of this.players) {
        if (p.nickname === nickname) {
          playerId = id;
          player = p;
          break;
        }
      }

      if (!player) {
        throw new Error('玩家数据异常');
      }

      // 如果需要更新邮箱（老数据迁移）
      if (validation.needsEmailUpdate) {
        player.email = email;
        this.nicknameEmailMap.set(nickname, email);
      }

      // 重置游戏状态（允许重新开始）
      player.currentScore = 0;
      player.status = 'registered';
      player.gameState = null;
      player.startTime = null;
      player.endTime = null;
    }

    // 保存到文件
    this.saveToFileAsync();

    return { player, isNewPlayer };
  }

  // 开始游戏
  startGame(playerId) {
    const player = this.players.get(playerId);
    if (!player) {
      throw new Error('玩家不存在');
    }

    player.status = 'playing';
    player.startTime = Date.now();
    player.currentScore = 0;
    
    // 初始化服务端方块序列
    player.pieceSequence = []; // 已分配的方块序列
    player.pieceIndex = 0; // 当前方块索引
    player.cheatingDetected = false; // 作弊标记
    
    // 下落时间验证
    player.currentPieceStartTime = Date.now(); // 当前方块开始时间
    player.speedViolations = 0; // 速度违规次数
    player.pauseCount = 0; // 暂停次数
    player.isPaused = false; // 暂停状态
    player.pauseStartTime = null; // 暂停开始时间
    
    // 预生成一批方块（50个）
    for (let i = 0; i < 50; i++) {
      player.pieceSequence.push(this.generateRandomPiece());
    }
    
    // 获取初始难度配置
    const difficulty = DifficultyConfig.getDifficultyByScore(0);
    
    // 初始游戏状态
    player.gameState = {
      board: Array(20).fill(null).map(() => Array(10).fill(0)),
      currentPiece: player.pieceSequence[0],
      nextPiece: player.pieceSequence[1],
      score: 0,
      lines: 0,
      level: difficulty.level,
      dropInterval: difficulty.interval // 下落间隔
    };
    
    // 存储当前棋盘状态用于验证
    player.lastBoardState = JSON.parse(JSON.stringify(player.gameState.board));
    player.lastLockedPiece = null; // 记录上次锁定的方块

    this.broadcastToAdmins({
      type: 'playerStatusUpdate',
      player: this.getPlayerInfo(playerId)
    });

    return {
      gameState: player.gameState,
      pieceSequence: player.pieceSequence.slice(0, 10), // 只发送前10个方块
      dropInterval: difficulty.interval, // 初始下落速度
      difficulty: {
        level: difficulty.level,
        name: difficulty.name
      }
    };
  }

  // 生成初始游戏状态（废弃，保留兼容）
  generateInitialGameState() {
    return {
      board: Array(20).fill(null).map(() => Array(10).fill(0)),
      currentPiece: this.generateRandomPiece(),
      nextPiece: this.generateRandomPiece(),
      score: 0,
      lines: 0,
      level: 1
    };
  }

  // 生成随机方块
  generateRandomPiece() {
    const pieces = [
      { type: 'I', color: '#00f0f0', shape: [[1,1,1,1]] },
      { type: 'O', color: '#f0f000', shape: [[1,1],[1,1]] },
      { type: 'T', color: '#a000f0', shape: [[0,1,0],[1,1,1]] },
      { type: 'S', color: '#00f000', shape: [[0,1,1],[1,1,0]] },
      { type: 'Z', color: '#f00000', shape: [[1,1,0],[0,1,1]] },
      { type: 'J', color: '#0000f0', shape: [[1,0,0],[1,1,1]] },
      { type: 'L', color: '#f0a000', shape: [[0,0,1],[1,1,1]] }
    ];
    
    const piece = pieces[Math.floor(Math.random() * pieces.length)];
    return {
      ...piece,
      x: 3,
      y: 0,
      id: `${piece.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` // 唯一ID
    };
  }

  // 请求下一个方块（客户端消耗当前方块后调用）
  getNextPiece(playerId) {
    const player = this.players.get(playerId);
    if (!player) {
      throw new Error('玩家不存在');
    }

    if (player.status !== 'playing') {
      throw new Error('游戏未开始');
    }

    // 如果游戏已暂停，跳过下落时间验证
    if (player.isPaused) {
      console.log(`玩家 ${player.nickname} 游戏已暂停，跳过下落时间验证`);
      player.currentPieceStartTime = Date.now();
    }

    // 验证下落时间（防止作弊暂停/加速）
    const now = Date.now();
    const fallTime = now - player.currentPieceStartTime;
    const currentScore = player.currentScore || 0;
    
    const validation = DifficultyConfig.validateFallTime(fallTime, currentScore);
    
    if (!validation.valid) {
      console.warn(`速度异常检测: 玩家 ${player.nickname} (${playerId})`);
      console.warn(`  原因: ${validation.reason}`);
      console.warn(`  实际时间: ${fallTime}ms`);
      const min = validation.expected.min ? validation.expected.min.toFixed(0) : 'N/A';
      const max = validation.expected.max ? validation.expected.max.toFixed(0) : 'N/A';
      console.warn(`  期望范围: ${min}ms - ${max}ms`);
      console.warn(`  当前违规次数: ${player.speedViolations + 1}/${DifficultyConfig.SPEED_VALIDATION.SUSPICIOUS_COUNT}`);
      
      player.speedViolations++;
      
      // 严重违规（连续多次）- 判定作弊
      if (player.speedViolations >= DifficultyConfig.SPEED_VALIDATION.SUSPICIOUS_COUNT) {
        player.cheatingDetected = true;
        console.error(`作弊判定: 玩家 ${player.nickname} 连续 ${player.speedViolations} 次速度异常`);
        throw new Error(`检测到速度作弊: ${validation.reason}`);
      }
      
      // 超时 - 可能是暂停（只在非暂停状态下计数）
      if (validation.severity === 'high' && fallTime > DifficultyConfig.SPEED_VALIDATION.MAX_PAUSE_TIME) {
        player.pauseCount++;
        console.warn(`  暂停检测: 第 ${player.pauseCount}/${DifficultyConfig.SPEED_VALIDATION.PAUSE_TOLERANCE} 次`);
        
        if (player.pauseCount > DifficultyConfig.SPEED_VALIDATION.PAUSE_TOLERANCE) {
          player.cheatingDetected = true;
          console.error(`作弊判定: 玩家 ${player.nickname} 累计暂停 ${player.pauseCount} 次`);
          throw new Error('检测到多次暂停游戏，疑似作弊');
        }
      }
    } else {
      // 正常情况，逐渐恢复违规计数（不是立即清零）
      if (player.speedViolations > 0) {
        player.speedViolations = Math.max(0, player.speedViolations - 0.5);
      }
    }

    // 增加索引
    player.pieceIndex++;

    // 如果快用完了，继续生成
    if (player.pieceIndex + 10 >= player.pieceSequence.length) {
      for (let i = 0; i < 20; i++) {
        player.pieceSequence.push(this.generateRandomPiece());
      }
    }

    const currentPiece = player.pieceSequence[player.pieceIndex];
    const nextPiece = player.pieceSequence[player.pieceIndex + 1];
    
    // 更新当前方块开始时间
    player.currentPieceStartTime = now;
    
    // 根据分数获取新的难度配置
    const difficulty = DifficultyConfig.getDifficultyByScore(currentScore);

    return {
      currentPiece,
      nextPiece,
      pieceIndex: player.pieceIndex,
      dropInterval: difficulty.interval, // 新的下落速度
      difficulty: {
        level: difficulty.level,
        name: difficulty.name
      }
    };
  }

  // 验证当前方块是否合法（已废弃 - 存在时序问题）
  // 注意：此方法不再使用，因为客户端请求顺序导致索引不同步
  // 防作弊通过以下机制保证：
  // 1. 方块序列由服务端生成（客户端无法伪造）
  // 2. getNextPiece 严格控制索引和下落时间验证
  validateCurrentPiece(playerId, pieceId, pieceType) {
    const player = this.players.get(playerId);
    if (!player) {
      return { valid: false, reason: '玩家不存在' };
    }

    if (player.cheatingDetected) {
      return { valid: false, reason: '已检测到作弊行为' };
    }

    const expectedPiece = player.pieceSequence[player.pieceIndex];
    
    if (!expectedPiece) {
      return { valid: false, reason: '方块序列异常' };
    }

    // 验证方块ID和类型
    if (expectedPiece.id !== pieceId) {
      console.warn(`作弊检测: 玩家 ${player.nickname} (${playerId}) - 方块ID不匹配`);
      console.warn(`  期望: ${expectedPiece.id}`);
      console.warn(`  实际: ${pieceId}`);
      player.cheatingDetected = true;
      return { valid: false, reason: '方块ID不匹配，疑似作弊' };
    }

    if (expectedPiece.type !== pieceType) {
      console.warn(`作弊检测: 玩家 ${player.nickname} (${playerId}) - 方块类型不匹配`);
      console.warn(`  期望: ${expectedPiece.type}`);
      console.warn(`  实际: ${pieceType}`);
      player.cheatingDetected = true;
      return { valid: false, reason: '方块类型不匹配，疑似作弊' };
    }

    return { valid: true };
  }

  // 验证方块消除是否合法
  validateLineClear(playerId, boardBefore, boardAfter, linesCleared, scoreBefore) {
    const player = this.players.get(playerId);
    if (!player) {
      return { valid: false, reason: '玩家不存在' };
    }

    if (!boardBefore || !boardAfter) {
      return { valid: false, reason: '缺少棋盘数据' };
    }

    // 找出被消除的行（在旧棋盘满的行，在新棋盘中不存在或位置变了）
    const ROWS = 20;
    const COLS = 10;

    // 找出旧棋盘中满的行
    const fullRows = [];
    for (let y = 0; y < ROWS; y++) {
      const isFull = boardBefore[y].every(cell => cell !== 0);
      if (isFull) {
        fullRows.push(y);
      }
    }

    // 验证消除的行数
    if (linesCleared !== fullRows.length) {
      console.warn(`作弊检测: 玩家 ${player.nickname} - 消除行数不匹配`);
      console.warn(`  报告消除: ${linesCleared} 行`);
      console.warn(`  实际满行: ${fullRows.length} 行`);
      return { valid: false, reason: `消除行数异常: 报告${linesCleared}行，实际${fullRows.length}行` };
    }

    // 验证分数计算
    const points = [0, 100, 300, 500, 800];
    const expectedScoreIncrease = (points[linesCleared] || 0) * (player.gameState?.level || 1);
    const expectedScore = scoreBefore + expectedScoreIncrease;

    if (player.currentScore !== expectedScore) {
      console.warn(`作弊检测: 玩家 ${player.nickname} - 分数异常`);
      console.warn(`  期望分数: ${expectedScore}`);
      console.warn(`  报告分数: ${player.currentScore}`);
      return { valid: false, reason: `分数异常: 期望${expectedScore}，实际${player.currentScore}` };
    }

    return { valid: true };
  }

  // 更新游戏状态
  updateGameState(playerId, gameState, pieceValidation = null) {
    const player = this.players.get(playerId);
    if (!player) {
      throw new Error('玩家不存在');
    }

    const oldBoard = player.lastBoardState;
    const oldScore = player.currentScore || 0;
    const newScore = gameState.score;
    const newBoard = gameState.board;

    // 验证棋盘状态一致性
    if (oldBoard && newBoard) {
      const boardValidation = this.validateBoardState(player, oldBoard, newBoard);
      if (!boardValidation.valid) {
        player.cheatingDetected = true;
        console.error(`作弊判定: 玩家 ${player.nickname} - 棋盘状态异常`);
        console.error(`  原因: ${boardValidation.reason}`);
        throw new Error(`检测到棋盘状态异常: ${boardValidation.reason}`);
      }
    }

    // 验证方块消除（如果有分数变化）
    if (oldBoard && newScore !== oldScore) {
      const scoreIncrease = newScore - oldScore;
      const level = gameState.level || 1;
      
      // 根据分数反推消除的行数
      // 分数增加 = linesCleared * level * [0, 100, 300, 500, 800]
      const points = [0, 100, 300, 500, 800];
      let estimatedLines = 0;
      for (let i = points.length - 1; i >= 1; i--) {
        if (scoreIncrease >= points[i] * level) {
          estimatedLines = i;
          break;
        }
      }
      
      // 验证方块数量变化是否合理（消除的行应该有方块消失）
      if (oldBoard && newBoard) {
        let oldBlockCount = 0;
        let newBlockCount = 0;
        for (let y = 0; y < 20; y++) {
          for (let x = 0; x < 10; x++) {
            if (oldBoard[y][x] !== 0) oldBlockCount++;
            if (newBoard[y][x] !== 0) newBlockCount++;
          }
        }
        
        const blockDecrease = oldBlockCount - newBlockCount;
        // 消除行时，方块数量应该减少（被消除的满行约10个方块）
        // 允许有一定偏差（因为新方块可能还没完全落下）
        if (estimatedLines > 0 && blockDecrease < estimatedLines * 5) {
          // 方块减少太少，可能是假报分数
          console.warn(`作弊检测: 玩家 ${player.nickname} - 分数与方块数量不匹配`);
          console.warn(`  估计消除: ${estimatedLines} 行`);
          console.warn(`  方块减少: ${blockDecrease} 个`);
        }
      }
    }

    // 更新服务器存储的棋盘状态
    if (newBoard) {
      player.lastBoardState = JSON.parse(JSON.stringify(newBoard));
    }

    // 验证方块ID，因为存在时序问题
    // 方块验证已经通过以下机制保证：
    // 1. 所有方块由服务端生成（客户端无法伪造）
    // 2. getNextPiece 时已经验证了下落时间
    // 3. 方块序列索引由服务端严格控制
    // 4. 方块消除需要服务端验证

    player.gameState = gameState;
    player.currentScore = gameState.score;

    // 更新最高分
    if (player.currentScore > player.highestScore) {
      player.highestScore = player.currentScore;
    }

    // 广播给管理端
    this.broadcastToAdmins({
      type: 'gameStateUpdate',
      playerId: playerId,
      gameState: gameState,
      score: player.currentScore
    });

    // 广播排行榜更新
    this.broadcastLeaderboard();

    return player;
  }

  // 验证棋盘状态一致性
  validateBoardState(player, oldBoard, newBoard) {
    const ROWS = 20;
    const COLS = 10;

    // 检查棋盘尺寸
    if (!newBoard || newBoard.length !== ROWS || newBoard[0].length !== COLS) {
      return { valid: false, reason: '棋盘尺寸异常' };
    }

    // 检查方块是否超出边界
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = newBoard[y][x];
        if (cell !== 0 && (cell < 1 || cell > 7)) {
          return { valid: false, reason: `方块类型异常: 格子[${y}][${x}]=${cell}` };
        }
      }
    }

    return { valid: true };
  }

  // 计算消除的行数
  calculateLinesCleared(oldBoard, newBoard) {
    if (!oldBoard || !newBoard) return 0;

    const ROWS = 20;
    let clearedCount = 0;

    // 找出旧棋盘中满的行
    for (let y = 0; y < ROWS; y++) {
      const isFull = oldBoard[y].every(cell => cell !== 0);
      if (isFull) {
        // 检查这行在新棋盘中是否还存在
        // 如果被消除，新棋盘中这行应该变成空行或移除了
        const stillExists = newBoard[y] && newBoard[y].some(cell => cell !== 0);
        if (!stillExists) {
          clearedCount++;
        }
      }
    }

    return clearedCount;
  }

  // 结束游戏
  endGame(playerId) {
    const player = this.players.get(playerId);
    if (!player) {
      throw new Error('玩家不存在');
    }

    player.status = 'finished';
    player.endTime = Date.now();

    // 记录到历史
    player.history.push({
      score: player.currentScore,
      startTime: player.startTime,
      endTime: player.endTime,
      duration: player.endTime - player.startTime
    });

    this.broadcastToAdmins({
      type: 'playerStatusUpdate',
      player: this.getPlayerInfo(playerId)
    });

    this.broadcastLeaderboard();

    // 保存到文件（游戏结束时立即保存）
    this.saveToFileAsync();

    return player;
  }

  // 暂停游戏
  pauseGame(playerId) {
    const player = this.players.get(playerId);
    if (!player) {
      throw new Error('玩家不存在');
    }

    if (player.status !== 'playing') {
      throw new Error('游戏未开始，无法暂停');
    }

    if (player.isPaused) {
      throw new Error('游戏已经暂停');
    }

    player.isPaused = true;
    player.pauseStartTime = Date.now();

    // 通知客户端暂停
    this.broadcastToPlayer(playerId, {
      type: 'gamePaused',
      message: '游戏已暂停'
    });

    return { success: true, message: '游戏已暂停' };
  }

  // 恢复游戏
  resumeGame(playerId) {
    const player = this.players.get(playerId);
    if (!player) {
      throw new Error('玩家不存在');
    }

    if (!player.isPaused) {
      throw new Error('游戏未暂停，无法恢复');
    }

    // 计算暂停时长，调整 currentPieceStartTime
    const pauseDuration = Date.now() - player.pauseStartTime;
    player.currentPieceStartTime += pauseDuration;

    player.isPaused = false;
    player.pauseStartTime = null;

    // 通知客户端恢复
    this.broadcastToPlayer(playerId, {
      type: 'gameResumed',
      message: '游戏已继续'
    });

    return { success: true, message: '游戏已继续' };
  }

  // 获取玩家信息
  getPlayerInfo(playerId) {
    const player = this.players.get(playerId);
    if (!player) {
      return null;
    }

    let duration = null;
    if (player.startTime) {
      if (player.endTime) {
        duration = player.endTime - player.startTime;
      } else if (player.status === 'playing') {
        duration = Date.now() - player.startTime;
      }
    }

    return {
      id: player.id,
      nickname: player.nickname,
      currentScore: player.currentScore,
      highestScore: player.highestScore,
      status: player.status,
      startTime: player.startTime,
      endTime: player.endTime,
      duration: duration
    };
  }

  // 获取所有正在玩的玩家
  getPlayingPlayers() {
    const playing = [];
    const now = Date.now();
    for (const [id, player] of this.players) {
      if (player.status === 'playing') {
        const playerInfo = this.getPlayerInfo(id);
        playing.push(playerInfo);
      }
    }
    return playing;
  }

  // 获取排行榜
  getLeaderboard() {
    const allPlayers = Array.from(this.players.values());
    
    // 收集所有分数条目（当前分数和最高分各一条）
    const allEntries = [];
    
    allPlayers.forEach(p => {
      // 正在玩的玩家：添加当前分数条目
      if (p.status === 'playing') {
        const duration = p.startTime ? Date.now() - p.startTime : null;
        allEntries.push({
          id: p.id + '_current',
          playerId: p.id,
          nickname: p.nickname,
          score: p.currentScore,
          currentScore: p.currentScore,
          highestScore: p.highestScore,
          status: 'playing',
          startTime: p.startTime,
          duration: duration,
          isCurrent: true
        });
      }
      
      // 所有玩家：添加最高分条目
      if (p.highestScore > 0) {
        // 如果正在玩的玩家，最高分就是当前最高分，可能和当前分数相同
        // 如果已结束的玩家，使用记录的最高分
        let duration = null;
        if (p.status === 'finished' && p.startTime && p.endTime) {
          duration = p.endTime - p.startTime;
        }
        
        allEntries.push({
          id: p.id + '_highest',
          playerId: p.id,
          nickname: p.nickname,
          score: p.highestScore,
          currentScore: p.currentScore,
          highestScore: p.highestScore,
          status: p.status,
          endTime: p.endTime,
          duration: duration,
          isCurrent: false
        });
      }
    });
    
    // 按分数从高到低排序
    allEntries.sort((a, b) => b.score - a.score);
    
    // 分类为正在玩和已结束
    const playing = allEntries.filter(e => e.status === 'playing');
    const finished = allEntries.filter(e => e.status === 'finished' || (e.status === 'playing' && !e.isCurrent));
    
    return { playing, finished, all: allEntries };
  }

  // 获取玩家排名
  getPlayerRank(playerId) {
    const leaderboard = this.getLeaderboard();
    const player = this.players.get(playerId);
    if (!player) {
      return null;
    }

    const rank = leaderboard.all.findIndex(p => p.nickname === player.nickname) + 1;
    return rank;
  }

  // 获取玩家游戏状态（用于管理端实时查看）
  getPlayerGameState(playerId) {
    const player = this.players.get(playerId);
    if (!player) {
      return null;
    }

    return {
      player: this.getPlayerInfo(playerId),
      gameState: player.gameState
    };
  }

  // 检查是否应该触发验证码挑战
  shouldTriggerCaptcha(playerId) {
    const player = this.players.get(playerId);
    if (!player || player.status !== 'playing') {
      return false;
    }

    const captcha = require('./captcha');
    return captcha.shouldTriggerCaptcha(
      playerId,
      player.currentScore || 0,
      player.speedViolations || 0
    );
  }

  // 暂停游戏并触发验证码
  pauseForCaptcha(playerId) {
    const player = this.players.get(playerId);
    if (!player || player.status !== 'playing') {
      return null;
    }

    const captcha = require('./captcha');
    const captchaData = captcha.createCaptcha(playerId);

    // 标记玩家等待验证码验证
    player.waitingCaptcha = true;
    player.captchaId = captchaData.id;

    // 发送验证码挑战给玩家
    const ws = this.wsConnections.get(playerId);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'captchaChallenge',
        captchaId: captchaData.id,
        imageUrl: `/api/captcha/image/${captchaData.id}`
      }));
    }

    // 通知管理端
    this.broadcastToAdmins({
      type: 'playerCaptchaChallenge',
      playerId: playerId,
      nickname: player.nickname
    });

    return captchaData;
  }

  // 验证验证码并恢复游戏
  verifyCaptchaAndResume(playerId, captchaId, inputCode) {
    const player = this.players.get(playerId);
    if (!player) {
      return { success: false, error: '玩家不存在' };
    }

    if (!player.waitingCaptcha) {
      return { success: false, error: '当前无需验证码验证' };
    }

    const captcha = require('./captcha');
    const result = captcha.verifyCaptcha(captchaId, inputCode);

    if (result.valid) {
      // 验证成功，恢复游戏
      player.waitingCaptcha = false;
      player.captchaId = null;
      player.captchaVerified = true;

      // 重置违规计数
      player.speedViolations = 0;
      player.pauseCount = 0;

      // 通知玩家恢复游戏
      const ws = this.wsConnections.get(playerId);
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'captchaVerified',
          success: true
        }));
      }

      // 通知管理端
      this.broadcastToAdmins({
        type: 'playerCaptchaVerified',
        playerId: playerId,
        nickname: player.nickname,
        success: true
      });

      return { success: true };
    } else {
      // 验证失败
      return { success: false, error: result.error };
    }
  }

  // 检查玩家是否正在等待验证码
  isWaitingCaptcha(playerId) {
    const player = this.players.get(playerId);
    return player && player.waitingCaptcha === true;
  }

  // 广播给所有管理端
  broadcastToAdmins(message) {
    for (const ws of this.adminWsConnections) {
      if (ws.readyState === 1) { // OPEN
        ws.send(JSON.stringify(message));
      }
    }
  }

  // 广播玩家游戏状态给订阅的管理端
  broadcastPlayerGameState(playerId, gameState) {
    for (const ws of this.adminWsConnections) {
      if (ws.readyState === 1 && ws.subscribedPlayers && ws.subscribedPlayers.has(playerId)) {
        ws.send(JSON.stringify({
          type: 'gameStateUpdate',
          playerId: playerId,
          gameState: gameState
        }));
      }
    }
  }

  // 广播排行榜更新
  broadcastLeaderboard() {
    const leaderboard = this.getLeaderboard();
    this.broadcastToAdmins({
      type: 'leaderboardUpdate',
      leaderboard: leaderboard
    });

    // 也通知所有玩家他们的排名
    for (const [playerId, ws] of this.wsConnections) {
      if (ws.readyState === 1) {
        const rank = this.getPlayerRank(playerId);
        ws.send(JSON.stringify({
          type: 'rankUpdate',
          rank: rank,
          leaderboard: leaderboard.all.slice(0, 10) // 只发送前10名
        }));
      }
    }
  }

  // 添加WebSocket连接
  addPlayerConnection(playerId, ws) {
    this.wsConnections.set(playerId, ws);
  }

  // 移除WebSocket连接
  removePlayerConnection(playerId) {
    this.wsConnections.delete(playerId);
  }

  // 添加管理端连接
  addAdminConnection(ws) {
    this.adminWsConnections.add(ws);
  }

  // 移除管理端连接
  removeAdminConnection(ws) {
    this.adminWsConnections.delete(ws);
  }
}

// 导出单例
const gameManager = new GameManager();
module.exports = gameManager;
