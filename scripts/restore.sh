#!/usr/bin/env bash
# 還原（§8）：restore.sh db_YYYYMMDD.sql.gz [uploads_YYYYMMDD.tar.gz]
set -euo pipefail
DB_FILE="${1:?用法: restore.sh <db.sql.gz> [uploads.tar.gz]}"
UP_FILE="${2:-}"

echo "還原資料庫 $DB_FILE …"
gunzip -c "$DB_FILE" | docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U "${POSTGRES_USER:-aiclass}" ai_class

if [ -n "$UP_FILE" ]; then
  echo "還原 uploads $UP_FILE …"
  docker run --rm -v ai-class_uploads:/data -v "$(dirname "$UP_FILE")":/backup alpine \
    sh -c "cd /data && tar xzf /backup/$(basename "$UP_FILE")"
fi
echo "還原完成。"
