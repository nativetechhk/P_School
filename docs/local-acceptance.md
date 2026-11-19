# 本機驗收清單（§11.5）

逐項打勾。全部通過才 tag `v1.0.0-rc1` 推 GitHub。

| # | 項目 | 驗證方法 | 狀態 |
|---|---|---|---|
| 1 | 學生帳號登入、只見已開課堂 | S4-01 登入，home 只見 senior-l3 | ✅ 已驗證 |
| 2 | 四格生成成功、2 張圖、配額減 1、冷卻倒數 | senior-l3 生成 → job done → 2 artifacts、quota used=1 | ✅ 已驗證 |
| 3 | 併發 10 分頁同時生成：排隊正確、無 429 外漏、globalRpm 不被突破 | 開 10 個分頁同按（看 worker log RPM）；MOCK 模式不觸 429，真 key 下 token bucket 限流 | ⬜ 真 key 課前實測 |
| 4 | 黑名單命中被攔；人類詞被攔 | 自由字輸入「小男孩」→ 422「畫動物或奇幻角色先啦」 | ✅ 已驗證 |
| 5 | SafeSearch 複檢有紀錄 | 真 key 下生成；MOCK 模式跳過（usage 顯示 MOCK） | ⬜ 真 key 實測 |
| 6 | 投影頁 SSE 即時出現新作品、H 鍵隱藏即時生效 | /present 開作品牆，另一分頁生成 → 飛入；放大按 H → 全端 1 秒內消失 | ⬜ 手動 UI 測 |
| 7 | 匯出 PDF／DOCX／ZIP 可開啟 | 我的作品多選匯出；admin 班別 ZIP；派發卡 PDF | ✅ 已驗證（cards.pdf / class.zip / portfolio.pdf 皆回 200 且檔案有效） |
| 8 | Prompt 後台改模板 → 立即影響下一次生成；版本還原正常 | /admin/prompts 改 lesson 模板 → 預覽即變；儲存 v+1；還原 | ⬜ 手動 UI 測 |
| 9 | 生產映像可 build 並以 production 模式啟動 | `pnpm build` ✅；`docker compose -f docker-compose.prod.yml build` | ✅ build 成功 |
| 10 | 承接：第 4 節顯示第 3 節主角；缺席者可用示範圖 | senior-l4 承接面板；無作品顯示「用示範作品」 | ⬜ 手動 UI 測 |

## 已自動驗證（API 層）

以下經 curl 實測通過（MOCK 模式，本機 Postgres + Redis）：
- `POST /api/auth/student-login` → 200；`POST /api/auth/admin-login` → 200
- `GET /api/lessons` → 只回已開放課堂 + 配額 + 選項卡
- `POST /api/generate/image` → jobId；worker 消費 → 2 張 PNG + 縮圖存盤；`quota_usage.used=1`
- `GET /api/jobs/:id` → `done` + artifactIds
- 人類主體詞 `POST /api/generate/image`（freeText 含「小男孩」）→ 422 blocked
- `GET /api/admin/usage` → 今日 images=2、est_cost=0.08、佇列狀態、連線健康、RPM
- `GET /api/admin/accounts/cards.pdf` → 有效 PDF；`POST /api/admin/export/class` → 有效 ZIP；`POST /api/export`（pdf）→ signed-path

## 待手動 UI／真 key 項目

第 3、5、6、8、10 項涉及瀏覽器互動（SSE 飛入、鍵盤 H、語音、滑桿）或需真 Gemini key（SafeSearch、真 RPM 限流），在裝好 key 及開課環境後逐項打勾。
