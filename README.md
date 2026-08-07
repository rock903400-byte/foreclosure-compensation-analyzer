# foreclosure-compensation-analyzer

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Pages](https://img.shields.io/badge/Demo-Light3-brightgreen.svg)](https://rock903400-byte.github.io/foreclosure-compensation-analyzer/)

> 法拍補償 PRO 系統 (Foreclosure Compensation PRO) — 台灣法拍土地投資監控與分析系統

## 功能特色

- **雙軌系統架構**：以 Google Apps Script 生產環境（爬蟲 + 試算表 Web App）配合 Python 本地數據驗證工具。
- **動態法拍爬取**：自動化抓取司法院最新的法拍土地與案件資訊。
- **補償金精算**：自動依據「面積 × 6 元/m²」公式試算預估補償金與投資回報率 (ROI)。
- **權限與分級**：提供訪客、一般會員、專業會員等多層次存取。

## 技術棧

- **Production Backend**: Google Apps Script (GAS)
- **Verification Tools**: Python (Requests, Pandas, Xlrd)
- **Database / Sheets**: Google Sheets, Excel
- **Frontend**: HTML / CSS

## 快速開始

### 1. 部署 Google Apps Script
將專案中所有的 `.gs` 檔案上傳至您的 Google Apps Script 專案，並部署為 Web App。

### 2. 執行 Python 數據驗證
```bash
pip install -r analysis/requirements.txt
python analysis/fetch_data.py
```

## 專案結構

```text
/
├── 常數.gs             # 公式權重與常數定義
├── 後端.gs             # API 處理與網頁路由
├── 法拍清單(一般).gs   # 一般法拍案件爬取
├── 法拍清單(應買).gs   # 應買法拍案件爬取
├── index.html          # 前端（GitHub Pages 部署）
└── analysis/           # 本地數據驗證與分析工具（Python）
    ├── fetch_data.py   # 法拍資料下載腳本
    ├── analyze_*.py    # ROI 與案源數據分析工具
    ├── verify_*.py     # 計算公式與數據一致性校驗
    └── requirements.txt # Python 依賴
```

## License

MIT
