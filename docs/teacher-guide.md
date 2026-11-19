# 導師手冊

## 課前準備（每次上課）
1. `docker compose ps` 全綠；開 `/admin/usage` 確認 Postgres、Redis、Gemini 連線正常（若顯示「MOCK 模式」代表未設 API key）。
2. 按「🔥 預熱」送 3 張測試請求。
3. 確認昨晚備份成功；磁碟剩餘 > 20%。

## 開課流程
1. **建班**（`/admin/classes`）：輸入班名、揀組別（高／低年級）。
2. **生成帳號**（`/admin/accounts`）：揀班 → 輸入前綴（如 `S4-`）+ 數量 → 生成 → **列印派發卡 PDF**（每張 A6：帳號、密碼、QR、網址）。學生掃 QR 自動填入登入。
3. **開放課堂**（`/admin/lessons`）：逐節開關，設每人配額（預設 10）與冷卻秒數（預設 60）。**逐節開放**：上一節未完成前唔好開下一節。
4. 上課：學生登入只見已開放課堂，跟平台內步驟卡完成練習。
5. **投影模式**（`/present`）：
   - `1` 作品牆（新作品即時飛入，點圖放大，❤ 加星）
   - `2` 步驟卡（大字講解）
   - `3` 示範生成（用導師帳號即場生成，不計學生配額）
   - `F` 全螢幕 · `H` 即時隱藏放大中的不當作品

## 課堂承接
每節的「揀返上一節嘅作品」面板只列出該學生前幾節正常作品。缺席學生可按「用示範作品」繼續，不卡流程。

## 安全與審核（事後審核）
- 學生即時見結果；被 SafeSearch 或分類器標記者自動入 `/admin/works` 的「待檢視」（黃框）。
- 作品牆可一鍵隱藏（學生端即時消失）、刪除、加 ❤ 或導師評語。
- 黑名單（`/admin/blacklist`）：新增攔截／標記詞，支援簡繁粵語；人類主體詞已內建。

## Prompt 引擎（`/admin/prompts`）
- 全域層（前後綴、`no humans` 防線）、課堂層模板、選項詞典逐項可編輯／停用。
- 改完**即時生效，不用重新部署**；每次儲存保留前 20 版可還原。
- 右側即時預覽 + 試生成（用 admin 配額）。

## 配額與限流（`/admin/settings`）
- `globalRpm`（Tier 1 建議 18）、`maxConcurrentJobs`（改後需重啟 worker）、每帳號每日上限、每次生成張數。
- 升到 Gemini Tier 2（專案消費 ≥ US$250 自動升級）後，把 `globalRpm` 調高即可。

## 交付（學期尾）
- `/admin/exports`：批量匯出班別作品 ZIP；一鍵產出**全班完成作**（每人一份作品集 PDF 打包 ZIP）。
- 高年級完成作 = 第 6 節故事書 PDF；低年級 = 第 6 節海報。

## 資料管理
- 無自動刪除。`/admin/data` 可按班別／日期批量刪除作品或帳號（兩步確認 + 輸入班名）。

## 更新部署（§11.5）
```bash
ssh server && cd /opt/ai-class
git fetch --tags && git checkout vX.Y.Z
docker compose -f docker-compose.prod.yml build web worker
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec web node_modules/.bin/prisma migrate deploy
```
