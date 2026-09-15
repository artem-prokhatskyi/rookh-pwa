/* Листи, тости, гаптика. */
import { uid } from './util.js';
import { ui } from './state.js';
import { render } from './render/index.js';

let toastTimer = null;
export function toast(text, action, ms = 4000) {
  ui.toast = { text, action };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { ui.toast = null; render(); }, ms);
  render();
}
export function clearToast() { clearTimeout(toastTimer); ui.toast = null; }

export function pushSheet(sh) {
  sh.id = uid();
  ui.sheets.push(sh);
  render();
  return sh;
}
export function closeSheet(id) {
  const i = id ? ui.sheets.findIndex(s => s.id === id) : ui.sheets.length - 1;
  if (i >= 0) ui.sheets.splice(i, 1);
  ui.heatTip = null;
  render();
}
export const topSheet = t => [...ui.sheets].reverse().find(s => !t || s.t === t);
export const dropSheets = (...types) => { ui.sheets = ui.sheets.filter(s => !types.includes(s.t)); };
export function menu(title, items, opts = {}) {
  return pushSheet({ t: 'menu', title, items, anchor: opts.anchor || null });
}

const VIBES = { light: 10, medium: 22, rigid: 16, success: [12, 40, 18], warning: [26, 50, 26] };
export function haptic(kind) {
  try { if (navigator.vibrate) navigator.vibrate(VIBES[kind] || 10); } catch (e) { /* ignore */ }
}

/* безпечне виконання дії: будь-яка помилка не ламає екран */
export function safe(fn) {
  try { fn(); } catch (err) {
    console.error('[rookh]', err);
    ui.sheets = ui.sheets.filter(s => s.t !== 'sub');
    toast('Дія скасована — стан екрана змінився');
  }
}
