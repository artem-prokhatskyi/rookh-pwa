/* Стан додатка в памʼяті + наскрізний запис у IndexedDB. */
import { dbGetAll, dbPut, dbDelete, dbDeleteMany, dbPutMany, kvGet, kvSet, persist } from './db.js';
import { setH12, uid, dkey } from './util.js';

export const DEFAULT_SETTINGS = {
  dayEnd: '00:00',      // межа доби
  firstDay: 0,          // 0 = понеділок
  timeFmt: '24',
  theme: 'system',
  view: 'list',
  hideDone: false,
  snooze: 30,
  light: true,
  tagFilter: 'усі',
  notifAsked: false,
  onboarded: false,
};

export const settings = { ...DEFAULT_SETTINGS };
export const habits = [];
export const timer = { hid: null, startTs: 0, pausedAt: null, acc: 0 };

export const ui = {
  tab: 'today', stack: [], seg: 'today', tag: 'усі', statsTag: 'усі', statsWeeks: 12,
  doneCollapsed: false, sheets: [], editor: null, toast: null, onboarding: null,
  onbPick: new Set(), heatTip: null, celebrate: null, newDayBar: false, tzBar: null,
  reorder: false, tabMini: false, lastKey: null, dayKey: null,
};

/* ---- версія даних для скидання мемоізації двигуна ---- */
export const dataVersion = { v: 0 };
export function bump() { dataVersion.v++; }

/* ---- індекс логів за датою ---- */
export function indexHabit(h) {
  const m = new Map();
  for (const l of h.logs) {
    let a = m.get(l.date);
    if (!a) { a = []; m.set(l.date, a); }
    a.push(l);
  }
  for (const a of m.values()) a.sort((x, y) => x.ts - y.ts);
  h._byDate = m;
}

export function newHabit(over = {}) {
  const h = Object.assign({
    id: uid(), name: '', icon: '•', color: 0, type: 'check', unit: '', presets: [],
    goal: { kind: 'min', n: 1, period: 'day', everyN: 3, intervalH: 8, tolH: 1, second: null },
    schedule: { days: null, start: dkey(new Date()), end: null },
    time: { window: null, retro: 'yesterday' },
    reminders: [], tags: [], desc: '', requireNote: false, requirePhoto: false,
    paused: null, archived: false, order: 0, createdAt: Date.now(),
  }, over);
  h.logs = over.logs || [];
  indexHabit(h);
  return h;
}
export const cloneHabit = h => {
  const c = JSON.parse(JSON.stringify(stripHabit(h)));
  c.logs = h.logs; c._byDate = h._byDate;
  return c;
};
export function stripHabit(h) {
  const { logs, _byDate, ...rest } = h;
  return rest;
}

export const findHabit = id => habits.find(h => h.id === id);
export const visibleHabits = () => habits.filter(h => !h.archived).sort((a, b) => a.order - b.order);
export const allTags = () => [...new Set(visibleHabits().flatMap(h => h.tags))].sort((a, b) => a.localeCompare(b, 'uk'));

/* ---------- завантаження ---------- */
export async function loadAll() {
  const saved = await kvGet('settings');
  if (saved) Object.assign(settings, saved);
  setH12(settings.timeFmt === '12');
  ui.tag = settings.tagFilter || 'усі';

  const [hs, ls] = await Promise.all([dbGetAll('habits'), dbGetAll('logs')]);
  const byId = new Map();
  habits.length = 0;
  hs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).forEach(h => {
    h.logs = [];
    habits.push(h);
    byId.set(h.id, h);
  });
  for (const l of ls) {
    const h = byId.get(l.habitId);
    if (h) h.logs.push(l);
  }
  habits.forEach(h => { h.logs.sort((a, b) => a.ts - b.ts); indexHabit(h); });

  const t = await kvGet('timer');
  if (t && t.hid && byId.has(t.hid)) Object.assign(timer, t);
  bump();
}

/* ---------- запис ---------- */
export function saveSettings() {
  setH12(settings.timeFmt === '12');
  const copy = { ...settings };
  persist(() => kvSet('settings', copy));
  bump(); // перший день тижня / межа доби впливають на розрахунки
}
export function saveTimer() {
  const copy = { ...timer };
  persist(() => kvSet('timer', copy));
}
export function saveHabit(h) {
  const copy = JSON.parse(JSON.stringify(stripHabit(h)));
  persist(() => dbPut('habits', copy));
  bump();
}
export function addHabit(h) {
  habits.push(h);
  saveHabit(h);
  return h;
}
export function replaceHabit(draft) {
  const i = habits.findIndex(h => h.id === draft.id);
  if (i < 0) return null;
  const old = habits[i];
  draft.logs = old.logs;
  indexHabit(draft);
  habits[i] = draft;
  saveHabit(draft);
  return draft;
}
export function deleteHabit(h) {
  const i = habits.indexOf(h);
  if (i >= 0) habits.splice(i, 1);
  const logIds = h.logs.map(l => l.id);
  const photoIds = h.logs.map(l => l.photoId).filter(Boolean);
  persist(async () => {
    await dbDelete('habits', h.id);
    await dbDeleteMany('logs', logIds);
    await dbDeleteMany('photos', photoIds);
  });
  bump();
}
export function saveLog(h, log) {
  const copy = { ...log };
  persist(() => dbPut('logs', copy));
  bump();
}
export function pushLog(h, log) {
  h.logs.push(log);
  h.logs.sort((a, b) => a.ts - b.ts);
  indexHabit(h);
  saveLog(h, log);
  return log;
}
export function reindexAndSave(h, log) {
  h.logs.sort((a, b) => a.ts - b.ts);
  indexHabit(h);
  saveLog(h, log);
}
/* масовий запис — одна транзакція замість тисяч (демо-дані, імпорт) */
export function saveHabitsBulk(list) {
  const copies = list.map(h => JSON.parse(JSON.stringify(stripHabit(h))));
  persist(() => dbPutMany('habits', copies));
  bump();
}
export function saveLogsBulk(logs) {
  const copies = logs.map(l => ({ ...l }));
  persist(() => dbPutMany('logs', copies));
  bump();
}

export function saveOrder() {
  habits.forEach((h, i) => { h.order = i; });
  const copies = habits.map(h => JSON.parse(JSON.stringify(stripHabit(h))));
  persist(async () => { for (const c of copies) await dbPut('habits', c); });
  bump();
}

export function applyOrder(ids) {
  const pos = new Map(ids.map((id, i) => [id, i]));
  habits.sort((a, b) => {
    const pa = pos.has(a.id) ? pos.get(a.id) : 1000 + (a.order || 0);
    const pb = pos.has(b.id) ? pos.get(b.id) : 1000 + (b.order || 0);
    return pa - pb;
  });
  saveOrder();
}
