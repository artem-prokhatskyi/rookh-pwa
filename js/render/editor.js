/* Редактор звички і його фокусні листи. */
import { esc, fmtN, fmtDur, fmtHM, plural, P, DOW_SHORT, diffDays, fmtDate, addDays } from '../util.js';
import { settings, ui, allTags, findHabit } from '../state.js';
import {
  habitSentence, scheduleSummary, timeSummary, extraSummary, remindersSummary, reminderText,
  warnings, errors, activeLogs,
} from '../engine.js';
import { topdeco, hcolor } from './common.js';
import { PALETTE, ICONS } from '../recipes.js';

const ED = () => ui.editor;
const chip = (key, text, on) => `<button class="gchip ${on ? 'on' : ''}" data-act="goalPop" data-pop="${key}">${text}<span class="car">▾</span></button>`;

export function perText(g) {
  return g.period === 'day' ? 'на день' : g.period === 'week' ? 'на тиждень' : g.period === 'month' ? 'на місяць'
    : g.period === 'everyN' ? `кожні ${g.everyN} ${plural(g.everyN, P.den)}` : 'з інтервалом';
}

function goalSentenceHTML(h) {
  const g = h.goal, e = ED();
  const on = k => e.pop === k;
  if (g.period === 'interval') {
    return `${chip('period', 'З інтервалом', on('period'))} <span class="w">кожні</span> ${chip('ivh', `${g.intervalH} год`, on('ivh'))}<span class="w">, допуск</span> ${chip('tol', `±${g.tolH} год`, on('tol'))}<span class="w">, після попередньої відмітки</span>`;
  }
  const kindTxt = g.kind === 'min' ? 'Щонайменше' : g.kind === 'max' ? 'Не більше ніж' : 'Без цілі';
  if (g.kind === 'none') return `${chip('kind', kindTxt, on('kind'))} <span class="w">, лише облік · підсумовувати</span> ${chip('period', perText(g), on('period'))}`;
  const amount = h.type === 'check' ? `${fmtN(g.n)}` : h.type === 'qty' ? fmtN(g.n) : fmtDur(g.n);
  const word = h.type === 'check' ? `<span class="w">${plural(g.n, P.raz)}</span>`
    : h.type === 'qty' ? `<span class="w">${esc(h.unit) || '<i style="color:var(--text-3)">одиниця</i>'}</span>` : '';
  let s = `${chip('kind', kindTxt, on('kind'))} ${chip('n', amount, on('n'))} ${word} ${chip('period', perText(g), on('period'))}`;
  if (g.second) s += `<br><span class="w">і</span> ${chip('n2', `${g.second.n}`, on('n2'))} <span class="w">${plural(g.second.n, P.sesia)}</span> <button class="gchip" data-act="removeSecond" style="color:var(--text-3)">×</button>`;
  return s;
}

function popoverHTML(h) {
  const e = ED(), g = h.goal;
  if (!e.pop) return '';
  const opt = (v, label, on, extra = '') => `<button class="opt ${on ? 'on' : ''}" data-act="popSet" data-v="${v}"><span style="flex:1;text-align:left">${label}${extra}</span><span>${on ? '✓' : ''}</span></button>`;
  const quick = (vals, cur, fmt = v => v, act = 'popSet') => `<div class="quick">${vals.map(v => `<button class="${v == cur ? 'on' : ''}" data-act="${act}" data-v="${v}">${fmt(v)}</button>`).join('')}</div>`;
  switch (e.pop) {
    case 'kind':
      return `<div class="popover">${opt('min', 'Щонайменше', g.kind === 'min')}${opt('max', 'Не більше ніж', g.kind === 'max')}${opt('none', 'Без цілі — лише облік', g.kind === 'none')}${g.kind === 'max' ? '<div class="inner subhint" style="margin:0">Виконано, доки за період не більше N. Логуйте факт — інтерфейс порахує решту.</div>' : ''}</div>`;
    case 'n': {
      const unit = h.type === 'check' ? plural(g.n, P.raz) : h.type === 'qty' ? (h.unit || 'одиниць') : 'хв';
      return `<div class="popover"><div class="inner"><div class="numin"><input type="text" inputmode="decimal" enterkeyhint="done" value="${g.n}" data-in="goalN" data-autofocus><span>${esc(unit)}</span></div>${h.type === 'check' ? quick([1, 2, 3, 5], g.n)
        : h.type === 'time' ? quick([15, 30, 60, 120, 240], g.n, fmtDur)
          : quick(h.presets.length ? [...h.presets, h.presets[h.presets.length - 1] * 4] : [1, 10, 50, 100, 1000, 2000], g.n, fmtN)}</div></div>`;
    }
    case 'n2':
      return `<div class="popover"><div class="inner"><div class="numin"><input type="number" inputmode="numeric" value="${g.second.n}" data-in="goalN2" data-autofocus><span>${plural(g.second.n, P.sesia)}</span></div>${quick([2, 3, 5, 8], g.second.n)}</div></div>`;
    case 'period':
      return `<div class="popover">${opt('day', 'на день', g.period === 'day')}${opt('week', 'на тиждень', g.period === 'week')}${opt('month', 'на місяць', g.period === 'month')}${opt('everyN', 'кожні N днів', g.period === 'everyN')}${g.period === 'everyN' ? `<div class="inner" style="padding-top:0">${quick([2, 3, 7, 14], g.everyN, v => `${v} ${plural(v, P.den)}`, 'setEveryN')}<div class="subhint">Періоди відраховуються від дати початку.</div></div>` : ''}${h.type === 'check' && g.kind !== 'none' ? opt('interval', 'з інтервалом від відмітки', g.period === 'interval', '<div class="subhint" style="margin:2px 0 0">«кожні 8 годин» — наступний час рахується від фактичної попередньої відмітки</div>') : ''}</div>`;
    case 'ivh':
      return `<div class="popover"><div class="inner"><div class="numin"><input type="number" inputmode="numeric" value="${g.intervalH}" data-in="ivh" data-autofocus><span>годин</span></div>${quick([4, 6, 8, 12, 24, 48], g.intervalH, v => `${v} год`)}<div class="subhint">Наступний дозволений час рахується від фактичної попередньої відмітки, а не за розкладом.</div></div></div>`;
    case 'tol':
      return `<div class="popover"><div class="inner">${quick([0.5, 1, 2, 3], g.tolH, v => `±${v} год`)}</div></div>`;
  }
  return '';
}

export function renderEditor() {
  const e = ED(), h = e.draft, isNew = e.mode === 'create';
  const errs = errors(h), warns = warnings(h);
  const typeSeg = `<div class="seg">${[['check', '✓', 'Відмітка'], ['qty', '#', 'Кількість'], ['time', '⏱', 'Час']].map(([v, i, l]) => `<button class="${h.type === v ? 'on' : ''}" data-act="setType" data-v="${v}"><span style="opacity:.6">${i}</span>${l}</button>`).join('')}</div>`;
  let typeExtra = '';
  if (h.type === 'qty') {
    typeExtra = `<div class="field" style="margin-top:10px"><span class="muted">Одиниця</span><input value="${esc(h.unit)}" placeholder="мл, стор., разів…" data-in="unit" list="units"><datalist id="units"><option>мл</option><option>стор.</option><option>разів</option><option>км</option><option>повторень</option><option>ккал</option><option>г</option></datalist></div>`;
  }
  if (h.type !== 'check') {
    typeExtra += `<div class="field" style="margin-top:8px;align-items:flex-start"><span class="muted" style="padding-top:8px">Пресети</span><div class="quick" style="margin:0;flex:1">${h.presets.map(p => `<button data-act="removePreset" data-v="${p}" style="padding:6px 10px;font-size:14px">+${h.type === 'time' ? fmtDur(p) : fmtN(p)} <span class="faint">×</span></button>`).join('')}<input type="number" inputmode="numeric" placeholder="+ додати" data-in="presetAdd" enterkeyhint="done" style="width:100px;border:0;background:transparent;outline:0;font-size:15px;padding:6px 0"></div></div>`;
  }
  const rows = `<div class="card">
    <button class="setrow" data-act="openSub" data-sub="schedule"><span class="l">Розклад</span><span class="v">${esc(scheduleSummary(h))}</span><span class="chev">›</span></button>
    ${h.goal.period === 'interval' ? '' : `<button class="setrow" data-act="openSub" data-sub="time"><span class="l">Час</span><span class="v">${esc(timeSummary(h))}</span><span class="chev">›</span></button>`}
    <button class="setrow" data-act="openSub" data-sub="reminders"><span class="l">Нагадування</span><span class="v ${h.reminders.length ? '' : 'faint'}">${esc(remindersSummary(h))}</span><span class="chev">›</span></button>
    <button class="setrow" data-act="openSub" data-sub="extra"><span class="l">Додатково</span><span class="v ${extraSummary(h) ? '' : 'faint'}">${esc(extraSummary(h) || 'Теги, нотатки, опис')}</span><span class="chev">›</span></button>
  </div>`;
  const warnHTML = warns.map(w => `<div class="warnbar"><span>${esc(w.t)}</span>${w.fix ? `<button data-act="openSub" data-sub="${w.fix}">Виправити</button>` : ''}</div>`).join('')
    + (errs.includes('end') ? `<div class="warnbar" style="background:color-mix(in srgb,var(--danger) 14%,transparent);color:var(--danger)"><span>Дата кінця раніше за дату початку.</span><button data-act="openSub" data-sub="schedule">Виправити</button></div>` : '')
    + (errs.includes('days') ? `<div class="warnbar" style="background:color-mix(in srgb,var(--danger) 14%,transparent);color:var(--danger)"><span>Оберіть хоча б один день тижня.</span><button data-act="openSub" data-sub="schedule">Виправити</button></div>` : '');
  const existing = isNew ? null : findHabit(h.id);
  const histN = existing ? activeLogs(existing).length : 0;
  const histWarn = !isNew && e.dirty && histN ? `<div class="warnbar"><span>Статистика за ${histN} ${plural(histN, P.zapys)} буде перерахована за новою ціллю.</span></div>` : '';
  const lifecycle = isNew ? '' : `<div class="lifecycle card">
    <button class="setrow" data-act="${h.paused ? 'resume' : 'pauseMenu'}" data-hid="${h.id}"><span class="l">${h.paused ? 'Відновити' : 'Пауза'}</span><span class="v faint">${h.paused ? '' : 'відпустка, хвороба'}</span></button>
    <button class="setrow" data-act="archive" data-hid="${h.id}"><span class="l">Архівувати</span><span class="v faint">історія збережеться</span></button>
    <button class="setrow danger" data-act="deleteMenu" data-hid="${h.id}"><span class="l">Видалити</span></button></div>`;

  return `<div class="screen" style="${hcolor(h)}">${topdeco()}
  <div class="nav"><button class="txt" data-act="editorCancel">Скасувати</button><span class="title">${isNew ? 'Нова звичка' : esc(h.name)}</span><button class="txt primary" data-act="editorSave" ${errs.length || (!isNew && !e.dirty) ? 'disabled' : ''} id="ed-save">${isNew ? 'Створити' : 'Готово'}</button></div>
  <div class="content">
  ${e.recipe ? `<div class="recipebadge">📄 Рецепт: ${esc(e.recipe.title)} · змініть що завгодно</div>` : ''}
  <div class="namefield" id="ed-name"><button class="icon" data-act="openSub" data-sub="look">${h.icon}</button><input value="${esc(h.name)}" placeholder="Назва" data-in="name" enterkeyhint="done" ${e.focusName ? 'data-autofocus' : ''}></div>
  <div class="sect"><span>Що логуємо</span></div>${typeSeg}${typeExtra}
  <div class="sect"><span>Ціль</span></div><div class="sentence" id="ed-goal">${goalSentenceHTML(h)}</div>${popoverHTML(h)}
  ${h.type !== 'check' && h.goal.kind !== 'none' && h.goal.period !== 'interval' && !h.goal.second ? `<button class="addcond" data-act="addSecond">+ ще одна умова (кількість сесій)</button>` : ''}
  <div style="height:14px"></div>${rows}
  ${warnHTML}${histWarn}
  <div class="summary" id="ed-summary">${esc(habitSentence(h))}</div>
  ${lifecycle}<div style="height:20px"></div></div></div>`;
}

/* ---------- фокусні листи ---------- */
export function renderSub(sh) {
  const e = ED(), h = e.draft;
  const head = t => `<div class="grab"></div><div class="sheethead"><h3>${t}</h3><button data-act="closeSheet" data-sid="${sh.id}">Готово</button></div>`;
  const dayChips = (sel, act) => `<div class="daychips">${DOW_SHORT.map((d, i) => {
    const idx = (i + settings.firstDay) % 7;
    return `<button class="${sel && sel.includes(idx) ? 'on' : ''}" data-act="${act}" data-d="${idx}">${DOW_SHORT[idx]}</button>`;
  }).join('')}</div>`;

  switch (sh.sub) {
    case 'schedule': {
      const endMode = e.endMode || (h.schedule.end ? 'date' : 'none');
      const nDays = h.schedule.end ? diffDays(h.schedule.start, h.schedule.end) + 1 : 14;
      return head('Розклад') + `<div class="sect" style="margin-top:4px"><span>Дні</span></div>
      <div class="seg"><button class="${!h.schedule.days ? 'on' : ''}" data-act="schedDays" data-v="all">Щодня</button><button class="${h.schedule.days ? 'on' : ''}" data-act="schedDays" data-v="pick">Обрані дні</button></div>
      ${h.schedule.days ? dayChips(h.schedule.days, 'toggleDay') : ''}
      ${h.schedule.days && !h.schedule.days.length ? '<div class="subhint" style="color:var(--danger)">Оберіть хоча б один день</div>' : ''}
      <div class="sect"><span>Період дії</span></div><div class="card">
        <div class="setrow"><span class="l">Початок</span><input type="date" value="${h.schedule.start}" data-in="start" style="border:0;background:transparent;color:var(--text-2)"></div>
        <div class="setrow" style="flex-wrap:wrap;gap:8px"><span class="l" style="flex:none">Кінець</span>
          <div class="seg" style="flex:1;min-width:210px"><button class="${endMode === 'none' ? 'on' : ''}" data-act="endMode" data-v="none">Без кінця</button><button class="${endMode === 'days' ? 'on' : ''}" data-act="endMode" data-v="days">Через N днів</button><button class="${endMode === 'date' ? 'on' : ''}" data-act="endMode" data-v="date">Дата</button></div>
          ${endMode === 'days' ? `<div style="width:100%"><div class="quick">${[7, 14, 30, 90].map(n => `<button class="${nDays === n ? 'on' : ''}" data-act="endDays" data-v="${n}">${n} ${plural(n, P.den)}</button>`).join('')}</div><div class="subhint">${h.schedule.end ? `Останній день — ${fmtDate(h.schedule.end)}` : ''}</div></div>` : ''}
          ${endMode === 'date' ? `<div style="width:100%;margin-top:8px"><input type="date" value="${h.schedule.end || ''}" data-in="end" style="border:0;background:var(--surface-3);padding:8px 10px;border-radius:8px"></div>` : ''}
        </div></div>
      <div class="hint">У дні поза розкладом звичка не показується і не рахується як пропуск. Пауза — це дія зі сторінки звички, а не налаштування.</div>`;
    }
    case 'time': {
      const w = h.time.window;
      return head('Час') + `${h.goal.period === 'interval' ? '' : `<div class="sect" style="margin-top:4px"><span>Коли можна відмічати</span></div>
      <div class="seg"><button class="${!w ? 'on' : ''}" data-act="winMode" data-v="any">Будь-коли</button><button class="${w ? 'on' : ''}" data-act="winMode" data-v="win">Лише у вікні</button></div>
      ${w ? `<div class="field" style="margin-top:10px;justify-content:center;gap:14px"><span class="muted">з</span><input type="time" value="${w.from}" data-in="winFrom" style="width:auto;flex:none"><span class="muted">до</span><input type="time" value="${w.to}" data-in="winTo" style="width:auto;flex:none"></div><div class="subhint">Поза вікном контрол заблоковано; вікно може переходити через північ. Ретро-закриття минулих днів працює будь-коли.</div>` : ''}`}
      <div class="sect"><span>Закривати минулі дні</span></div>
      <div class="seg"><button class="${h.time.retro === 'none' ? 'on' : ''}" data-act="retroMode" data-v="none">Ні</button><button class="${h.time.retro === 'yesterday' ? 'on' : ''}" data-act="retroMode" data-v="yesterday">Лише вчора</button><button class="${typeof h.time.retro === 'number' ? 'on' : ''}" data-act="retroMode" data-v="n">До N днів</button></div>
      ${typeof h.time.retro === 'number' ? `<div class="quick">${[2, 3, 5, 7].map(n => `<button class="${h.time.retro === n ? 'on' : ''}" data-act="retroMode" data-v="${n}">${n} ${plural(n, P.den)}</button>`).join('')}</div>` : ''}
      <div class="subhint">Ретро-відмітки позначаються в історії. Максимум 7 днів.</div>
      <div class="hint" style="margin-top:18px">Доба закінчується о ${esc(settings.dayEnd)} — змінюється в Налаштуваннях → Час.</div>`;
    }
    case 'reminders': {
      if (h.goal.period === 'interval') {
        const r = h.reminders.find(x => x.type === 'interval');
        return head('Нагадування') + `<div class="card"><button class="setrow" data-act="toggleIvReminder"><span class="l">Нагадати, коли настане час наступної відмітки</span><span class="toggle ${r ? 'on' : ''}"></span></button>
        ${r ? `<div class="setrow"><span class="l">За скільки до</span><div class="quick" style="margin:0">${[0, 10, 30].map(n => `<button class="${r.before === n ? 'on' : ''}" data-act="ivBefore" data-v="${n}" style="padding:6px 10px;font-size:14px">${n ? n + ' хв' : 'вчасно'}</button>`).join('')}</div></div>` : ''}</div>
        <div class="hint">Планується від кожної відмітки. Не приходить, якщо звичка на паузі.</div>`;
      }
      return head('Нагадування') + `${h.reminders.length
        ? `<div class="card">${h.reminders.map((r, i) => `<button class="setrow" data-act="editRem" data-i="${i}"><span class="l">${esc(reminderText(r))}${r.text ? `<div class="faint" style="font-size:13px">«${esc(r.text)}»</div>` : ''}</span><span class="chev">›</span></button>`).join('')}</div>`
        : '<div class="empty" style="padding:16px">Нагадувань немає</div>'}
      <button class="bigbtn sec" data-act="addRem">+ Додати нагадування</button>
      <div class="hint">Не приходить, якщо ціль періоду вже закрита, звичка на паузі або день поза розкладом.</div>`;
    }
    case 'reminder': {
      const r = h.reminders[e.remIdx];
      if (!r) return head('Нагадування');
      return head('Нагадування') + `<div class="seg">${[['exact', 'Точний час'], ['window', 'У вікні'], ['random', 'Випадково']].map(([v, l]) => `<button class="${r.type === v ? 'on' : ''}" data-act="remType" data-v="${v}">${l}</button>`).join('')}</div>
      ${r.type === 'exact'
        ? `<div class="field" style="margin-top:10px;justify-content:center"><span class="muted">о</span><input type="time" value="${r.time}" data-in="remTime" style="width:auto;flex:none"></div>`
        : `<div class="field" style="margin-top:10px;justify-content:center;gap:14px"><span class="muted">з</span><input type="time" value="${r.from}" data-in="remFrom" style="width:auto;flex:none"><span class="muted">до</span><input type="time" value="${r.to}" data-in="remTo" style="width:auto;flex:none"></div>`}
      ${r.type === 'window' ? `<div class="quick" style="justify-content:center">${[2, 3, 4, 6].map(n => `<button class="${r.count === n ? 'on' : ''}" data-act="remCount" data-v="${n}">${n} рази</button>`).join('')}</div><div class="subhint" style="text-align:center">Рівномірно у вікні</div>` : ''}
      ${r.type === 'random' ? '<div class="subhint" style="text-align:center">Прийде один раз у випадковий момент вікна. Час щодня різний.</div>' : ''}
      <div class="sect"><span>Дні</span>${r.daysCustom ? `<button style="color:var(--accent)" data-act="remDaysReset">Скинути до днів розкладу</button>` : ''}</div>${dayChips(r.days, 'remToggleDay')}
      <div class="sect"><span>Текст</span></div><div class="field"><input value="${esc(r.text || '')}" placeholder="${esc(h.name || 'Назва звички')}" data-in="remText"></div>
      <button class="linkbtn" style="color:var(--danger);margin-top:10px" data-act="remDelete">Видалити нагадування</button>`;
    }
    case 'extra':
      return head('Додатково') + `<div class="sect" style="margin-top:4px"><span>Теги</span></div>
      <div class="field" style="flex-wrap:wrap"><div class="quick" style="margin:0">${h.tags.map(t => `<button data-act="removeTag" data-v="${esc(t)}" style="padding:6px 10px;font-size:14px">${esc(t)} <span class="faint">×</span></button>`).join('')}</div><input placeholder="+ тег" data-in="tagAdd" list="tags" enterkeyhint="done" style="min-width:90px"><datalist id="tags">${allTags().map(t => `<option>${esc(t)}</option>`).join('')}</datalist></div>
      <div class="subhint">Введіть тег і натисніть Enter / Готово.</div>
      <div class="sect"><span>Опис «навіщо мені це»</span></div><div class="field"><textarea rows="2" placeholder="Одне речення для себе. Показується на сторінці звички." data-in="desc">${esc(h.desc)}</textarea></div>
      <div class="sect"><span>Нотатка та фото</span></div><div class="card">
        <button class="setrow" data-act="toggleDraft" data-key="requireNote"><span class="l">Вимагати нотатку при кожній відмітці</span><span class="toggle ${h.requireNote ? 'on' : ''}"></span></button>
        <button class="setrow" data-act="toggleDraft" data-key="requirePhoto"><span class="l">Вимагати фото при кожній відмітці</span><span class="toggle ${h.requirePhoto ? 'on' : ''}"></span></button>
      </div><div class="hint">Без цього нотатку і фото можна додавати за бажанням.</div>`;
    case 'look':
      return head('Вигляд') + `<div style="text-align:center;margin:4px 0 12px"><span style="display:inline-grid;width:64px;height:64px;border-radius:50%;background:var(--h${h.color});place-items:center;font-size:30px;color:#fff">${h.icon}</span></div>
      <div class="colors">${Array.from({ length: PALETTE }, (_, i) => `<button class="${h.color === i ? 'on' : ''}" style="--c:var(--h${i})" data-act="setColor" data-v="${i}"></button>`).join('')}</div>
      <div class="icons">${ICONS.map(i => `<button class="${h.icon === i ? 'on' : ''}" data-act="setIcon" data-v="${esc(i)}">${i}</button>`).join('')}</div>
      <div class="hint">Іконка вгадується за назвою; колір — наступний невикористаний у палітрі.</div>`;
  }
  return '';
}
