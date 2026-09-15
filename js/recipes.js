/* Палітра, іконки, стартові конфігурації. */
import { addDays, uid, dkey } from './util.js';
import { newHabit, visibleHabits } from './state.js';

export const PALETTE = 10;
export const ICONS = ['💧', '🏋', '🚴', '💊', '🧘', '📖', '🍷', '🚭', '⏱', '📷', '🌙', '🏃', '🥗', '💤', '✍️', '🎸', '🧠', '☀️', '🦷', '🚶', '🧹', '💰', '🎯', '🌱', '☕', '🍎', '🧴', '🎹', '🐕', '🛁', '🙏', '📵', '🧊', '🥛', '🏊', '⛰', '📞', '🧩', '🎨', '🗓', '•'];
const ICON_GUESS = [['вод', '💧'], ['зал', '🏋'], ['трен', '🏋'], ['вело', '🚴'], ['препар', '💊'], ['ібу', '💊'], ['таблет', '💊'], ['вітам', '💊'], ['медит', '🧘'], ['чит', '📖'], ['книг', '📖'], ['алко', '🍷'], ['кур', '🚭'], ['робот', '⏱'], ['фото', '📷'], ['форм', '📷'], ['сон', '🌙'], ['біг', '🏃'], ['розтяж', '🧘'], ['йог', '🧘'], ['кав', '☕'], ['прогул', '🚶'], ['зуб', '🦷'], ['англ', '✍️'], ['мов', '✍️'], ['гітар', '🎸'], ['басейн', '🏊'], ['душ', '🛁'], ['гро', '💰']];
export const guessIcon = name => {
  const n = (name || '').toLowerCase().trim();
  if (!n) return '•';
  for (const [k, v] of ICON_GUESS) if (n.startsWith(k) || n.includes(' ' + k)) return v;
  return '•';
};
export function nextColor() {
  const used = new Set(visibleHabits().map(h => h.color));
  for (let i = 0; i < PALETTE; i++) if (!used.has(i)) return i;
  return visibleHabits().length % PALETTE;
}

export const RECIPES = [
  { id: 'r-water', icon: '💧', title: 'Трекер води', sub: '2 л на день', cfg: { name: 'Вода', icon: '💧', type: 'qty', unit: 'мл', presets: [250, 500], goal: { kind: 'min', n: 2000, period: 'day' }, tags: ['здоровʼя'] } },
  { id: 'r-gym', icon: '🏋', title: 'Зал', sub: '3 рази на тиждень', cfg: { name: 'Зал', icon: '🏋', type: 'check', goal: { kind: 'min', n: 3, period: 'week' }, tags: ['спорт'] } },
  { id: 'r-stretch', icon: '🧘', title: 'Розтяжка', sub: 'щодня', cfg: { name: 'Розтяжка', icon: '🧘', type: 'check', goal: { kind: 'min', n: 1, period: 'day' } } },
  { id: 'r-read', icon: '📖', title: 'Читання', sub: '50 стор. на день', cfg: { name: 'Читання', icon: '📖', type: 'qty', unit: 'стор.', presets: [10, 25], goal: { kind: 'min', n: 50, period: 'day' }, tags: ['розум'] } },
  { id: 'r-deep', icon: '⏱', title: 'Глибока робота', sub: '4 год і 5 сесій', cfg: { name: 'Глибока робота', icon: '⏱', type: 'time', presets: [25, 50, 90], goal: { kind: 'min', n: 240, period: 'day', second: { n: 5 } }, schedule: { days: [0, 1, 2, 3, 4] }, tags: ['робота'] } },
  { id: 'r-med', icon: '💊', title: 'Препарат', sub: 'кожні 8 годин', cfg: { name: 'Препарат', icon: '💊', type: 'check', goal: { kind: 'min', n: 1, period: 'interval', intervalH: 8, tolH: 1 }, schedule: { endDays: 14 }, time: { retro: 'none' }, reminders: [{ type: 'interval', before: 10 }], tags: ['здоровʼя'] } },
  { id: 'r-alco', icon: '🍷', title: 'Алкоголь', sub: 'не більше 1 на тиждень', cfg: { name: 'Алкоголь', icon: '🍷', type: 'check', goal: { kind: 'max', n: 1, period: 'week' }, tags: ['здоровʼя'] } },
  { id: 'r-sober', icon: '🚭', title: 'Не пив сьогодні', sub: 'вечірній чек-ін 22:00', cfg: { name: 'Не пив', icon: '🚭', type: 'check', goal: { kind: 'min', n: 1, period: 'day' }, time: { window: { from: '22:00', to: '00:00' }, retro: 'yesterday' }, tags: ['здоровʼя'] } },
];

export function applyRecipe(r) {
  const c = JSON.parse(JSON.stringify(r.cfg));
  const h = newHabit();
  Object.assign(h, {
    name: c.name, icon: c.icon, type: c.type, unit: c.unit || '', presets: c.presets || [],
    tags: c.tags || [], color: nextColor(), desc: c.desc || '',
  });
  Object.assign(h.goal, c.goal || {});
  if (c.schedule) {
    if (c.schedule.days) h.schedule.days = c.schedule.days;
    if (c.schedule.endDays) h.schedule.end = addDays(h.schedule.start, c.schedule.endDays - 1);
  }
  if (c.time) Object.assign(h.time, c.time);
  if (c.reminders) h.reminders = c.reminders.map(x => Object.assign({ id: uid(), days: [0, 1, 2, 3, 4, 5, 6], text: '', from: '10:00', to: '18:00', count: 2 }, x));
  return h;
}

/* ---------- демо-дані для перевірки статистики ---------- */
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const pad2 = n => String(n).padStart(2, '0');

export function buildDemo() {
  const R = rng(42);
  const D0 = dkey(new Date());
  const out = [];
  const mk = over => { const h = newHabit(over); h.order = out.length; h.logs = []; out.push(h); return h; };
  const log = (h, date, hm, value, extra = {}) => {
    const [hh, mm] = hm.split(':').map(Number);
    const d = new Date(date + 'T00:00:00');
    d.setHours(hh, mm, 0, 0);
    h.logs.push(Object.assign({
      id: uid(), habitId: h.id, ts: d.getTime(), date, value: value ?? null,
      note: '', photoId: null, retro: false, edited: false, early: null, deleted: false,
    }, extra));
  };
  const seed = (h, days, fn) => { for (let i = days; i >= 1; i--) fn(addDays(D0, -i), i); };
  const dw = k => (new Date(k + 'T00:00:00').getDay() + 6) % 7;

  const water = mk({ name: 'Вода', icon: '💧', color: 5, type: 'qty', unit: 'мл', presets: [250, 500, 1000], goal: { kind: 'min', n: 2000, period: 'day', everyN: 3, intervalH: 8, tolH: 1, second: null }, schedule: { days: null, start: addDays(D0, -84), end: null }, tags: ['здоровʼя'], desc: 'Менше головного болю після обіду.' });
  seed(water, 84, d => { const g = 3 + Math.floor(R() * 6); let t = 450; for (let i = 0; i < g; i++) { t += 60 + Math.floor(R() * 120); if (t > 1320) break; log(water, d, `${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`, R() < .7 ? 250 : 500); } });

  const gym = mk({ name: 'Зал', icon: '🏋', color: 1, type: 'check', goal: { kind: 'min', n: 3, period: 'week', everyN: 3, intervalH: 8, tolH: 1, second: null }, schedule: { days: null, start: addDays(D0, -84), end: null }, tags: ['спорт'], desc: 'Спина перестала боліти, коли ходив регулярно.' });
  seed(gym, 84, d => { const w = dw(d); if ([0, 2, 4].includes(w) && R() < .78) log(gym, d, '19:' + pad2(Math.floor(R() * 50)), null, { note: R() < .3 ? ['Ноги', 'Спина', 'Груди'][Math.floor(R() * 3)] : '' }); else if (w === 5 && R() < .2) log(gym, d, '11:20'); });

  const deep = mk({ name: 'Глибока робота', icon: '⏱', color: 6, type: 'time', presets: [25, 50, 90], goal: { kind: 'min', n: 240, period: 'day', everyN: 3, intervalH: 8, tolH: 1, second: { n: 5 } }, schedule: { days: [0, 1, 2, 3, 4], start: addDays(D0, -84), end: null }, tags: ['робота'] });
  seed(deep, 84, d => { if (dw(d) > 4) return; const s = 2 + Math.floor(R() * 5); let t = 540; for (let i = 0; i < s; i++) { t += 30 + Math.floor(R() * 90); if (t > 1140) break; log(deep, d, `${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`, 25 + Math.floor(R() * 70)); } });

  const stretch = mk({ name: 'Розтяжка', icon: '🧘', color: 3, type: 'check', goal: { kind: 'min', n: 1, period: 'day', everyN: 3, intervalH: 8, tolH: 1, second: null }, schedule: { days: null, start: addDays(D0, -84), end: null }, tags: ['спорт'] });
  seed(stretch, 84, d => { if (R() < .72) log(stretch, d, '08:' + pad2(Math.floor(R() * 40))); });

  const alco = mk({ name: 'Алкоголь', icon: '🍷', color: 7, type: 'check', goal: { kind: 'max', n: 1, period: 'week', everyN: 3, intervalH: 8, tolH: 1, second: null }, schedule: { days: null, start: addDays(D0, -84), end: null }, tags: ['здоровʼя'], desc: 'Логую факт, а не відсутність.' });
  seed(alco, 84, d => { const w = dw(d); if ((w === 4 || w === 5) && R() < .45) log(alco, d, '20:' + pad2(Math.floor(R() * 59)), null, { note: R() < .4 ? 'келих вина' : '' }); });

  const read = mk({ name: 'Читання', icon: '📖', color: 2, type: 'qty', unit: 'стор.', presets: [10, 25], goal: { kind: 'min', n: 50, period: 'day', everyN: 3, intervalH: 8, tolH: 1, second: null }, schedule: { days: null, start: addDays(D0, -40), end: null }, tags: ['розум'] });
  seed(read, 40, d => { if (R() < .8) log(read, d, '22:' + pad2(Math.floor(R() * 59)), 20 + Math.floor(R() * 50)); });

  const bike = mk({ name: 'Велозаїзди', icon: '🚴', color: 4, type: 'check', goal: { kind: 'min', n: 2, period: 'month', everyN: 3, intervalH: 8, tolH: 1, second: null }, schedule: { days: null, start: addDays(D0, -84), end: null }, tags: ['спорт'] });
  [-78, -68, -55, -40, -22, -8].forEach((off, i) => log(bike, addDays(D0, off), '10:15', null, { note: ['42 км', 'ліс', '61 км', '', 'дощ', 'Голосіїво'][i] }));

  const medit = mk({ name: 'Медитація', icon: '🧠', color: 0, type: 'time', presets: [10, 20], goal: { kind: 'min', n: 10, period: 'day', everyN: 3, intervalH: 8, tolH: 1, second: null }, schedule: { days: null, start: addDays(D0, -70), end: null }, tags: ['розум'], paused: { since: addDays(D0, -4), until: addDays(D0, 7) } });
  seed(medit, 70, (d, i) => { if (i <= 4) return; if (R() < .6) log(medit, d, '07:' + pad2(Math.floor(R() * 30)), 10 + Math.floor(R() * 12)); });

  out.forEach(h => h.logs.sort((a, b) => a.ts - b.ts));
  return out;
}
