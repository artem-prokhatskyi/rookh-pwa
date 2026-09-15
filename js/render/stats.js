/* Вкладка «Статистика» — загальний дашборд. */
import { esc, fmtN, addDays, dow, fmtDate, DOW_LONG, plural, P } from '../util.js';
import { ui, visibleHabits, allTags } from '../state.js';
import { TODAY, progress, isScheduled, streaks, logsIn, periodUnit } from '../engine.js';
import { topdeco, tabbar, heatmapHTML, miniHeat, ringStyle, hcolor } from './common.js';

export function renderStats() {
  const today = TODAY();
  const list = visibleHabits().filter(h => ui.statsTag === 'усі' || h.tags.includes(ui.statsTag));
  const tags = allTags();

  const aggCache = new Map();
  const agg = day => {
    if (aggCache.has(day)) return aggCache.get(day);
    const hs = list.filter(h => isScheduled(h, day));
    const r = hs.length ? { pct: hs.reduce((a, h) => a + progress(h, day).pct, 0) / hs.length, hasLog: false, periodKind: 'day' } : null;
    aggCache.set(day, r);
    return r;
  };

  const weeks = ui.statsWeeks;
  const start = addDays(today, -weeks * 7 + 1);
  let days = 0, sum = 0, logsN = 0, prevSum = 0, prevDays = 0;
  const byDow = Array(7).fill(0), byDowN = Array(7).fill(0);
  for (let d = addDays(start, -weeks * 7); d <= today; d = addDays(d, 1)) {
    const c = agg(d);
    if (!c) continue;
    if (d >= start) { days++; sum += c.pct; byDow[dow(d)] += c.pct; byDowN[dow(d)]++; }
    else { prevDays++; prevSum += c.pct; }
  }
  list.forEach(h => { logsN += logsIn(h, start, today).length; });
  const pct = days ? Math.round(sum / days * 100) : 0;
  const prev = prevDays ? Math.round(prevSum / prevDays * 100) : null;
  const best = byDow.map((v, i) => ({ i, v: byDowN[i] ? v / byDowN[i] : 0 })).sort((a, b) => b.v - a.v)[0];
  const longest = list.map(h => ({ h, s: streaks(h) })).sort((a, b) => b.s.longest - a.s.longest)[0];

  const tip = ui.heatTip && ui.heatTip.key === 'agg' ? (() => {
    const d = ui.heatTip.day;
    const hs = list.filter(h => isScheduled(h, d));
    return `<div class="tip"><span>${fmtDate(d)} · ${hs.map(h => `${esc(h.name)} ${Math.round(progress(h, d).pct * 100)} %`).join(' · ') || 'нічого не заплановано'}</span></div>`;
  })() : '';

  const wk = 12;
  const wkStart = addDays(today, -wk * 7 + 1);
  const dyn = [];
  for (let w = 0; w < wk; w++) {
    let s = 0, n = 0;
    for (let i = 0; i < 7; i++) { const c = agg(addDays(wkStart, w * 7 + i)); if (c) { s += c.pct; n++; } }
    dyn.push(n ? s / n : 0);
  }

  if (!list.length) {
    return `<div class="screen">${topdeco()}<div class="nav"></div><div class="content">
    <div class="hero"><div class="date">Статистика</div></div>
    <div class="empty">${visibleHabits().length ? 'За цим тегом немає звичок' : 'Тут зʼявиться статистика, коли будуть звички'}</div>
    ${tags.length >= 2 ? `<div class="chips">${['усі', ...tags].map(t => `<button class="chip ${ui.statsTag === t ? 'on' : ''}" data-act="statsTag" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : ''}
    </div>${tabbar()}</div>`;
  }

  return `<div class="screen">${topdeco()}<div class="nav"></div><div class="content">
  <div class="hero"><div class="date">Статистика</div><div class="dow">${weeks === 12 ? '12 тижнів' : weeks === 26 ? '6 місяців' : 'Рік'}${ui.statsTag !== 'усі' ? ' · ' + esc(ui.statsTag) : ''}</div></div>
  <div class="seg">${[[12, '12 тижнів'], [26, '6 місяців'], [52, 'Рік']].map(([v, t]) => `<button class="${weeks === v ? 'on' : ''}" data-act="statsWeeks" data-w="${v}">${t}</button>`).join('')}</div>
  ${tags.length >= 2 ? `<div class="chips">${['усі', ...tags].map(t => `<button class="chip ${ui.statsTag === t ? 'on' : ''}" data-act="statsTag" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : '<div style="height:12px"></div>'}
  ${heatmapHTML(agg, weeks, { key: 'agg', color: 'var(--agg)', range: [8, 95], tip })}
  <div class="sect"><span>Звички</span></div><div class="card">${list.map(h => {
    const s = streaks(h);
    return `<button class="hlist" style="${hcolor(h)}" data-act="openHabit" data-hid="${h.id}"><div class="ind"><div class="ring" style="${ringStyle(progress(h, today).pct, 0)}"></div><div class="core" style="font-size:14px">${h.icon}</div></div><span class="name">${esc(h.name)}</span>${miniHeat(h)}<span class="pct">${s.pct} %</span></button>`;
  }).join('')}</div>
  <div class="tiles" style="margin-top:12px">
    <div class="tile"><div class="sum">Виконано за період</div><div class="bignum" style="font-size:34px;margin-top:8px;text-align:left">${pct} %</div>${prev !== null ? `<div class="sum">${pct - prev >= 0 ? '+' : ''}${pct - prev} % до попереднього</div>` : ''}</div>
    <div class="tile"><div class="sum">Записів за період</div><div class="bignum" style="font-size:34px;margin-top:8px;text-align:left">${fmtN(logsN)}</div><div class="sum">≈ ${fmtN(Math.round(logsN / Math.max(1, weeks * 7) * 10) / 10)} на день</div></div>
    <div class="tile"><div class="sum">Найдовша серія</div><div class="bignum" style="font-size:34px;margin-top:8px;text-align:left">${longest ? longest.s.longest : 0}</div><div class="sum">${longest ? esc(longest.h.name) + ', ' + periodUnit(longest.h, longest.s.longest) : ''}</div></div>
    <div class="tile"><div class="sum">Найпродуктивніший день</div><div class="bignum" style="font-size:22px;margin-top:10px;text-align:left">${best && best.v > 0 ? DOW_LONG[best.i] : '—'}</div><div class="sum">${best && best.v > 0 ? Math.round(best.v * 100) + ' %' : ''}</div>
      <div class="chart" style="height:28px;padding:0;background:none;margin-top:6px;gap:3px">${byDow.map((v, i) => `<div class="bar" style="height:${Math.max(6, (byDowN[i] ? v / byDowN[i] : 0) * 100)}%;background:var(--agg);opacity:${best && best.i === i ? 1 : .35}"></div>`).join('')}</div></div>
  </div>
  <div class="sect"><span>Динаміка · 12 тижнів</span></div><div class="chart" style="margin-top:0">${dyn.map(v => `<div class="bar" style="height:${Math.max(3, v * 100)}%;background:var(--agg)"></div>`).join('')}</div>
  <div style="height:10px"></div>
  </div>${tabbar()}</div>`;
}
