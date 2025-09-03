# 📱 LINE Bot 器材租借管理系統

一個基於 LINE Bot + Google Apps Script + Google Sheets 的器材租借管理系統，讓團隊可以輕鬆管理拍攝器材的借用與歸還。

## ✨ 功能特色

- **📝 器材借用登記**：透過 LINE 訊息三行格式快速登記器材借用
- **🔍 日期查詢**：查詢特定日期的器材借用狀況
- **📊 Google Sheets 整合**：所有資料自動儲存到 Google 試算表
- **👥 使用者識別**：自動記錄借用者的 LINE 顯示名稱
- **🎯 簡單易用**：直覺的指令介面，無需複雜操作

## 🚀 快速開始

### 1. 建立 LINE Bot

1. 前往 [LINE Developers Console](https://developers.line.biz/)
2. 建立新的 Provider 和 Messaging API Channel
3. 記錄以下資訊：
   - **Channel Access Token** (長期)
   - **Channel Secret** (選用，用於驗證)

### 2. 建立 Google Sheets

1. 建立新的 Google 試算表
2. 記錄試算表的 ID（網址中的長字串）

### 3. 設定 Google Apps Script

1. 在 Google Sheets 中，點選「擴充功能」→「Apps Script」
2. 刪除預設的 `Code.gs` 檔案
3. 將本專案的所有 `.gs` 檔案複製到專案中：
   - `main.gs` - 主要入口點
   - `config.gs` - 設定管理
   - `dateUtils.gs` - 日期工具
   - `sheetService.gs` - 試算表操作
   - `lineService.gs` - LINE API 通訊
   - `borrowService.gs` - 借用邏輯
   - `queryService.gs` - 查詢功能
4. 儲存專案（Ctrl+S）

### 4. 設定環境變數

在 Apps Script 編輯器中：

1. 點選左側「專案設定」⚙️
2. 在「指令碼屬性」區塊點選「新增指令碼屬性」
3. 新增以下屬性：

| 屬性名稱 | 值 | 說明 |
|---------|---|------|
| `LINE_CHANNEL_TOKEN` | 你的 Channel Access Token | **必填** - LINE Bot 的存取權杖 |
| `LINE_CHANNEL_SECRET` | 你的 Channel Secret | 選填 - 用於訊息驗證 |

### 5. 部署 Web 應用程式

1. 在 Apps Script 編輯器中，點選右上角「部署」→「新增部署作業」
2. 選擇類型：「網頁應用程式」
3. 設定：
   - **說明**：LINE Bot Webhook
   - **執行身分**：我
   - **存取權限**：任何人
4. 點選「部署」
5. **複製 Web 應用程式網址**（這就是 Webhook URL）

### 6. 設定 LINE Bot Webhook

1. 回到 [LINE Developers Console](https://developers.line.biz/)
2. 選擇你的 Messaging API Channel
3. 在「Messaging API」分頁中：
   - 將「Webhook URL」設定為剛才複製的網址
   - 啟用「Use webhook」
   - 停用「Auto-reply messages」（避免重複回應）

### 7. 測試設定

1. 用手機 LINE 掃描 Bot 的 QR Code 加為好友
2. 傳送「查指令」測試是否正常運作
3. 如果收到指令說明，表示設定成功！

## 📋 使用方式

### 指令列表

| 指令 | 格式 | 說明 |
|------|------|------|
| **借器材** | 四行格式（見下方） | 登記器材借用 |
| **查器材** | `查器材 YYYY.MM.DD` | 查詢特定日期的借用狀況 |
| **查指令** | `查指令` | 顯示所有可用指令 |

### 借器材格式

```text
借器材
租用器材：相機A, 三腳架, 燈具
租用日期：2025.09.10
歸還日期：2025.09.12
```

**注意事項：**

- 必須完整複製四行（包含「借器材」）
- 器材名稱用逗號分隔
- 日期格式必須是 `YYYY.MM.DD`
- 歸還日期不可早於租用日期

### 查詢範例

```text
查器材 2025.09.11
```

系統會回傳該日期所有被借用的器材和借用者：

```text
**張小明**
相機A
三腳架

**李小華**
燈具
收音設備
```

## 📊 資料結構

系統會在 Google Sheets 中自動建立 `loans` 工作表，包含以下欄位：

| 欄位 | 說明 | 範例 |
|------|------|------|
| `ts` | 建立時間戳記 | 2025-09-03 14:30:00 |
| `userId` | LINE 使用者 ID | U1234567890abcdef... |
| `username` | LINE 顯示名稱 | 張小明 |
| `items` | 租用器材清單 | 相機A, 三腳架, 燈具 |
| `borrowedAt` | 歸還日期 | 2025-09-12 |
| `returnedAt` | 租用日期 | 2025-09-10 |

> **注意**：由於歷史原因，`borrowedAt` 實際儲存歸還日期，`returnedAt` 實際儲存租用日期。

## 📁 檔案結構

重構後的專案採用模組化設計，每個檔案負責特定功能：

| 檔案 | 功能說明 | 主要內容 |
|------|----------|----------|
| `main.gs` | 主要路由與 Webhook 處理 | doGet, doPost, handleEvent_ |
| `config.gs` | 設定與常數管理 | 工作表設定、訊息常數、Script Properties |
| `dateUtils.gs` | 日期處理工具 | 日期解析、格式化、比較函式 |
| `sheetService.gs` | Google Sheets 操作 | 工作表建立、資料讀寫、標題管理 |
| `lineService.gs` | LINE API 通訊 | 訊息回覆、歡迎訊息、使用者資訊 |
| `borrowService.gs` | 借用邏輯處理 | 表單解析、借用紀錄建立 |
| `queryService.gs` | 查詢功能 | 日期查詢、指令說明 |

## 🔧 自訂設定

### 修改工作表名稱

在 `config.gs` 中：

```javascript
const SHEET_LOANS = 'loans';  // 改為你想要的工作表名稱
```

### 修改欄位順序

在 `config.gs` 中：

```javascript
const LOANS_HEADERS = ['ts', 'userId', 'username', 'items', 'borrowedAt', 'returnedAt'];
```

### 自訂錯誤訊息

在 `config.gs` 中：

```javascript
const UNKNOWN_CMD_MSG = '目前沒有此指令，請使用「查指令」查看指令範例';
```

## 🔍 疑難排解

### 常見問題

**Q: Bot 沒有回應？**

- 檢查 Webhook URL 是否正確設定
- 確認 `LINE_CHANNEL_TOKEN` 是否正確
- 查看 Apps Script 的執行記錄是否有錯誤

**Q: 無法寫入 Google Sheets？**

- 確認 Apps Script 有 Google Sheets 的存取權限
- 檢查工作表名稱是否正確

**Q: 日期格式錯誤？**

- 確保使用 `YYYY.MM.DD` 格式（例如：2025.09.03）
- 注意是英文句點，不是中文句號

### 除錯方式

1. 在 Apps Script 編輯器中查看「執行」記錄
2. 使用 `console.log()` 在程式碼中加入除錯訊息
3. 測試 Web 應用程式網址是否可正常存取（應顯示 "OK"）

## 📝 授權條款

本專案採用 MIT 授權條款，歡迎自由使用和修改。

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request 來改善這個專案！

---

**💡 提示**：這個系統特別適合攝影工作室、學校社團、或任何需要管理共用器材的團隊使用。
