# [已存檔] Google Apps Script (GAS) 遷移計畫書
> **注意**：本文件內容已整合至 [README.md](README.md)，僅供歷史查閱。

## 狀態：✅ 已完成 (2026-05-10)

---

## 1. 遷移目標
將法拍投資系統從「GAS 爬蟲 + Supabase 資料庫 + 前端網頁」架構，完整遷移至「GAS 爬蟲 + Google 試算表 + GAS Web App」架構。

- **廢除項目**：Supabase Auth、Supabase Database、Supabase Edge Functions/RPC。
- **保留項目**：現有 UI 介面 (HTML/CSS)、GAS 爬蟲邏輯。
- **新機制**：Google 試算表作為唯一資料庫，`Session.getActiveUser()` 進行身分驗證。

---

## 2. 修改完成的檔案

### A. `法拍清單(一般).gs`
- 標題列新增 5 欄（第 21–25 欄，黃色標示）
- 爬蟲主迴圈加入計算邏輯（`Math.ceil(面積m2 × 6)` / ROI）
- 刪除 `syncToSupabase` 函數及所有呼叫

### B. `法拍清單(應買).gs`
- 同上（新增 5 欄 + 計算邏輯）
- 底價欄改存純數字（原為 `toLocaleString()` 字串）
- 刪除 `syncToSupabase` 呼叫

### C. `後端.gs`
- `COL` 常數擴充至 25 欄（索引 0–24）
- 新增 `checkUserRole(email)` 讀取「會員名單」工作表
- `getSheetData()` 回傳 `userEmail`、`userRole`，並依權限切片資料
- `extractData()` 返回完整欄位（含布林值 `is_handover`、`is_empty_land`）

### D. `index.html`
- 移除 Supabase JS SDK `<script>` 引用
- 移除 Email/密碼登入 Modal
- 資料改用 `google.script.run.getSheetData()` 取得
- Header 顯示 Google Email 與權限等級（或「訪客模式」）

---

## 3. 試算表欄位結構（共 25 欄）

| 欄 | 欄位名稱 | 說明 |
|---|---------|------|
| A–T (0–19) | 原有欄位 | 筆次、法院、案號、股別、日期、拍次、縣市、地址、面積、底價、點交、空地、標別、看圖、備註、通訊投標、污染、地圖、空、單價 |
| U (20) | **預估補償金** | `Math.ceil(面積m2 × 6)` |
| V (21) | **ROI (%)** | `補償金 / 底價 × 100` |
| W (22) | **PDF 連結** | 原始 URL 字串 |
| X (23) | **是否點交** | "是" / "否" |
| Y (24) | **是否空地** | "是" / "否" |

---

## 4. 會員名單工作表格式

工作表名稱：`會員名單`

| Email (A欄) | 權限等級 (B欄) |
|:------------|:-------------|
| admin@gmail.com | pro |
| user@gmail.com | free |

權限切片規則：
- `visitor`（查無此 Email）：回傳 3 筆
- `free`：回傳 10 筆
- `pro`：回傳全部

---

## 5. 快取機制

- 快取 Key：`auction_data_v3`（Script Cache，共用）
- TTL：5 分鐘
- 快取完整資料集，權限切片在回傳時執行（非快取時）
---

## 6. GitHub Pages 前後端分離架構

前端部署於 GitHub Pages，GAS 作為純 JSON API 後端。

### A. 後端 (`後端.gs`) — ✅ 已完成

- `doGet(e)` 改為 JSON API，廢棄原 `HtmlService` 回傳
- 接受 `?email=xxx` query 參數，查詢「會員名單」決定角色後切片資料
- 以 `ContentService.createTextOutput(JSON.stringify(...)).setMimeType(JSON)` 回傳
- CORS 由 GAS 部署設定「存取權：所有人」自動處理
- 錯誤時回傳 `{ error: "..." }` JSON

### B. 前端 (`index.html`, `live_site.html`) — ✅ 已完成

- 移除 `<base target="_top">` 與所有 `google.script.run` 呼叫
- Script 頂端 `var WEB_APP_URL = '';`，填入 GAS 部署網址即可運作
- 未填 URL 時顯示黃色設定提示與部署步驟說明
- Email 登入 Modal：點擊 Header 右側按鈕輸入，存入 `localStorage` 持久化
- 每次 `fetch` 自動帶入 `?email=...`，重新整理不需重新輸入
- Skeleton Loading 動畫 + 載入失敗明確錯誤訊息

### C. 部署步驟

1. GAS 編輯器 → 部署 → 新增部署 → 類型「網頁應用程式」→ 存取權「所有人」→ 複製網址
2. 在 `index.html` / `live_site.html` 頂端填入：`var WEB_APP_URL = 'https://script.google.com/macros/s/YOUR_ID/exec';`
3. 推送至 GitHub，啟用 GitHub Pages（branch: main, folder: `/`）

### D. 身分驗證說明

採用 `localStorage` + URL 參數方案（低安全性，適合私人小型系統）：
- 前端將 email 存入 `localStorage('auction_email')`
- 每次 fetch 附帶 `?email=xxx` 參數
- GAS 後端比對「會員名單」工作表決定資料切片筆數（visitor: 3 / free: 10 / pro: 全部）
