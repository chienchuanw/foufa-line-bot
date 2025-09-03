/**
 * 日期處理工具模組
 * 提供統一的日期解析、格式化與比較功能
 */

/**
 * 解析點分隔的日期字串 (YYYY.MM.DD)
 * @param {string} s - 日期字串
 * @returns {Date|null} 解析後的日期物件，失敗時回傳 null
 */
function parseDotDate_(s) {
  const m = String(s || '').trim().match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return isNaN(d) ? null : d;
}

/**
 * 將日期格式化為點分隔字串 (YYYY.MM.DD)
 * @param {Date} d - 日期物件
 * @returns {string} 格式化後的日期字串
 */
function formatDotDate_(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

/**
 * 取得日期的開始時間 (00:00:00)
 * @param {Date} d - 原始日期
 * @returns {Date} 設定為當日開始時間的新日期物件
 */
function startOfDay_(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * 安全地將值轉換為日期物件
 * @param {any} v - 要轉換的值
 * @returns {Date|null} 日期物件或 null
 */
function toDateOrNull_(v) {
  if (v instanceof Date) return v;
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : d;
}
