# 模型測試紀錄

用於記錄不同模型／prompt 模板的效果，方便追查「為何那天效果變差」。artifact 會記錄生成時的 `template_version`。

## 圖生圖大師風格成功率（M4 驗收目標：三位大師各 ≥80%）

填入真 `GEMINI_API_KEY` 後，於 `/admin/prompts` 對 senior-l5 逐位大師「試生成」10 次，記錄成功（構圖保留 + 風格明顯）次數。

| 大師 | 測試次數 | 成功 | 成功率 | 備註 |
|---|---|---|---|---|
| 梵谷 m_vangogh | | | | |
| 莫內 m_monet | | | | |
| 畢卡索 m_picasso | | | | |
| 水彩繪本 m_storybook | | | | |

## 文生圖品質抽查（senior-l3 / senior-l4）

| 日期 | lesson | template_version | 樣本數 | 觀察 |
|---|---|---|---|---|
| | | | | |

## 備用模型切換（imagen-4.0-fast）

| 情境 | 觸發 | 結果 |
|---|---|---|
| 429 退避 3 次後切 imagen | | |

## MOCK 模式

未設 API key 時所有生成回傳佔位圖，供離線測試管道；此表只在真 key 下填寫。
