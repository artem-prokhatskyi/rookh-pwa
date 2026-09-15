/* Сторінка звички. */
import {
  esc, fmtN, fmtDur, fmtTime, fmtDate, fmtShort, fmtHM, addDays, diffDays, dow, pad,
  plural, P, DOW_SHORT,
} from '../util.js';
import { ui } from '../state.js';
import {
  TODAY, rowState, progress, streaks, periodsBack, periodOf, logsIn, logsOn, activeLogs,
  isScheduled, isPausedOn, dayCell, habitSentence, yesterdayUnclosed, periodUnit, lastLog, timerElapsedMin,
} from '../engine.js';
import { topdeco, hcolor, heatmapHTML, heatTipHTML } from './common.js';

function metricsHTML(h) {
  const today = TODAY();
  const off = (dow(today) - 0 + 7) % 7;
  const start = addDays(today, -83);
  let sched = 0, done = 0, logs = 0;
  for (let d = start; d <= today; d = addDays(d, 1)) {
    if (!isScheduled(h, d)) continue;
    sched++;
    const c = dayCell(h, d);
    if (c && c.pct >= 1) done++;
    logs += logsOn(h, d).length;
  }
  const pct = sched ? Math.round(done / sched * 100) : 0;
  return `<div class="metrics"><span><b>${sched}</b> ${plural(sched, P.den)} у розкладі</span><span>·</span><span><b>${done}</b> закрито</span><span>·</span><span><b>${pct} %</b></span><span>·</span><span><b>${logs}</b> ${plural(logs, P.zapys)}</span></div>`;
}

function trendHTML(h, ps, vals) {
  const v = vals.map(x => h.type === 'check' ? x.count : x.sum);
  const target = h.goal.kind === 'none' || h.goal.period === 'interval' ? null : h.goal.n;
  const mx = Math.max(1, ...v, target || 0) * 1.15;
  const W = 320, H = 80, padd = 8, n = v.length;
  const xs = i => padd + (n > 1 ? i * (W - 2 * padd) / (n - 1) : W / 2);
  const ys = val => H - padd - (val / mx) * (H - 2 * padd);
  const fmt = val => h.type === 'time' ? fmtDur(val) : h.type === 'qty' ? fmtN(Math.round(val)) : String(val);
  const goal = target !== null
    ? `<line x1="0" x2="${W}" y1="${ys(target)}" y2="${ys(target)}" stroke="var(--text-3)" stroke-dasharray="3 4" stroke-width="1"/><text x="${W}" y="${ys(target) - 4}" text-anchor="end" font-size="10" fill="var(--text-3)">ціль ${esc(fmt(target))}</text>`
    : '';
  const line = v.length > 1 ? `<polyline fill="none" stroke="var(--hc)" stroke-opacity=".35" stroke-width="1.5" points="${v.map((val, i) => `${xs(i)},${ys(val)}`).join(' ')}"/>` : '';
  const dots = v.map((val, i) => `<circle cx="${xs(i)}" cy="${ys(val)}" r="${i === n - 1 ? 4.5 : 3.5}" fill="${val === 0 ? 'var(--surface-3)' : 'var(--hc)'}" ${h.goal.kind === 'max' && target !== null && val > target ? 'stroke="var(--text-3)" stroke-width="1.5" fill="none"' : ''}/>`).join('');
  const unit = h.type === 'check' ? 'відмітки' : h.type === 'time' ? 'час' : esc(h.unit);
  return `<div class="trend"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${goal}${line}${dots}</svg><div class="lbl"><span>${ps.length ? fmtShort(ps[0].start) : ''}</span><span>${unit} за ${ps.length} ${periodUnit(h, ps.length)}</span><span>${esc(fmt(v[v.length - 1] || 0))}</span></div></div>`;
}

export function renderHabit(h) {
  const today = TODAY();
  const st = rowState(h);
  const pr = st.pr;
  const sk = streaks(h);
  const disabled = h.archived || isPausedOn(h, today);
  let action = '';
  if (h.paused && isPausedOn(h, today)) action += `<div class="pausebar"><span>На паузі${h.paused.until ? ' до ' + fmtShort(h.paused.until) : ''}</span><button data-act="resume" data-hid="${h.id}">Відновити</button></div>`;
  if (h.archived) action += `<div class="pausebar"><span>В архіві</span><button data-act="unarchive" data-hid="${h.id}">Повернути</button></div>`;

  const tail = pr.period.kind === 'day' ? 'сьогодні' : pr.period.kind === 'week' ? 'цього тижня' : pr.period.kind === 'month' ? 'цього місяця' : 'у періоді';

  if (h.goal.period === 'interval') {
    const iv = st.iv;
    const mins = iv.minsLeft || 0;
    action += `<div class="action"><div class="bignum">${iv.phase === 'early' ? `${Math.floor(mins / 60)}:${pad(mins % 60)}` : 'зараз'}</div>
    <div class="pstate">${iv.phase === 'early' ? `до дозволеного часу · можна з ${fmtTime(new Date(iv.from))}` : esc(iv.text)}</div>
    <button class="bigcirc ${iv.phase === 'early' ? 'dim' : ''}" data-act="mark" data-hid="${h.id}" ${disabled ? 'disabled' : ''}>Відмітити</button>
    <div class="pstate">${pr.count} ${plural(pr.count, P.raz)} сьогодні · останній ${lastLog(h) ? fmtTime(new Date(lastLog(h).ts)) : '—'}</div></div>`;
  } else if (h.goal.kind === 'none') {
    const val = h.type === 'time' ? fmtDur(pr.sum) : h.type === 'qty' ? `${fmtN(pr.sum)} ${esc(h.unit)}` : `${pr.count}`;
    action += `<div class="action"><div class="bignum">${val}</div><div class="pstate">${pr.count} ${plural(pr.count, P.zapys)} сьогодні</div>
    <div class="timerrow">${h.type === 'time' ? `<button class="stop" data-act="startTimer" data-hid="${h.id}" ${disabled ? 'disabled' : ''}>▶ Старт</button>` : ''}<button data-act="${h.type === 'check' ? 'markNote' : 'openQty'}" data-hid="${h.id}" ${disabled ? 'disabled' : ''}>+ Запис</button></div></div>`;
  } else if (h.type === 'check') {
    const segs = h.goal.kind === 'min' && h.goal.n > 1 && h.goal.n <= 7
      ? `<div class="segdots">${Array.from({ length: h.goal.n }, (_, i) => `<div><span class="${i < pr.count ? 'on' : ''}"></span><small>${pr.logs[i] ? DOW_SHORT[dow(pr.logs[i].date)] : '—'}</small></div>`).join('')}</div>`
      : '';
    const label = st.locked ? `Відкриється о ${fmtHM(h.time.window.from)}` : h.goal.kind === 'max' ? 'Залогувати'
      : pr.done && h.goal.n === 1 && pr.period.kind === 'day' ? '✓' : 'Відмітити';
    const state = h.goal.kind === 'max'
      ? `${pr.value} з ${h.goal.n} ${tail}${pr.over ? ' · перевищено' : ' · в межах'}`
      : h.goal.n === 1 && pr.period.kind === 'day'
        ? (pr.done ? `відмічено о ${fmtTime(new Date(pr.logs[pr.logs.length - 1].ts))}` : 'не відмічено')
        : `${pr.count} з ${h.goal.n} ${tail}${pr.period.kind !== 'day' ? ` · ще ${Math.max(0, diffDays(today, pr.period.end))} ${plural(Math.max(0, diffDays(today, pr.period.end)), P.den)}` : ''}`;
    action += `<div class="action"><button class="bigcirc ${st.done ? 'filled' : ''} ${st.locked ? 'dim' : ''}" data-act="mark" data-hid="${h.id}" ${disabled ? 'disabled' : ''}>${label}</button>
    <div class="pstate">${esc(state)}</div>${segs}
    ${yesterdayUnclosed(h) ? `<div class="pstate">Вчора не закрито · <button style="color:var(--accent);font-weight:700" data-act="retroQuick" data-hid="${h.id}">Закрити вчора</button></div>` : ''}</div>`;
  } else if (h.type === 'qty') {
    action += `<div class="action"><div class="bignum">${fmtN(pr.sum)}<small>/ ${fmtN(h.goal.n)} ${esc(h.unit)}</small></div>
    <div class="quick" style="justify-content:center">${h.presets.map(p => `<button data-act="preset" data-hid="${h.id}" data-v="${p}" ${disabled ? 'disabled' : ''}>+${fmtN(p)}</button>`).join('')}<button data-act="openQty" data-hid="${h.id}" ${disabled ? 'disabled' : ''}>+ …</button></div>
    <div class="pstate">${pr.count} ${plural(pr.count, P.zapys)} сьогодні${pr.done && h.goal.kind === 'min' ? ' · ціль закрита' : ''}</div></div>`;
  } else {
    action += `<div class="action">${st.timer
      ? `<div class="bignum">${fmtDur(timerElapsedMin())}</div><div class="timerrow"><button data-act="openTimer" data-hid="${h.id}">Відкрити таймер</button></div>`
      : `<div class="bignum">${fmtDur(pr.sum)}<small>/ ${fmtDur(h.goal.n)}</small></div><div class="timerrow"><button class="stop" data-act="startTimer" data-hid="${h.id}" ${disabled ? 'disabled' : ''}>▶ Старт</button><button data-act="openQty" data-hid="${h.id}" ${disabled ? 'disabled' : ''}>Ввести вручну</button></div>`}
    <div class="pstate">${pr.count} ${plural(pr.count, P.sesia)}${pr.second ? ` з ${pr.second.n}` : ''} сьогодні</div></div>`;
  }

  const stats = [
    `<div class="stat"><div class="v">${sk.cur}</div><div class="k">Серія, ${periodUnit(h, sk.cur)}</div></div>`,
    `<div class="stat"><div class="v">${sk.longest}</div><div class="k">Найдовша, ${periodUnit(h, sk.longest)}</div></div>`,
    `<div class="stat"><div class="v">${sk.pct} %</div><div class="k">Виконано</div></div>`,
  ];
  if (h.type !== 'check') {
    const m = periodOf({ goal: { period: 'month' }, schedule: h.schedule }, today);
    const ml = logsIn(h, m.start, m.end);
    const sum = ml.reduce((a, l) => a + (Number(l.value) || 0), 0);
    const days = new Set(ml.map(l => l.date)).size || 1;
    stats.push(
      `<div class="stat"><div class="v">${h.type === 'time' ? fmtDur(sum) : fmtN(sum)}</div><div class="k">${h.type === 'time' ? 'Загалом' : 'Сума'} за місяць${h.type === 'qty' ? ', ' + esc(h.unit) : ''}</div></div>`,
      `<div class="stat"><div class="v">${h.type === 'time' ? fmtDur(sum / days) : fmtN(Math.round(sum / days))}</div><div class="k">Середнє за день</div></div>`,
    );
  }

  const ps = periodsBack(h, today, 40).slice(0, 12).reverse();
  const vals = ps.map(p => progress(h, p.start));

  const logs = activeLogs(h).slice().sort((a, b) => b.ts - a.ts).slice(0, 60);
  let feed = '', lastD = '';
  logs.forEach(l => {
    if (l.date !== lastD) {
      feed += `<div class="dayhead">${l.date === today ? 'Сьогодні' : l.date === addDays(today, -1) ? 'Вчора' : fmtDate(l.date)}</div>`;
      lastD = l.date;
    }
    const v = h.type === 'check' ? '✓' : h.type === 'time' ? fmtDur(l.value) : fmtN(l.value) + ' ' + esc(h.unit);
    feed += `<button class="log" data-act="openLog" data-hid="${h.id}" data-lid="${l.id}"><span class="t">${fmtTime(new Date(l.ts))}</span><span class="v">${v}</span>`
      + `${l.photoId ? `<span class="ph"><img data-photo="${l.photoId}" alt=""></span>` : ''}`
      + `<span class="n">${esc(l.note)}</span>`
      + `${l.retro ? '<span class="tag">ретро</span>' : ''}${l.edited ? '<span class="tag">змінено</span>' : ''}${l.early ? `<span class="tag">раніше на ${fmtDur(l.early)}</span>` : ''}</button>`;
  });
  const total = activeLogs(h).length;
  const tip = ui.heatTip && ui.heatTip.key === h.id ? heatTipHTML(h, ui.heatTip.day) : '';

  return `<div class="screen" style="${hcolor(h)}">${topdeco()}
  <div class="nav"><button class="txt glass" data-act="pop">‹ Назад</button><span class="title"></span>
  <div class="grp glass"><button class="txt" data-act="edit" data-hid="${h.id}">Редагувати</button><button data-act="habitMenu" data-hid="${h.id}">⋯</button></div></div>
  <div class="content">
  <div class="hhead"><div class="big-ind">${h.icon}</div><h2>${esc(h.name)}</h2><div class="sent">${esc(habitSentence(h))}</div>${h.desc ? `<div class="desc">«${esc(h.desc)}»</div>` : ''}</div>
  ${action}
  <div class="sect"><span>Календар · 12 тижнів</span></div>${metricsHTML(h)}${heatmapHTML(d => dayCell(h, d), 12, { key: h.id, tip, bare: true })}
  <div class="stats3">${stats.join('')}</div>${trendHTML(h, ps, vals)}
  <div class="sect"><span>Історія · ${total} ${plural(total, P.zapys)}</span></div>${feed || '<div class="empty">Записів ще немає</div>'}
  ${total > 60 ? '<div class="hint">Показано останні 60 записів.</div>' : ''}
  </div></div>`;
}
