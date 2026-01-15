#!/bin/bash

# 数据管理脚本

# 加载 nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

BASE_URL="http://localhost:3001"

case "$1" in
  stats)
    echo "=== 存储统计信息 ==="
    curl -s "$BASE_URL/api/storage/stats" | node -e "const data=require('fs').readFileSync(0,'utf8'); console.log(JSON.stringify(JSON.parse(data), null, 2))"
    ;;
  
  save)
    echo "=== 手动保存数据 ==="
    curl -s -X POST "$BASE_URL/api/storage/save" | node -e "const data=require('fs').readFileSync(0,'utf8'); console.log(JSON.stringify(JSON.parse(data), null, 2))"
    ;;
  
  backup)
    echo "=== 创建备份 ==="
    curl -s -X POST "$BASE_URL/api/storage/backup" | node -e "const data=require('fs').readFileSync(0,'utf8'); console.log(JSON.stringify(JSON.parse(data), null, 2))"
    ;;
  
  leaderboard)
    echo "=== 排行榜 ==="
    curl -s "$BASE_URL/api/leaderboard" | node -e "const data=require('fs').readFileSync(0,'utf8'); const json = JSON.parse(data); console.log('总玩家数:', json.all.length); json.all.slice(0, 10).forEach((p, i) => console.log(\`\${i+1}. \${p.nickname} - \${p.score}分 [\${p.status}]\`))"
    ;;
  
  list-backups)
    echo "=== 备份文件列表 ==="
    ls -lh data/players_backup_*.json 2>/dev/null || echo "暂无备份文件"
    ;;
  
  view-data)
    echo "=== 查看数据文件 ==="
    if [ -f "data/players.json" ]; then
      cat data/players.json | node -e "const data=require('fs').readFileSync(0,'utf8'); console.log(JSON.stringify(JSON.parse(data), null, 2))"
    else
      echo "数据文件不存在"
    fi
    ;;
  
  *)
    echo "数据管理脚本"
    echo ""
    echo "用法: $0 <command>"
    echo ""
    echo "可用命令:"
    echo "  stats         - 查看存储统计信息"
    echo "  save          - 手动保存数据"
    echo "  backup        - 创建数据备份"
    echo "  leaderboard   - 查看排行榜"
    echo "  list-backups  - 列出所有备份文件"
    echo "  view-data     - 查看原始数据文件"
    echo ""
    echo "示例:"
    echo "  $0 stats"
    echo "  $0 backup"
    ;;
esac
