/* Усі дії користувача. Ключ data-act у розмітці -> функція тут. */
import {
  uid, addDays, diffDays, parseK, dkey, pad, fmtN, fmtDur, fmtDate, fmtShort, fmtTime,
  plural, P, esc, clamp, num,
} from './util.js';
import {
  settings, ui, habits, timer, newHabit, cloneHabit, findHabit, visibleHabits,
  addHabit, replaceHabit, deleteHabit, pushLog, saveLog, reindexAndSave, saveHabit,
  saveSettings, saveTimer, saveOrder, indexHabit, bump, saveHabitsBulk, saveLogsBulk,
} from './state.js';
import {
  TODAY, progress, rowState, activeLogs, logsOn, isScheduled, isPausedOn, inWindow,
  intervalState, canRetro, errors, isComplexGoal, timerElapsedMin, habitSentence,
} from './engine.js';
import { RECIPES, applyRecipe, nextColor, guessIcon, buildDemo, DEMO_SIZE, DEMO_PHOTO_HABIT } from './recipes.js';
import { render } from './render/index.js';
import { toast, pushSheet, closeSheet, topSheet, dropSheets, menu, haptic, clearToast } from './ui.js';
import { savePhoto, deletePhoto } from './photos.js';
import { syncReminders, askPermission, permissionState } from './notifications.js';
import { exportCsv, exportBackup, importBackupFlow, wipeAll } from './backup-actions.js';

const ED = () => { if (!ui.editor) throw new Error('editor closed'); return ui.editor; };
const markDirty = () => { if (ui.editor) ui.editor.dirty = true; };

/* ---------- логи ---------- */
export function createLog(h, { value = null, note = '', photoId = null, date = null, retro = false, early = null, time = null } = {}) {
  const d = date || TODAY();
  let ts;
  if (time) {
    const dt = parseK(d);
    const [hh, mm] = time.split(':').map(Number);
    dt.setHours(hh || 0, mm || 0, 0, 0);
    ts = dt.getTime();
  } else if (retro || d !== TODAY()) {
    ts = parseK(d).setHours(12, 0, 0, 0);
  } else {
    ts = Date.now();
  }
  const l = { id: uid(), habitId: h.id, ts, date: d, value, note, photoId, retro, edited: false, early, deleted: false };
  pushLog(h, l);
  return l;
}

export function doMark(h, opts = {}, el) {
  const today = TODAY();
  if (isPausedOn(h, today) && !opts.date) { toast('Звичка на паузі'); return; }
  if (h.goal.period === 'interval') {
    const iv = intervalState(h);
    if (iv.phase === 'early' && !opts.force) {
      pushSheet({
        t: 'info',
        title: `Ще ${fmtDur(iv.minsLeft)} до дозволеного часу`,
        body: `Дозволене вікно — з ${fmtTime(new Date(iv.from))} до ${fmtTime(new Date(iv.to))}. Відмітити зараз усе одно? Це буде позначено в історії.`,
        buttons: [{ label: 'Відмітити зараз', fn: () => doMark(h, { force: true, early: iv.minsLeft }) }],
      });
      return;
    }
  }
  if (h.time.window && !inWindow(h) && !opts.date && !opts.force) {
    haptic('warning');
    if (el) el.classList.add('shake');
    toast(`Можна відмітити з ${h.time.window.from} до ${h.time.window.to}`);
    return;
  }
  if ((h.requireNote || h.requirePhoto) && !opts.fromSheet) {
    pushSheet({
      t: 'qty', hid: h.id, isCheck: h.type === 'check',
      value: h.type === 'check' ? null : (h.presets[0] || null),
      showNote: h.requireNote, photoId: null, date: opts.date || null, retro: !!opts.retro,
    });
    return;
  }
  const before = progress(h, opts.date || today).done;
  const l = createLog(h, {
    value: opts.value ?? null, note: opts.note || '', photoId: opts.photoId || null,
    date: opts.date, retro: !!opts.retro, early: opts.early || null, time: opts.time || null,
  });
  const after = progress(h, opts.date || today).done;
  if (!before && after && isComplexGoal(h)) { haptic('success'); ui.celebrate = h.id; } else haptic('light');
  dropSheets('qty', 'info', 'menu');
  syncReminders();
  render();
  return l;
}

export function doUndo(h) {
  const today = TODAY();
  const cand = activeLogs(h).filter(l => l.date === today);
  if (!cand.length) { toast('Сьогодні ще нічого не відмічено'); return; }
  const l = cand.reduce((m, x) => (x.ts > m.ts ? x : m));
  l.deleted = true;
  saveLog(h, l);
  haptic('rigid');
  syncReminders();
  const what = h.type === 'qty' ? `+${fmtN(l.value)} ${h.unit}` : h.type === 'time' ? fmtDur(l.value) : 'відмітка';
  toast(`Скасовано: ${what}`, { label: 'Повернути', fn: () => { l.deleted = false; saveLog(h, l); syncReminders(); } });
}

/* ---------- таймер ---------- */
export function startTimer(h) {
  if (timer.hid && timer.hid !== h.id) { toast('Інший таймер уже іде'); return; }
  if (!timer.hid) {
    timer.hid = h.id; timer.startTs = Date.now(); timer.acc = 0; timer.pausedAt = null;
    saveTimer(); haptic('medium');
  }
  pushSheet({ t: 'timer' });
}
function stopTimer(save) {
  const h = findHabit(timer.hid);
  const min = Math.max(1, Math.round(timerElapsedMin()) || 1);
  timer.hid = null; timer.startTs = 0; timer.acc = 0; timer.pausedAt = null;
  saveTimer();
  dropSheets('timer');
  haptic('medium');
  if (save && h) pushSheet({ t: 'qty', hid: h.id, value: min, showNote: false, photoId: null });
  else render();
}

/* ---------- редактор ---------- */
export function openEditor(draft, mode, recipe) {
  ui.editor = { draft, mode, recipe: recipe || null, pop: null, remIdx: null, dirty: false, focusName: mode === 'create' && !recipe, endMode: null, iconManual: false };
  dropSheets('newpick');
  pushSheet({ t: 'editor' });
}
function saveEditor() {
  const e = ui.editor, d = e.draft;
  if (errors(d).length) return;
  d.name = d.name.trim();
  if (e.mode === 'create') {
    d.order = habits.length;
    addHabit(d);
    ui.sheets = []; ui.editor = null; ui.onboarding = null;
    haptic('light');
    ui.tab = 'today';
    ui.seg = isScheduled(d, TODAY()) ? 'today' : 'all';
    if (ui.tag !== 'усі' && !d.tags.includes(ui.tag)) { ui.tag = 'усі'; settings.tagFilter = 'усі'; saveSettings(); }
    toast(`Створено «${d.name}»`);
  } else {
    replaceHabit(d);
    ui.sheets = []; ui.editor = null;
    haptic('light');
  }
  syncReminders();
  render();
}
function pauseMenu(h) {
  menu(`Пауза «${h.name}»`, [
    { label: 'До завтра', fn: () => setPause(h, addDays(TODAY(), 1)) },
    { label: 'На тиждень', fn: () => setPause(h, addDays(TODAY(), 7)) },
    { label: 'Без дати', fn: () => setPause(h, null) },
  ]);
}
function setPause(h, until) {
  h.paused = { since: TODAY(), until };
  saveHabit(h);
  if (ui.editor && ui.editor.draft.id === h.id) ui.editor.draft.paused = h.paused;
  syncReminders();
  toast(`«${h.name}» на паузі${until ? ' до ' + fmtShort(until) : ''}`);
}
function resume(h) {
  h.paused = null;
  saveHabit(h);
  if (ui.editor && ui.editor.draft.id === h.id) ui.editor.draft.paused = null;
  syncReminders();
  toast(`«${h.name}» відновлено`);
}
function deleteMenu(h) {
  const n = activeLogs(h).length;
  menu(`Видалити «${h.name}» і ${n} ${plural(n, P.zapys)}? Це незворотно.`, [
    { label: 'Експортувати бекап перед видаленням', fn: () => exportBackup() },
    {
      label: 'Видалити', danger: true, fn: () => {
        deleteHabit(h);
        ui.sheets = []; ui.editor = null; ui.stack = [];
        syncReminders();
        toast(`«${h.name}» видалено`);
      },
    },
  ]);
}
function archiveHabit(h) {
  h.archived = true;
  saveHabit(h);
  ui.sheets = []; ui.editor = null; ui.stack = [];
  syncReminders();
  toast(`«${h.name}» в архіві`, { label: 'Повернути', fn: () => { h.archived = false; saveHabit(h); render(); } });
}

/* демо-фото: градієнт із датою, щоб сценарій «прогрес форми» був повним */
async function makeDemoPhoto(i, dateKey) {
  try {
    const c = document.createElement('canvas');
    c.width = 720; c.height = 960;
    const x = c.getContext('2d');
    const pair = [['#3E9B6C', '#2A9C93'], ['#4F6D8F', '#7561C9'], ['#D4A012', '#E8782B'], ['#8D7A5E', '#5F6B78']][i % 4];
    const g = x.createLinearGradient(0, 0, 720, 960);
    g.addColorStop(0, pair[0]); g.addColorStop(1, pair[1]);
    x.fillStyle = g; x.fillRect(0, 0, 720, 960);
    x.fillStyle = 'rgba(255,255,255,.88)';
    x.textAlign = 'center';
    x.font = '600 46px -apple-system, Helvetica, sans-serif';
    x.fillText('демо-фото', 360, 470);
    x.font = '400 30px -apple-system, Helvetica, sans-serif';
    x.fillText(fmtDate(dateKey), 360, 520);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
    return blob ? await savePhoto(new File([blob], 'demo.jpg', { type: 'image/jpeg' })) : null;
  } catch (e) { console.warn('[rookh] демо-фото', e); return null; }
}

async function loadDemoData() {
  toast('Готую демо-дані…', null, 120000);
  await new Promise(r => setTimeout(r, 30));
  const demo = buildDemo();
  const base = habits.length;
  demo.forEach((h, i) => { h.order = base + i; indexHabit(h); habits.push(h); });
  saveHabitsBulk(demo);
  const allLogs = demo.flatMap(h => h.logs);
  saveLogsBulk(allLogs);
  bump();
  render();

  const ph = demo.find(h => h.name === DEMO_PHOTO_HABIT);
  if (ph) {
    const recent = ph.logs.slice(-8);
    for (let i = 0; i < recent.length; i++) {
      const id = await makeDemoPhoto(i, recent[i].date);
      if (id) recent[i].photoId = id;
    }
    saveLogsBulk(recent);
    bump();
  }
  syncReminders();
  clearToast();
  toast(`Додано ${demo.length} ${plural(demo.length, P.zvychka)} і ${fmtN(allLogs.length)} ${plural(allLogs.length, P.zapys)}`);
  render();
}

async function pickImage() {
  const { pickFile } = await import('./backup.js');
  const f = await pickFile('image/*');
  if (!f) return null;
  try { return await savePhoto(f); } catch (e) { console.error(e); toast('Не вдалося зберегти фото'); return null; }
}

/* ---------- мапа дій ---------- */
export const ACT = {
  /* навігація */
  tab: d => { ui.tab = d.tab; ui.stack = []; ui.heatTip = null; ui.reorder = false; render(); },
  push: d => { ui.stack.push({ s: d.s }); render(); },
  pop: () => { ui.stack.pop(); ui.heatTip = null; render(); },
  seg: d => { ui.seg = d.seg; if (d.seg !== 'all') ui.reorder = false; render(); },
  tag: d => { ui.tag = d.tag; settings.tagFilter = d.tag; saveSettings(); render(); },
  statsTag: d => { ui.statsTag = d.tag; render(); },
  statsWeeks: d => { ui.statsWeeks = +d.w; render(); },
  toggleDone: () => { ui.doneCollapsed = !ui.doneCollapsed; render(); },
  newDayRefresh: () => { ui.newDayBar = false; ui.dayKey = TODAY(); render(); },
  closeTzBar: () => { ui.tzBar = null; render(); },
  reorderDone: () => { ui.reorder = false; render(); },
  todayMenu: () => menu(null, [
    { label: settings.view === 'list' ? 'Вигляд: плитки' : 'Вигляд: список', fn: () => { settings.view = settings.view === 'list' ? 'tiles' : 'list'; saveSettings(); } },
    { label: settings.hideDone ? 'Показувати виконані' : 'Ховати виконані', fn: () => { settings.hideDone = !settings.hideDone; saveSettings(); } },
    { label: 'Змінити порядок', fn: () => { ui.seg = 'all'; ui.reorder = true; settings.view = 'list'; saveSettings(); } },
    { label: 'Налаштування', fn: () => ui.stack.push({ s: 'settings' }) },
  ]),

  /* створення */
  plus: () => pushSheet({ t: 'newpick' }),
  newBlank: () => { dropSheets('newpick'); openEditor(newHabit({ color: nextColor() }), 'create'); },
  recipe: d => {
    const r = RECIPES.find(x => x.id === d.id);
    if (!r) return;
    dropSheets('newpick');
    openEditor(applyRecipe(r), 'create', r);
  },

  /* рядок */
  openHabit: (d, el, e) => {
    if (e && e.target.closest('[data-act]') !== el) return;
    if (ui.reorder) return;
    ui.stack.push({ s: 'habit', id: d.hid });
    ui.heatTip = null; ui.sheets = [];
    render();
  },
  tileMain: (d, el, e) => {
    const h = findHabit(d.hid);
    if (!h) return;
    if (e.target.closest('.arrow')) { ui.stack.push({ s: 'habit', id: h.id }); ui.sheets = []; render(); return; }
    const st = rowState(h);
    if (st.paused) { ACT.habitMenu(d); return; }
    if (st.locked) { ACT.lockedTap(d); return; }
    if (st.control === 'qty') { if (h.presets[0]) doMark(h, { value: h.presets[0] }, el); else ACT.openQty(d); }
    else if (st.control === 'time') startTimer(h);
    else doMark(h, {}, el);
  },
  mark: (d, el) => { const h = findHabit(d.hid); if (h) doMark(h, {}, el); },
  markNote: d => { const h = findHabit(d.hid); if (h) pushSheet({ t: 'qty', hid: h.id, isCheck: true, showNote: true, photoId: null }); },
  preset: (d, el) => { const h = findHabit(d.hid); if (h) doMark(h, { value: +d.v }, el); },
  openQty: d => {
    const h = findHabit(d.hid);
    if (!h) return;
    pushSheet({ t: 'qty', hid: h.id, value: h.presets[0] || null, showNote: false, photoId: null, date: d.day || null, retro: !!d.day });
  },
  startTimer: d => { const h = findHabit(d.hid); if (h) startTimer(h); },
  openTimer: () => { if (timer.hid) pushSheet({ t: 'timer' }); },
  lockedTap: d => {
    const h = findHabit(d.hid);
    haptic('warning');
    menu(`Відмічати можна з ${h.time.window.from} до ${h.time.window.to}`, [
      { label: 'Відмітити все одно', fn: () => doMark(h, { force: true }) },
    ]);
  },
  retroQuick: d => {
    const h = findHabit(d.hid);
    if (!h) return;
    const y = addDays(TODAY(), -1);
    if (h.type !== 'check') {
      pushSheet({ t: 'qty', hid: h.id, date: y, retro: true, value: h.presets[0] || null, showNote: false, photoId: null });
      return;
    }
    menu(`Вчора, ${fmtDate(y, false)} · «${h.name}» не закрито`, [
      { label: 'Закрити вчора', fn: () => doMark(h, { date: y, retro: true }) },
      { label: 'Пропустити', fn: () => toast('Пропущено — день лишиться порожнім') },
    ]);
  },
  retroMark: d => { const h = findHabit(d.hid); ui.heatTip = null; doMark(h, { date: d.day, retro: true }); },
  heatTap: d => {
    ui.heatTip = ui.heatTip && ui.heatTip.day === d.day && ui.heatTip.key === d.key ? null : { day: d.day, key: d.key };
    render();
  },

  /* життєвий цикл */
  edit: d => { const h = findHabit(d.hid); if (h) openEditor(cloneHabit(h), 'edit'); },
  habitMenu: d => {
    const h = findHabit(d.hid);
    if (!h) return;
    menu(null, [
      { label: 'Відкрити', fn: () => { if (ui.stack[ui.stack.length - 1]?.id !== h.id) ui.stack.push({ s: 'habit', id: h.id }); } },
      { label: 'Редагувати', fn: () => openEditor(cloneHabit(h), 'edit') },
      { label: 'Додати запис із нотаткою', fn: () => pushSheet({ t: 'qty', hid: h.id, isCheck: h.type === 'check', value: h.type === 'check' ? null : (h.presets[0] || null), showNote: true, photoId: null }) },
      { label: 'Скасувати останню', fn: () => doUndo(h) },
      { label: h.paused ? 'Відновити' : 'Пауза', fn: () => (h.paused ? resume(h) : pauseMenu(h)) },
      { label: h.archived ? 'Повернути з архіву' : 'Архівувати', fn: () => { if (h.archived) { h.archived = false; saveHabit(h); } else archiveHabit(h); } },
      { label: 'Видалити', danger: true, fn: () => deleteMenu(h) },
    ]);
  },
  resume: d => { const h = findHabit(d.hid); if (h) resume(h); },
  pauseMenu: d => { const h = findHabit(d.hid); if (h) pauseMenu(h); },
  archive: d => { const h = findHabit(d.hid); if (h) archiveHabit(h); },
  unarchive: d => { const h = findHabit(d.hid); if (h) { h.archived = false; saveHabit(h); render(); } },
  deleteMenu: d => { const h = findHabit(d.hid); if (h) deleteMenu(h); },
  archiveMenu: d => {
    const h = findHabit(d.hid);
    menu(h.name, [
      { label: 'Повернути', fn: () => { h.archived = false; saveHabit(h); } },
      { label: 'Відкрити', fn: () => { ui.stack.push({ s: 'habit', id: h.id }); } },
      { label: 'Видалити', danger: true, fn: () => deleteMenu(h) },
    ]);
  },

  /* записи */
  openLog: d => pushSheet({ t: 'log', hid: d.hid, lid: d.lid }),
  logSave: d => {
    const sh = ui.sheets.find(s => s.id === d.sid);
    const h = findHabit(sh.hid);
    const l = h.logs.find(x => x.id === sh.lid);
    if (l && sh.changed) {
      const c = sh.changed;
      if ('value' in c) l.value = c.value;
      if ('note' in c) l.note = c.note;
      if (c.date || c.time) {
        const date = c.date || l.date;
        const time = c.time || (pad(new Date(l.ts).getHours()) + ':' + pad(new Date(l.ts).getMinutes()));
        const dt = parseK(date);
        const [hh, mm] = time.split(':').map(Number);
        dt.setHours(hh || 0, mm || 0, 0, 0);
        l.ts = dt.getTime();
        l.date = date;
      }
      l.edited = true;
      reindexAndSave(h, l);
      syncReminders();
    }
    closeSheet(sh.id);
  },
  logPhoto: () => {
    const sh = topSheet('log');
    const h = findHabit(sh.hid);
    const l = h.logs.find(x => x.id === sh.lid);
    pickImage().then(id => {
      if (!id) return;
      if (l.photoId) deletePhoto(l.photoId);
      l.photoId = id; l.edited = true;
      saveLog(h, l);
      render();
    });
  },
  logPhotoDelete: () => {
    const sh = topSheet('log');
    const h = findHabit(sh.hid);
    const l = h.logs.find(x => x.id === sh.lid);
    if (l.photoId) { deletePhoto(l.photoId); l.photoId = null; l.edited = true; saveLog(h, l); render(); }
  },
  viewPhoto: d => pushSheet({ t: 'photo', pid: d.pid }),
  logDelete: () => {
    const sh = topSheet('log');
    const h = findHabit(sh.hid);
    const l = h.logs.find(x => x.id === sh.lid);
    l.deleted = true;
    saveLog(h, l);
    closeSheet(sh.id);
    syncReminders();
    toast('Запис видалено', { label: 'Повернути', fn: () => { l.deleted = false; saveLog(h, l); render(); } });
  },

  /* листи */
  closeSheet: d => {
    const sh = ui.sheets.find(s => s.id === d.sid);
    if (sh && sh.t === 'sub' && ui.editor) ui.editor.pop = null;
    closeSheet(d.sid);
  },
  menuItem: d => {
    const sh = ui.sheets.find(s => s.id === d.sid);
    if (!sh) return;
    const it = sh.items[+d.i];
    closeSheet(d.sid);
    it.fn();
    render();
  },
  infoBtn: d => {
    const sh = ui.sheets.find(s => s.id === d.sid);
    if (!sh) return;
    const b = sh.buttons[+d.i];
    closeSheet(d.sid);
    b.fn();
    render();
  },
  toastAction: () => { const a = ui.toast && ui.toast.action; clearToast(); if (a) a.fn(); render(); },

  /* лист кількості */
  qtyPreset: d => { const sh = topSheet('qty'); sh.value = +d.v; render(); },
  qtyStep: d => {
    const sh = topSheet('qty');
    const h = findHabit(sh.hid);
    const step = h.type === 'time' ? 5 : (h.presets[0] || 1);
    sh.value = Math.max(0, (+sh.value || 0) + step * +d.v);
    render();
  },
  qtyToggle: d => { const sh = topSheet('qty'); sh[d.k] = !sh[d.k]; render(); },
  qtyPhoto: () => {
    const sh = topSheet('qty');
    pickImage().then(id => { if (id) { if (sh.photoId) deletePhoto(sh.photoId); sh.photoId = id; render(); } });
  },
  qtyTime: () => { const sh = topSheet('qty'); sh.timePicker = !sh.timePicker; render(); },
  qtyTimeNow: () => { const sh = topSheet('qty'); sh.time = null; sh.timePicker = false; render(); },
  qtySave: () => {
    const sh = topSheet('qty');
    const h = findHabit(sh.hid);
    doMark(h, {
      value: sh.isCheck ? null : num(sh.value),
      note: sh.note, photoId: sh.photoId, date: sh.date, time: sh.time,
      retro: !!(sh.date && sh.date !== TODAY()) || !!sh.retro,
      fromSheet: true,
    });
  },

  /* таймер */
  timerPause: () => {
    if (timer.pausedAt) { timer.acc += timer.pausedAt - timer.startTs; timer.startTs = Date.now(); timer.pausedAt = null; }
    else timer.pausedAt = Date.now();
    saveTimer(); render();
  },
  timerStop: () => stopTimer(true),
  timerDiscard: () => menu('Відкинути сесію без збереження?', [{ label: 'Відкинути', danger: true, fn: () => stopTimer(false) }]),

  /* редактор */
  editorCancel: () => {
    if (ui.editor && ui.editor.dirty) {
      menu('Відкинути зміни?', [{ label: 'Відкинути', danger: true, fn: () => { ui.sheets = []; ui.editor = null; } }]);
      return;
    }
    ui.sheets = []; ui.editor = null; render();
  },
  editorSave: () => saveEditor(),
  setType: d => {
    const e = ED(), h = e.draft;
    if (h.type === d.v) return;
    h.type = d.v;
    markDirty();
    if (d.v === 'check') { h.goal.n = 1; h.presets = []; h.goal.second = null; h.unit = ''; }
    if (d.v === 'qty') { h.goal.n = h.unit === 'мл' ? 2000 : 1; if (h.unit === 'мл' && !h.presets.length) h.presets = [250, 500]; }
    if (d.v === 'time') { h.goal.n = 30; h.presets = h.presets.length ? h.presets : [15, 25, 60]; }
    if (d.v !== 'check' && h.goal.period === 'interval') h.goal.period = 'day';
    e.pop = null;
    const ex = findHabit(h.id);
    if (e.mode === 'edit' && ex && activeLogs(ex).length) toast(`Історія ${activeLogs(ex).length} ${plural(activeLogs(ex).length, P.zapys)} буде показана за новим типом`);
    render();
  },
  goalPop: d => { const e = ED(); e.pop = e.pop === d.pop ? null : d.pop; render(); },
  popSet: d => {
    const e = ED(), g = e.draft.goal;
    markDirty();
    let keep = false;
    switch (e.pop) {
      case 'kind':
        g.kind = d.v;
        if ((d.v === 'max' || d.v === 'exact') && g.n < 1) g.n = 1;
        if (d.v === 'none') g.second = null;
        if (d.v !== 'min' && g.period === 'interval') g.period = 'day';
        break;
      case 'n': g.n = +d.v; break;
      case 'n2': g.second.n = +d.v; break;
      case 'period':
        g.period = d.v;
        if (d.v === 'interval') { e.draft.time.retro = 'none'; e.draft.time.window = null; g.second = null; g.kind = 'min'; g.n = 1; }
        keep = d.v === 'everyN';
        break;
      case 'ivh': g.intervalH = +d.v; break;
      case 'tol': g.tolH = +d.v; break;
    }
    if (!keep) e.pop = null;
    render();
  },
  setEveryN: d => { ED().draft.goal.everyN = +d.v; markDirty(); render(); },
  addSecond: () => { const e = ED(); e.draft.goal.second = { n: 5 }; e.pop = 'n2'; markDirty(); render(); },
  removeSecond: () => { ED().draft.goal.second = null; markDirty(); render(); },
  removePreset: d => { const h = ED().draft; h.presets = h.presets.filter(p => p != d.v); markDirty(); render(); },
  openSub: d => { ED().pop = null; dropSheets('sub'); pushSheet({ t: 'sub', sub: d.sub }); },
  schedDays: d => { const h = ED().draft; h.schedule.days = d.v === 'all' ? null : (h.schedule.days || [0, 1, 2, 3, 4]); markDirty(); render(); },
  toggleDay: d => {
    const h = ED().draft;
    const s = new Set(h.schedule.days || []);
    const i = +d.d;
    s.has(i) ? s.delete(i) : s.add(i);
    h.schedule.days = [...s].sort((a, b) => a - b);
    h.reminders.forEach(r => { if (!r.daysCustom && r.type !== 'interval') r.days = h.schedule.days.length ? [...h.schedule.days] : [0, 1, 2, 3, 4, 5, 6]; });
    markDirty(); render();
  },
  endMode: d => {
    const e = ED(), h = e.draft;
    e.endMode = d.v;
    if (d.v === 'none') h.schedule.end = null;
    if (d.v === 'days' && !h.schedule.end) h.schedule.end = addDays(h.schedule.start, 13);
    if (d.v === 'date' && !h.schedule.end) h.schedule.end = addDays(h.schedule.start, 30);
    markDirty(); render();
  },
  endDays: d => { const h = ED().draft; h.schedule.end = addDays(h.schedule.start, +d.v - 1); markDirty(); render(); },
  winMode: d => { const h = ED().draft; h.time.window = d.v === 'any' ? null : (h.time.window || { from: '22:00', to: '00:00' }); markDirty(); render(); },
  retroMode: d => {
    const h = ED().draft;
    h.time.retro = d.v === 'n' ? 3 : (d.v === 'none' || d.v === 'yesterday') ? d.v : +d.v;
    markDirty(); render();
  },
  addRem: () => {
    const e = ED(), h = e.draft;
    h.reminders.push({
      id: uid(), type: 'exact', time: '08:00',
      days: h.schedule.days && h.schedule.days.length ? [...h.schedule.days] : [0, 1, 2, 3, 4, 5, 6],
      text: '', from: '10:00', to: '18:00', count: 2,
    });
    e.remIdx = h.reminders.length - 1;
    markDirty();
    dropSheets('sub');
    pushSheet({ t: 'sub', sub: 'reminder' });
    if (permissionState() === 'default') askPermission().then(() => render());
  },
  editRem: d => { ED().remIdx = +d.i; dropSheets('sub'); pushSheet({ t: 'sub', sub: 'reminder' }); },
  remType: d => { const e = ED(); e.draft.reminders[e.remIdx].type = d.v; markDirty(); render(); },
  remCount: d => { const e = ED(); e.draft.reminders[e.remIdx].count = +d.v; markDirty(); render(); },
  remToggleDay: d => {
    const e = ED(), r = e.draft.reminders[e.remIdx];
    const s = new Set(r.days);
    s.has(+d.d) ? s.delete(+d.d) : s.add(+d.d);
    r.days = [...s].sort((a, b) => a - b);
    r.daysCustom = true;
    markDirty(); render();
  },
  remDaysReset: () => {
    const e = ED(), h = e.draft, r = h.reminders[e.remIdx];
    r.days = h.schedule.days ? [...h.schedule.days] : [0, 1, 2, 3, 4, 5, 6];
    r.daysCustom = false;
    markDirty(); render();
  },
  remDelete: () => {
    const e = ED();
    e.draft.reminders.splice(e.remIdx, 1);
    e.remIdx = null;
    markDirty();
    dropSheets('sub');
    pushSheet({ t: 'sub', sub: 'reminders' });
  },
  toggleIvReminder: () => {
    const h = ED().draft;
    const i = h.reminders.findIndex(r => r.type === 'interval');
    if (i >= 0) h.reminders.splice(i, 1);
    else {
      h.reminders.push({ id: uid(), type: 'interval', before: 10 });
      if (permissionState() === 'default') askPermission().then(() => render());
    }
    markDirty(); render();
  },
  ivBefore: d => { const r = ED().draft.reminders.find(x => x.type === 'interval'); if (r) { r.before = +d.v; markDirty(); render(); } },
  removeTag: d => { const h = ED().draft; h.tags = h.tags.filter(t => t !== d.v); markDirty(); render(); },
  toggleDraft: d => { const h = ED().draft; h[d.key] = !h[d.key]; markDirty(); render(); },
  setColor: d => { ED().draft.color = +d.v; markDirty(); render(); },
  setIcon: d => { const e = ED(); e.draft.icon = d.v; e.iconManual = true; markDirty(); render(); },

  /* налаштування */
  toggleSetting: d => { settings[d.key] = !settings[d.key]; saveSettings(); render(); },
  askPerm: () => {
    if (permissionState() === 'unsupported') { toast('Браузер не підтримує сповіщення'); return; }
    if (permissionState() === 'denied') { toast('Дозвіл заборонено — увімкніть у налаштуваннях системи'); return; }
    askPermission().then(p => { if (p === 'granted') { syncReminders(); toast('Сповіщення дозволено'); } render(); });
  },
  exportCsv: () => exportCsv(),
  exportBackup: () => exportBackup(),
  importBackup: () => importBackupFlow(),
  loadDemo: () => menu(`Додати ${DEMO_SIZE.habits} демо-звичок з історією до року? Вони покривають усі сценарії маніфесту.`, [
    { label: 'Додати', fn: () => loadDemoData() },
  ]),
  showOnboarding: () => { ui.onboarding = 1; ui.sheets = []; ui.stack = []; render(); },
  wipeAll: () => menu('Стерти всі звички, записи й налаштування? Це незворотно.', [
    { label: 'Спочатку зробити бекап', fn: () => exportBackup() },
    {
      label: 'Стерти все', danger: true, fn: () => {
        wipeAll().then(() => {
          ui.stack = []; ui.sheets = []; ui.editor = null; ui.tag = 'усі';
          Object.assign(settings, { onboarded: false });
          ui.onboarding = 1;
          syncReminders();
          render();
        });
      },
    },
  ]),

  /* онбординг */
  onb: d => { ui.onboarding = +d.s; render(); },
  onbPick: d => { ui.onbPick.has(d.id) ? ui.onbPick.delete(d.id) : ui.onbPick.add(d.id); render(); },
  onbFinish: () => {
    [...ui.onbPick].forEach(id => {
      const r = RECIPES.find(x => x.id === id);
      if (!r) return;
      const h = applyRecipe(r);
      h.order = habits.length;
      addHabit(h);
    });
    ui.onbPick.clear();
    ui.onboarding = null;
    settings.onboarded = true; saveSettings();
    ui.tab = 'today'; ui.stack = [];
    syncReminders();
    toast('Перша відмітка — один тап по колу праворуч');
  },
  onbOwn: () => { settings.onboarded = true; saveSettings(); openEditor(newHabit({ color: nextColor() }), 'create'); },
  onbSkip: () => { ui.onboarding = null; settings.onboarded = true; saveSettings(); render(); },
};

/* ---------- поля вводу ---------- */
export const INP = {
  name: v => { const e = ED(), h = e.draft; h.name = v; if (!e.iconManual) { const g = guessIcon(v); if (g !== '•' || h.icon === '•') h.icon = g; } markDirty(); return 'partial'; },
  unit: v => { const h = ED().draft; h.unit = v; if (v === 'мл' && !h.presets.length) { h.presets = [250, 500]; markDirty(); return 'full'; } markDirty(); return 'partial'; },
  goalN: v => { ED().draft.goal.n = Math.max(0, num(v) || 0); markDirty(); return 'partial'; },
  goalN2: v => { ED().draft.goal.second.n = Math.max(1, +v || 1); markDirty(); return 'partial'; },
  ivh: v => { ED().draft.goal.intervalH = clamp(+v || 1, 1, 168); markDirty(); return 'partial'; },
  start: v => { if (v) { ED().draft.schedule.start = v; markDirty(); return 'full'; } return 'none'; },
  end: v => { ED().draft.schedule.end = v || null; markDirty(); return 'full'; },
  winFrom: v => { if (v) ED().draft.time.window.from = v; markDirty(); return 'none'; },
  winTo: v => { if (v) ED().draft.time.window.to = v; markDirty(); return 'none'; },
  remTime: v => { if (v) ED().draft.reminders[ED().remIdx].time = v; markDirty(); return 'none'; },
  remFrom: v => { if (v) ED().draft.reminders[ED().remIdx].from = v; markDirty(); return 'none'; },
  remTo: v => { if (v) ED().draft.reminders[ED().remIdx].to = v; markDirty(); return 'none'; },
  remText: v => { ED().draft.reminders[ED().remIdx].text = v; markDirty(); return 'none'; },
  desc: v => { ED().draft.desc = v; markDirty(); return 'none'; },
  qtyVal: v => { topSheet('qty').value = num(v); return 'partial'; },
  qtyNote: v => { topSheet('qty').note = v; return 'partial'; },
  qtyTimeVal: v => { topSheet('qty').time = v || null; return 'none'; },
  logVal: v => { const sh = topSheet('log'); sh.changed = Object.assign(sh.changed || {}, { value: num(v) }); return 'none'; },
  logDate: v => { const sh = topSheet('log'); sh.changed = Object.assign(sh.changed || {}, { date: v }); return 'none'; },
  logTime: v => { const sh = topSheet('log'); sh.changed = Object.assign(sh.changed || {}, { time: v }); return 'none'; },
  logNote: v => { const sh = topSheet('log'); sh.changed = Object.assign(sh.changed || {}, { note: v }); return 'none'; },
};

/* оновлення підписів без втрати фокуса */
export function partialUpdate() {
  const e = ui.editor;
  if (e) {
    const h = e.draft;
    const s = document.getElementById('ed-summary');
    if (s) s.textContent = habitSentence(h);
    const nm = document.querySelector('#ed-name .icon');
    if (nm) nm.textContent = h.icon;
    const sv = document.getElementById('ed-save');
    if (sv) sv.disabled = !!errors(h).length || (e.mode === 'edit' && !e.dirty);
    const t = document.querySelector('.sheet.full .nav .title');
    if (t && e.mode === 'edit') t.textContent = h.name;
  }
  const q = topSheet('qty');
  if (q) {
    const hh = findHabit(q.hid);
    const b = document.querySelector('.overlay:last-of-type .sheet .bigbtn');
    if (b && hh) {
      b.textContent = q.isCheck ? 'Відмітити' : hh.type === 'time' ? `Додати ${fmtDur(q.value || 0)}` : `Додати ${fmtN(q.value || 0)} ${hh.unit}`;
      b.disabled = (!q.value && !q.isCheck) || (hh.requireNote && !(q.note || '').trim()) || (hh.requirePhoto && !q.photoId);
    }
  }
}

export { doMark as _doMark, doUndo as _doUndo, startTimer as _startTimer };
