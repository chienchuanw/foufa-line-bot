/**
 * 查詢服務
 * 負責處理器材查詢相關的業務邏輯
 */

/**
 * 查詢指定日期被借走的器材與借用人
 * @param {string} replyToken - LINE 回覆 token
 * @param {string} ymdDot - 日期字串 (YYYY.MM.DD)
 */
function replyBorrowedOnDate_(replyToken, ymdDot) {
  const loans = getLoansSheet_();
  if (!loans) return replyMessage_(replyToken, `找不到工作表：${SHEET_LOANS}`);

  const target = parseDotDate_(ymdDot);
  if (!target) return replyMessage_(replyToken, '日期格式錯誤，請用 YYYY.MM.DD');

  const rows = getLoanRows_(loans);

  // 篩選規則：若「租用日期（returnedAt）」<= target <=「歸還日期（borrowedAt）」即視為該日占用中
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

  // 格式化回覆訊息：粗體 username，逐項器材換行顯示
  const msg = list.map(r => {
    const username = r.username || r.userId;
    // 把 items 用 , 或 ， 分隔後逐行顯示
    const itemsArr = String(r.items || '').split(/[，,]/).map(s => s.trim()).filter(Boolean);
    const itemsBlock = itemsArr.length ? itemsArr.join('\n') : '（無器材資料）';
    return `*${username}*\n${itemsBlock}`;
  }).join('\n\n'); // 每筆之間多一個空行分隔

  replyMessage_(replyToken, msg);
}

/**
 * 產生指令說明文字
 * @returns {string} 指令說明內容
 */
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
