// 俄罗斯方块游戏逻辑

// 游戏配置
const ROWS = 20;
const COLS = 10;
const CELL_SIZE = 30;
const COLORS = {
    I: '#00f0f0',
    O: '#f0f000',
    T: '#a000f0',
    S: '#00f000',
    Z: '#f00000',
    J: '#0000f0',
    L: '#f0a000'
};

// 方块形状定义
const PIECES = {
    I: [[1,1,1,1]],
    O: [[1,1],[1,1]],
    T: [[0,1,0],[1,1,1]],
    S: [[0,1,1],[1,1,0]],
    Z: [[1,1,0],[0,1,1]],
    J: [[1,0,0],[1,1,1]],
    L: [[0,0,1],[1,1,1]]
};

// 游戏状态
let gameState = {
    board: [],
    currentPiece: null,
    nextPiece: null,
    score: 0,
    lines: 0,
    level: 1,
    gameOver: false,
    playing: false
};

let playerId = null;
let playerNickname = null;
let highestScore = 0;
let ws = null;
let gameLoop = null;
let dropInterval = 1000;
let lastDropTime = 0;
let isGamePaused = false;
let isLoggedOut = false; // 标记是否已退出登录
let heartbeatInterval = null; // 心跳定时器

// 服务端方块序列管理
let serverPieceSequence = []; // 服务端分配的方块序列
let currentPieceIndex = 0; // 当前方块索引

// 难度系统
let currentDifficulty = { level: 1, name: '新手' };
let lastDifficultyLevel = 1;

// Canvas元素
let canvas, ctx, nextCanvas, nextCtx;

// 初始化
window.addEventListener('load', () => {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    nextCanvas = document.getElementById('nextPieceCanvas');
    nextCtx = nextCanvas.getContext('2d');

    // 监听键盘事件
    document.addEventListener('keydown', handleKeyPress);

    // 验证码输入框事件
    const captchaInput = document.getElementById('captchaInput');
    if (captchaInput) {
        captchaInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                verifyCaptcha();
            }
        });
    }

    // 检查URL参数
    const urlParams = new URLSearchParams(window.location.search);
    const urlPlayerId = urlParams.get('playerId');
    const urlNickname = urlParams.get('nickname');
    
    if (urlPlayerId && urlNickname) {
        playerId = urlPlayerId;
        playerNickname = urlNickname;
        showGameContainer();
    } else {
        // 检查localStorage中是否有保存的登录信息
        tryAutoLogin();
    }
});

// 尝试自动登录
function tryAutoLogin() {
    const savedLoginInfo = localStorage.getItem('tetris_login_info');
    if (!savedLoginInfo) {
        return;
    }
    
    let loginInfo;
    try {
        loginInfo = JSON.parse(savedLoginInfo);
    } catch (error) {
        console.error('解析登录信息失败:', error);
        // 只有在 JSON 解析失败时才清除
        localStorage.removeItem('tetris_login_info');
        return;
    }
    
    // 验证登录信息的完整性
    if (!loginInfo.playerId || !loginInfo.nickname) {
        console.error('登录信息不完整');
        localStorage.removeItem('tetris_login_info');
        return;
    }
    
    // 恢复登录状态
    playerId = loginInfo.playerId;
    playerNickname = loginInfo.nickname;
    
    try {
        // 隐藏注册界面，显示游戏界面
        document.getElementById('registerContainer').classList.add('hidden');
        // 从服务端加载最新的玩家数据
        loadPlayerDataAndShowGame();
        console.log('自动登录成功:', playerNickname);
    } catch (error) {
        // showGameContainer 中的错误不应该清除登录信息
        // 这些错误通常是临时的（如 WebSocket 连接失败）
        console.error('显示游戏界面时出错:', error);
        // 不清除 localStorage，下次刷新可以重试
    }
}

// 从服务端加载玩家数据并显示游戏界面
async function loadPlayerDataAndShowGame() {
    try {
        const response = await fetch(`/api/player/${playerId}`);
        if (response.ok) {
            const playerData = await response.json();
            highestScore = playerData.highestScore || 0;
            // 更新显示
            const highestScoreEl = document.getElementById('highestScore');
            if (highestScoreEl) {
                highestScoreEl.textContent = highestScore;
            }
        } else {
            console.warn('无法加载玩家数据，使用默认值');
            highestScore = 0;
        }
    } catch (error) {
        console.error('加载玩家数据失败:', error);
        highestScore = 0;
    }
    
    showGameContainer();
}

// 保存用户身份信息到localStorage（仅保存身份，不保存业务数据）
function saveUserIdentity() {
    if (playerId && playerNickname) {
        const loginInfo = {
            playerId: playerId,
            nickname: playerNickname
        };
        localStorage.setItem('tetris_login_info', JSON.stringify(loginInfo));
    }
}

// 退出登录
function logout() {
    // 设置退出标志，防止自动重连
    isLoggedOut = true;
    
    // 清除localStorage中的登录信息
    localStorage.removeItem('tetris_login_info');
    
    // 断开WebSocket连接
    if (ws) {
        ws.close();
        ws = null;
    }
    
    // 停止游戏
    if (gameLoop) {
        cancelAnimationFrame(gameLoop);
        gameLoop = null;
    }
    
    // 重置游戏状态
    playerId = null;
    playerNickname = null;
    highestScore = 0;
    gameState.playing = false;
    gameState.gameOver = false;
    
    // 隐藏游戏界面，显示注册界面
    document.getElementById('gameContainer').classList.remove('active');
    document.getElementById('registerContainer').classList.remove('hidden');
    
    // 清空输入框和错误信息
    const nicknameInput = document.getElementById('nicknameInput');
    const emailInput = document.getElementById('emailInput');
    const nicknameError = document.getElementById('nicknameError');
    const emailError = document.getElementById('emailError');
    
    if (nicknameInput) nicknameInput.value = '';
    if (emailInput) emailInput.value = '';
    if (nicknameError) {
        nicknameError.textContent = '';
        nicknameError.classList.remove('active');
    }
    if (emailError) {
        emailError.textContent = '';
        emailError.classList.remove('active');
    }
    
    console.log('已退出登录');
}

// 注册玩家
async function register() {
    const nicknameInput = document.getElementById('nicknameInput');
    const emailInput = document.getElementById('emailInput');
    const nickname = nicknameInput.value.trim();
    const email = emailInput.value.trim();
    const nicknameError = document.getElementById('nicknameError');
    const emailError = document.getElementById('emailError');
    const registerBtn = document.getElementById('registerBtn');

    // 清除之前的错误信息
    nicknameError.textContent = '';
    nicknameError.classList.remove('active');
    emailError.textContent = '';
    emailError.classList.remove('active');

    // 验证昵称
    if (!nickname || nickname.length < 2) {
        nicknameError.textContent = '昵称至少需要2个字符';
        nicknameError.classList.add('active');
        return;
    }

    // 验证邮箱
    if (!email) {
        emailError.textContent = '请输入邮箱地址';
        emailError.classList.add('active');
        return;
    }

    // 简单的邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        emailError.textContent = '请输入有效的邮箱地址';
        emailError.classList.add('active');
        return;
    }

    registerBtn.disabled = true;
    registerBtn.textContent = '验证中...';

    try {
        const response = await fetch('/api/player/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nickname, email })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '登录失败');
        }

        playerId = data.player.id;
        playerNickname = data.player.nickname;
        highestScore = data.player.highestScore || 0;

        // 保存用户身份信息到localStorage（仅身份信息）
        saveUserIdentity();

        // 显示欢迎信息
        if (data.isNewPlayer) {
            console.log('欢迎新玩家！昵称和邮箱已绑定。');
        } else {
            console.log('欢迎回来！');
        }

        // 隐藏注册界面，显示游戏界面
        document.getElementById('registerContainer').classList.add('hidden');
        showGameContainer();

    } catch (error) {
        // 根据错误类型显示在不同的位置
        if (error.message.includes('邮箱')) {
            emailError.textContent = error.message;
            emailError.classList.add('active');
        } else {
            nicknameError.textContent = error.message;
            nicknameError.classList.add('active');
        }
        registerBtn.disabled = false;
        registerBtn.textContent = '登录/注册';
    }
}

// 显示游戏容器
function showGameContainer() {
    // 重置退出标志
    isLoggedOut = false;
    
    try {
        const gameContainer = document.getElementById('gameContainer');
        const playerNicknameEl = document.getElementById('playerNickname');
        const highestScoreEl = document.getElementById('highestScore');
        
        if (gameContainer) gameContainer.classList.add('active');
        if (playerNicknameEl) playerNicknameEl.textContent = playerNickname;
        if (highestScoreEl) highestScoreEl.textContent = highestScore;
    } catch (error) {
        console.error('更新游戏界面元素失败:', error);
    }
    
    // 连接WebSocket（即使上面出错也要尝试连接）
    try {
        connectWebSocket();
    } catch (error) {
        console.error('连接WebSocket失败:', error);
    }
    
    // 初始化游戏板
    try {
        initBoard();
        drawBoard();
    } catch (error) {
        console.error('初始化游戏板失败:', error);
    }
}

// 连接WebSocket
function connectWebSocket() {
    // 如果已退出登录，不要重连
    if (isLoggedOut || !playerId) {
        return;
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}?type=player&playerId=${playerId}`;
    
    // 更新连接状态为连接中
    updateConnectionStatus('connecting');
    
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('WebSocket已连接');
        updateConnectionStatus('connected');
        
        // 启动心跳（每10秒发送一次ping）
        startHeartbeat();
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
    };

    ws.onclose = () => {
        console.log('WebSocket连接断开');
        updateConnectionStatus('disconnected');
        
        // 停止心跳
        stopHeartbeat();
        
        // 只有在未退出登录的情况下才尝试重连
        if (!isLoggedOut && playerId) {
            setTimeout(connectWebSocket, 3000);
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
        updateConnectionStatus('disconnected');
    };
}

// 更新连接状态显示
function updateConnectionStatus(status) {
    const dot = document.getElementById('connectionDot');
    const text = document.getElementById('connectionText');
    
    // 安全检查：如果元素不存在（比如已退出登录），直接返回
    if (!dot || !text) return;
    
    // 清除所有状态类
    dot.className = 'status-dot';
    
    switch (status) {
        case 'connected':
            dot.classList.add('connected');
            text.textContent = '已连接';
            text.style.color = '#4caf50';
            break;
        case 'disconnected':
            dot.classList.add('disconnected');
            text.textContent = '已断开';
            text.style.color = '#f44336';
            break;
        case 'connecting':
            dot.classList.add('connecting');
            text.textContent = '连接中...';
            text.style.color = '#ff9800';
            break;
    }
}

// SDK事件发送函数
function emitSdkEvent(event, data) {
    window.parent.postMessage({
        __sdkEvent: true,
        event: event,
        data: data
    }, '*');
}

// 启动心跳
function startHeartbeat() {
    // 清除旧的心跳定时器
    stopHeartbeat();
    
    // 每10秒发送一次心跳
    heartbeatInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
        }
    }, 10000);
    
    console.log('心跳已启动');
}

// 停止心跳
function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
        console.log('心跳已停止');
    }
}

// 处理WebSocket消息
function handleWebSocketMessage(message) {
    switch (message.type) {
        case 'pong':
            // 心跳响应，不需要处理
            break;
        case 'gameEnded':
            // 服务器通知游戏结束
            if (message.reason === 'timeout') {
                alert(message.message || '由于长时间未响应，游戏已自动结束');
                endGame();
            }
            break;
        case 'init':
        case 'rankUpdate':
            if (message.rank !== undefined) {
                document.getElementById('globalRank').textContent = `#${message.rank}`;
            }
            if (message.leaderboard) {
                updateLeaderboard(message.leaderboard);
            }
            break;
        case 'durationUpdate':
            if (message.duration !== undefined) {
                updateDurationDisplay(message.duration);
            }
            break;
        case 'captchaChallenge':
            // 获取验证码图片并转换为 data URI
            fetch(message.imageUrl)
                .then(res => res.blob())
                .then(blob => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const dataUri = reader.result;
                        captchaPending = { 
                            id: message.captchaId, 
                            dataUri: dataUri 
                        };
                        showCaptchaModal(message.captchaId, message.imageUrl);
                        // 发送验证码事件
                        emitSdkEvent('captchaRequired', { 
                            captchaId: message.captchaId,
                            imageUrl: message.imageUrl,
                            dataUri: dataUri
                        });
                    };
                    reader.readAsDataURL(blob);
                })
                .catch(err => {
                    console.error('Failed to load captcha image:', err);
                    captchaPending = { 
                        id: message.captchaId 
                    };
                    showCaptchaModal(message.captchaId, message.imageUrl);
                    emitSdkEvent('captchaRequired', { 
                        captchaId: message.captchaId,
                        imageUrl: message.imageUrl
                    });
                });
            break;
        case 'captchaVerified':
            if (message.success) {
                captchaPending = null;
                hideCaptchaModal();
                showNotification('验证通过，游戏继续！');
                emitSdkEvent('captchaVerified', { success: true });
            }
            break;
    }
}

// 显示验证码模态框
function showCaptchaModal(captchaId, imageUrl) {
    const overlay = document.getElementById('captchaOverlay');
    const img = document.getElementById('captchaImage');
    const input = document.getElementById('captchaInput');
    const error = document.getElementById('captchaError');
    
    window.currentCaptchaId = captchaId;
    
    img.src = imageUrl;
    input.value = '';
    error.textContent = '';
    
    overlay.classList.add('active');
    
    // 暂停游戏
    if (gameLoop) {
        cancelAnimationFrame(gameLoop);
        gameLoop = null;
    }
    gameState.playing = false;
    
    input.focus();
}

// 隐藏验证码模态框
function hideCaptchaModal() {
    const overlay = document.getElementById('captchaOverlay');
    overlay.classList.remove('active');
    window.currentCaptchaId = null;
}

// 刷新验证码
function refreshCaptcha() {
    const img = document.getElementById('captchaImage');
    img.src = '/api/captcha/create?playerId=' + playerId + '&t=' + Date.now();
}

// 验证验证码
async function verifyCaptcha() {
    const input = document.getElementById('captchaInput');
    const error = document.getElementById('captchaError');
    const captchaId = window.currentCaptchaId;
    const code = input.value.trim();
    
    if (!code || code.length < 4) {
        error.textContent = '请输入完整的验证码';
        return;
    }
    
    try {
        const response = await fetch('/api/captcha/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                captchaId, 
                inputCode: code,
                playerId: playerId // 添加玩家ID
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 验证成功，清除验证码状态
            captchaPending = null;
            // 恢复游戏
            hideCaptchaModal();
            gameState.playing = true;
            lastDropTime = Date.now();
            gameLoop = requestAnimationFrame(update);
        } else {
            error.textContent = result.error || '验证失败，请重试';
            input.value = '';
            input.focus();
        }
    } catch (error) {
        console.error('验证失败:', error);
        error.textContent = '验证失败，请重试';
    }
}

// 显示通知
function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #4caf50;
        color: white;
        padding: 15px 30px;
        border-radius: 8px;
        font-weight: bold;
        z-index: 3000;
        animation: fadeIn 0.3s ease-in-out;
    `;
    notification.textContent = message;
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transition = 'opacity 0.5s';
        notification.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(notification);
            document.head.removeChild(style);
        }, 500);
    }, 2000);
}

// 更新时长显示
function updateDurationDisplay(durationMs) {
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    const formatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('gameDuration').textContent = formatted;
}

// 更新排行榜
function updateLeaderboard(leaderboard) {
    const container = document.getElementById('leaderboardMini');
    
    if (!leaderboard || leaderboard.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">暂无数据</div>';
        return;
    }

    container.innerHTML = leaderboard.slice(0, 10).map((player, index) => {
        const rank = index + 1;
        const rankClass = rank <= 3 ? `rank-${rank}` : 'rank';
        const isCurrent = player.nickname === playerNickname;
        
        return `
            <div class="leaderboard-item ${isCurrent ? 'current' : ''}">
                <span>
                    <span class="${rankClass}">#${rank}</span>
                    <span style="margin-left: 10px;">${player.nickname}</span>
                </span>
                <span style="font-weight: bold;">${player.score}</span>
            </div>
        `;
    }).join('');
}

// 初始化游戏板
function initBoard() {
    gameState.board = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    gameState.score = 0;
    gameState.lines = 0;
    gameState.level = 1;
    gameState.gameOver = false;
    gameState.playing = false;
    
    updateStats();
}

// 开始游戏
async function startGame() {
    try {
        const response = await fetch('/api/game/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '开始游戏失败');
        }

        // 接收服务端分配的方块序列
        serverPieceSequence = data.pieceSequence || [];
        currentPieceIndex = 0;
        
        // 接收初始难度配置
        dropInterval = data.dropInterval || 1000;
        currentDifficulty = data.difficulty || { level: 1, name: '新手' };
        lastDifficultyLevel = currentDifficulty.level;

        initBoard();
        gameState.playing = true;
        gameState.gameOver = false;
        
        // 使用服务端分配的方块
        gameState.currentPiece = serverPieceSequence[0];
        gameState.nextPiece = serverPieceSequence[1];
        gameState.level = currentDifficulty.level;

        document.getElementById('startBtn').style.display = 'none';

        // 显示初始难度
        updateDifficultyDisplay();

        // 开始游戏循环
        lastDropTime = Date.now();
        if (gameLoop) cancelAnimationFrame(gameLoop);
        gameLoop = requestAnimationFrame(update);

    } catch (error) {
        alert(error.message);
    }
}

// 结束游戏
function endGame() {
    try {
        fetch('/api/game/end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId })
        });
        
        gameState.playing = false;
        gameState.gameOver = true;
        gameState.gameOverScore = gameState.score;
        gameState.gameOverRank = 0;
        
        if (gameLoop) {
            cancelAnimationFrame(gameLoop);
            gameLoop = null;
        }
        
        document.getElementById('startBtn').style.display = 'inline-block';
        document.getElementById('startBtn').textContent = '重新开始';
        
        // 发送结束事件给外部
        if (typeof emitSdkEvent === 'function') {
            emitSdkEvent('gameOver', {
                score: gameState.score,
                rank: 0
            });
        }
        
    } catch (error) {
        console.error('结束游戏失败:', error);
    }
}

// 从服务端获取下一个方块
async function getNextPieceFromServer() {
    try {
        const response = await fetch('/api/game/next-piece', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId })
        });

        const data = await response.json();

        if (!response.ok) {
            // 服务端检测到速度作弊
            console.error('服务端检测到异常:', data.error);
            alert('检测到异常操作！\n' + data.error);
            gameOver();
            return null;
        }

        currentPieceIndex = data.pieceIndex;
        
        // 更新下落速度（根据分数动态调整）
        if (data.dropInterval) {
            const oldInterval = dropInterval;
            dropInterval = data.dropInterval;
            
            // 如果速度变化，显示提示
            if (oldInterval !== dropInterval) {
                console.log(`难度提升！下落速度: ${oldInterval}ms → ${dropInterval}ms`);
            }
        }
        
        // 更新难度信息
        if (data.difficulty) {
            currentDifficulty = data.difficulty;
            
            // 难度等级提升时显示提示
            if (currentDifficulty.level > lastDifficultyLevel) {
                showDifficultyLevelUp(currentDifficulty);
                lastDifficultyLevel = currentDifficulty.level;
            }
            
            updateDifficultyDisplay();
        }
        
        return {
            currentPiece: data.currentPiece,
            nextPiece: data.nextPiece
        };
    } catch (error) {
        console.error('获取下一个方块失败:', error);
        // 如果获取失败，游戏结束
        gameOver();
        return null;
    }
}

// 更新难度显示
function updateDifficultyDisplay() {
    if (currentDifficulty) {
        document.getElementById('currentLevel').textContent = 
            `${currentDifficulty.level} (${currentDifficulty.name})`;
    }
}

// 显示难度提升动画
function showDifficultyLevelUp(difficulty) {
    // 创建提示元素
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 30px 50px;
        border-radius: 15px;
        font-size: 24px;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        animation: levelUpPulse 0.5s ease-in-out;
    `;
    notification.textContent = `难度提升！等级 ${difficulty.level} - ${difficulty.name}`;
    
    // 添加动画
    const style = document.createElement('style');
    style.textContent = `
        @keyframes levelUpPulse {
            0%, 100% { transform: translate(-50%, -50%) scale(1); }
            50% { transform: translate(-50%, -50%) scale(1.1); }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // 2秒后移除
    setTimeout(() => {
        notification.style.transition = 'opacity 0.5s';
        notification.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(notification);
            document.head.removeChild(style);
        }, 500);
    }, 2000);
}

// 生成随机方块（废弃，仅用于兼容）
function generatePiece() {
    const types = Object.keys(PIECES);
    const type = types[Math.floor(Math.random() * types.length)];
    
    return {
        type: type,
        shape: JSON.parse(JSON.stringify(PIECES[type])),
        color: COLORS[type],
        x: Math.floor(COLS / 2) - Math.floor(PIECES[type][0].length / 2),
        y: 0
    };
}

// 游戏更新循环
function update(timestamp) {
    if (!gameState.playing || gameState.gameOver || isGamePaused) {
        return;
    }

    // 自动下落
    const currentTime = Date.now();
    if (currentTime - lastDropTime > dropInterval) {
        moveDown();
        lastDropTime = currentTime;
    }

    drawBoard();
    drawNextPiece();
    
    // 实时推送游戏状态到服务器（每帧）
    sendGameStateToServer();

    gameLoop = requestAnimationFrame(update);
}

// 实时推送游戏状态到服务器
let lastSendTime = 0;
const SEND_INTERVAL = 50; // 每50毫秒发送一次（20fps）

function sendGameStateToServer() {
    const now = Date.now();
    
    // 限制发送频率，避免过载
    if (now - lastSendTime < SEND_INTERVAL) {
        return;
    }
    
    lastSendTime = now;
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'gameUpdate',
            gameState: {
                board: gameState.board,
                currentPiece: gameState.currentPiece,
                nextPiece: gameState.nextPiece,
                score: gameState.score,
                lines: gameState.lines,
                level: gameState.level
            }
        }));
    }
}

// 绘制游戏板
function drawBoard() {
    // 清空画布
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制已固定的方块
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (gameState.board[y][x]) {
                ctx.fillStyle = getColorForType(gameState.board[y][x]);
                ctx.fillRect(
                    x * CELL_SIZE + 1,
                    y * CELL_SIZE + 1,
                    CELL_SIZE - 2,
                    CELL_SIZE - 2
                );
            }
        }
    }

    // 绘制当前方块
    if (gameState.currentPiece) {
        ctx.fillStyle = gameState.currentPiece.color;
        const piece = gameState.currentPiece;
        
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x]) {
                    ctx.fillRect(
                        (piece.x + x) * CELL_SIZE + 1,
                        (piece.y + y) * CELL_SIZE + 1,
                        CELL_SIZE - 2,
                        CELL_SIZE - 2
                    );
                }
            }
        }
    }

    // 绘制网格线
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CELL_SIZE, 0);
        ctx.lineTo(i * CELL_SIZE, canvas.height);
        ctx.stroke();
    }
    for (let i = 0; i <= ROWS; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * CELL_SIZE);
        ctx.lineTo(canvas.width, i * CELL_SIZE);
        ctx.stroke();
    }
}

// 绘制下一个方块
function drawNextPiece() {
    if (!gameState.nextPiece) return;

    nextCtx.fillStyle = '#f5f5f5';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

    const piece = gameState.nextPiece;
    const cellSize = 25;
    const offsetX = (nextCanvas.width - piece.shape[0].length * cellSize) / 2;
    const offsetY = (nextCanvas.height - piece.shape.length * cellSize) / 2;

    nextCtx.fillStyle = piece.color;
    for (let y = 0; y < piece.shape.length; y++) {
        for (let x = 0; x < piece.shape[y].length; x++) {
            if (piece.shape[y][x]) {
                nextCtx.fillRect(
                    offsetX + x * cellSize + 1,
                    offsetY + y * cellSize + 1,
                    cellSize - 2,
                    cellSize - 2
                );
            }
        }
    }
}

// 获取方块类型对应的颜色
// 方块形状说明 (ASCII art, #=方块, .=空白):
// I: ####   O: ##     T: .#.     S: .##     Z: ##.     J: #..     L: ..#
//           O: ##           ###           ##.          .##         ###         ###
//                                                      #..
// 旋转：所有方块围绕左上角顺时针旋转90度
function getColorForType(type) {
    const typeNames = ['', 'I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    return COLORS[typeNames[type]] || '#fff';
}

// 键盘控制
function handleKeyPress(e) {
    if (!gameState.playing || gameState.gameOver) return;
    
    // P 键暂停/恢复游戏
    if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (isGamePaused) {
            handleResumeGame();
        } else {
            handlePauseGame();
        }
        return;
    }
    
    if (isGamePaused) return;

    switch (e.key) {
        case 'ArrowLeft':
            e.preventDefault();
            moveLeft();
            break;
        case 'ArrowRight':
            e.preventDefault();
            moveRight();
            break;
        case 'ArrowDown':
            e.preventDefault();
            moveDown();
            break;
        case 'ArrowUp':
            e.preventDefault();
            rotate();
            break;
        case ' ':
            e.preventDefault();
            hardDrop();
            break;
    }

    drawBoard();
    
    // 立即发送状态更新（用户操作）
    sendGameStateImmediately();
}

// 立即发送游戏状态（不受频率限制）
function sendGameStateImmediately() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'gameUpdate',
            gameState: {
                board: gameState.board,
                currentPiece: gameState.currentPiece,
                nextPiece: gameState.nextPiece,
                score: gameState.score,
                lines: gameState.lines,
                level: gameState.level
            }
        }));
    }
}

// 向左移动
function moveLeft() {
    gameState.currentPiece.x--;
    if (checkCollision()) {
        gameState.currentPiece.x++;
    }
}

// 向右移动
function moveRight() {
    gameState.currentPiece.x++;
    if (checkCollision()) {
        gameState.currentPiece.x--;
    }
}

// 向下移动
function moveDown() {
    gameState.currentPiece.y++;
    if (checkCollision()) {
        gameState.currentPiece.y--;
        lockPiece();
        return false;
    }
    return true;
}

// 旋转方块
function rotate() {
    const piece = gameState.currentPiece;
    const rotated = piece.shape[0].map((_, i) =>
        piece.shape.map(row => row[i]).reverse()
    );
    
    const originalShape = piece.shape;
    piece.shape = rotated;
    
    if (checkCollision()) {
        piece.shape = originalShape;
    }
}

// 直接落下
function hardDrop() {
    while (moveDown()) {
        // 继续下落
    }
}

// 检查碰撞
function checkCollision() {
    const piece = gameState.currentPiece;
    
    for (let y = 0; y < piece.shape.length; y++) {
        for (let x = 0; x < piece.shape[y].length; x++) {
            if (piece.shape[y][x]) {
                const newX = piece.x + x;
                const newY = piece.y + y;
                
                // 检查边界
                if (newX < 0 || newX >= COLS || newY >= ROWS) {
                    return true;
                }
                
                // 检查是否与已有方块重叠
                if (newY >= 0 && gameState.board[newY][newX]) {
                    return true;
                }
            }
        }
    }
    
    return false;
}

// 锁定方块
async function lockPiece() {
    const piece = gameState.currentPiece;
    const typeIndex = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'].indexOf(piece.type) + 1;
    
    for (let y = 0; y < piece.shape.length; y++) {
        for (let x = 0; x < piece.shape[y].length; x++) {
            if (piece.shape[y][x]) {
                const boardY = piece.y + y;
                const boardX = piece.x + x;
                
                if (boardY >= 0) {
                    gameState.board[boardY][boardX] = typeIndex;
                }
            }
        }
    }
    
    // 检查消除行
    checkLines();
    
    // 从服务端获取下一个方块
    const nextPieces = await getNextPieceFromServer();
    
    if (!nextPieces) {
        // 获取失败，游戏结束
        return;
    }
    
    // 使用服务端分配的方块
    gameState.currentPiece = nextPieces.currentPiece;
    gameState.nextPiece = nextPieces.nextPiece;
    
    // 检查游戏是否结束
    if (checkCollision()) {
        gameOver();
    } else {
        // 更新游戏状态到服务器
        sendGameUpdate();
    }
}

// 检查并消除完整的行
function checkLines() {
    let linesCleared = 0;
    
    for (let y = ROWS - 1; y >= 0; y--) {
        if (gameState.board[y].every(cell => cell !== 0)) {
            // 移除这一行
            gameState.board.splice(y, 1);
            // 在顶部添加新的空行
            gameState.board.unshift(Array(COLS).fill(0));
            linesCleared++;
            y++; // 重新检查这一行
        }
    }
    
    if (linesCleared > 0) {
        // 计算分数
        const points = [0, 100, 300, 500, 800];
        gameState.lines += linesCleared;
        gameState.score += points[linesCleared] * gameState.level;
        
        // 更新等级
        gameState.level = Math.floor(gameState.lines / 10) + 1;
        dropInterval = Math.max(100, 1000 - (gameState.level - 1) * 100);
        
        updateStats();
        
        // 发送分数更新事件
        emitSdkEvent('scoreUpdate', {
            score: gameState.score,
            lines: gameState.lines,
            level: gameState.level,
            linesCleared: linesCleared
        });
    }
}

// 更新统计信息
function updateStats() {
    // 更新游戏进展卡片
    document.getElementById('currentScore').textContent = gameState.score;
    document.getElementById('linesCleared').textContent = gameState.lines;
    document.getElementById('currentLevel').textContent = gameState.level;
    
    if (gameState.score > highestScore) {
        highestScore = gameState.score;
        document.getElementById('highestScore').textContent = highestScore;
    }
}

// 发送游戏状态更新到服务器（带方块验证）
async function sendGameUpdate() {
    try {
        const response = await fetch('/api/game/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playerId: playerId,
                gameState: {
                    board: gameState.board,
                    currentPiece: gameState.currentPiece,
                    nextPiece: gameState.nextPiece,
                    score: gameState.score,
                    lines: gameState.lines,
                    level: gameState.level
                }
                // 注意：移除了 validatePiece，因为方块验证存在时序问题
                // 防作弊通过服务端控制方块序列和下落时间验证来保证
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            // 服务器检测到作弊
            console.error('服务器验证失败:', data.error);
            alert('检测到异常操作，游戏已终止！\n' + data.error);
            gameState.gameOver = true;
            gameState.playing = false;
            if (gameLoop) {
                cancelAnimationFrame(gameLoop);
                gameLoop = null;
            }
            return;
        }
        
        if (data.success && data.highestScore !== undefined) {
            highestScore = data.highestScore;
            document.getElementById('highestScore').textContent = highestScore;
            // 最高分已保存到服务端，无需更新localStorage
        }
    } catch (error) {
        console.error('更新游戏状态失败:', error);
    }
}

// 游戏结束
async function gameOver() {
    gameState.gameOver = true;
    gameState.playing = false;
    
    if (gameLoop) {
        cancelAnimationFrame(gameLoop);
        gameLoop = null;
    }

    try {
        const response = await fetch('/api/game/end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId })
        });

        const data = await response.json();
        
        if (data.success) {
            document.getElementById('finalScore').textContent = data.finalScore;
            document.getElementById('finalRank').textContent = `#${data.rank}`;
            document.getElementById('finalHighestScore').textContent = data.highestScore;
            document.getElementById('gameOverOverlay').classList.add('active');
            
            // 发送游戏结束事件
            emitSdkEvent('gameOver', {
                score: data.finalScore,
                rank: data.rank,
                highestScore: data.highestScore
            });
        }
    } catch (error) {
        console.error('结束游戏失败:', error);
    }
}

// 再玩一局
function playAgain() {
    document.getElementById('gameOverOverlay').classList.remove('active');
    document.getElementById('startBtn').style.display = 'block';
    initBoard();
    drawBoard();
}

// ==================== SDK Bridge for Cross-Origin Communication ====================

/**
 * SDK Bridge - Handles postMessage communication for cross-origin iframe control
 */

// SDK状态管理
let sdkReady = false;
let captchaPending = null;

// Listen for postMessage from parent window (for SDK control)
window.addEventListener('message', async (event) => {
    // Don't verify origin - allow any domain
    
    const message = event.data;
    if (!message || !message.__sdkRequest) return;
    
    const { id, type, ...params } = message;
    
    try {
        let result;
        
        switch (type) {
            // 初始化
            case '__SDK_INIT__':
                sdkReady = true;
                result = { ready: true };
                break;
                
            // 获取游戏状态
            case '__SDK_GET_STATE__':
                result = handleGetState();
                break;
                
            // 方块控制
            case '__SDK_MOVE_LEFT__':
                result = handleMoveLeft();
                break;
                
            case '__SDK_MOVE_RIGHT__':
                result = handleMoveRight();
                break;
                
            case '__SDK_MOVE_DOWN__':
                result = handleMoveDown();
                break;
                
            case '__SDK_HARD_DROP__':
                result = await handleHardDrop();
                break;
                
            case '__SDK_ROTATE__':
                result = handleRotate();
                break;
                
            // 暂停游戏
            case '__SDK_PAUSE_GAME__':
                if (!playerId) {
                    throw new Error('请先登录');
                }
                if (!gameState.playing || gameState.gameOver) {
                    throw new Error('游戏未开始，无法暂停');
                }
                result = await handlePauseGame();
                break;
                
            // 恢复游戏
            case '__SDK_RESUME_GAME__':
                if (!playerId) {
                    throw new Error('请先登录');
                }
                result = await handleResumeGame();
                break;
                
            // 验证码
            case '__SDK_CAPTCHA_SUBMIT__':
                result = await handleCaptchaSubmit(params.captchaId, params.code);
                break;
                
            default:
                throw new Error(`Unknown SDK command: ${type}`);
        }
        
        // 发送成功响应
        event.source.postMessage({
            __sdkResponse: true,
            id,
            success: true,
            data: result
        }, '*');
        
    } catch (error) {
        // 发送错误响应
        event.source.postMessage({
            __sdkResponse: true,
            id,
            success: false,
            error: error.message
        }, '*');
    }
});

// SDK事件发送函数
function emitSdkEvent(event, data) {
    window.parent.postMessage({
        __sdkEvent: true,
        event: event,
        data: data
    }, '*');
}

// 处理注册
async function handleRegister(nickname, email) {
    const response = await fetch('/api/player/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, email })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Registration failed');
    
    playerId = data.player.id;
    playerNickname = data.player.nickname;
    highestScore = data.player.highestScore || 0;
    
    return { playerId, nickname, email, highestScore };
}

// 处理开始游戏
async function handleStartGame(pId, nickname, email) {
    // 如果没有 playerId，先注册
    if (!playerId) {
        await handleRegister(nickname, email);
    }
    
    // 开始游戏
    await startGame();
    
    return handleGetState();
}

// 处理获取游戏状态
function handleGetState() {
    const linesCleared = gameState.lines || 0;
    const level = gameState.level || 1;
    const score = gameState.score || 0;
    
    // 构建简化棋盘信息（0=空格，1=已占用）
    const simplifiedBoard = [];
    for (let y = 0; y < ROWS; y++) {
        simplifiedBoard[y] = [];
        for (let x = 0; x < COLS; x++) {
            const cell = gameState.board[y][x];
            simplifiedBoard[y][x] = cell === 0 ? 0 : 1;
        }
    }
    
    return {
        status: gameState.playing ? 'playing' : (gameState.gameOver ? 'finished' : 'waiting'),
        score: score,
        lines: linesCleared,
        level: level,
        currentScore: score,
        highestScore: highestScore,
        board: simplifiedBoard,
        currentPiece: gameState.currentPiece,
        nextPiece: gameState.nextPiece,
        captchaRequired: captchaPending !== null,
        captchaId: captchaPending?.id || null,
        captchaDataUri: captchaPending?.dataUri || null
    };
}

// 处理向左移动
function handleMoveLeft() {
    if (!gameState.playing || gameState.gameOver) {
        throw new Error('Game is not playing');
    }
    
    const success = moveLeft();
    drawBoard();
    
    return { success, x: gameState.currentPiece?.x || 0 };
}

// 处理向右移动
function handleMoveRight() {
    if (!gameState.playing || gameState.gameOver) {
        throw new Error('Game is not playing');
    }
    
    const success = moveRight();
    drawBoard();
    
    return { success, x: gameState.currentPiece?.x || 0 };
}

// 处理向下移动
function handleMoveDown() {
    if (!gameState.playing || gameState.gameOver) {
        throw new Error('Game is not playing');
    }
    
    const success = moveDown();
    drawBoard();
    
    return { success, y: gameState.currentPiece?.y || 0 };
}

// 处理硬降落
async function handleHardDrop() {
    if (!gameState.playing || gameState.gameOver) {
        throw new Error('Game is not playing');
    }
    
    const success = hardDrop();
    drawBoard();
    await sendGameUpdate();
    
    return { success };
}

// 处理旋转
function handleRotate() {
    if (!gameState.playing || gameState.gameOver) {
        throw new Error('Game is not playing');
    }
    
    rotate();
    drawBoard();
    
    return { success: true };
}

// 暂停游戏
async function handlePauseGame() {
    try {
        const response = await fetch('/api/game/pause', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 暂停游戏循环
            if (gameLoop) {
                cancelAnimationFrame(gameLoop);
                gameLoop = null;
            }
            isGamePaused = true;
            
            // 显示暂停状态
            const statusEl = document.getElementById('gameStatus');
            if (statusEl) {
                statusEl.textContent = '游戏已暂停 - 按 P 继续';
            }
            
            emitSdkEvent('gamePaused', { message: '游戏已暂停' });
        }
        
        return result;
    } catch (error) {
        throw new Error('暂停失败: ' + error.message);
    }
}

// 恢复游戏
async function handleResumeGame() {
    try {
        const response = await fetch('/api/game/resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId })
        });
        
        const result = await response.json();
        
        if (result.success) {
            isGamePaused = false;
            lastDropTime = Date.now();
            gameLoop = requestAnimationFrame(update);
            
            // 清除暂停状态显示
            const statusEl = document.getElementById('gameStatus');
            if (statusEl) {
                statusEl.textContent = '';
            }
            
            emitSdkEvent('gameResumed', { message: '游戏已继续' });
        }
        
        return result;
    } catch (error) {
        throw new Error('恢复失败: ' + error.message);
    }
}

// 处理验证码提交
async function handleCaptchaSubmit(captchaId, code) {
    if (!captchaPending || captchaPending.id !== captchaId) {
        throw new Error('No pending CAPTCHA challenge');
    }
    
    if (!playerId) {
        throw new Error('Player not logged in');
    }
    
    try {
        const response = await fetch('/api/captcha/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                captchaId, 
                inputCode: code,
                playerId: playerId 
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            captchaPending = null;
            // 恢复游戏
            gameState.playing = true;
            lastDropTime = Date.now();
            gameLoop = requestAnimationFrame(update);
            
            return { success: true };
        } else {
            throw new Error(result.error || 'CAPTCHA verification failed');
        }
    } catch (error) {
        throw new Error(`CAPTCHA verification failed: ${error.message}`);
    }
}

// 修改 showCaptchaModal 以支持 SDK 触发
const originalShowCaptchaModal = window.showCaptchaModal;
window.showCaptchaModal = function(captchaId, imageUrl) {
    // captchaPending 已经在 captchaChallenge 中设置了
    if (!captchaPending) {
        captchaPending = { id: captchaId };
    }
    if (originalShowCaptchaModal) {
        originalShowCaptchaModal(captchaId, imageUrl);
    } else {
        // 如果原始函数不存在（SDK模式），使用简化的处理
        const overlay = document.getElementById('captchaOverlay');
        if (overlay) {
            const img = document.getElementById('captchaImage');
            if (img) img.src = imageUrl;
            overlay.classList.add('active');
        }
        
        if (gameLoop) {
            cancelAnimationFrame(gameLoop);
            gameLoop = null;
        }
        gameState.playing = false;
    }
};

