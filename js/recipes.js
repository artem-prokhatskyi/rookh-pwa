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

/* ---------- демо-дані ----------
   Покриття: усі 12 референсних сценаріїв маніфесту + краї, яких у ньому немає:
   період «кожні N днів», ціль «рівно», максимум для кількості й тривалості,
   вікно через північ, курс, що вже завершився, звичка, що ще не почалась,
   пауза з датою і без, архів, дробові значення, обовʼязкові нотатка й фото,
   ретро-відмітки, відредаговані записи, ранні відмітки за інтервалом.        */

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

export const DEMO_SIZE = { habits: 36, days: 365 };

export function buildDemo() {
  const R = rng(20260915);
  const D0 = dkey(new Date());
  const out = [];
  const dw = k => (new Date(k + 'T00:00:00').getDay() + 6) % 7;
  const G = o => Object.assign({ kind: 'min', n: 1, period: 'day', everyN: 3, intervalH: 8, tolH: 1, second: null }, o);
  const SC = (fromDays, o = {}) => Object.assign({ days: null, start: addDays(D0, -fromDays), end: null }, o);
  const rem = o => Object.assign({ id: uid(), type: 'exact', time: '08:00', days: [0, 1, 2, 3, 4, 5, 6], text: '', from: '10:00', to: '18:00', count: 2 }, o);
  const pick = a => a[Math.floor(R() * a.length)];

  const mk = over => {
    const h = newHabit(over);
    h.order = out.length;
    h.logs = [];
    out.push(h);
    return h;
  };
  const log = (h, date, minutes, value, extra = {}) => {
    const d = new Date(date + 'T00:00:00');
    d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    h.logs.push(Object.assign({
      id: uid(), habitId: h.id, ts: d.getTime(), date, value: value ?? null,
      note: '', photoId: null, retro: false, edited: false, early: null, deleted: false,
    }, extra));
  };
  // проходить days днів назад; fn(дата, скільки днів тому)
  const seed = (h, days, fn) => { for (let i = days; i >= 1; i--) fn(addDays(D0, -i), i); };

  /* ===== 1. Відмітка ===== */

  const stretch = mk({ name: 'Розтяжка', icon: '🧘', color: 3, type: 'check', goal: G(), schedule: SC(365), tags: ['спорт'], desc: 'Спина перестала боліти, коли робив регулярно.' });
  seed(stretch, 365, d => { if (R() < .74) log(stretch, d, 480 + Math.floor(R() * 40), null, { retro: R() < .05 }); });

  const gym = mk({ name: 'Зал', icon: '🏋', color: 1, type: 'check', goal: G({ n: 3, period: 'week' }), schedule: SC(365), tags: ['спорт'], desc: 'Три рази на тиждень, у які саме дні — байдуже.', reminders: [rem({ time: '18:30', days: [0, 2, 4], text: 'Сумка зібрана?' })] });
  seed(gym, 365, d => { const w = dw(d); if ([0, 2, 4].includes(w) && R() < .76) log(gym, d, 1140 + Math.floor(R() * 50), null, { note: R() < .35 ? pick(['Ноги', 'Спина', 'Груди', 'Плечі']) : '' }); else if (w === 5 && R() < .18) log(gym, d, 680); });

  const bike = mk({ name: 'Велозаїзди', icon: '🚴', color: 4, type: 'check', goal: G({ n: 2, period: 'month' }), schedule: SC(365), tags: ['спорт'] });
  seed(bike, 365, (d, i) => { if (dw(d) > 4 && R() < .12) log(bike, d, 615, null, { note: pick(['42 км, Дніпро', 'ліс', '61 км', 'дощ', 'Голосіїв', '']), edited: R() < .1 }); });

  const vitd = mk({ name: 'Вітамін D', icon: '☀️', color: 2, type: 'check', goal: G(), schedule: SC(200, { days: [0, 2, 4] }), tags: ['здоровʼя'], desc: 'Лише пн · ср · пт — так призначив лікар.' });
  seed(vitd, 200, d => { if ([0, 2, 4].includes(dw(d)) && R() < .86) log(vitd, d, 540); });

  const ibu = mk({ name: 'Ібупрофен', icon: '💊', color: 0, type: 'check', goal: G({ period: 'interval', intervalH: 8, tolH: 1 }), schedule: { days: null, start: addDays(D0, -5), end: addDays(D0, 8) }, time: { window: null, retro: 'none' }, tags: ['здоровʼя'], reminders: [{ id: uid(), type: 'interval', before: 10 }] });
  seed(ibu, 5, d => { log(ibu, d, 15 + Math.floor(R() * 25)); log(ibu, d, 490 + Math.floor(R() * 30)); log(ibu, d, 975 + Math.floor(R() * 30), null, { early: R() < .4 ? 30 + Math.floor(R() * 60) : null }); });
  log(ibu, D0, 20); log(ibu, D0, 500);

  const amox = mk({ name: 'Амоксицилін', icon: '💊', color: 7, type: 'check', goal: G({ n: 2 }), schedule: { days: null, start: addDays(D0, -6), end: addDays(D0, 7) }, time: { window: null, retro: 'yesterday' }, tags: ['здоровʼя'], desc: 'Курс 14 днів, допити до кінця навіть якщо полегшає.', reminders: [rem({ time: '09:00' }), rem({ time: '21:00', text: 'Друга доза' })] });
  seed(amox, 6, d => { log(amox, d, 540 + Math.floor(R() * 20)); if (R() < .85) log(amox, d, 1260 + Math.floor(R() * 20), null, { retro: R() < .2 }); });
  log(amox, D0, 545);

  const drops = mk({ name: 'Краплі в очі', icon: '🧴', color: 5, type: 'check', goal: G({ kind: 'exact', n: 3 }), schedule: { days: null, start: addDays(D0, -10), end: addDays(D0, 4) }, time: { window: null, retro: 'yesterday' }, tags: ['здоровʼя'], desc: 'Рівно три рази — більше подразнює.' });
  seed(drops, 10, (d, i) => {
    const n = i === 4 ? 4 : i === 7 ? 2 : 3;          // один день перевищено, один недобраний
    for (let k = 0; k < n; k++) log(drops, d, 480 + k * 300 + Math.floor(R() * 30));
  });
  log(drops, D0, 490); log(drops, D0, 800);

  const sober = mk({ name: 'Не пив', icon: '🚭', color: 9, type: 'check', goal: G(), schedule: SC(180), time: { window: { from: '22:00', to: '00:00' }, retro: 'yesterday' }, tags: ['здоровʼя'], desc: 'Вечірній чек-ін: сьогодні — ні.', reminders: [rem({ time: '22:30', text: 'Вечірній чек-ін' })] });
  seed(sober, 180, (d, i) => { if (i === 1) return; if (R() < .88) log(sober, d, 1340 + Math.floor(R() * 30), null, { retro: R() < .14 }); });

  const alco = mk({ name: 'Алкоголь', icon: '🍷', color: 6, type: 'check', goal: G({ kind: 'max', n: 1, period: 'week' }), schedule: SC(365), tags: ['здоровʼя'], desc: 'Логую факт, а не відсутність.' });
  seed(alco, 365, d => { const w = dw(d); if ((w === 4 || w === 5) && R() < .4) log(alco, d, 1200 + Math.floor(R() * 90), null, { note: R() < .4 ? pick(['келих вина', 'пиво з друзями', 'день народження']) : '' }); });

  const smoke = mk({ name: 'Цигарки', icon: '🚬', color: 8, type: 'check', goal: G({ kind: 'max', n: 0 }), schedule: SC(180), tags: ['здоровʼя'], desc: 'Нуль. Кожен зрив має бути видно.' });
  [173, 150, 121, 66, 24].forEach(i => log(smoke, addDays(D0, -i), 1290, null, { note: pick(['стрес на роботі', 'вечірка', '']) }));

  const body = mk({ name: 'Прогрес форми', icon: '📷', color: 5, type: 'check', goal: G({ n: 1, period: 'week' }), schedule: SC(180), time: { window: null, retro: 'none' }, tags: ['спорт'], requirePhoto: true, desc: 'Раз на тиждень, те саме світло й ракурс.' });
  seed(body, 180, d => { if (dw(d) === 6 && R() < .85) log(body, d, 460 + Math.floor(R() * 40), null, { note: pick(['', 'бік', 'спина', 'ноги']) }); });

  const parents = mk({ name: 'Подзвонити батькам', icon: '📞', color: 2, type: 'check', goal: G({ period: 'everyN', everyN: 7 }), schedule: SC(180), tags: ['люди'], desc: 'Не рідше ніж раз на тиждень, день не важливий.' });
  seed(parents, 180, (d, i) => { if (i % 7 === 3 && R() < .82) log(parents, d, 1140 + Math.floor(R() * 60), null, { note: R() < .3 ? 'довго говорили' : '' }); });

  const clean = mk({ name: 'Прибирання', icon: '🧹', color: 4, type: 'check', goal: G({ period: 'everyN', everyN: 3 }), schedule: SC(120), tags: ['дім'] });
  seed(clean, 120, (d, i) => { if (i % 3 === 1 && R() < .78) log(clean, d, 720 + Math.floor(R() * 200)); });

  const diary = mk({ name: 'Щоденник', icon: '✍️', color: 6, type: 'check', goal: G(), schedule: SC(120), time: { window: { from: '21:00', to: '01:00' }, retro: 3 }, tags: ['розум'], desc: 'Вікно з вечора й за північ — пишу вже в ліжку.' });
  seed(diary, 120, d => { if (R() < .68) log(diary, d, R() < .3 ? 1400 + Math.floor(R() * 40) : 1290 + Math.floor(R() * 60), null, { retro: R() < .18 }); });

  const shower = mk({ name: 'Контрастний душ одразу після пробудження, до кави', icon: '🛁', color: 4, type: 'check', goal: G(), schedule: SC(90), tags: ['побут'], desc: 'Навмисно довга назва — перевірити, як обрізається.' });
  seed(shower, 90, d => { if (R() < .6) log(shower, d, 420 + Math.floor(R() * 40)); });

  const spanish = mk({ name: 'Іспанська · картки', icon: '🧩', color: 7, type: 'check', goal: G(), schedule: SC(120), tags: ['розум'], paused: { since: addDays(D0, -9), until: null }, desc: 'На паузі без дати — поки не закінчиться проєкт.' });
  seed(spanish, 120, (d, i) => { if (i <= 9) return; if (R() < .55) log(spanish, d, 1320 + Math.floor(R() * 40)); });

  const yoga = mk({ name: 'Йога', icon: '🙏', color: 3, type: 'check', goal: G({ n: 2, period: 'week' }), schedule: SC(150), tags: ['спорт'], paused: { since: addDays(D0, -2), until: addDays(D0, 7) }, desc: 'Пауза до кінця тижня — застуда.' });
  seed(yoga, 150, (d, i) => { if (i <= 2) return; if ((dw(d) === 1 || dw(d) === 3) && R() < .62) log(yoga, d, 1110); });

  const run = mk({ name: 'Біг у вихідні', icon: '🏃', color: 1, type: 'check', goal: G(), schedule: { days: [5, 6], start: addDays(D0, 3), end: null }, tags: ['спорт'], desc: 'Стартує за три дні — перевірити стан «ще не почалась».' });

  const b12 = mk({ name: 'Курс B12', icon: '💊', color: 2, type: 'check', goal: G(), schedule: { days: null, start: addDays(D0, -33), end: addDays(D0, -3) }, tags: ['здоровʼя'], desc: 'Курс завершено — має зникнути з «Сьогодні», але лишитись у статистиці.' });
  seed(b12, 33, (d, i) => { if (i < 3) return; if (R() < .9) log(b12, d, 545); });

  const walk = mk({ name: 'Прогулянка 10 хв', icon: '🚶', color: 3, type: 'check', goal: G(), schedule: SC(60), tags: ['побут'], requireNote: true, desc: 'Нотатка обовʼязкова — куди саме ходив.' });
  seed(walk, 60, d => { if (R() < .7) log(walk, d, 780 + Math.floor(R() * 300), null, { note: pick(['парк', 'навколо кварталу', 'до озера', 'до магазину й назад']) }); });

  /* ===== 2. Кількість ===== */

  const water = mk({ name: 'Вода', icon: '💧', color: 5, type: 'qty', unit: 'мл', presets: [250, 500, 1000], goal: G({ n: 2000 }), schedule: SC(365), tags: ['здоровʼя'], desc: 'Менше головного болю після обіду.', reminders: [rem({ type: 'window', from: '09:00', to: '21:00', count: 3 })] });
  seed(water, 365, d => { const g = 3 + Math.floor(R() * 6); let t = 450; for (let k = 0; k < g; k++) { t += 60 + Math.floor(R() * 120); if (t > 1320) break; log(water, d, t, R() < .68 ? 250 : R() < .9 ? 500 : 1000); } });
  log(water, D0, 490, 500); log(water, D0, 630, 250, { note: 'після кави' });

  const read = mk({ name: 'Читання', icon: '📖', color: 2, type: 'qty', unit: 'стор.', presets: [10, 25], goal: G({ n: 50 }), schedule: SC(150), tags: ['розум'] });
  seed(read, 150, d => { if (R() < .78) log(read, d, 1320 + Math.floor(R() * 60), 15 + Math.floor(R() * 55)); });

  const coffee = mk({ name: 'Кава', icon: '☕', color: 8, type: 'qty', unit: 'чашки', presets: [1], goal: G({ kind: 'max', n: 3 }), schedule: SC(180), tags: ['здоровʼя'], desc: 'Не більше трьох — інакше не засну.' });
  seed(coffee, 180, d => { const n = 1 + Math.floor(R() * 4); for (let k = 0; k < n; k++) log(coffee, d, 500 + k * 180 + Math.floor(R() * 40), 1); });

  const steps = mk({ name: 'Кроки', icon: '🚶', color: 9, type: 'qty', unit: 'кроків', presets: [], goal: G({ n: 8000 }), schedule: SC(120), tags: ['спорт'], desc: 'Без пресетів — вводжу ввечері одним числом.' });
  seed(steps, 120, d => { if (R() < .85) log(steps, d, 1350, 3000 + Math.floor(R() * 9000), { edited: R() < .08 }); });

  const pull = mk({ name: 'Підтягування', icon: '🎯', color: 1, type: 'qty', unit: 'повторень', presets: [5, 10], goal: G({ n: 30 }), schedule: SC(90, { days: [0, 1, 2, 3, 4] }), tags: ['спорт'] });
  seed(pull, 90, d => { if (dw(d) > 4) return; const n = Math.floor(R() * 4); for (let k = 0; k < n; k++) log(pull, d, 600 + k * 240, 5 + Math.floor(R() * 8)); });

  const omega = mk({ name: 'Омега-3', icon: '🐟', color: 4, type: 'qty', unit: 'капс.', presets: [1, 2], goal: G({ kind: 'exact', n: 2 }), schedule: SC(90), tags: ['здоровʼя'], desc: 'Рівно дві на добу — для кількості це строга ціль.' });
  seed(omega, 90, (d, i) => { const n = i % 11 === 0 ? 1 : 2; for (let k = 0; k < n; k++) log(omega, d, 540 + k * 540, 1); });

  const weight = mk({ name: 'Вага', icon: '⚖️', color: 9, type: 'qty', unit: 'кг', presets: [], goal: G({ kind: 'none' }), schedule: SC(180), tags: ['здоровʼя'], desc: 'Без цілі — просто крива за півроку. Дробові значення.' });
  let wv = 84.6;
  seed(weight, 180, d => { wv += (R() - .55) * .35; if (R() < .8) log(weight, d, 430 + Math.floor(R() * 20), Math.round(wv * 10) / 10); });

  /* ===== 3. Тривалість ===== */

  const deep = mk({ name: 'Глибока робота', icon: '⏱', color: 6, type: 'time', presets: [25, 50, 90], goal: G({ n: 240, second: { n: 5 } }), schedule: SC(365, { days: [0, 1, 2, 3, 4] }), tags: ['робота'], desc: 'Дві умови одночасно: чотири години і пʼять сесій.' });
  seed(deep, 365, d => { if (dw(d) > 4) return; const n = 2 + Math.floor(R() * 5); let t = 540; for (let k = 0; k < n; k++) { t += 30 + Math.floor(R() * 90); if (t > 1140) break; log(deep, d, t, 25 + Math.floor(R() * 70)); } });
  log(deep, D0, 545, 60); log(deep, D0, 660, 40, { note: 'спека, важко фокусуватись' });

  const medit = mk({ name: 'Медитація', icon: '🧠', color: 0, type: 'time', presets: [10, 20], goal: G({ n: 10 }), schedule: SC(200), tags: ['розум'] });
  seed(medit, 200, d => { if (R() < .58) log(medit, d, 420 + Math.floor(R() * 30), 8 + Math.floor(R() * 15)); });

  const screen = mk({ name: 'Екранний час увечері', icon: '📵', color: 7, type: 'time', presets: [30, 60], goal: G({ kind: 'max', n: 120 }), schedule: SC(120), tags: ['побут'], desc: 'Не більше двох годин після 20:00.' });
  seed(screen, 120, d => { const n = 1 + Math.floor(R() * 2); for (let k = 0; k < n; k++) log(screen, d, 1230 + k * 60, 20 + Math.floor(R() * 90)); });

  const feed = mk({ name: 'Годування', icon: '🍼', color: 3, type: 'time', presets: [10, 15, 20], goal: G({ kind: 'none' }), schedule: SC(60), tags: ['сімʼя'], requireNote: true, desc: 'Без цілі, лише облік. Сторона — в нотатці.' });
  seed(feed, 60, d => { const n = 6 + Math.floor(R() * 4); let t = 360; for (let k = 0; k < n; k++) { t += 90 + Math.floor(R() * 90); if (t > 1400) break; log(feed, d, t, 8 + Math.floor(R() * 18), { note: pick(['ліва', 'права', 'ліва, засинав', 'права, зригнув']) }); } });

  const sleep = mk({ name: 'Сон', icon: '💤', color: 5, type: 'time', presets: [420, 480], goal: G({ n: 420 }), schedule: SC(180), tags: ['здоровʼя'], desc: 'Щонайменше сім годин.' });
  seed(sleep, 180, d => { if (R() < .93) log(sleep, d, 480, 330 + Math.floor(R() * 200)); });

  /* ----- періодні цілі для кількості й часу ----- */

  const runKm = mk({ name: 'Біг, кілометраж', icon: '🏃', color: 1, type: 'qty', unit: 'км', presets: [3, 5, 10], goal: G({ n: 20, period: 'week' }), schedule: SC(150), time: { window: null, retro: 7 }, tags: ['спорт'], desc: 'Двадцять кілометрів за тиждень, у які дні — байдуже. Ретро до 7 днів.' });
  seed(runKm, 150, d => { if (R() < .42) log(runKm, d, 420 + Math.floor(R() * 60), Math.round((3 + R() * 9) * 10) / 10, { retro: R() < .2 }); });

  const save = mk({ name: 'Відкласти на подушку', icon: '💰', color: 2, type: 'qty', unit: 'грн', presets: [500, 1000, 2000], goal: G({ n: 5000, period: 'month' }), schedule: SC(300), tags: ['гроші'], desc: 'Місячна кількісна ціль — рідкісний, але робочий випадок.' });
  seed(save, 300, (d, i) => { if (i % 10 === 2 && R() < .8) log(save, d, 780, 500 + Math.floor(R() * 12) * 250); });

  const course = mk({ name: 'Онлайн-курс', icon: '🎹', color: 6, type: 'time', presets: [45, 90], goal: G({ n: 300, period: 'week' }), schedule: SC(200), tags: ['робота'], desc: 'Пʼять годин на тиждень — час, розтягнутий на період.' });
  seed(course, 200, d => { if (dw(d) < 5 && R() < .35) log(course, d, 1200 + Math.floor(R() * 60), 30 + Math.floor(R() * 70)); else if (dw(d) === 6 && R() < .5) log(course, d, 660, 60 + Math.floor(R() * 90)); });

  /* ===== 4. Архів ===== */

  const eng = mk({ name: 'Англійська', icon: '🇬🇧', color: 9, type: 'time', presets: [20], goal: G({ n: 20 }), schedule: SC(200), archived: true, tags: ['розум'], desc: 'В архіві: історія лишилась, з екранів зникла.' });
  seed(eng, 200, (d, i) => { if (i < 40) return; if (R() < .5) log(eng, d, 1200, 20 + Math.floor(R() * 20)); });

  out.forEach(h => h.logs.sort((a, b) => a.ts - b.ts));
  return out;
}

/* логи звички «Прогрес форми» — їм демо-завантажувач підставляє справжні фото */
export const DEMO_PHOTO_HABIT = 'Прогрес форми';
