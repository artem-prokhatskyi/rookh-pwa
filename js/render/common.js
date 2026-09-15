/* Спільні шматки розмітки. */
import { esc, addDays, dow, parseK, fmtDate, fmtN, fmtDur, MON_SHORT, plural, P } from '../util.js';
import { settings, ui } from '../state.js';
import { TODAY, dayCell, isScheduled, progress, logsOn, canRetro } from '../engine.js';

export const hcolor = h => `--hc:var(--h${h.color})`;

export function ambient() {
  const hh = new Date().getHours();
  const pair = hh >= 5 && hh < 11 ? ['#BFD3F0', '#D9CDF2']
    : hh >= 11 && hh < 17 ? ['#EADFC6', '#D8D3CB']
      : hh >= 17 && hh < 22 ? ['#F2CDB0', '#EBC4CF'] : ['#B9C0DE', '#A9B4C2'];
  return `<div class="ambient" style="--light-a:${pair[0]};--light-b:${pair[1]}"></div>`;
}
export const topdeco = () => ambient() + `<div class="edge"></div>`;

export const tabbar = () => `<div class="tabbar glass ${ui.tabMini ? 'mini' : ''}">
<button class="${ui.tab === 'today' ? 'on' : ''}" data-act="tab" data-tab="today"><span class="ico">☑</span><span>Сьогодні</span></button>
<button class="${ui.tab === 'stats' ? 'on' : ''}" data-act="tab" data-tab="stats"><span class="ico">▦</span><span>Статистика</span></button></div>`;

export function ringStyle(pct, segments) {
  if (segments && segments > 1 && segments <= 8) {
    const gap = 6, seg = (360 - gap * segments) / segments;
    const stops = []; let a = 0;
    const filled = Math.round(pct * segments);
    for (let i = 0; i < segments; i++) {
      stops.push(`${i < filled ? 'var(--hc)' : 'var(--surface-3)'} ${a}deg ${a + seg}deg`);
      a += seg;
      stops.push(`transparent ${a}deg ${a + gap}deg`);
      a += gap;
    }
    return `background:conic-gradient(${stops.join(',')})`;
  }
  return `background:conic-gradient(var(--hc) ${Math.round(pct * 360)}deg, var(--surface-3) 0)`;
}
export function indicator(h, pr) {
  const segs = h.type === 'check' && (h.goal.kind === 'min' || h.goal.kind === 'exact') && h.goal.period !== 'interval' && h.goal.n <= 8 ? h.goal.n
    : (h.goal.period === 'interval' ? pr.target : 0);
  const pct = h.goal.kind === 'max' ? (pr.over ? 0 : 1) : pr.pct;
  return `<div class="ind"><div class="ring" style="${ringStyle(pct, segs)}"></div><div class="core">${h.icon}</div></div>`;
}

/* ---------- heatmap ---------- */
export function heatmapHTML(cellFn, weeks, opts = {}) {
  const today = TODAY();
  const off = (dow(today) - settings.firstDay + 7) % 7;
  const curStart = addDays(today, -off);
  const start = addDays(curStart, -(weeks - 1) * 7);
  let cells = '';
  const months = [];
  let lastM = -1;
  for (let w = 0; w < weeks; w++) {
    const wk = addDays(start, w * 7);
    const m = parseK(wk).getMonth();
    months.push(m !== lastM && (w === 0 || parseK(wk).getDate() <= 7) ? MON_SHORT[m] : '');
    lastM = m;
  }
  const key = opts.key || 'x';
  for (let i = 0; i < weeks * 7; i++) {
    const day = addDays(start, i);
    if (day > today) { cells += `<div class="cell future"></div>`; continue; }
    const c = cellFn(day);
    const sel = ui.heatTip && ui.heatTip.day === day && ui.heatTip.key === key ? ' hl' : '';
    if (!c) { cells += `<div class="cell na${sel}" data-act="heatTap" data-day="${day}" data-key="${key}"></div>`; continue; }
    if (c.over) { cells += `<div class="cell over${sel}" data-act="heatTap" data-day="${day}" data-key="${key}"></div>`; continue; }
    const p = c.pct;
    const [a0, a1] = opts.range || [25, 90];
    const alpha = p <= 0 ? 0 : p >= 1 ? 100 : Math.round(a0 + (a1 - a0) * p);
    const bg = alpha ? `background:color-mix(in srgb,${opts.color || 'var(--hc)'} ${alpha}%,${opts.mixBase || 'transparent'})` : '';
    cells += `<div class="cell${sel}" style="${bg}" data-act="heatTap" data-day="${day}" data-key="${key}">`
      + `${c.hasLog && c.periodKind && c.periodKind !== 'day' ? '<span class="dot"></span>' : ''}`
      + `${c.retro ? '<span class="rt"></span>' : ''}</div>`;
  }
  return `<div class="heat ${opts.bare ? 'bare' : ''}"><div class="months">${months.map(m => `<span>${m}</span>`).join('')}</div>`
    + `<div class="grid" style="grid-template-columns:repeat(${weeks},1fr)">${cells}</div>${opts.tip || ''}</div>`;
}

export function miniHeat(h) {
  const today = TODAY();
  const off = (dow(today) - settings.firstDay + 7) % 7;
  const start = addDays(addDays(today, -off), -3 * 7);
  let cells = '';
  for (let i = 0; i < 28; i++) {
    const day = addDays(start, i);
    if (day > today) { cells += '<div class="cell future"></div>'; continue; }
    const c = dayCell(h, day);
    if (!c) { cells += '<div class="cell na"></div>'; continue; }
    if (c.over) { cells += '<div class="cell over"></div>'; continue; }
    const a = c.pct <= 0 ? 0 : c.pct >= 1 ? 100 : Math.round(25 + 65 * c.pct);
    cells += `<div class="cell" style="${a ? `background:color-mix(in srgb,var(--hc) ${a}%,transparent)` : ''}"></div>`;
  }
  return `<div class="mini" style="grid-template-columns:repeat(4,1fr)">${cells}</div>`;
}

export function heatTipHTML(h, day) {
  const c = dayCell(h, day);
  const pr = progress(h, day);
  const dl = logsOn(h, day);
  let val = h.type === 'qty' ? `${fmtN(pr.sum)} / ${fmtN(h.goal.n)} ${esc(h.unit)}`
    : h.type === 'time' ? `${fmtDur(pr.sum)} / ${fmtDur(h.goal.n)}`
      : h.goal.kind === 'max' ? `${pr.value} з ${h.goal.n}${pr.over ? ' · перевищено' : ''}`
        : `${pr.count} з ${pr.target}`;
  if (h.goal.kind === 'none') val = `${pr.count} ${plural(pr.count, P.zapys)}`;
  if (h.goal.kind === 'exact' && pr.over) val += ' · перевищено';
  if (!c) val = isScheduled(h, day) ? val : 'поза розкладом';
  const pct = c && h.goal.kind !== 'none' ? ` · ${Math.round(pr.pct * 100)} %` : '';
  const retroOk = canRetro(h, day);
  const action = retroOk && !pr.done && h.type === 'check' && h.goal.kind === 'min'
    ? `<button data-act="retroMark" data-hid="${h.id}" data-day="${day}">Закрити день</button>`
    : retroOk && h.type !== 'check'
      ? `<button data-act="openQty" data-hid="${h.id}" data-day="${day}">Додати запис</button>`
      : dl.length ? `<button data-act="openLog" data-hid="${h.id}" data-lid="${dl[dl.length - 1].id}">Запис</button>` : '';
  return `<div class="tip"><span>${fmtDate(day)} · ${val}${pct}${dl.some(l => l.retro) ? ' · ретро' : ''}</span>${action}</div>`;
}
