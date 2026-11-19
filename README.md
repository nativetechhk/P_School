# 小小 AI 探索家 — 課堂學習平台

香港小學生 AI 課堂平台（繁中介面）。學生無需 Gmail，由導師生成帳號派發；導師逐節開放內容；上一節作品自動成為下一節素材；課程結束產出作品集。完整規格見 [`../AI_CLASS_PLATFORM_SPEC.md`](../AI_CLASS_PLATFORM_SPEC.md)。

實作範圍：高年級第 3–6 節、低年級第 4–6 節。

## 技術棧

Next.js 14（App Router, standalone）· PostgreSQL 16 + Prisma · BullMQ + Redis · Gemini Developer API（`@google/genai`）· Cloud Vision REST · 本機磁碟儲存（可換 S3）· puppeteer-core 匯出 · iron-session 認證 · Docker Compose + Caddy + Cloudflare。

## 🧪 MOCK 模式

**未設 `GEMINI_API_KEY` 時平台自動進入 MOCK 模式**：生成佔位圖、跳過 SafeSearch、本地計算主色，整條管道（佇列、配額、冷卻、SSE、匯出）可完全離線測試。填入真 key 即切換到真 Gemini，無需改碼。

## 本機快速開始

### 方式 A：已裝 Node 20 + 本機 Postgres/Redis（最快）
```bash
pnpm install
cp .env.example .env            # 填 SESSION_SECRET（openssl rand -hex 32）、DATABASE_URL、REDIS_URL
createdb ai_class               # 若未有
pnpm prisma migrate dev
pnpm seed                       # 建 admin、示範班 10 帳號、匯入 prompt 種子、開放 senior-l3 / junior-l4
pnpm dev                        # web → http://localhost:3000
pnpm worker:dev                 # 另一個 terminal：佇列 worker
```

### 方式 B：Docker Compose（貼近生產）
```bash
export SESSION_SECRET=$(openssl rand -hex 32)
docker compose up -d --build
docker compose exec web node_modules/.bin/prisma migrate deploy
docker compose exec web sh -c "cd /app && node -e 'require(\"tsx/cjs\")' 2>/dev/null; npx tsx prisma/seed.ts" || true
```
> 本機開發建議用方式 A（熱重載）；Docker 用於驗證生產映像。

## 預設帳號（seed 後）

| 角色 | 登入 | 帳密 |
|---|---|---|
| 導師 | http://localhost:3000/admin/login | `admin@example.com` / `admin1234` |
| 學生（高年級） | http://localhost:3000/login | `S4-01`…`S4-10`（密碼見 seed log 或 `/admin/accounts`） |
| 學生（低年級） | 同上 | `S1-01`…`S1-10` |

投影模式：http://localhost:3000/present

## 常用指令

```bash
pnpm dev              # 開發 web
pnpm worker:dev       # 開發 worker（tsx watch）
pnpm typecheck        # tsc --noEmit
pnpm build            # 生產 build（Next standalone + worker bundle）
pnpm seed             # 本機種子（含示範班）
pnpm seed:prod        # 生產種子（只 admin + prompt）
pnpm create-admin <email> <password> [admin|assistant]
pnpm generate-accounts <classId> <prefix> <count>
```

## 部署

本機測試通過 → 推 GitHub（tag）→ 伺服器 `docker-compose.prod.yml`。詳見 [`docs/teacher-guide.md`](docs/teacher-guide.md) 與規格 §11。驗收清單：[`docs/local-acceptance.md`](docs/local-acceptance.md)。

## 目錄
- `app/` — 頁面（student / admin / present）+ API 路由
- `lib/` — 核心（auth, db, storage, prompt-engine, gemini, vision, queue, quota, safety, export, compose）
- `components/` — React 元件（student / admin）
- `worker/` — BullMQ 消費者（生成、編輯、token bucket、退避、備用模型）
- `content/` — 課堂步驟卡、prompt 種子、填色線稿
- `prisma/` — schema、seed
- `docker/`, `docker-compose*.yml` — 容器與反向代理
