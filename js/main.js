/* Старт, події, жести. */
import { loadAll, settings, ui, habits, timer, findHabit, applyOrder } from './state.js';
import { setDbErrorHandler, kvGet, kvSet } from './db.js';
import { TODAY, rowState, timerElapsedMin } from './engine.js';
import { render, applyTheme } from './render/index.js';
import { ACT, INP, partialUpdate, doMark, doUndo, startTimer, openEditor } from './actions.js';
import { toast, menu, haptic, topSheet, safe, pushSheet } from './ui.js';
import { syncReminders, loadFired } from './notifications.js';
import { cloneHabit } from './state.js';

const app = () => document.getElementById('app');

/* ---------- події ---------- */
let suppressClick = false;

function bindEvents() {
  const root = app();

  root.addEventListener('click', e => {
    if (suppressClick) return;
    const el = e.target.closest('[data-act]');
    if (!el) return;
    if (el.classList.contains('overlay') && e.target !== el) return;
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') return;
    const fn = ACT[el.dataset.act];
    if (fn) safe(() => fn(el.dataset, el, e));
  });

  root.addEventListener('input', e => {
    const key = e.target.dataset.in;
    if (!key) return;
    if (key === 'presetAdd' || key === 'tagAdd') return;
    safe(() => {
      const mode = INP[key] && INP[key](e.target.value);
      if (mode === 'partial') partialUpdate();
      else if (mode !== 'none') render();
    });
  });

  root.addEventListener('keydown', e => safe(() => {
    if (e.key !== 'Enter') return;
    const key = e.target.dataset.in;
    if (!key) return;
    if (key === 'presetAdd') {
      const v = +e.target.value;
      if (v > 0 && ui.editor) {
        const h = ui.editor.draft;
        if (!h.presets.includes(v)) h.presets.push(v);
        h.presets.sort((a, b) => a - b);
        ui.editor.dirty = true;
        render();
      }
      e.preventDefault();
      return;
    }
    if (key === 'tagAdd') {
      const v = e.target.value.trim();
      if (v && ui.editor) {
        const h = ui.editor.draft;
        if (!h.tags.includes(v)) h.tags.push(v);
        ui.editor.dirty = true;
        render();
      }
      e.preventDefault();
      return;
    }
    if (key === 'name') { e.target.blur(); if (ui.editor) ui.editor.focusName = false; e.preventDefault(); return; }
    if (key === 'goalN' || key === 'goalN2' || key === 'ivh') { if (ui.editor) ui.editor.pop = null; render(); e.preventDefault(); }
  }));

  root.addEventListener('change', e => safe(() => {
    const sel = e.target.dataset.sel;
    if (sel) {
      let v = e.target.value;
      if (['firstDay', 'snooze'].includes(sel)) v = +v;
      settings[sel] = v;
      import('./state.js').then(m => m.saveSettings());
      render();
      return;
    }
    const key = e.target.dataset.in;
    if (key && INP[key]) {
      const mode = INP[key](e.target.value);
      if (mode === 'partial') partialUpdate();
      else if (mode !== 'none') render();
    }
  }));

  root.addEventListener('scroll', e => {
    const c = e.target;
    if (!c.classList || !c.classList.contains('content') || c.closest('.sheet')) return;
    const last = +c.dataset.lastY || 0, y = c.scrollTop;
    const tb = root.querySelector('.tabbar');
    if (tb) {
      if (y > last + 6 && y > 40 && !ui.tabMini) { ui.tabMini = true; tb.classList.add('mini'); }
      else if ((y < last - 6 || y < 20) && ui.tabMini) { ui.tabMini = false; tb.classList.remove('mini'); }
    }
    c.dataset.lastY = String(y);
  }, true);

  bindGestures(root);
}

/* ---------- жести по рядках ---------- */
let drag = null, reorder = null, pressTimer = null;

function longPressMenu(h, row) {
  const rr = row.getBoundingClientRect();
  const y = Math.min(Math.max(rr.bottom + 6, 120), window.innerHeight - 320);
  menu(null, [
    { label: 'Відкрити', fn: () => { ui.stack.push({ s: 'habit', id: h.id }); ui.sheets = []; } },
    { label: 'Відмітити', fn: () => doMark(h) },
    { label: 'Додати запис із нотаткою', fn: () => pushSheet({ t: 'qty', hid: h.id, isCheck: h.type === 'check', value: h.type === 'check' ? null : (h.presets[0] || null), showNote: true, photoId: null }) },
    { label: 'Скасувати останню', fn: () => doUndo(h) },
    { label: h.paused ? 'Відновити' : 'Пауза', fn: () => ACT.habitMenu({ hid: h.id }) },
    { label: 'Редагувати', fn: () => openEditor(cloneHabit(h), 'edit') },
    { label: 'Змінити порядок', fn: () => { ui.seg = 'all'; ui.reorder = true; } },
  ], { anchor: { y } });
}

function bindGestures(root) {
  root.addEventListener('pointerdown', e => {
    const handle = e.target.closest('[data-handle]');
    if (handle && ui.reorder) {
      const wrap = handle.closest('.rowwrap');
      const list = wrap && wrap.parentElement;
      if (!wrap || !list) return;
      const items = [...list.querySelectorAll('.rowwrap')];
      reorder = {
        wrap, list, items, y0: e.clientY, dy: 0,
        rects: items.map(el => el.getBoundingClientRect()),
        index: items.indexOf(wrap),
      };
      wrap.style.zIndex = '5';
      wrap.style.position = 'relative';
      wrap.style.opacity = '.9';
      haptic('medium');
      e.preventDefault();
      return;
    }
    const row = e.target.closest('.row');
    if (!row || !row.dataset.hid || ui.reorder) return;
    drag = { row, x0: e.clientX, y0: e.clientY, dx: 0, moved: false, hid: row.dataset.hid, long: false };
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      if (drag && !drag.moved) {
        drag.long = true;
        haptic('medium');
        const h = findHabit(drag.hid);
        if (h) safe(() => longPressMenu(h, drag.row));
      }
    }, 550);
  });

  root.addEventListener('pointermove', e => {
    if (reorder) {
      reorder.dy = e.clientY - reorder.y0;
      reorder.wrap.style.transform = `translateY(${reorder.dy}px)`;
      e.preventDefault();
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved && Math.hypot(dx, dy) > 8) {
      drag.moved = true;
      clearTimeout(pressTimer);
      if (Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
      drag.row.classList.add('dragging');
    }
    if (drag.moved) {
      drag.dx = Math.max(-140, Math.min(140, dx));
      drag.row.style.transform = `translateX(${drag.dx}px)`;
    }
  }, { passive: false });

  const end = () => {
    clearTimeout(pressTimer);
    if (reorder) {
      const r = reorder;
      reorder = null;
      r.wrap.style.transform = '';
      r.wrap.style.opacity = '';
      r.wrap.style.zIndex = '';
      const centre = r.rects[r.index].top + r.rects[r.index].height / 2 + r.dy;
      let target = 0;
      for (let i = 0; i < r.rects.length; i++) {
        const m = r.rects[i].top + r.rects[i].height / 2;
        if (centre > m) target = i;
      }
      if (target !== r.index) {
        const ids = r.items.map(el => el.querySelector('.row').dataset.hid);
        const [moved] = ids.splice(r.index, 1);
        ids.splice(target, 0, moved);
        safe(() => { applyOrder(ids); haptic('light'); });
      }
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 60);
      render();
      return;
    }
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.moved) {
      d.row.classList.remove('dragging');
      d.row.style.transform = '';
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 60);
      const h = findHabit(d.hid);
      if (!h) return;
      safe(() => {
        if (d.dx < -80) {
          const st = rowState(h);
          if (st.paused) { toast('Звичка на паузі'); return; }
          if (st.locked) { ACT.lockedTap({ hid: h.id }); return; }
          if (st.control === 'qty') { if (h.presets[0]) doMark(h, { value: h.presets[0] }); else ACT.openQty({ hid: h.id }); }
          else if (st.control === 'time') startTimer(h);
          else doMark(h, {});
        } else if (d.dx > 80) doUndo(h);
      });
    } else if (d.long) {
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 60);
    }
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);
}

/* ---------- годинник ---------- */
function canAutoRender() {
  if (drag || reorder) return false;           // не рвемо жест перемальовуванням
  const ae = document.activeElement;
  if (ae && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName)) return false;
  if (ui.editor) return false;
  const top = ui.sheets[ui.sheets.length - 1];
  if (top && top.t !== 'timer') return false;
  return true;
}
function needsTick() {
  if (timer.hid) return true;
  return habits.some(h => !h.archived && (h.goal.period === 'interval' || h.time.window));
}
function startClock() {
  setInterval(() => {
    if (timer.hid && !timer.pausedAt && (topSheet('timer') || document.querySelector('.circ.running'))) {
      if (canAutoRender()) render();
      return;
    }
  }, 1000);
  setInterval(() => {
    const t = TODAY();
    if (ui.dayKey && t !== ui.dayKey && !ui.newDayBar) {
      ui.newDayBar = true;
      if (canAutoRender()) render();
      return;
    }
    if (needsTick() && canAutoRender()) render();
  }, 30000);
}

/* ---------- старт ---------- */
async function boot() {
  setDbErrorHandler(err => {
    console.error('[rookh][db]', err);
    toast('Не вдалося зберегти дані');
  });
  try {
    await loadAll();
    await loadFired();
  } catch (e) {
    console.error(e);
    document.getElementById('app').innerHTML = '<div class="boot">Не вдалося відкрити базу даних.<br>Перевірте, що приватний режим вимкнено.</div>';
    return;
  }
  ui.dayKey = TODAY();
  ui.tag = settings.tagFilter || 'усі';
  if (!habits.length && !settings.onboarded) ui.onboarding = 1;

  const tz = new Date().getTimezoneOffset();
  const savedTz = await kvGet('tzOffset');
  if (savedTz !== undefined && savedTz !== tz) ui.tzBar = 'Часовий пояс змінився. Періоди рахуються за новим часом.';
  kvSet('tzOffset', tz).catch(() => {});

  applyTheme();
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if (settings.theme === 'system') render(); };
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
  }

  render();
  bindEvents();
  startClock();
  syncReminders();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const t = TODAY();
    if (ui.dayKey && t !== ui.dayKey) { ui.newDayBar = true; }
    syncReminders();
    if (canAutoRender()) render();
  });

  window.addEventListener('error', ev => console.error('[rookh] uncaught', ev.error || ev.message));
  window.addEventListener('unhandledrejection', ev => console.error('[rookh] promise', ev.reason));

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(e => console.warn('SW', e));
  }
}

boot();
