/* Дрібні утиліти: дати, числа, українська плюралізація. Без залежностей. */

export const pad = n => String(n).padStart(2, '0');
export const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseK = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (k, n) => { const d = parseK(k); d.setDate(d.getDate() + n); return dkey(d); };
export const diffDays = (a, b) => Math.round((parseK(b) - parseK(a)) / 864e5);
export const dow = k => (parseK(k).getDay() + 6) % 7; // 0 = понеділок

export const DOW_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'];
export const DOW_LONG = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота', 'Неділя'];
export const DOW_DATE = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
export const MON_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
export const MON_SHORT = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];

export const fmtDate = (k, withDow = true) => { const d = parseK(k); return (withDow ? DOW_DATE[dow(k)] + ', ' : '') + d.getDate() + ' ' + MON_GEN[d.getMonth()]; };
export const fmtShort = k => { const d = parseK(k); return d.getDate() + ' ' + MON_SHORT[d.getMonth()]; };

/* формат часу залежить від налаштувань; state.js оновлює прапорець */
export const timePrefs = { h12: false };
export function setH12(v) { timePrefs.h12 = !!v; }
export function fmtTime(d) {
  const h = d.getHours(), m = d.getMinutes();
  if (!timePrefs.h12) return pad(h) + ':' + pad(m);
  const ap = h < 12 ? 'AM' : 'PM', hh = h % 12 === 0 ? 12 : h % 12;
  return hh + ':' + pad(m) + ' ' + ap;
}
/* "HH:MM" (24h, як зберігається) -> для показу */
export function fmtHM(hm) {
  if (!timePrefs.h12) return hm;
  const [h, m] = hm.split(':').map(Number);
  const ap = h < 12 ? 'AM' : 'PM', hh = h % 12 === 0 ? 12 : h % 12;
  return hh + ':' + pad(m) + ' ' + ap;
}
export const hmToMin = hm => { const [h, m] = String(hm).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
export const minToHm = min => { min = ((min % 1440) + 1440) % 1440; return pad(Math.floor(min / 60)) + ':' + pad(min % 60); };

export const fmtNum = n => Math.round(n * 100) / 100 + '';
export const fmtN = n => {
  const s = fmtNum(n || 0).replace('.', ',');
  const [i, f] = s.split(',');
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (f ? ',' + f : '');
};
export function plural(n, forms) { // укр: [1, 2-4, 5+]
  const a = Math.abs(Math.round(n)) % 100, b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}
export const P = {
  raz: ['раз', 'рази', 'разів'], den: ['день', 'дні', 'днів'], tyzh: ['тиждень', 'тижні', 'тижнів'],
  mis: ['місяць', 'місяці', 'місяців'], hod: ['година', 'години', 'годин'], sesia: ['сесія', 'сесії', 'сесій'],
  zapys: ['запис', 'записи', 'записів'], period: ['період', 'періоди', 'періодів'],
  nahad: ['нагадування', 'нагадування', 'нагадувань'], zvychka: ['звичка', 'звички', 'звичок'],
};
export function fmtDur(min) {
  min = Math.round(min || 0);
  const h = Math.floor(min / 60), m = min % 60;
  if (h && m) return `${h} год ${m} хв`;
  if (h) return `${h} год`;
  return `${m} хв`;
}
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let _seq = 0;
export const uid = () => Date.now().toString(36) + '-' + (_seq++).toString(36) + '-' + Math.random().toString(36).slice(2, 7);

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* приймає "1,5", "1 500", "1.5" */
export function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
