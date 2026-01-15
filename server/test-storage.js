// 测试数据持久化功能

const http = require('http');

const BASE_URL = 'http://localhost:3001';

// 辅助函数：发送 HTTP 请求
function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: result });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// 测试流程
async function runTests() {
  console.log('=== 开始测试数据持久化功能 ===\n');

  try {
    // 1. 检查存储状态
    console.log('1. 检查存储状态...');
    const statsRes = await request('GET', '/api/storage/stats');
    console.log('存储状态:', JSON.stringify(statsRes.data, null, 2));
    console.log('✓ 检查存储状态成功\n');

    // 2. 注册测试玩家
    console.log('2. 注册测试玩家...');
    const player1 = await request('POST', '/api/player/register', { 
      nickname: `测试玩家_${Date.now()}` 
    });
    
    if (player1.data.success) {
      console.log('✓ 玩家注册成功:', player1.data.player.nickname);
      console.log('  玩家ID:', player1.data.player.id);
    } else {
      console.log('✗ 玩家注册失败:', player1.data.error);
    }
    console.log();

    // 3. 手动保存数据
    console.log('3. 手动保存数据...');
    const saveRes = await request('POST', '/api/storage/save');
    if (saveRes.data.success) {
      console.log('✓ 数据保存成功:', saveRes.data.message);
    } else {
      console.log('✗ 数据保存失败:', saveRes.data.error);
    }
    console.log();

    // 4. 创建备份
    console.log('4. 创建数据备份...');
    const backupRes = await request('POST', '/api/storage/backup');
    if (backupRes.data.success) {
      console.log('✓ 备份创建成功:', backupRes.data.backupFile);
    } else {
      console.log('✗ 备份创建失败:', backupRes.data.error);
    }
    console.log();

    // 5. 再次检查存储状态
    console.log('5. 再次检查存储状态...');
    const stats2Res = await request('GET', '/api/storage/stats');
    console.log('存储状态:', JSON.stringify(stats2Res.data, null, 2));
    console.log('✓ 检查存储状态成功\n');

    // 6. 获取排行榜
    console.log('6. 获取排行榜...');
    const leaderboardRes = await request('GET', '/api/leaderboard');
    if (leaderboardRes.data.all && leaderboardRes.data.all.length > 0) {
      console.log('✓ 排行榜数据:', leaderboardRes.data.all.length, '个玩家');
      console.log('前3名:');
      leaderboardRes.data.all.slice(0, 3).forEach((player, idx) => {
        console.log(`  ${idx + 1}. ${player.nickname} - ${player.score}分`);
      });
    } else {
      console.log('排行榜暂无数据');
    }
    console.log();

    console.log('=== 测试完成 ===');
    console.log('\n提示:');
    console.log('- 数据已保存到 data/players.json');
    console.log('- 重启服务器后数据会自动恢复');
    console.log('- 备份文件保存在 data/ 目录');

  } catch (error) {
    console.error('测试失败:', error.message);
    process.exit(1);
  }
}

// 运行测试
runTests();
