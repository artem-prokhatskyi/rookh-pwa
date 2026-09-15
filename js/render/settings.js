/* Налаштування, архів, онбординг. */
import { esc, plural, P, fmtHM } from '../util.js';
import { settings, ui, habits } from '../state.js';
import { activeLogs } from '../engine.js';
import { topdeco, hcolor, ringStyle } from './common.js';
import { RECIPES } from '../recipes.js';
import { BUILD } from '../build.js';

const toggleRow = (label, key) => `<button class="setrow" data-act="toggleSetting" data-key="${key}"><span class="l">${label}</span><span class="toggle ${settings[key] ? 'on' : ''}"></span></button>`;
const selectRow = (label, key, opts) => `<div class="setrow"><span class="l">${label}</span><select data-sel="${key}">${opts.map(([v, t]) => `<option value="${v}" ${String(settings[key]) === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;

function permText() {
  if (!('Notification' in window)) return 'Недоступні в цьому браузері';
  if (Notification.permission === 'granted') return 'Дозволено';
  if (Notification.permission === 'denied') return 'Заборонено в системі';
  return 'Ще не запитували';
}

export function renderSettings() {
  const archived = habits.filter(h => h.archived).length;
  const logCount = habits.reduce((a, h) => a + activeLogs(h).length, 0);
  return `<div class="screen">${topdeco()}
  <div class="nav"><button class="txt glass" data-act="pop">‹ Назад</button><span class="title">Налаштування</span><span style="width:60px"></span></div>
  <div class="content">
  <div class="sect"><span>Час</span></div><div class="card">
    ${selectRow('Доба закінчується о', 'dayEnd', [['00:00', '00:00'], ['01:00', '01:00'], ['02:00', '02:00'], ['03:00', '03:00'], ['04:00', '04:00'], ['05:00', '05:00'], ['06:00', '06:00']])}
    ${selectRow('Перший день тижня', 'firstDay', [[0, 'Понеділок'], [6, 'Неділя'], [5, 'Субота']])}
    ${selectRow('Формат часу', 'timeFmt', [['24', '24 год'], ['12', '12 год']])}
  </div><div class="hint">Звички за сьогодні можна відмічати до межі доби наступного дня. Перший день тижня впливає на те, що рахується як «цей тиждень».</div>

  <div class="sect"><span>Вигляд</span></div><div class="card">
    ${selectRow('Тема', 'theme', [['system', 'Як у системі'], ['light', 'Світла'], ['dark', 'Темна']])}
    ${selectRow('Вигляд «Сьогодні»', 'view', [['list', 'Список'], ['tiles', 'Плитки']])}
    ${toggleRow('Ховати виконані', 'hideDone')}
    ${toggleRow('Світло за часом доби', 'light')}
  </div>

  <div class="sect"><span>Нагадування</span></div><div class="card">
    ${selectRow('Відкласти на', 'snooze', [[10, '10 хв'], [30, '30 хв'], [60, '60 хв']])}
    <button class="setrow" data-act="askPerm"><span class="l">Дозвіл на сповіщення</span><span class="v">${permText()}</span><span class="chev">›</span></button>
  </div><div class="hint">У веб-версії сповіщення приходять лише поки додаток відкритий (навіть у фоні вкладки). Це обмеження браузера, у нативному додатку нагадування плануються системою.</div>

  <div class="sect"><span>Дані</span></div><div class="card">
    <button class="setrow" data-act="exportCsv"><span class="l">Експорт CSV</span><span class="v faint">${logCount} ${plural(logCount, P.zapys)}</span><span class="chev">›</span></button>
    <button class="setrow" data-act="exportBackup"><span class="l">Повний бекап</span><span class="v faint">JSON + фото</span><span class="chev">›</span></button>
    <button class="setrow" data-act="importBackup"><span class="l">Імпорт бекапу</span><span class="chev">›</span></button>
    <button class="setrow" data-act="push" data-s="archive"><span class="l">Архів</span><span class="v">${archived}</span><span class="chev">›</span></button>
  </div><div class="hint">Усі дані зберігаються лише в цьому браузері (IndexedDB). Бекап — єдиний спосіб перенести їх.</div>

  <div class="sect"><span>Прототип</span></div><div class="card">
    <button class="setrow" data-act="loadDemo"><span class="l">Додати демо-дані</span><span class="v faint">8 звичок, 84 дні</span><span class="chev">›</span></button>
    <button class="setrow" data-act="showOnboarding"><span class="l">Показати онбординг</span><span class="chev">›</span></button>
    <button class="setrow danger" data-act="wipeAll"><span class="l">Стерти всі дані</span><span class="chev">›</span></button>
  </div>

  <div class="sect"><span>Про додаток</span></div><div class="card">
    <div class="setrow"><span class="l">Версія</span><span class="v">PWA-прототип 1.0 · ${BUILD}</span></div>
    <div class="setrow"><span class="l">Звичок</span><span class="v">${habits.length}</span></div>
    <div class="setrow"><span class="l">Записів</span><span class="v">${logCount}</span></div>
  </div><div class="hint">Це тестова версія для перевірки флоу. Покупок, тріалу й аналітики тут немає.</div>
  <div style="height:20px"></div>
  </div></div>`;
}

export function renderArchive() {
  const a = habits.filter(h => h.archived);
  return `<div class="screen">${topdeco()}
  <div class="nav"><button class="txt glass" data-act="pop">‹ Налаштування</button><span class="title">Архів</span><span style="width:60px"></span></div>
  <div class="content"><div style="height:8px"></div>
  ${a.length ? `<div class="card">${a.map(h => {
    const n = activeLogs(h).length;
    return `<button class="hlist" style="${hcolor(h)}" data-act="archiveMenu" data-hid="${h.id}"><div class="ind"><div class="ring" style="${ringStyle(0, 0)}"></div><div class="core" style="font-size:14px">${h.icon}</div></div><span class="name">${esc(h.name)}</span><span class="pct" style="width:auto">${n} ${plural(n, P.zapys)}</span></button>`;
  }).join('')}</div>` : '<div class="empty">Архів порожній</div>'}
  <div class="hint">Архів ховає звичку з усіх екранів, але зберігає історію. Повернути можна будь-коли.</div></div></div>`;
}

export function renderOnboarding() {
  const s = ui.onboarding;
  const dots = `<div class="dots">${[1, 2, 3].map(i => `<span class="${i === s ? 'on' : ''}"></span>`).join('')}</div>`;
  if (s === 1) {
    const demo = [['💧', 5, 'Вода', '1 500 / 2 000 мл', .75, 0], ['💊', 0, 'Ібупрофен', 'наступний через 2 год 15 хв', .4, 3], ['🏋', 1, 'Зал', '2 з 3 цього тижня · ще 4 дні', .66, 3]];
    return `<div class="screen">${topdeco()}<div class="onb"><h1>Один трекер замість десяти</h1><p>Інструмент, а не тренер. Без мотивації й гейміфікації.</p>
    <div class="demo">${demo.map(([i, c, n, sm, p, seg]) => `<div class="rowwrap" style="--hc:var(--h${c})"><div class="row"><div class="ind"><div class="ring" style="${ringStyle(p, seg)}"></div><div class="core">${i}</div></div><div class="txt"><div class="name">${n}</div><div class="sum">${sm}</div></div><div class="ctl"><span class="circ"></span></div></div></div>`).join('')}</div>
    <div class="fill"></div>${dots}<button class="bigbtn" data-act="onb" data-s="2">Далі</button></div></div>`;
  }
  if (s === 2) {
    return `<div class="screen">${topdeco()}<div class="onb"><h1>Ваші дані — на вашому пристрої</h1>
    <ul><li>Акаунт не потрібен.</li><li>Усе працює офлайн.</li><li>Дані лежать у цьому браузері й нікуди не відправляються.</li><li>Експорт доступний завжди.</li></ul>
    <div class="hint">Це тестова PWA-версія: щоб вона працювала як додаток, додайте її на домашній екран (Поділитися → На екран «Додому»).</div>
    <div class="fill"></div>${dots}<button class="bigbtn" data-act="onb" data-s="3">Далі</button></div></div>`;
  }
  const n = ui.onbPick.size;
  return `<div class="screen">${topdeco()}<div class="onb"><h1>З чого почати?</h1><p>Оберіть готові конфігурації — або створіть свою. Усе можна змінити.</p>
  <div class="rgrid">${RECIPES.slice(0, 6).map(r => `<button class="recipe ${ui.onbPick.has(r.id) ? 'on' : ''}" data-act="onbPick" data-id="${r.id}"><div class="e">${r.icon}</div><b>${esc(r.title)}</b><span>${esc(r.sub)}</span></button>`).join('')}</div>
  <div class="fill"></div>${dots}<button class="bigbtn" data-act="onbFinish" ${n ? '' : 'disabled'}>Додати обрані${n ? ` (${n})` : ''}</button>
  <button class="linkbtn" data-act="onbOwn">Створити свою</button><button class="linkbtn" data-act="onbSkip">Пропустити</button></div></div>`;
}
