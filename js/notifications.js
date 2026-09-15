/* Нагадування. У вебі планувальника немає — таймер працює, поки додаток відкритий. */
import { habits, settings, ui } from './state.js';
import { TODAY, rowState, isScheduled, isPausedOn, intervalState, reminderMinutes, progress } from './engine.js';
import { dow, dkey, addDays, pad } from './util.js';
import { toast } from './ui.js';
import { kvGet, kvSet } from './db.js';

let timerId = null;
let fired = new Set();

export async function loadFired() {
  const a = await kvGet('firedReminders');
  if (Array.isArray(a)) fired = new Set(a);
}
function remember(key) {
  fired.add(key);
  if (fired.size > 400) fired = new Set([...fired].slice(-200));
  kvSet('firedReminders', [...fired]).catch(() => {});
}

export function permissionState() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}
export async function askPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') return Notification.permission;
  try { return await Notification.requestPermission(); } catch (e) { return 'denied'; }
}

function habitSilenced(h, today) {
  if (h.archived) return true;
  if (isPausedOn(h, today)) return true;
  if (!isScheduled(h, today)) return true;
  const pr = progress(h, today);
  if (h.goal.kind === 'min' && pr.done) return true;
  return false;
}

/* всі заплановані спрацювання у вікні [now, now + horizon] */
function upcoming(now) {
  const list = [];
  const today = TODAY();
  const nowDayKey = dkey(now);
  for (const h of habits) {
    if (habitSilenced(h, today)) continue;
    for (const r of h.reminders) {
      if (r.type === 'interval') {
        if (h.goal.period !== 'interval') continue;
        const iv = intervalState(h, now.getTime());
        if (!iv.from) continue;
        const at = iv.from - (r.before || 0) * 6e4;
        const key = `${r.id}|${Math.round(at / 6e4)}`;
        if (at >= now.getTime() - 60000 && !fired.has(key)) list.push({ at, h, r, key });
        continue;
      }
      for (const dayOff of [0, 1]) {
        const d = addDays(nowDayKey, dayOff);
        if (r.days && r.days.length && !r.days.includes(dow(d))) continue;
        for (const m of reminderMinutes(h, r, d)) {
          const dt = new Date(d + 'T00:00:00');
          dt.setHours(Math.floor(m / 60), m % 60, 0, 0);
          const at = dt.getTime();
          const key = `${r.id}|${d}|${m}`;
          if (at >= now.getTime() - 60000 && !fired.has(key)) list.push({ at, h, r, key });
        }
      }
    }
  }
  return list.sort((a, b) => a.at - b.at);
}

function bodyFor(h) {
  try { return rowState(h).sum; } catch (e) { return ''; }
}

function fire(item) {
  remember(item.key);
  const title = (item.r.text && item.r.text.trim()) || item.h.name;
  const body = bodyFor(item.h);
  if (permissionState() === 'granted') {
    try {
      const n = new Notification(`${item.h.icon} ${title}`, { body, tag: 'rookh-' + item.h.id, icon: 'icons/icon-192.png' });
      n.onclick = () => { window.focus(); n.close(); };
    } catch (e) {
      toast(`${item.h.icon} ${title} · ${body}`);
    }
  } else {
    toast(`${item.h.icon} ${title} · ${body}`, null, 8000);
  }
}

export function syncReminders() {
  clearTimeout(timerId);
  timerId = null;
  const now = new Date();
  const list = upcoming(now);
  if (!list.length) return;
  const due = list.filter(x => x.at <= now.getTime());
  if (due.length) {
    fire(due[due.length - 1]);
    due.slice(0, -1).forEach(x => remember(x.key));
    setTimeout(syncReminders, 1500);
    return;
  }
  const next = list[0];
  const delay = Math.min(next.at - now.getTime(), 15 * 60000); // прокидаємось щонайменше раз на 15 хв
  timerId = setTimeout(syncReminders, Math.max(1000, delay));
}

export function snoozeMinutes() { return Number(settings.snooze) || 30; }
