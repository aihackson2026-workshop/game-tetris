// 游戏难度配置

/**
 * 难度等级系统
 * 
 * 根据分数动态调整方块下落速度
 * 人类反应时间考虑：
 * - 平均反应时间：200-300ms
 * - 游戏操作时间：需要识别、决策、操作，约 500-800ms
 * - 安全下落时间：最快不低于 200ms（留有余地）
 */

const DifficultyConfig = {
  // 基础配置
  BASE_DROP_INTERVAL: 1000,      // 初始下落间隔（毫秒）
  MIN_DROP_INTERVAL: 200,        // 最小下落间隔（人类极限）
  MAX_DROP_INTERVAL: 1000,       // 最大下落间隔
  
  // 难度等级配置
  LEVELS: [
    { score: 0,     interval: 1000, level: 1,  name: '新手' },
    { score: 500,   interval: 900,  level: 2,  name: '初级' },
    { score: 1000,  interval: 800,  level: 3,  name: '中级' },
    { score: 2000,  interval: 700,  level: 4,  name: '高级' },
    { score: 3000,  interval: 600,  level: 5,  name: '专家' },
    { score: 4000,  interval: 500,  level: 6,  name: '大师' },
    { score: 5000,  interval: 450,  level: 7,  name: '宗师' },
    { score: 6000,  interval: 400,  level: 8,  name: '传奇' },
    { score: 7000,  interval: 350,  level: 9,  name: '神话' },
    { score: 8000,  interval: 300,  level: 10, name: '至尊' },
    { score: 10000, interval: 250,  level: 11, name: '超凡' },
    { score: 15000, interval: 200,  level: 12, name: '神级' }
  ],
  
  // 速度验证配置
  SPEED_VALIDATION: {
    // 允许的速度偏差（容错率）
    TOLERANCE_RATIO: 0.5,  // 50% 容错（更宽松）
    
    // 额外允许的固定超时时间
    EXTRA_TOLERANCE_MS: 2000,  // 额外允许 2 秒超时（从1秒改为2秒）
    
    // 异常检测阈值
    SUSPICIOUS_THRESHOLD: 0.3,  // 快于70%才视为可疑（更宽松）
    SUSPICIOUS_COUNT: 8,        // 连续8次异常才判定作弊（更宽松）
    
    // 暂停检测（更宽松）
    MAX_PAUSE_TIME: 30000,      // 超过30秒未请求新方块视为暂停（从10秒改为30秒）
    PAUSE_TOLERANCE: 10         // 允许暂停10次（从5次改为10次）
  },
  
  // 根据分数获取难度配置
  getDifficultyByScore(score) {
    // 从高到低查找匹配的难度
    for (let i = this.LEVELS.length - 1; i >= 0; i--) {
      if (score >= this.LEVELS[i].score) {
        return this.LEVELS[i];
      }
    }
    return this.LEVELS[0];
  },
  
  // 计算期望的下落时间（考虑容错）
  getExpectedFallTime(score) {
    const difficulty = this.getDifficultyByScore(score);
    return {
      ideal: difficulty.interval,
      max: difficulty.interval * (1 + this.SPEED_VALIDATION.TOLERANCE_RATIO) + 
           this.SPEED_VALIDATION.EXTRA_TOLERANCE_MS, // 额外的固定容差
      level: difficulty.level,
      name: difficulty.name
    };
  },
  
  // 验证下落时间是否合法
  validateFallTime(actualTime, score) {
    const expected = this.getExpectedFallTime(score);
    
    // 注意：不再检测"下落过快"，因为玩家可以通过按向下键或空格键加速下落
    // 这是正常的游戏操作，不应该视为作弊
    // 防作弊主要依靠：
    // 1. 服务端控制方块序列
    // 2. 服务端验证消除行数和分数
    // 3. 服务端验证棋盘状态
    
    // 太慢但未超时 - 可能是玩家操作慢或网络延迟
    // 使用更宽松的判定，在合理范围内都认为是正常
    if (actualTime > expected.max && actualTime < this.SPEED_VALIDATION.MAX_PAUSE_TIME) {
      return {
        valid: true,
        reason: `方块下落较慢，可能是玩家思考或网络延迟 (${actualTime}ms)`,
        severity: 'low',
        expected: expected
      };
    }
    
    // 超时 - 可能暂停作弊
    if (actualTime > this.SPEED_VALIDATION.MAX_PAUSE_TIME) {
      return {
        valid: false,
        reason: `方块下落超时 (${actualTime}ms > ${this.SPEED_VALIDATION.MAX_PAUSE_TIME}ms)，可能暂停了游戏`,
        severity: 'high',
        expected: expected
      };
    }
    
    // 正常
    return {
      valid: true,
      reason: 'normal',
      severity: 'none',
      expected: expected
    };
  }
};

module.exports = DifficultyConfig;
