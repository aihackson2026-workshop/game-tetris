// 数据持久化模块 - 使用本地 JSON 文件存储

const fs = require('fs');
const path = require('path');

class DataStorage {
  constructor() {
    this.dataDir = path.join(__dirname, 'data');
    this.playersFile = path.join(this.dataDir, 'players.json');
    this.ensureDataDirectory();
  }

  // 确保数据目录存在
  ensureDataDirectory() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      console.log('数据目录已创建:', this.dataDir);
    }
  }

  // 加载所有玩家数据
  loadPlayers() {
    try {
      if (fs.existsSync(this.playersFile)) {
        const data = fs.readFileSync(this.playersFile, 'utf8');
        const parsed = JSON.parse(data);
        
        console.log(`从文件加载了 ${parsed.players ? parsed.players.length : 0} 个玩家数据`);
        
        return {
          players: parsed.players || [],
          nicknames: parsed.nicknames || []
        };
      }
    } catch (error) {
      console.error('加载玩家数据失败:', error.message);
    }
    
    return {
      players: [],
      nicknames: []
    };
  }

  // 保存所有玩家数据
  savePlayers(playersMap, nicknamesSet, nicknameEmailMap = null) {
    try {
      // 将 Map 转换为数组
      const playersArray = Array.from(playersMap.values()).map(player => ({
        id: player.id,
        nickname: player.nickname,
        email: player.email, // 保存邮箱
        currentScore: player.currentScore,
        highestScore: player.highestScore,
        status: player.status,
        startTime: player.startTime,
        endTime: player.endTime,
        history: player.history || []
      }));

      // 将 Set 转换为数组
      const nicknamesArray = Array.from(nicknamesSet);

      const data = {
        players: playersArray,
        nicknames: nicknamesArray,
        lastUpdated: new Date().toISOString()
      };

      // 写入文件（使用临时文件防止写入中断导致数据损坏）
      const tempFile = this.playersFile + '.tmp';
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
      
      // 原子性替换文件
      fs.renameSync(tempFile, this.playersFile);
      
      console.log(`已保存 ${playersArray.length} 个玩家数据到文件`);
      return true;
    } catch (error) {
      console.error('保存玩家数据失败:', error.message);
      return false;
    }
  }

  // 异步保存（防止阻塞主线程）
  async savePlayersAsync(playersMap, nicknamesSet, nicknameEmailMap = null) {
    return new Promise((resolve, reject) => {
      try {
        const playersArray = Array.from(playersMap.values()).map(player => ({
          id: player.id,
          nickname: player.nickname,
          email: player.email, // 保存邮箱
          currentScore: player.currentScore,
          highestScore: player.highestScore,
          status: player.status,
          startTime: player.startTime,
          endTime: player.endTime,
          history: player.history || []
        }));

        const nicknamesArray = Array.from(nicknamesSet);

        const data = {
          players: playersArray,
          nicknames: nicknamesArray,
          lastUpdated: new Date().toISOString()
        };

        const tempFile = this.playersFile + '.tmp';
        
        fs.writeFile(tempFile, JSON.stringify(data, null, 2), 'utf8', (err) => {
          if (err) {
            reject(err);
            return;
          }

          fs.rename(tempFile, this.playersFile, (err) => {
            if (err) {
              reject(err);
              return;
            }

            console.log(`已异步保存 ${playersArray.length} 个玩家数据`);
            resolve(true);
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // 备份数据
  backupData() {
    try {
      if (fs.existsSync(this.playersFile)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(this.dataDir, `players_backup_${timestamp}.json`);
        fs.copyFileSync(this.playersFile, backupFile);
        console.log('数据备份成功:', backupFile);
        
        // 清理旧备份（保留最近10个）
        this.cleanOldBackups();
        
        return backupFile;
      }
    } catch (error) {
      console.error('备份数据失败:', error.message);
    }
    return null;
  }

  // 清理旧备份文件
  cleanOldBackups() {
    try {
      const files = fs.readdirSync(this.dataDir)
        .filter(file => file.startsWith('players_backup_'))
        .map(file => ({
          name: file,
          path: path.join(this.dataDir, file),
          time: fs.statSync(path.join(this.dataDir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      // 保留最近10个备份
      if (files.length > 10) {
        files.slice(10).forEach(file => {
          fs.unlinkSync(file.path);
          console.log('删除旧备份:', file.name);
        });
      }
    } catch (error) {
      console.error('清理备份失败:', error.message);
    }
  }

  // 获取数据统计信息
  getStats() {
    try {
      if (fs.existsSync(this.playersFile)) {
        const stats = fs.statSync(this.playersFile);
        const data = JSON.parse(fs.readFileSync(this.playersFile, 'utf8'));
        
        return {
          exists: true,
          size: stats.size,
          modified: stats.mtime,
          playerCount: data.players ? data.players.length : 0,
          lastUpdated: data.lastUpdated || null
        };
      }
    } catch (error) {
      console.error('获取统计信息失败:', error.message);
    }
    
    return {
      exists: false,
      size: 0,
      modified: null,
      playerCount: 0,
      lastUpdated: null
    };
  }
}

// 导出单例
const dataStorage = new DataStorage();
module.exports = dataStorage;
