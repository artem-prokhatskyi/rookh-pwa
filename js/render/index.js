/* Один рендер усього екрана. Стан -> HTML -> innerHTML. */
import { esc } from '../util.js';
import { settings, ui, findHabit } from '../state.js';
import { hydratePhotos } from '../photos.js';
import { renderToday } from './today.js';
import { renderHabit } from './habit.js';
import { renderStats } from './stats.js';
import { renderSettings, renderArchive, renderOnboarding } from './settings.js';
import { renderSheet } from './sheets.js';

const app = () => document.getElementById('app');

export function applyTheme() {
  let t = settings.theme;
  if (t === 'system') t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.body.dataset.theme = t;
  document.body.dataset.light = settings.light === false ? 'off' : 'on';
  const meta = document.querySelector('meta[name="theme-color"]:not([media])');
  if (meta) meta.content = t === 'dark' ? '#131315' : '#F5F3EE';
}

/* усі прокручувані контейнери в порядку документа: головний екран, потім листи */
const scrollables = root => [...root.querySelectorAll('.content, .sheet')];

export function render() {
  const root = app();
  const top = ui.stack[ui.stack.length - 1];
  const key = ui.onboarding ? 'onb' + ui.onboarding : top ? top.s + (top.id || '') : ui.tab;
  const changed = key !== ui.lastKey;
  // позиції прокрутки треба зберегти до заміни розмітки
  const prev = changed ? [] : scrollables(root).map(el => el.scrollTop);
  if (changed) { ui.tabMini = false; ui.lastKey = key; }
  applyTheme();

  let html = '';
  if (ui.onboarding) html += renderOnboarding();
  else if (!top) html += ui.tab === 'today' ? renderToday() : renderStats();
  else if (top.s === 'habit') {
    const h = findHabit(top.id);
    if (!h) { ui.stack.pop(); return render(); }
    html += renderHabit(h);
  } else if (top.s === 'settings') html += renderSettings();
  else if (top.s === 'archive') html += renderArchive();

  ui.sheets.forEach(sh => { html += renderSheet(sh); });
  if (ui.toast) html += `<div class="toast"><span>${esc(ui.toast.text)}</span>${ui.toast.action ? `<button data-act="toastAction">${esc(ui.toast.action.label)}</button>` : ''}</div>`;

  root.innerHTML = html;

  const nodes = scrollables(root);
  const restore = () => nodes.forEach((el, i) => {
    const v = prev[i];
    if (v && el.isConnected && el.scrollTop !== v) el.scrollTop = v;
  });
  restore();
  requestAnimationFrame(restore); // Safari іноді обрізає scrollTop до першого лейауту
  const c = root.querySelector('.screen > .content');
  if (c) c.dataset.lastY = String(c.scrollTop);
  if (ui.celebrate) {
    const r = root.querySelector(`.row[data-hid="${ui.celebrate}"]`);
    if (r) r.classList.add('celebrate');
    ui.celebrate = null;
  }
  const f = root.querySelector('[data-autofocus]');
  if (f && document.activeElement !== f) {
    f.focus();
    if (f.type === 'text' && f.value) try { f.setSelectionRange(f.value.length, f.value.length); } catch (e) { /* ignore */ }
  }
  hydratePhotos(root);
}
