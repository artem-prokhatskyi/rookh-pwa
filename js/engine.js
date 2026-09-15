/* Двигун оцінки цілей + людські формулювання. Чистий над станом, без DOM. */
import {
  addDays, diffDays, dkey, dow, parseK, pad, plural, P, fmtDur, fmtN, fmtTime, fmtHM, fmtShort,
  DOW_SHORT, hmToMin,
} from './util.js';
import { settings, habits, timer, dataVersion } from './state.js';

/* ---------- логічна доба ---------- */
export function logicalTodayAt(now = new Date()) {
  const mins = now.getHours() * 60 + now.getMinutes();
  let k = dkey(now);
  if (mins < hmToMin(settings.dayEnd)) k = addDays(k, -1);
  return k;
}
export const TODAY = () => logicalTodayAt(new Date());

/* ---------- періоди ---------- */
export function periodOf(h, day) {
  const g = h.goal;
  switch (g.period) {
    case 'week': {
      const off = (dow(day) - settings.firstDay + 7) % 7;
      const s = addDays(day, -off);
      return { start: s, end: addDays(s, 6), kind: 'week' };
    }
    case 'month': {
      const d = parseK(day);
      return { start: dkey(new Date(d.getFullYear(), d.getMonth(), 1)), end: dkey(new Date(d.getFullYear(), d.getMonth() + 1, 0)), kind: 'month' };
    }
    case 'everyN': {
      const n = Math.max(2, g.everyN || 2);
      let k = Math.floor(diffDays(h.schedule.start, day) / n);
      if (k < 0) k = 0;
      const s = addDays(h.schedule.start, k * n);
      return { start: s, end: addDays(s, n - 1), kind: 'everyN' };
    }
    default:
      return { start: day, end: day, kind: 'day' };
  }
}

/* ---------- доступ до логів ---------- */
export const activeLogs = h => h.logs.filter(l => !l.deleted);
export function logsIn(h, start, end) {
  const out = [];
  const span = diffDays(start, end);
  if (span < 0) return out;
  if (span > 400) { // дуже широкий діапазон — простіше перебрати всі логи
    for (const l of h.logs) if (!l.deleted && l.date >= start && l.date <= end) out.push(l);
    out.sort((a, b) => a.ts - b.ts);
    return out;
  }
  for (let i = 0, d = start; i <= span; i++, d = addDays(d, 1)) {
    const a = h._byDate.get(d);
    if (a) for (const l of a) if (!l.deleted) out.push(l);
  }
  return out;
}
export const logsOn = (h, day) => {
  const a = h._byDate.get(day);
  return a ? a.filter(l => !l.deleted) : [];
};
export function lastLog(h) {
  for (let i = h.logs.length - 1; i >= 0; i--) if (!h.logs[i].deleted) return h.logs[i];
  return null;
}

/* ---------- розклад і пауза ---------- */
export function isPausedOn(h, day) {
  if (!h.paused) return false;
  if (day < h.paused.since) return false;
  if (h.paused.until && day >= h.paused.until) return false;
  return true;
}
export function isScheduled(h, day) {
  if (h.archived) return false;
  if (day < h.schedule.start) return false;
  if (h.schedule.end && day > h.schedule.end) return false;
  if (h.schedule.days && !h.schedule.days.includes(dow(day))) return false;
  if (isPausedOn(h, day)) return false;
  return true;
}

/* ---------- прогрес за період (мемоізовано) ---------- */
const memo = new Map();
let memoVer = -1;
function memoGet(key) {
  if (memoVer !== dataVersion.v) { memo.clear(); memoVer = dataVersion.v; }
  return memo.get(key);
}
function memoSet(key, val) { memo.set(key, val); return val; }

export function progress(h, day) {
  const p = periodOf(h, day);
  const key = h.id + '|' + p.start + '|' + p.end;
  const hit = memoGet(key);
  if (hit) return hit;

  const g = h.goal;
  const logs = logsIn(h, p.start, p.end);
  const count = logs.length;
  const sum = logs.reduce((a, l) => a + (Number(l.value) || 0), 0);
  const value = h.type === 'check' ? count : sum;
  const r = { count, sum, value, target: g.n, pct: 0, done: false, over: false, period: p, logs, second: null };

  if (g.kind === 'none') { r.pct = count > 0 ? 1 : 0; r.done = false; return memoSet(key, r); }
  if (g.period === 'interval') {
    const exp = Math.max(1, Math.round(24 / (g.intervalH || 8)));
    r.target = exp; r.pct = Math.min(1, count / exp); r.done = count >= exp;
    return memoSet(key, r);
  }
  if (g.kind === 'max') {
    r.over = value > g.n; r.done = !r.over; r.pct = r.over ? 0 : 1;
    return memoSet(key, r);
  }
  if (g.kind === 'exact') {
    r.over = value > g.n;
    r.pct = g.n ? Math.min(1, value / g.n) : 1;
    r.done = value === g.n;
    if (g.second && g.second.n) {
      const p2 = Math.min(1, count / g.second.n);
      r.second = { count, n: g.second.n, pct: p2, done: count >= g.second.n };
      r.pct = Math.min(r.pct, p2);
      r.done = r.done && r.second.done;
    }
    return memoSet(key, r);
  }
  r.pct = g.n ? Math.min(1, value / g.n) : 1;
  r.done = g.n ? value >= g.n : true;
  if (g.second && g.second.n) {
    const p2 = Math.min(1, count / g.second.n);
    r.second = { count, n: g.second.n, pct: p2, done: count >= g.second.n };
    r.pct = Math.min(r.pct, p2);
    r.done = r.done && r.second.done;
  }
  return memoSet(key, r);
}

/* клітинка календаря: null = поза розкладом/без даних */
export function dayCell(h, day) {
  const dl = logsOn(h, day);
  if (!isScheduled(h, day) && !dl.length) return null;
  const pr = progress(h, day);
  return { pct: pr.pct, hasLog: dl.length > 0, over: pr.over, retro: dl.some(l => l.retro), periodKind: pr.period.kind };
}

export function periodsBack(h, fromDay, max = 400) {
  const out = [];
  let d = fromDay;
  for (let i = 0; i < max; i++) {
    const p = periodOf(h, d);
    if (p.end < h.schedule.start) break;
    out.push(p);
    d = addDays(p.start, -1);
    if (d < h.schedule.start) break;
  }
  return out;
}

export function streaks(h) {
  const today = TODAY();
  const ps = periodsBack(h, today, h.goal.period === 'day' || h.goal.period === 'interval' ? 365 : 120);
  const usable = [];
  for (const p of ps) {
    let scheduled = false;
    for (let d = p.start; d <= p.end && d <= today; d = addDays(d, 1)) {
      if (isScheduled(h, d)) { scheduled = true; break; }
    }
    if (scheduled) usable.push(p);
  }
  let cur = 0, longest = 0, run = 0, done = 0, elapsed = 0;
  usable.forEach((p, i) => {
    const pr = progress(h, p.start);
    if (i > 0) { elapsed++; if (pr.done) done++; }
    if (pr.done) { run++; longest = Math.max(longest, run); } else if (i > 0) { run = 0; } else { run = 0; }
  });
  // поточна серія: рахуємо назад, поточний незакритий період не рве її
  for (let i = 0; i < usable.length; i++) {
    const pr = progress(h, usable[i].start);
    if (i === 0 && !pr.done) continue;
    if (pr.done) cur++; else break;
  }
  longest = Math.max(longest, cur);
  return { cur, longest, pct: elapsed ? Math.round(done / elapsed * 100) : 0, elapsed };
}

export function periodUnit(h, n) {
  const k = h.goal.period;
  return plural(n, k === 'week' ? P.tyzh : k === 'month' ? P.mis : k === 'everyN' ? P.period : P.den);
}

/* ---------- інтервал від останнього логу ---------- */
export function intervalState(h, now = Date.now()) {
  const g = h.goal, last = lastLog(h);
  if (!last) return { phase: 'ready', text: 'ще не було відміток', from: null, to: null, next: null };
  const next = last.ts + (g.intervalH || 8) * 36e5;
  const from = next - (g.tolH || 0) * 36e5;
  const to = next + (g.tolH || 0) * 36e5;
  const fmt = t => fmtTime(new Date(t));
  if (now < from) {
    const min = Math.round((from - now) / 6e4);
    return { phase: 'early', text: `через ${fmtDur(min)} · можна з ${fmt(from)}`, from, next, to, minsLeft: min };
  }
  if (now <= to) return { phase: 'ready', text: `час приймати · до ${fmt(to)}`, from, next, to };
  return { phase: 'late', text: `час приймати · з ${fmt(from)}`, from, next, to };
}

/* ---------- часове вікно ---------- */
export function inWindow(h, now = new Date()) {
  const w = h.time.window;
  if (!w) return true;
  const n = now.getHours() * 60 + now.getMinutes();
  const f = hmToMin(w.from);
  const t = hmToMin(w.to) || 1440;
  return f < t ? (n >= f && n < t) : (n >= f || n < t);
}

/* ---------- ретро ---------- */
export function retroDepth(h) {
  return h.time.retro === 'none' ? 0 : h.time.retro === 'yesterday' ? 1 : Number(h.time.retro) || 1;
}
export function canRetro(h, day) {
  const t = TODAY();
  if (day >= t) return false;
  const d = diffDays(day, t);
  return d <= retroDepth(h) && isScheduled(h, day);
}
export function yesterdayUnclosed(h) {
  if (h.time.retro === 'none' || (h.goal.kind !== 'min' && h.goal.kind !== 'exact') || h.goal.period === 'interval') return false;
  if (h.archived) return false;
  const y = addDays(TODAY(), -1);
  if (!isScheduled(h, y)) return false;
  if (periodOf(h, y).kind !== 'day') return false;
  return logsOn(h, y).length === 0;
}

/* ---------- таймер ---------- */
export function timerElapsedMin() {
  if (!timer.hid) return 0;
  const end = timer.pausedAt || Date.now();
  return (timer.acc + (end - timer.startTs)) / 6e4;
}

/* ---------- нагадування: наступний час ---------- */
function seededRandom(str) {
  let t = 0;
  for (let i = 0; i < str.length; i++) t = (t * 31 + str.charCodeAt(i)) >>> 0;
  t = (t + 0x6D2B79F5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
  return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
}
/* список хвилин у добі, коли нагадування має спрацювати цього дня */
export function reminderMinutes(h, r, dayKey) {
  if (r.type === 'exact') return [hmToMin(r.time || '08:00')];
  const f = hmToMin(r.from || '10:00');
  let t = hmToMin(r.to || '18:00');
  if (t <= f) t = f + 60;
  if (r.type === 'window') {
    const n = Math.max(1, Math.min(8, r.count || 2));
    const step = (t - f) / n;
    return Array.from({ length: n }, (_, i) => Math.round(f + step * (i + 0.5)));
  }
  if (r.type === 'random') return [Math.round(f + seededRandom(r.id + dayKey) * (t - f))];
  return [];
}
export function reminderText(r) {
  if (r.type === 'interval') return `За ${r.before} хв до дозволеного часу`;
  const days = !r.days || r.days.length === 7 ? 'Щодня' : r.days.map(d => DOW_SHORT[d]).join(' · ');
  if (r.type === 'exact') return `${days} о ${fmtHM(r.time)}`;
  if (r.type === 'window') return `${days} · ${r.count || 2} рази з ${fmtHM(r.from)} до ${fmtHM(r.to)}`;
  return `${days} · випадково ${fmtHM(r.from)}–${fmtHM(r.to)}`;
}
export function remindersSummary(h) {
  const r = h.reminders;
  if (!r.length) return 'Немає';
  if (r.length === 1) return reminderText(r[0]);
  return `${r.length} ${plural(r.length, P.nahad)}`;
}
/* найближче нагадування сьогодні, яке ще попереду (для підсумку рядка) */
export function nextReminderToday(h, now = new Date()) {
  if (!h.reminders.length) return null;
  const today = TODAY();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let best = null;
  for (const r of h.reminders) {
    if (r.type === 'interval') continue;
    if (r.days && r.days.length && !r.days.includes(dow(dkey(now)))) continue;
    for (const m of reminderMinutes(h, r, today)) {
      if (m > nowMin && (best === null || m < best)) best = m;
    }
  }
  return best === null ? null : pad(Math.floor(best / 60)) + ':' + pad(best % 60);
}

/* ---------- стан рядка на «Сьогодні» ---------- */
export function rowState(h, now = new Date()) {
  const today = TODAY();
  const pr = progress(h, today), g = h.goal;
  const s = {
    pr, control: 'circle', locked: false, ready: true, sum: '', extra: null,
    // «закрито» у списку означає «діяти більше не треба»: для цілі «рівно»
    // перевищення теж закриває день. Для статистики лишається строгий
    // progress().done — перевищена ціль «рівно» не рахується виконаною.
    done: g.kind === 'exact'
      ? (pr.done || pr.over)
      : (pr.done && g.kind !== 'max' && g.kind !== 'none'),
    timer: timer.hid === h.id,
  };
  const daysLeft = diffDays(today, pr.period.end);
  const tail = pr.period.kind === 'day' ? 'сьогодні' : pr.period.kind === 'week' ? 'цього тижня' : pr.period.kind === 'month' ? 'цього місяця' : 'у цьому періоді';
  const left = pr.period.kind === 'day' ? '' : daysLeft <= 0 ? ' · останній день' : ` · ще ${daysLeft} ${plural(daysLeft, P.den)}`;

  if (g.kind === 'none') {
    s.sum = pr.count
      ? `${pr.count} ${plural(pr.count, P.zapys)} сьогодні${h.type === 'time' ? ' · ' + fmtDur(pr.sum) : h.type === 'qty' ? ' · ' + fmtN(pr.sum) + ' ' + h.unit : ''}`
      : 'записів ще немає';
    if (h.type === 'qty') s.control = 'qty';
    if (h.type === 'time') s.control = 'time';
  } else if (g.period === 'interval') {
    const iv = intervalState(h, now.getTime());
    s.control = 'interval'; s.ready = iv.phase !== 'early'; s.sum = iv.text; s.iv = iv;
  } else if (g.kind === 'max') {
    s.sum = `${h.type === 'check' ? pr.value : (h.type === 'time' ? fmtDur(pr.sum) : fmtN(pr.sum))} з ${h.type === 'time' ? fmtDur(g.n) : fmtN(g.n)}${h.type === 'qty' ? ' ' + h.unit : ''} ${tail}${left}`;
    if (h.type === 'qty') s.control = 'qty';
    if (h.type === 'time') s.control = 'time';
  } else if (h.type === 'check') {
    if (pr.period.kind === 'day' && g.n === 1) {
      const nr = nextReminderToday(h, now);
      s.sum = pr.done ? fmtTime(new Date(pr.logs[pr.logs.length - 1].ts)) : (nr ? `нагадаю о ${fmtHM(nr)}` : 'не відмічено');
    } else {
      s.sum = `${pr.count} з ${g.n} ${tail}${left}`;
    }
  } else if (h.type === 'qty') {
    s.sum = `${fmtN(pr.sum)} / ${fmtN(g.n)} ${h.unit}${pr.period.kind !== 'day' ? ' ' + tail : ''}`;
    s.control = 'qty';
  } else {
    s.control = 'time';
    s.sum = pr.second
      ? `${pr.count} ${plural(pr.count, P.sesia)} · ${fmtDur(pr.sum)} / ${g.second.n} · ${fmtDur(g.n)}`
      : `${fmtDur(pr.sum)} / ${fmtDur(g.n)}${pr.period.kind !== 'day' ? ' ' + tail : ''}`;
  }

  if (g.kind === 'exact' && pr.over) s.sum += ' · перевищено';
  if (h.time.window && !inWindow(h, now) && !s.done && g.period !== 'interval') {
    s.locked = true; s.control = 'locked';
    s.sum = `відкриється о ${fmtHM(h.time.window.from)}`;
  }
  if (yesterdayUnclosed(h)) s.extra = 'вчора не закрито';
  if (s.timer) s.sum = 'таймер іде · ' + fmtDur(timerElapsedMin());
  if (isPausedOn(h, today)) {
    s.paused = true;
    s.sum = h.paused.until ? `на паузі до ${fmtShort(h.paused.until)}` : 'на паузі';
    s.control = 'paused';
    s.extra = null;
  }
  return s;
}

/* ---------- людські формулювання ---------- */
export function habitSentence(h) {
  const g = h.goal;
  let goal;
  const per = g.period === 'day' ? 'на день' : g.period === 'week' ? 'на тиждень' : g.period === 'month' ? 'на місяць'
    : g.period === 'everyN' ? `кожні ${g.everyN} ${plural(g.everyN, P.den)}` : '';
  const amount = h.type === 'check' ? `${fmtN(g.n)} ${plural(g.n, P.raz)}` : h.type === 'qty' ? `${fmtN(g.n)} ${h.unit || ''}`.trim() : fmtDur(g.n);
  if (g.period === 'interval') goal = `Відмічати кожні ${g.intervalH} год, допуск ±${g.tolH} год, після попередньої відмітки`;
  else if (g.kind === 'none') goal = `Лише облік, без цілі, підсумок за ${g.period === 'week' ? 'тиждень' : g.period === 'month' ? 'місяць' : g.period === 'everyN' ? `${g.everyN} ${plural(g.everyN, P.den)}` : 'день'}`;
  else {
    const head = g.kind === 'max' ? 'Не більше ніж' : g.kind === 'exact' ? 'Рівно' : 'Щонайменше';
    const sec = g.second && g.second.n ? ` і ${g.second.n} ${plural(g.second.n, P.sesia)}` : '';
    goal = `${head} ${amount}${sec} ${per}`;
  }
  const sch = h.schedule.days ? h.schedule.days.map(d => DOW_SHORT[d]).join(' · ') : 'щодня';
  const dates = h.schedule.end
    ? `, з ${fmtShort(h.schedule.start)} до ${fmtShort(h.schedule.end)}`
    : (h.schedule.start > TODAY() ? `, з ${fmtShort(h.schedule.start)}` : '');
  const time = g.period === 'interval' ? '' : h.time.window ? `, відмічати з ${fmtHM(h.time.window.from)} до ${fmtHM(h.time.window.to)}` : ', відмічати будь-коли';
  return `${goal}, ${sch}${dates}${time}.`;
}
export function scheduleSummary(h) {
  const days = h.schedule.days ? h.schedule.days.map(d => DOW_SHORT[d]).join(' · ') : 'Щодня';
  const end = h.schedule.end ? `з ${fmtShort(h.schedule.start)} до ${fmtShort(h.schedule.end)}` : 'без дати кінця';
  return `${days} · ${end}`;
}
export function timeSummary(h) {
  const w = h.time.window ? `${fmtHM(h.time.window.from)}–${fmtHM(h.time.window.to)}` : 'Будь-коли';
  const r = h.time.retro === 'none' ? 'без ретро' : h.time.retro === 'yesterday' ? 'ретро: вчора' : `ретро: до ${h.time.retro} днів`;
  return `${w} · ${r}`;
}
export function extraSummary(h) {
  const parts = [];
  if (h.tags.length) parts.push('Теги: ' + h.tags.join(', '));
  if (h.requireNote) parts.push('вимагати нотатку');
  if (h.requirePhoto) parts.push('вимагати фото');
  if (h.desc) parts.push('опис');
  return parts.length ? parts.join(' · ') : '';
}
export function warnings(h) {
  const w = [];
  const ex = h.reminders.find(r => r.type === 'exact' && r.time);
  if (h.time.window && ex) {
    const f = hmToMin(h.time.window.from), t = hmToMin(h.time.window.to) || 1440, n = hmToMin(ex.time);
    const inside = f < t ? (n >= f && n < t) : (n >= f || n < t);
    if (!inside) w.push({ t: `Нагадування о ${fmtHM(ex.time)}, а відмітити можна з ${fmtHM(h.time.window.from)}.`, fix: 'reminders' });
  }
  if (h.goal.period === 'week' && h.schedule.days && h.goal.kind === 'min' && h.type === 'check' && h.schedule.days.length < h.goal.n)
    w.push({ t: `За розкладом лише ${h.schedule.days.length} ${plural(h.schedule.days.length, P.den)} на тиждень — ціль недосяжна.`, fix: 'schedule' });
  if (h.goal.kind === 'max' && h.goal.n === 0)
    w.push({ t: 'Не більше ніж 0 — виконано, доки не залогуєте жодного разу. Так і задумано?', fix: null });
  if (h.type === 'qty' && !h.unit)
    w.push({ t: `Без одиниці число буде показуватись просто як «${fmtN(h.goal.n)}».`, fix: null });
  if (h.schedule.end && h.goal.period === 'month' && diffDays(h.schedule.start, h.schedule.end) < 7)
    w.push({ t: 'Місячна ціль не встигне закритись до дати кінця.', fix: 'schedule' });
  if (h.goal.kind === 'min' && h.goal.n <= 0 && h.goal.period !== 'interval')
    w.push({ t: 'Ціль 0 — звичка вважатиметься виконаною завжди.', fix: null });
  if (h.goal.kind === 'exact' && h.type !== 'check')
    w.push({ t: 'Ціль «рівно» закриється лише при точному збігу суми — для кількості й часу це майже недосяжно.', fix: null });
  if (h.goal.kind === 'exact' && h.goal.n <= 0)
    w.push({ t: 'Рівно 0 — виконано, доки не залогуєте жодного разу. Так і задумано?', fix: null });
  return w;
}
export function errors(h) {
  const e = [];
  if (!h.name.trim()) e.push('name');
  if (h.schedule.days && !h.schedule.days.length) e.push('days');
  if (h.schedule.end && h.schedule.end < h.schedule.start) e.push('end');
  return e;
}
export const isComplexGoal = h => h.goal.period !== 'day' || h.goal.n > 1 || h.type !== 'check' || !!h.goal.second;
