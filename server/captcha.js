// 验证码生成工具

const CAPTCHA_CONFIG = {
  length: 4,
  width: 150,
  height: 50,
  fontSize: 30,
  expirationTime: 120000, // 2分钟过期
  challengeProbability: 0.005 // 每次请求有5%概率触发验证码
};

// 存储验证码
const captchaStore = new Map();

const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

// 生成随机字符串
function generateRandomString(length) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 生成随机颜色
function randomColor(min = 50, max = 200) {
  const r = Math.floor(Math.random() * (max - min) + min);
  const g = Math.floor(Math.random() * (max - min) + min);
  const b = Math.floor(Math.random() * (max - min) + min);
  return `rgb(${r},${g},${b})`;
}

// 生成验证码图片（返回 Buffer）
function generateCaptchaImage(code) {
  const canvas = Buffer.alloc ? Buffer.alloc(200) : Buffer.from([]);
  // 使用简单的SVG代替Canvas，避免依赖问题
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${CAPTCHA_CONFIG.width}" height="${CAPTCHA_CONFIG.height}">
      <rect width="100%" height="100%" fill="white"/>
      <line x1="0" y1="${Math.random() * CAPTCHA_CONFIG.height}" x2="${CAPTCHA_CONFIG.width}" y2="${Math.random() * CAPTCHA_CONFIG.height}" stroke="gray" stroke-width="1"/>
      <line x1="0" y1="${Math.random() * CAPTCHA_CONFIG.height}" x2="${CAPTCHA_CONFIG.width}" y2="${Math.random() * CAPTCHA_CONFIG.height}" stroke="gray" stroke-width="1"/>
      <line x1="0" y1="${Math.random() * CAPTCHA_CONFIG.height}" x2="${CAPTCHA_CONFIG.width}" y2="${Math.random() * CAPTCHA_CONFIG.height}" stroke="gray" stroke-width="1"/>
      <text x="20" y="${CAPTCHA_CONFIG.height - 10}" font-family="Arial" font-size="${CAPTCHA_CONFIG.fontSize}" fill="#333">
        ${code.split('').map((char, i) => {
          const rotation = (Math.random() - 0.5) * 0.5;
          const x = 25 + i * 28;
          const y = CAPTCHA_CONFIG.fontSize + 5;
          return `<tspan x="${x}" y="${y}" transform="rotate(${rotation * 180 / Math.PI}, ${x}, ${y})">${char}</tspan>`;
        }).join('')}
      </text>
      <circle cx="${Math.random() * CAPTCHA_CONFIG.width}" cy="${Math.random() * CAPTCHA_CONFIG.height}" r="2" fill="gray"/>
      <circle cx="${Math.random() * CAPTCHA_CONFIG.width}" cy="${Math.random() * CAPTCHA_CONFIG.height}" r="2" fill="gray"/>
      <circle cx="${Math.random() * CAPTCHA_CONFIG.width}" cy="${Math.random() * CAPTCHA_CONFIG.height}" r="2" fill="gray"/>
    </svg>
  `;
  return Buffer.from(svg);
}

// 生成验证码图片的 Data URI
function generateCaptchaDataUri(code) {
  const svgBuffer = generateCaptchaImage(code);
  const base64 = svgBuffer.toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

// 生成验证码
function createCaptcha(playerId) {
  const code = generateRandomString(CAPTCHA_CONFIG.length);
  const captchaId = `captcha_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const captcha = {
    id: captchaId,
    code: code,
    playerId: playerId,
    createdAt: Date.now(),
    expiresAt: Date.now() + CAPTCHA_CONFIG.expirationTime
  };
  
  captchaStore.set(captchaId, captcha);
  
  // 清理过期验证码
  cleanupExpiredCaptchas();
  
  return captcha;
}

// 验证验证码
function verifyCaptcha(captchaId, inputCode) {
  const captcha = captchaStore.get(captchaId);
  
  if (!captcha) {
    return { valid: false, error: '验证码不存在或已过期' };
  }
  
  if (Date.now() > captcha.expiresAt) {
    captchaStore.delete(captchaId);
    return { valid: false, error: '验证码已过期' };
  }
  
  if (inputCode.toLowerCase() !== captcha.code.toLowerCase()) {
    return { valid: false, error: '验证码错误' };
  }
  
  // 验证成功，删除验证码
  captchaStore.delete(captchaId);
  return { valid: true };
}

// 清理过期验证码
function cleanupExpiredCaptchas() {
  const now = Date.now();
  for (const [id, captcha] of captchaStore) {
    if (now > captcha.expiresAt) {
      captchaStore.delete(id);
    }
  }
}

// 判断是否应该触发验证码
function shouldTriggerCaptcha(playerId, currentScore, speedViolations) {
  // 基于分数：每500分有概率触发
  const scoreProbability = Math.min(0.1, Math.floor(currentScore / 500) * 0.02);
  
  // 基于违规次数：有违规时提高概率
  const violationBonus = speedViolations * 0.05;
  
  // 基础概率 + 分数加成 + 违规加成
  const totalProbability = CAPTCHA_CONFIG.challengeProbability + scoreProbability + violationBonus;
  
  // 每次消除行时检查
  return Math.random() < totalProbability;
}

// 定时清理过期验证码
setInterval(cleanupExpiredCaptchas, 60000);

module.exports = {
  createCaptcha,
  verifyCaptcha,
  shouldTriggerCaptcha,
  generateCaptchaImage,
  generateCaptchaDataUri,
  captchaStore, // 导出验证码存储，供图片API使用
  CAPTCHA_CONFIG
};
