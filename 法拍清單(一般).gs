/**
 * 自動初始化與更新司法院法拍系統的 Session 資訊
 * 包含 Cookie, CSRF Token 與 API Token
 */
function refreshSession() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheetName = "設定(驗證資訊)";
  let configSheet = ss.getSheetByName(configSheetName);
  
  // 1. 確保設定工作表存在
  if (!configSheet) {
    configSheet = ss.insertSheet(configSheetName);
    configSheet.getRange("A1:A3").setValues([["Cookie"], ["CSRF"], ["Token"]]);
    configSheet.getRange("A1:A3").setFontWeight("bold").setBackground("#f3f3f3");
    configSheet.setColumnWidth(1, 100);
    configSheet.setColumnWidth(2, 500);
  }

  Logger.log("🔄 正在嘗試從司法院網站獲取最新憑證...");

  try {
    const url = "https://aomp109.judicial.gov.tw/judbp/wkw/WHD1A02/V2.htm";
    const options = {
      "method": "get",
      "headers": {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
      },
      "muteHttpExceptions": true
    };

    const response = UrlFetchApp.fetch(url, options);
    const content = response.getContentText();
    const headers = response.getAllHeaders();

    // 2. 獲取 Cookie (處理 Set-Cookie 陣列或字串)
    let cookie = "";
    const setCookie = headers["Set-Cookie"];
    if (setCookie) {
      if (Array.isArray(setCookie)) {
        cookie = setCookie.map(c => c.split(';')[0]).join('; ');
      } else {
        cookie = setCookie.split(';')[0];
      }
    }

    // 3. 獲取 CSRF Token
    // <input type="hidden" name="_csrf" value="xxxx-xxxx-xxxx" />
    const csrfMatch = content.match(/name="_csrf"\s+value="([^"]+)"/);
    const csrf = csrfMatch ? csrfMatch[1] : "";

    // 4. 獲取 Token (通常在 JavaScript 變數中)
    // var token = 'xxxxxx'; 或 similar
    const tokenMatch = content.match(/var\s+token\s*=\s*['"]([^'"]+)['"]/i) || 
                       content.match(/name="token"\s+value="([^"]+)"/);
    const token = tokenMatch ? tokenMatch[1] : "";

    if (csrf && token) {
      configSheet.getRange("B1").setValue(cookie || configSheet.getRange("B1").getValue()); // 如果沒抓到新 Cookie 則保留舊的
      configSheet.getRange("B2").setValue(csrf);
      configSheet.getRange("B3").setValue(token);
      
      Logger.log("✅ 憑證更新成功！");
      Logger.log("CSRF: " + csrf);
      Logger.log("Token: " + token);
      return true;
    } else {
      Logger.log("❌ 無法解析憑證。可能是頁面結構改變或被阻擋。");
      return false;
    }

  } catch (e) {
    Logger.log("❌ 獲取憑證時發生錯誤: " + e.message);
    return false;
  }
}

/**
 * 一般清單抓取邏輯
 * 針對一般程序 (第一、二、三拍) 進行抓取，具備自動分頁功能
 */
function scrapeLandStableBatch_General() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheetName = "設定(驗證資訊)";
  const configSheet = ss.getSheetByName(configSheetName);
  
  if (!configSheet) return;

  const cookieVal = configSheet.getRange("B1").getValue().toString().trim();
  const csrfVal = configSheet.getRange("B2").getValue().toString().trim();
  const tokenVal = configSheet.getRange("B3").getValue().toString().trim();

  const targetSheetName = "法拍清單(一般)";
  let sheet = ss.getSheetByName(targetSheetName);
  if (!sheet) { sheet = ss.insertSheet(targetSheetName); }
  sheet.clear(); 

  const headers = [
    "筆次", "法院名稱", "案號", "股別", "拍賣日期", "拍次",
    "縣市", "土地坐落", "面積", "總拍賣底價(元)",
    "點交", "空地", "標別", "看圖", "備註",
    "採通訊投標", "土地有無遭受污染", "地圖",
    "", "土地單價(元/㎡)",
    "預估補償金", "ROI (%)", "PDF 連結", "是否點交", "是否空地"
  ];
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#2d6a4f").setFontColor("white");
  sheet.getRange(1, 20).setBackground("#d9ead3").setFontColor("black");
  sheet.getRange(1, 21, 1, 5).setBackground("#fff2cc").setFontColor("black");

  function getSafeNum(val) {
    if (val == null || val === '') return 0;
    const n = parseFloat(String(val).replace(/,/g, ''));
    return isNaN(n) ? 0 : Math.floor(n);
  }

  try {
    const url = "https://aomp109.judicial.gov.tw/judbp/wkw/WHD1A02/QUERY.htm";
    // 🔴 修正：根據使用者資料，精確設定 40 個鄉鎮市關鍵字
    const searchKeywords = "大同鄉 南澳鄉 員山鄉 復興區 尖石鄉 五峰鄉 橫山鄉 關西鎮 泰安鄉 南庄鄉 獅潭鄉 和平區 仁愛鄉 信義鄉 魚池鄉 水里鄉 阿里山鄉 桃源區 那瑪夏區 獅子鄉 三地門鄉 牡丹鄉 來義鄉 泰武鄉 瑪家鄉 春日鄉 滿州鄉 內埔鄉 秀林鄉 卓溪鄉 萬榮鄉 壽豐鄉 光復鄉 富里鄉 豐濱鄉 吉安鄉 鳳林鎮 玉里鎮 瑞穗鄉 花蓮市 六龜區 新埤鄉 車城鄉 新城鄉";

    let allFetchedData = [];
    let currentPage = 1;
    let totalRecords = 0;
    const pageSize = 100;

    // 取得今日民國日期 (格式: 01150503)
    const now = new Date();
    const rocYear = now.getFullYear() - 1911;
    const rocMonth = (now.getMonth() + 1).toString().padStart(2, '0');
    const rocDay = now.getDate().toString().padStart(2, '0');
    const todayROC = "0" + rocYear + rocMonth + rocDay;

    // 🔴 循環抓取分頁
    do {
      Logger.log("📄 正在抓取第 " + currentPage + " 頁...");
      const payload = {
        "proptype": "C51",
        "saletype": "", 
        "keyword": searchKeywords,
        "rrange": "ALL",
        "pageSize": pageSize.toString(),
        "page": currentPage.toString(),
        "token": tokenVal,
        "_csrf": csrfVal,
        "sorted_column": "A.CRMYY, A.CRMID, A.CRMNO, A.SALENO, A.ROWID",
        "sorted_type": "ASC",
        "is_search": "Y"
      };

      const options = {
        "method": "post",
        "headers": {
          "Cookie": cookieVal,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://aomp109.judicial.gov.tw/judbp/wkw/WHD1A02/V2.htm",
          "X-Requested-With": "XMLHttpRequest"
        },
        "payload": payload,
        "muteHttpExceptions": true
      };

      const response = UrlFetchApp.fetch(url, options);
      const content = response.getContentText();
      const json = JSON.parse(content);

      if (json && json.data) {
        allFetchedData = allFetchedData.concat(json.data);
        totalRecords = parseInt(json.total || 0, 10);
        Logger.log("✅ 第 " + currentPage + " 頁抓取完成，累計: " + allFetchedData.length + "/" + totalRecords);
        
        if (json.data.length < pageSize) break; 
      } else {
        break;
      }

      currentPage++;
      Utilities.sleep(500); 
    } while (allFetchedData.length < totalRecords);

    if (allFetchedData.length > 0) {
      const uniqueData = new Map();

      allFetchedData.forEach(item => {
        // 🔴 修正：過濾權利範圍
        const share = (item.rrange || "").trim();
        if (share && share !== "全部" && share !== "1分之1") return;

        // 🔴 修正：僅保留一般程序常見拍次 (1, 2, 3, 4, 6) 並過濾過期案件
        const saleno = String(item.saleno || "");
        if (!["1", "2", "3", "4", "6"].includes(saleno)) return;
        
        const saleDate = String(item.saledate || "0").padStart(8, '0');
        if (saleDate < todayROC) return;

        // 🔴 修正：使用更細緻的 Key (包含土地座落)，確保每一筆土地都保留
        const uniqueKey = item.hsimun + item.crmyy + item.crmid + item.crmno + (item.saleno || "") + (item.batchno || "") + (item.sec || "") + (item.landno || "");
        
        if (!uniqueData.has(uniqueKey)) {
          uniqueData.set(uniqueKey, item);
        }
      });

      const filteredData = Array.from(uniqueData.values());
      Logger.log("🧹 篩選後總筆數: " + filteredData.length + " 筆 (應接近 268 筆)");

      // 拍次映射表
      const saleTypeMap = {
        "1": "第一拍",
        "2": "第二拍",
        "3": "第三拍",
        "4": "應買",
        "5": "特別程序",
        "6": "特別程序(二)",
        "99": "公告"
      };

      let allRows = filteredData.map((item, index) => {
        const totalSum = getSafeNum(item.summinprc);
        let individualPrice = getSafeNum(item.minprice) || getSafeNum(item.minprc) || totalSum;
        const areaM2 = parseFloat(item.area3) || 0;
        const areaTsubo = Math.round(areaM2 * 0.3025);
        const areaDisplay = areaTsubo + "坪(" + areaM2.toFixed(2) + "平方公尺) x " + (item.rrange || "全部") + "\n底價: " + individualPrice.toLocaleString() + " 元";
        let unitPriceDisplay = (areaM2 > 0 && individualPrice > 0) ? parseFloat((individualPrice / areaM2).toFixed(2)) : 0;
        const fullLocation = item.ctmd + (item.sec || "") + "段 " + (item.subsec || "小段 ") + (item.landno || "") + "號";
        const mapAddr = item.hsimun + item.ctmd + (item.sec || "") + "段" + (item.landno || "");
        const mapUrl = "https://www.google.com/maps/search/" + encodeURIComponent(mapAddr);
        const pdfUrl = item.filenm ? "https://aomp109.judicial.gov.tw/judbp/wkw/WHD1A02/DO_VIEWPDF.htm?filenm=" + item.filenm : "";
        const comp = Math.ceil(areaM2 * 6);
        const roi = totalSum > 0 ? parseFloat((comp / totalSum * 100).toFixed(2)) : 0;

        return [
          index + 1, item.hsimun + "地方法院", item.crmyy + "年" + item.crmid + "字第" + item.crmno + "號",
          "(" + (item.dpt || "") + "股)", item.saledate,
          item.saletitle || saleTypeMap[item.saleno] || "一般程序",
          item.hsimun,
          '=HYPERLINK("' + mapUrl + '", "' + fullLocation + '")',
          areaDisplay, totalSum,
          item.checkyn === "Y" ? "點交" : "不點交", item.emptyyn === "Y" ? "是" : "否",
          item.batchno || "",
          pdfUrl ? '=HYPERLINK("' + pdfUrl + '", "查詢")' : "無檔",
          item.ttitle || "", item.comm_yn === "Y" ? "是" : "否", "無資訊", '=HYPERLINK("' + mapUrl + '", "查詢")',
          "", unitPriceDisplay,
          comp, roi, pdfUrl, item.checkyn === "Y" ? "是" : "否", item.emptyyn === "Y" ? "是" : "否"
        ];
      });

      if (allRows.length > 0) {
        sheet.getRange(2, 1, allRows.length, allRows[0].length).setValues(allRows);
        sheet.getRange(2, 9, allRows.length, 1).setWrap(true);
        sheet.getRange(2, 20, allRows.length, 1).setNumberFormat("#,##0.00");
        sheet.getRange(2, 21, allRows.length, 1).setNumberFormat("#,##0");
        sheet.getRange(2, 22, allRows.length, 1).setNumberFormat("0.00");
        sheet.autoResizeColumns(1, 25);
      }
      Logger.log("🎯 【一般】清單更新完畢！");
    }
  } catch (e) {
    Logger.log("❌ 執行一般清單錯誤: " + e.message);
  }
}

/**
 * 自動建立並初始化【會員名單】工作表
 */
function initMembershipSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = "會員名單";
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange("A1:B1").setValues([["Email", "權限等級"]]);
    sheet.getRange("A1:B1").setFontWeight("bold").setBackground("#f3f3f3");
    sheet.setColumnWidth(1, 250);
    sheet.setColumnWidth(2, 150);

    let currentUserEmail = "";
    try {
      currentUserEmail = Session.getActiveUser().getEmail();
    } catch(e) {
      Logger.log("⚠️ 無法透過 Session 獲取 Email，請手動在會員名單 A2 填寫。");
    }

    if (currentUserEmail) {
      sheet.getRange("A2:B2").setValues([[currentUserEmail, "pro"]]);
      Logger.log("✅ 成功自動建立【會員名單】工作表，並已將您 (" + currentUserEmail + ") 設為 pro 權限！");
    } else {
      sheet.getRange("A2").setValue("請手動填寫您的 Email");
      sheet.getRange("B2").setValue("pro");
    }
  }
}

/**
 * 一鍵更新入口
 */
function runAllUpdate() {
  initMembershipSheet();
  if (refreshSession()) {
    Logger.log("🚀 憑證已更新，開始完整抓取...");
    scrapeLandStableBatch_General();
    if (typeof scrapeLandStableBatch_Buy === 'function') {
      scrapeLandStableBatch_Buy();
    }
    Logger.log("✨ 所有清單更新完成！");
  } else {
    SpreadsheetApp.getUi().alert("自動獲取憑證失敗，請檢查網路連線。");
  }
}

