/* Екран «Сьогодні». */
import { esc, fmtN, addDays, dow, parseK, MON_GEN, DOW_LONG, DOW_SHORT, plural, P, fmtHM } from '../util.js';
import { settings, ui, visibleHabits, allTags } from '../state.js';
import { TODAY, rowState, isScheduled } from '../engine.js';
import { RECIPES } from '../recipes.js';
import { topdeco, tabbar, indicator, hcolor } from './common.js';

export function controlHTML(h, st) {
  const pr = st.pr;
  if (st.paused) return `<button class="circ locked" data-act="habitMenu" data-hid="${h.id}">⏸</button>`;
  if (st.timer) return `<button class="circ play running" data-act="openTimer" data-hid="${h.id}">■</button>`;
  if (st.locked) return `<button class="circ locked" data-act="lockedTap" data-hid="${h.id}">🔒</button>`;
  if (st.control === 'interval') return `<button class="circ iv ${st.ready ? 'ready' : ''}" data-act="mark" data-hid="${h.id}">${st.ready ? '○' : '⏲'}</button>`;
  const closable = h.goal.kind === 'min' || h.goal.kind === 'exact';
  if (st.control === 'qty') return (h.presets[0] ? `<button class="preset" data-act="preset" data-hid="${h.id}" data-v="${h.presets[0]}">+${fmtN(h.presets[0])}</button>` : '')
    + `<button class="circ ${pr.done && closable ? 'filled' : ''}" data-act="openQty" data-hid="${h.id}">${pr.done && closable ? '✓' : ''}</button>`;
  if (st.control === 'time') return `<button class="circ play ${pr.done && closable ? 'filled' : ''}" data-act="startTimer" data-hid="${h.id}">▶</button>`;
  if (h.goal.kind === 'max') return `<button class="circ max" data-act="mark" data-hid="${h.id}" style="${pr.over ? '' : 'border-style:dashed'}">${pr.value ? pr.value : ''}</button>`;
  if (h.goal.kind === 'none') return `<button class="circ" data-act="mark" data-hid="${h.id}">+</button>`;
  if (h.type === 'check' && h.goal.n > 1) return `<button class="circ ${pr.done ? 'filled' : pr.count ? 'part' : ''}" data-act="mark" data-hid="${h.id}">${pr.done ? '✓' : pr.count ? `${pr.count}/${h.goal.n}` : ''}</button>`;
  return `<button class="circ ${pr.done ? 'filled' : ''}" data-act="mark" data-hid="${h.id}">${pr.done ? '✓' : ''}</button>`;
}

export function rowHTML(h, st) {
  const right = st.control === 'qty' ? `<span>+${fmtN(h.presets[0] || 1)}</span><span>Ввести…</span>`
    : st.control === 'time' ? `<span>Ввести час</span><span>Таймер</span>`
      : `<span>Відмітити</span>`;
  const handle = ui.reorder ? `<span class="handle" data-handle="1">≡</span>` : '';
  return `<div class="rowwrap" style="${hcolor(h)}"><div class="under"><div class="lp">↶ Скасувати останню</div><div class="rp">${right}</div></div>
  <div class="row ${st.done ? 'done' : ''}" data-hid="${h.id}" data-act="openHabit">${handle}${indicator(h, st.pr)}<div class="txt"><div class="name">${esc(h.name)}</div><div class="sum">${esc(st.sum)}${st.extra ? ` · <button class="retro" data-act="retroQuick" data-hid="${h.id}">${esc(st.extra)}</button>` : ''}</div></div><div class="ctl">${ui.reorder ? '' : controlHTML(h, st)}</div></div></div>`;
}

function tilesHTML(rows, states) {
  return `<div class="tiles">${rows.map(h => {
    const st = states.get(h);
    return `<button class="tile" style="${hcolor(h)}" data-act="tileMain" data-hid="${h.id}"><span class="arrow" data-act="openHabit" data-hid="${h.id}">›</span>${indicator(h, st.pr)}<div class="name">${esc(h.name)}</div><div class="sum">${esc(st.sum)}</div></button>`;
  }).join('')}</div>`;
}

function nextScheduled(list) {
  const t = TODAY();
  for (let i = 1; i < 60; i++) {
    const d = addDays(t, i);
    const h = list.find(x => isScheduled(x, d));
    if (h) return { h, day: d };
  }
  return null;
}

function emptyHTML() {
  return `<div class="empty">Тут будуть ваші звички на сьогодні</div>
  <div class="recipes">${RECIPES.map(r => `<button class="recipe" data-act="recipe" data-id="${r.id}"><div class="e">${r.icon}</div><b>${esc(r.title)}</b><span>${esc(r.sub)}</span></button>`).join('')}</div>
  <button class="bigbtn sec" data-act="newBlank">Створити свою</button>`;
}

export function renderToday() {
  const today = TODAY();
  const list = visibleHabits();
  const tags = allTags();
  const filt = h => ui.tag === 'усі' || h.tags.includes(ui.tag);
  const rows = ui.seg === 'today'
    ? list.filter(h => isScheduled(h, today) && filt(h))
    : list.filter(filt);
  const states = new Map(rows.map(h => [h, rowState(h)]));
  const open = rows.filter(h => !states.get(h).done);
  const done = rows.filter(h => states.get(h).done);

  let body = '';
  if (ui.newDayBar) body += `<div class="banner"><span>Почався новий день</span><button class="link" data-act="newDayRefresh">Оновити</button></div>`;
  if (ui.tzBar) body += `<div class="banner"><span>${esc(ui.tzBar)}</span><button class="link" data-act="closeTzBar">Ок</button></div>`;
  if (ui.reorder) body += `<div class="banner"><span>Перетягніть рядки за ≡, щоб змінити порядок</span><button class="link" data-act="reorderDone">Готово</button></div>`;

  body += `<div class="seg"><button class="${ui.seg === 'today' ? 'on' : ''}" data-act="seg" data-seg="today">Сьогодні</button><button class="${ui.seg === 'all' ? 'on' : ''}" data-act="seg" data-seg="all">Усі</button></div>`;
  if (tags.length >= 2) body += `<div class="chips">${['усі', ...tags].map(t => `<button class="chip ${ui.tag === t ? 'on' : ''}" data-act="tag" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>`;
  else body += `<div style="height:12px"></div>`;

  if (!list.length) body += emptyHTML();
  else if (!rows.length) {
    const next = ui.tag === 'усі' ? nextScheduled(list) : null;
    body += `<div class="empty">${ui.tag !== 'усі' ? 'За цим тегом нічого немає' : 'На сьогодні нічого не заплановано'}${next ? ` · Наступна: ${esc(next.h.name)}, ${DOW_SHORT[dow(next.day)]}` : ''}<br><button class="linkbtn" data-act="seg" data-seg="all">Усі звички</button></div>`;
  } else if (ui.reorder) {
    body += `<div class="card" data-list="reorder">${rows.map(h => rowHTML(h, states.get(h))).join('')}</div>`;
  } else if (settings.view === 'tiles') {
    body += tilesHTML(rows, states);
  } else {
    if (open.length) body += `<div class="card" data-list="open">${open.map(h => rowHTML(h, states.get(h))).join('')}</div>`;
    else if (done.length) body += `<div class="empty" style="padding:22px 12px 8px">Усе на сьогодні закрито</div>`;
    if (done.length && !settings.hideDone) {
      body += `<button class="sect" style="width:100%;text-align:left" data-act="toggleDone"><span>Виконано · ${done.length}</span><span>${ui.doneCollapsed ? '›' : '⌄'}</span></button>`
        + (ui.doneCollapsed ? '' : `<div class="card" data-list="done">${done.map(h => rowHTML(h, states.get(h))).join('')}</div>`);
    }
  }

  const d = parseK(today);
  const now = new Date();
  const dayEndH = Number(settings.dayEnd.split(':')[0]);
  const stillYesterday = settings.dayEnd !== '00:00' && now.getHours() < dayEndH;
  return `<div class="screen">${topdeco()}
  <div class="nav"><button class="glass" data-act="push" data-s="settings" aria-label="Налаштування">⚙</button><span class="title"></span>
  <div class="grp glass"><button data-act="todayMenu" aria-label="Меню">⋯</button><button data-act="plus" style="font-size:26px" aria-label="Нова звичка">+</button></div></div>
  <div class="content"><div class="hero"><div class="date">${d.getDate()} ${MON_GEN[d.getMonth()]}</div><div class="dow">${DOW_LONG[dow(today)]}${stillYesterday ? ' · доба ще триває' : ''}</div></div>${body}</div>${tabbar()}</div>`;
}
