#!/usr/bin/env bash
# 每日備份（§8）：pg_dump + uploads rsync，保留 14 日。加入 crontab 03:00。
set -euo pipefail
BACKUP_DIR="${BACKUP_DIR:-/opt/ai-class/backups}"
STAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

# DB
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-aiclass}" ai_class | gzip > "$BACKUP_DIR/db_$STAMP.sql.gz"

# uploads（volume 內容；透過一次性容器打包）
docker run --rm -v ai-class_uploads:/data -v "$BACKUP_DIR":/backup alpine \
  tar czf "/backup/uploads_$STAMP.tar.gz" -C /data . 2>/dev/null || \
  echo "[backup] uploads volume 名稱可能不同，請確認 docker volume ls"

# 清理 14 日前
find "$BACKUP_DIR" -name '*.gz' -mtime +14 -delete
echo "[backup] done: $STAMP"
