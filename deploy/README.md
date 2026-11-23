# 伺服器部署（systemd，併入既有 Caddy/Postgres/Redis）

此伺服器已有系統 Caddy（80/443）、PostgreSQL、Redis 服務供其他專案使用，**不用 Docker**，以免與既有 Caddy 搶 80/443。本專案以 systemd 服務方式併入，重用既有 Postgres／Redis（各自隔離 DB），並在既有 Caddyfile 加一個站台區塊。

## 一次性

```bash
# 1. 專用系統使用者 + 目錄
sudo useradd -r -m -d /opt/pschool -s /usr/sbin/nologin pschool || true
sudo mkdir -p /opt/pschool/data/uploads

# 2. 取碼（repo 為 public，可用 HTTPS）
sudo git clone https://github.com/nativetechhk/P_School.git /tmp/pschool-src
sudo cp -r /tmp/pschool-src/ai-class-platform/. /opt/pschool/

# 3. 隔離的 Postgres DB + 使用者（與其他專案分開）
sudo -u postgres psql -c "CREATE USER pschool WITH PASSWORD '<強密碼>';"
sudo -u postgres psql -c "CREATE DATABASE ai_class OWNER pschool;"

# 4. Chromium（匯出 PDF 用）— 裝 Google Chrome stable（避開 snap）
curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | sudo gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt-get update && sudo apt-get install -y google-chrome-stable

# 5. .env（chmod 600；Redis 用獨立 DB 4 隔離其他專案）
sudo tee /opt/pschool/.env >/dev/null <<EOF
DATABASE_URL=postgresql://pschool:<強密碼>@127.0.0.1:5432/ai_class
REDIS_URL=redis://127.0.0.1:6379/4
STORAGE_PATH=/opt/pschool/data/uploads
APP_URL=https://pschool.nativel.ink
SESSION_SECRET=$(openssl rand -hex 32)
COOKIE_SECURE=true
CHROME_PATH=/usr/bin/google-chrome
GEMINI_API_KEY=
GOOGLE_API_KEY=
WORKER_CONCURRENCY=3
EOF
sudo chmod 600 /opt/pschool/.env && sudo chown pschool:pschool /opt/pschool/.env

# 6. 安裝依賴 + build
cd /opt/pschool
sudo -u pschool bash -lc 'pnpm install --prod=false && pnpm prisma generate && pnpm prisma migrate deploy && pnpm build && pnpm worker:build'
# standalone 需要靜態 + public
sudo -u pschool cp -r /opt/pschool/.next/static /opt/pschool/.next/standalone/.next/
sudo -u pschool cp -r /opt/pschool/public /opt/pschool/.next/standalone/
sudo chown -R pschool:pschool /opt/pschool

# 7. seed（只建 admin + 匯入 prompt，不建示範班）
sudo -u pschool bash -lc 'cd /opt/pschool && ADMIN_EMAIL=<admin電郵> ADMIN_PASSWORD=<admin密碼> pnpm seed:prod'

# 8. systemd 服務
sudo cp /opt/pschool/deploy/pschool-web.service /etc/systemd/system/
sudo cp /opt/pschool/deploy/pschool-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now pschool-web pschool-worker

# 9. Caddy：把 docker/Caddyfile 的 pschool 區塊加進 /etc/caddy/Caddyfile（reverse_proxy 127.0.0.1:3210）
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## 更新部署

以 fresh clone + rsync（**必須 `--delete`**，否則 repo 已刪除的檔案會殘留並被重新編譯）：

```bash
rm -rf /tmp/P_School && git clone --depth 1 https://github.com/nativetechhk/P_School.git /tmp/P_School
# --delete 會清走 repo 已移除的檔案；excludes 保護 node_modules/.next/dist/data/.env
rsync -a --delete --exclude ".git" --exclude "node_modules" --exclude ".next" --exclude "dist" --exclude "/data/" --exclude ".env" /tmp/P_School/ /opt/pschool/
cd /opt/pschool
corepack pnpm install --no-frozen-lockfile && corepack pnpm prisma generate && corepack pnpm prisma migrate deploy
NODE_OPTIONS=--max-old-space-size=2048 corepack pnpm build && corepack pnpm worker:build
cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
chown -R pschool:pschool /opt/pschool
systemctl restart pschool-web pschool-worker
```

### 更新 prompt 模板（例如改畫家）
`corepack pnpm exec tsx prisma/seed.ts --prod` 會以 overwrite 匯入 `content/prompt_templates.seed.json` 並清走已移除的選項集。
⚠️ 此指令會 upsert 一個預設 `admin@example.com` staff（ADMIN_EMAIL 預設值）——跑完請刪除，避免預設帳號殘留：
`psql ... -c "DELETE FROM staff WHERE email='admin@example.com';"`（正式 admin 帳號為 `admin`）。

### v2.3 → v2.4 課堂 ID 遷移（一次性，已於上線時執行）
`corepack pnpm exec tsx scripts/migrate-lesson-ids.ts`（把舊 lesson_access/artifacts/quota 的課堂 ID 改成新 ID）。

## API key
部署時 `.env` 的 `GEMINI_API_KEY` 可留空；登入 `/admin/settings` 貼上 key 即可（DB 優先、免重啟、可隨時更換／清除）。
