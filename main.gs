/********************
 * LINE Bot x Google Sheet - Equipment Rental (Minimal for New Requirements)
 * 指令：
 * 1) 借器材（三行表單）
 * 2) 查器材 YYYY.MM.DD
 * 3) 查指令
 *
 * 欄位寫入規則（依你的指定）：
 * - items        ← 租用器材
 * - returnedAt   ← 租用日期
 * - borrowedAt   ← 歸還日期
 * - username     ← 使用者 LINE 顯示名稱
 * - 另寫入 ts, userId
 *
 * Script Properties:
 * - LINE_CHANNEL_TOKEN (必填)
 * - LINE_CHANNEL_SECRET (選填，用於計算簽名)
 ********************/

// === Config ===
const SHEET_LOANS = 'loans';
const LOANS_HEADERS = ['ts', 'userId', 'username', 'items', 'borrowedAt', 'returnedAt'];
const UNKNOWN_CMD_MSG = '目前沒有此指令，請使用「查指令」查看指令範例';

// === Utilities: Script Properties ===
function getProp_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

// === Minimal doGet for browser testing ===
function doGet(e) {
  ensureLoansHeaders_(); // 首次部署時自動建表＋補標題
  return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
}

// === Webhook entry ===
function doPost(e) {
  ensureLoansHeaders_();

  const body = (e && e.postData && e.postData.contents) ? e.postData.contents : '';
  const valid = verifyLineSignature_(body, e); // 在 GAS 無 header 仍放行
  if (!valid) {
    return ContentService.createTextOutput('Signature invalid').setMimeType(ContentService.MimeType.TEXT);
  }

  let json = {};
  try { json = body ? JSON.parse(body) : {}; } catch (_) { }
  const events = (json && Array.isArray(json.events)) ? json.events : [];
  if (!events.length) {
    return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
  }

  events.forEach(handleEvent_);
  return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
}

// === Signature verification (best-effort on GAS) ===
function verifyLineSignature_(body, e) {
  // GAS 幾乎拿不到 headers；此處若 body 存在則計算簽名但不強制比對（為相容性）
  if (!body) return true;
  const secret = getProp_('LINE_CHANNEL_SECRET') || '';
  try {
    Utilities.base64Encode(
      Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_256, body, secret)
    );
    return true;
  } catch (_) {
    return true;
  }
}

// === Event handler (僅文字訊息) ===
function handleEvent_(event) {
  // Greeting：使用者加好友
  if (event.type === 'follow') {
    return sendGreeting_(event.replyToken);
  }

  if (event.type !== 'message' || !event.message || event.message.type !== 'text') return;

  const text = String(event.message.text || '').trim();
  const userId = (event.source && event.source.userId) || 'unknown';

  // 需求三：查指令（顯示所有可用指令與範例）
  if (/^查指令$/.test(text)) {
    return replyMessage_(event.replyToken, helpText_());
  }

  // 需求一：「借器材」三行格式
  if (/^借器材/i.test(text)) {
    return handleBorrowForm_(event, text, userId);
  }

  // 需求二：「查器材 YYYY.MM.DD」
  const mQuery = text.match(/^查器材\s+(\d{4}\.\d{2}\.\d{2})$/);
  if (mQuery) {
    return replyBorrowedOnDate_(event.replyToken, mQuery[1]);
  }

  // 未知指令：回覆提示
  return replyMessage_(event.replyToken, UNKNOWN_CMD_MSG);
}

// === 指令說明 ===
function helpText_() {
  return [
    '可用指令與範例：',
    '',
    '1) 借器材（請複製下方四行格式，包含「借器材」）',
    '借器材',
    '租用器材：器材一, 器材二, 器材三',
    '租用日期：2025.09.10',
    '歸還日期：2025.09.12',
    '',
    '2) 查器材 <YYYY.MM.DD>',
    '範例：查器材 2025.09.11',
    '',
    '3) 查指令',
    '顯示所有指令與使用範例'
  ].join('\n');
}

// === 需求一：解析「借器材」訊息並寫入 loans ===
function handleBorrowForm_(event, rawText, userId) {
  const loans = getLoansSheet_();
  if (!loans) return replyMessage_(event.replyToken, `找不到工作表：${SHEET_LOANS}`);

  const parsed = parseBorrowMessage_(rawText);
  if (!parsed.ok) return replyMessage_(event.replyToken, parsed.msg);

  // 優先以 LINE API 取得顯示名稱，若失敗則退回 userId
  const username = fetchLineDisplayName_(userId) || userId;
  const now = new Date();

  // 寫入（欄位順序固定）
  loans.appendRow([
    now,                // ts
    userId,             // userId
    username,           // username
    parsed.items,       // items ← 租用器材
    parsed.borrowedAt,  // borrowedAt ← 歸還日期（依指定映射）
    parsed.returnedAt   // returnedAt ← 租用日期（依指定映射）
  ]);

  replyMessage_(event.replyToken,
    [
      '✅ 已建立借用紀錄：',
      `借用人：${username}`,
      `器材：${parsed.items}`,
      `租用日期：${formatDotDate_(parsed.returnedAt)}`,
      `歸還日期：${formatDotDate_(parsed.borrowedAt)}`
    ].join('\n')
  );
}

// 解析三行表單（嚴格格式）
function parseBorrowMessage_(raw) {
  // 移除前綴「借器材」
  const text = String(raw || '').replace(/^借器材[ \t]*/i, '').trim();

  // 期望三行（允許空行會被過濾）
  // 租用器材：器材一, 器材二, 器材三
  // 租用日期：YYYY.MM.DD
  // 歸還日期：YYYY.MM.DD
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (lines.length < 3) {
    return { ok: false, msg: '格式錯誤：請使用三行格式（租用器材／租用日期／歸還日期）' };
  }

  const kv = {};
  for (const line of lines) {
    // 支援中英文冒號
    const m = line.match(/^(租用器材|租用日期|歸還日期)\s*[:：]\s*(.+)$/);
    if (!m) return { ok: false, msg: `格式錯誤：無法解析「${line}」` };
    kv[m[1]] = m[2].trim();
  }

  if (!kv['租用器材'] || !kv['租用日期'] || !kv['歸還日期']) {
    return { ok: false, msg: '格式錯誤：三個欄位皆必填（租用器材／租用日期／歸還日期）' };
  }

  // 器材以逗號分隔（中英文逗號）
  const items = kv['租用器材'].split(/[，,]/).map(s => s.trim()).filter(Boolean).join(', ');

  // 解析日期
  const rentDate = parseDotDate_(kv['租用日期']);   // YYYY.MM.DD
  const backDate = parseDotDate_(kv['歸還日期']);   // YYYY.MM.DD
  if (!rentDate || !backDate) {
    return { ok: false, msg: '日期格式錯誤：請用 YYYY.MM.DD（例如 2025.09.03）' };
  }
  if (startOfDay_(backDate) < startOfDay_(rentDate)) {
    return { ok: false, msg: '日期邏輯錯誤：歸還日期不可早於租用日期' };
  }

  // 依指定映射：
  // 租用器材 → items
  // 租用日期 → returnedAt
  // 歸還日期 → borrowedAt
  return {
    ok: true,
    items,
    returnedAt: rentDate, // 租用日期
    borrowedAt: backDate  // 歸還日期
  };
}

// === 需求二：查詢指定日期（YYYY.MM.DD）被借走的器材與借用人 ===
function replyBorrowedOnDate_(replyToken, ymdDot) {
  const loans = getLoansSheet_();
  if (!loans) return replyMessage_(replyToken, `找不到工作表：${SHEET_LOANS}`);

  const target = parseDotDate_(ymdDot);
  if (!target) return replyMessage_(replyToken, '日期格式錯誤，請用 YYYY.MM.DD');

  const rows = getLoanRows_(loans);
  // 規則：若「租用日期（returnedAt）」<= target <=「歸還日期（borrowedAt）」即視為該日占用中
  const list = rows.filter(r => {
    const rentStart = toDateOrNull_(r.returnedAt); // 租用日期（returnedAt）
    const rentEnd = toDateOrNull_(r.borrowedAt); // 歸還日期（borrowedAt）
    if (!rentStart || !rentEnd) return false;
    const d = startOfDay_(target);
    return startOfDay_(rentStart) <= d && d <= startOfDay_(rentEnd);
  });

  if (!list.length) {
    return replyMessage_(replyToken, '暫無借用資訊，請確認工作室是否有拍攝。');
  }

  // 新格式：粗體 username，逐項器材換行顯示
  const msg = list.map(r => {
    const username = r.username || r.userId;
    // 把 items 用 , 或 ， 分隔後逐行顯示
    const itemsArr = String(r.items || '').split(/[，,]/).map(s => s.trim()).filter(Boolean);
    const itemsBlock = itemsArr.length ? itemsArr.join('\n') : '（無器材資料）';
    return `**${username}**\n${itemsBlock}`;
  }).join('\n\n'); // 每筆之間多一個空行分隔

  replyMessage_(replyToken, msg);
}

// === Google Sheet helpers ===
function getLoansSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_LOANS) || null;
}

function ensureLoansHeaders_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_LOANS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_LOANS);
  }
  const lastCol = sheet.getLastColumn();
  const header = lastCol > 0 ? (sheet.getRange(1, 1, 1, lastCol).getValues()[0] || []) : [];
  const headerStr = header.map(String);
  // 若第一列不完全相同，就重置為固定標題
  const same = LOANS_HEADERS.length === headerStr.length &&
    LOANS_HEADERS.every((h, i) => h === headerStr[i]);
  if (!same) {
    sheet.clear();
    sheet.getRange(1, 1, 1, LOANS_HEADERS.length).setValues([LOANS_HEADERS]);
  }
}

function getLoanRows_(sheet) {
  const rng = sheet.getDataRange().getValues();
  if (!rng || rng.length < 2) return [];
  const header = rng.shift().map(String);
  const idx = {};
  LOANS_HEADERS.forEach((h) => { idx[h] = header.indexOf(h); });

  return rng.map(row => ({
    ts: safeCell_(row, idx['ts']),
    userId: safeCell_(row, idx['userId']),
    username: safeCell_(row, idx['username']),
    items: safeCell_(row, idx['items']),
    borrowedAt: safeCell_(row, idx['borrowedAt']),
    returnedAt: safeCell_(row, idx['returnedAt']),
  }));
}

function safeCell_(row, i) {
  if (i === -1) return '';
  return row[i];
}

// === LINE Messaging API ===
function replyMessage_(replyToken, text) {
  const token = getProp_('LINE_CHANNEL_TOKEN');
  const url = 'https://api.line.me/v2/bot/message/reply';
  const payload = {
    replyToken,
    messages: [{ type: 'text', text: String(text).slice(0, 5000) }],
  };
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: { Authorization: `Bearer ${token}` },
    muteHttpExceptions: true,
  });
}

function sendGreeting_(replyToken) {
  const token = getProp_('LINE_CHANNEL_TOKEN');
  const url = 'https://api.line.me/v2/bot/message/reply';

  const flexMsg = {
    type: "flex",
    altText: "歡迎使用器材租借小幫手",
    contents: {
      type: "bubble",
      hero: {
        type: "text",
        text: "👋 歡迎使用器材租借小幫手",
        weight: "bold",
        size: "xl",
        align: "center"
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "我可以幫你管理拍攝器材的借用與查詢。",
            wrap: true,
            size: "sm"
          },
          {
            type: "separator",
            margin: "md"
          },
          {
            type: "text",
            text: "📌 常用指令",
            weight: "bold",
            margin: "md"
          },
          {
            type: "text",
            text: "1) 借器材（三行格式）\n2) 查器材 YYYY.MM.DD\n3) 查指令",
            wrap: true,
            size: "sm",
            margin: "sm"
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            action: {
              type: "message",
              label: "查看指令",
              text: "查指令"
            }
          },
          {
            type: "button",
            style: "secondary",
            action: {
              type: "message",
              label: "查某日借用情況",
              text: "查器材 2025.09.11"
            }
          },
          {
            type: "button",
            style: "secondary",
            action: {
              type: "message",
              label: "借器材範例",
              text: "借器材\n租用器材：相機A, 三腳架\n租用日期：2025.09.10\n歸還日期：2025.09.12"
            }
          }
        ]
      }
    }
  };

  const payload = {
    replyToken,
    messages: [flexMsg],
  };

  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: { Authorization: `Bearer ${token}` },
    muteHttpExceptions: true,
  });
}


// 以 User ID 取得顯示名稱（需使用者與 Bot 為好友）
function fetchLineDisplayName_(userId) {
  try {
    if (!userId || userId === 'unknown') return null;
    const token = getProp_('LINE_CHANNEL_TOKEN');
    const url = `https://api.line.me/v2/bot/profile/${encodeURIComponent(userId)}`;
    const res = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { Authorization: `Bearer ${token}` },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) return null;
    const json = JSON.parse(res.getContentText() || '{}');
    return json.displayName || null;
  } catch (_) {
    return null;
  }
}

// === Date helpers ===
function parseDotDate_(s) {
  const m = String(s || '').trim().match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return isNaN(d) ? null : d;
}
function formatDotDate_(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}
function startOfDay_(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function toDateOrNull_(v) {
  if (v instanceof Date) return v;
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : d;
}
