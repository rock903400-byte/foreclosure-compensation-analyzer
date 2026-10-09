# AGENTS.md — 法拍補償 PRO

## 專案結構

```
法拍清單(一般).gs   → 爬蟲：抓一般法拍資料 (saletype=1)
法拍清單(應買).gs   → 爬蟲：抓應買資料 (saletype=4)
後端.gs             → Web App API 入口 (doGet), 讀 Sheet → JSON
常數.gs             → CONST_KEYWORDS (47 偏鄉關鍵字) + CONST_VERSION + notifyError()
index.html          → 前端（GitHub Pages 部署）
live_site.html      → 前端模板（WIP, WEB_APP_URL 留空）
*.py                → Legacy 分析腳本，非必要勿改
```

## 版本管理

三處需同步更新：
- `常數.gs:3` → `CONST_VERSION`（後端 API 回傳）
- `index.html:245` → `APP_VERSION`（前端比對基準）
- `index.html:247` → `WEB_APP_URL`（部署新版後更新網址）

前端載入時比對 `data.version` vs `APP_VERSION`，不符時 toast 提示重整。

## API 關鍵行為

- `saletype=1` = 一般程序，`saletype=4` = 應買/特別程序
- 篩選：只追蹤 47 偏鄉（`CONST_KEYWORDS`）、持分須為「全部」
- 計算：補償金 = `ceil(面積m² × 6)`、ROI = 補償金 / 底價 × 100
- 權限：visitor=3 筆、free=10 筆、pro=無限
- 快取：分段快取（ChunkedCache）突破 GAS 100KB 限制，TTL=5 分鐘

## 拍次映射

```
"1":"第一拍","2":"第二拍","3":"第三拍","4":"第四拍",
"5":"第五拍","6":"第六拍","7":"第七拍","8":"第八拍","9":"第九拍",
"99":"公告"
```

## 錯誤通知

四處觸發（標題 / 上下文 step 名）：
- `Session 更新失敗` / `refreshSession` → `refreshSession()` 內 `UrlFetchApp.fetch` 丟例外（含 3 次重試仍失敗）
- `refreshSession 失敗` / `runAllUpdate` → `runAllUpdate()` 拿不到憑證，本次跳過抓取、舊表保留
- `一般清單抓取失敗` / `scrapeGeneral`、`應買清單抓取失敗` / `scrapeBuy`
通知信箱存放於「設定(驗證資訊)」B4，預設 fallback 至 `rock90340@gmail.com`

## 部署

```bash
clasp push                    # 上傳 .gs + .html 到 GAS
clasp deploy -d "說明"        # 產生新版本 URL（如 @16）
git add . && git commit -m "" && git push  # 更新 GitHub Pages
```

GAS Web App 設定（`appsscript.json`）：`executeAs: USER_DEPLOYING`、`access: ANYONE_ANONYMOUS`
Google Sheet 需有工作表：`法拍清單(一般)`、`法拍清單(應買)`、`會員名單`

## 開發命令

```bash
cd analysis && black .                     # format
cd analysis && ruff check . --fix          # lint auto-fix
cd analysis && ruff check .                # lint check
python analysis/test_100_users.py          # mock 測試（不需外部服務）
```

執行順序：`black → ruff check . --fix → ruff check . → python test_100_users.py`

## 維運備忘（2026/10/09 事件紀錄）

- `.clasp.json` 被 `*.json` 的 gitignore 排除、不進版控；換電腦後重綁：
  `clasp setting scriptId <指令碼ID>`（GAS 專案設定內取得），首次 `push` 若顯示
  `Skipping push` 改用 `clasp push --force`
- 只改爬蟲（`法拍清單(*).gs`）時只需 `clasp push` + 手動跑 `runAllUpdate` 驗證，
  不需 `clasp deploy`（Web App URL 不變）；有動 `後端.gs` 才需重新部署並同步版本號
- 排程健康檢查：GAS「觸發條件」確認 `runAllUpdate` 時間觸發啟用中；
  失敗信判讀：`Address unavailable` = GAS→司法院瞬斷（已有 3 次重試，連續失敗才需處理），
  `無法解析憑證` = 司法院 V2.htm 改版（檢查 `_csrf` / `token` 的 regex）
- 已知正常現象：API `QUERY.htm` 回傳 `total=0`（分頁靠單頁筆數 `< pageSize` 收尾）、
  每日筆數浮動（277/138 只是歷史快照，到期下架屬正常）；`updatedAt` 以 Web App 快取重建時間為準

## 前端注意

- 無 TypeScript / npm / bundler（純 HTML + JS CDN）
- `copy()` 在 HTTP 環境有 textarea fallback
- GitHub Pages：`rock903400-byte/auction`
