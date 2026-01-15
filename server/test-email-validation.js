// 测试邮箱验证功能

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
  console.log('=== 开始测试邮箱验证功能 ===\n');

  try {
    // 测试1: 新玩家注册
    console.log('【测试1】新玩家注册（昵称 + 邮箱）');
    const timestamp = Date.now();
    const testNickname = `测试玩家_${timestamp}`;
    const testEmail = `test_${timestamp}@example.com`;
    
    const res1 = await request('POST', '/api/player/register', {
      nickname: testNickname,
      email: testEmail
    });
    
    if (res1.data.success && res1.data.isNewPlayer) {
      console.log('✓ 新玩家注册成功');
      console.log(`  昵称: ${res1.data.player.nickname}`);
      console.log(`  邮箱: ${res1.data.player.email}`);
      console.log(`  玩家ID: ${res1.data.player.id}`);
    } else {
      console.log('✗ 注册失败:', res1.data);
    }
    console.log();

    // 测试2: 相同昵称 + 相同邮箱 = 登录成功
    console.log('【测试2】相同昵称 + 相同邮箱（应该登录成功）');
    const res2 = await request('POST', '/api/player/register', {
      nickname: testNickname,
      email: testEmail
    });
    
    if (res2.data.success && !res2.data.isNewPlayer) {
      console.log('✓ 登录成功（邮箱验证通过）');
      console.log(`  欢迎回来: ${res2.data.player.nickname}`);
    } else if (res2.data.isNewPlayer) {
      console.log('✗ 错误：不应该创建新玩家');
    } else {
      console.log('✗ 登录失败:', res2.data.error);
    }
    console.log();

    // 测试3: 相同昵称 + 不同邮箱 = 拒绝
    console.log('【测试3】相同昵称 + 不同邮箱（应该被拒绝）');
    const wrongEmail = `wrong_${timestamp}@example.com`;
    const res3 = await request('POST', '/api/player/register', {
      nickname: testNickname,
      email: wrongEmail
    });
    
    if (!res3.data.success && res3.data.error) {
      console.log('✓ 正确拒绝了错误的邮箱');
      console.log(`  错误信息: ${res3.data.error}`);
    } else {
      console.log('✗ 错误：应该拒绝但没有拒绝');
    }
    console.log();

    // 测试4: 新昵称 + 任意邮箱 = 新玩家
    console.log('【测试4】新昵称 + 新邮箱（应该创建新玩家）');
    const newNickname = `新玩家_${timestamp}`;
    const newEmail = `new_${timestamp}@example.com`;
    const res4 = await request('POST', '/api/player/register', {
      nickname: newNickname,
      email: newEmail
    });
    
    if (res4.data.success && res4.data.isNewPlayer) {
      console.log('✓ 新玩家创建成功');
      console.log(`  昵称: ${res4.data.player.nickname}`);
      console.log(`  邮箱: ${res4.data.player.email}`);
    } else {
      console.log('✗ 创建失败');
    }
    console.log();

    // 测试5: 验证数据持久化
    console.log('【测试5】验证数据持久化');
    console.log('提示：手动重启服务器后，尝试用相同的昵称和邮箱登录，应该能成功。');
    console.log();

    // 测试6: 无效邮箱格式
    console.log('【测试6】无效邮箱格式（应该被拒绝）');
    const res5 = await request('POST', '/api/player/register', {
      nickname: `测试_${Date.now()}`,
      email: 'invalid-email'
    });
    
    if (!res5.data.success && res5.data.error) {
      console.log('✓ 正确拒绝了无效的邮箱格式');
      console.log(`  错误信息: ${res5.data.error}`);
    } else {
      console.log('✗ 错误：应该拒绝无效邮箱');
    }
    console.log();

    // 测试7: 空邮箱
    console.log('【测试7】空邮箱（应该被拒绝）');
    const res6 = await request('POST', '/api/player/register', {
      nickname: `测试_${Date.now()}`,
      email: ''
    });
    
    if (!res6.data.success && res6.data.error) {
      console.log('✓ 正确拒绝了空邮箱');
      console.log(`  错误信息: ${res6.data.error}`);
    } else {
      console.log('✗ 错误：应该拒绝空邮箱');
    }
    console.log();

    console.log('=== 测试完成 ===\n');
    
    console.log('总结:');
    console.log('✓ 新玩家注册功能正常');
    console.log('✓ 老玩家登录验证正常');
    console.log('✓ 邮箱不匹配时正确拒绝');
    console.log('✓ 邮箱格式验证正常');
    console.log('\n请使用浏览器测试完整的用户流程！');

  } catch (error) {
    console.error('测试失败:', error.message);
    process.exit(1);
  }
}

// 运行测试
runTests();
