/* Модальні листи. */
import { esc, fmtN, fmtDur, fmtTime, fmtDate, addDays, pad, plural, P } from '../util.js';
import { ui, findHabit, settings } from '../state.js';
import { TODAY, progress, timerElapsedMin } from '../engine.js';
import { hcolor } from './common.js';
import { renderEditor, renderSub } from './editor.js';
import { RECIPES } from '../recipes.js';
import { timer } from '../state.js';

function renderNewPick() {
  return `<div class="grab"></div><h3 style="margin:6px 0 12px">Нова звичка</h3>
  <div class="card"><button class="setrow" data-act="newBlank"><span style="font-size:18px">✎</span><span class="l">Створити з нуля</span><span class="chev">›</span></button></div>
  <div class="sect"><span>З рецепта</span></div>
  <div class="recipes">${RECIPES.map(r => `<button class="recipe" data-act="recipe" data-id="${r.id}"><div class="e">${r.icon}</div><b>${esc(r.title)}</b><span>${esc(r.sub)}</span></button>`).join('')}</div>`;
}

function renderQty(sh) {
  const h = findHabit(sh.hid);
  if (!h) return '<div class="grab"></div>';
  const pr = progress(h, sh.date || TODAY());
  const isTime = h.type === 'time';
  const val = sh.value;
  const label = sh.isCheck ? 'Відмітити' : isTime ? `Додати ${fmtDur(val || 0)}` : `Додати ${fmtN(val || 0)} ${esc(h.unit)}`;
  const dateLbl = sh.date && sh.date !== TODAY() ? ` · ${sh.date === addDays(TODAY(), -1) ? 'Вчора' : fmtDate(sh.date, false)}` : '';
  const goalTxt = h.goal.kind === 'none' ? '—' : isTime ? fmtDur(h.goal.n) : fmtN(h.goal.n);
  const cur = isTime ? fmtDur(pr.sum) : h.type === 'qty' ? `${fmtN(pr.sum)}` : `${pr.count}`;
  const disabled = (!sh.isCheck && !val) || (h.requireNote && !(sh.note || '').trim()) || (h.requirePhoto && !sh.photoId);
  return `<div class="grab"></div><div class="qtyhead" style="${hcolor(h)}"><b>${esc(h.name)}${dateLbl}</b><span class="muted">${cur} / ${goalTxt}${h.type === 'qty' ? ' ' + esc(h.unit) : ''}</span></div>
  ${sh.isCheck ? '' : `<div class="qtyin"><input type="text" inputmode="decimal" enterkeyhint="done" value="${val === null || val === undefined ? '' : String(val).replace('.', ',')}" data-in="qtyVal" data-autofocus placeholder="0"><span>${isTime ? 'хв' : esc(h.unit)}</span></div>
  <div class="quick" style="justify-content:center">${h.presets.map(p => `<button data-act="qtyPreset" data-v="${p}">+${isTime ? fmtDur(p) : fmtN(p)}</button>`).join('')}<button data-act="qtyStep" data-v="-1">−</button><button data-act="qtyStep" data-v="1">+</button></div>`}
  <div class="ctxrow"><button class="${sh.showNote ? 'on' : ''}" data-act="qtyToggle" data-k="showNote">⊕ Нотатка${h.requireNote ? ' *' : ''}</button>
  <button class="${sh.photoId ? 'on' : ''}" data-act="qtyPhoto">📷 Фото${h.requirePhoto ? ' *' : ''}${sh.photoId ? ' ✓' : ''}</button>
  <button data-act="qtyTime">🕐 ${sh.time || 'Зараз'} ▾</button></div>
  ${sh.timePicker ? `<div class="field" style="margin-top:10px;justify-content:center;gap:12px"><span class="muted">Час</span><input type="time" value="${sh.time || fmtTime(new Date()).slice(0, 5)}" data-in="qtyTimeVal" style="width:auto;flex:none"><button data-act="qtyTimeNow" style="color:var(--accent);font-weight:600">Зараз</button></div>` : ''}
  ${sh.photoId ? `<img class="thumb" data-photo="${sh.photoId}" alt="">` : ''}
  ${sh.showNote || h.requireNote ? `<div class="field" style="margin-top:10px"><input value="${esc(sh.note || '')}" placeholder="${h.requireNote ? 'Нотатка обовʼязкова' : 'Нотатка'}" data-in="qtyNote"></div>` : ''}
  <button class="bigbtn" data-act="qtySave" ${disabled ? 'disabled' : ''}>${label}</button>`;
}

function renderTimer(sh) {
  const h = findHabit(timer.hid);
  if (!h) return '<div class="grab"></div>';
  const pr = progress(h, TODAY());
  const el = timerElapsedMin();
  const mm = Math.floor(el), ss = Math.floor((el - mm) * 60);
  return `<div class="content" style="${hcolor(h)};padding-bottom:20px">
  <div class="nav" style="position:relative;top:0;padding:8px 0 0"><button class="txt" data-act="closeSheet" data-sid="${sh.id}">Згорнути</button><span class="title">${esc(h.name)}</span><span style="width:70px"></span></div>
  <div class="timerdisc"></div>
  <div class="timerbig">${pad(Math.floor(mm / 60))}:${pad(mm % 60)}:${pad(ss)}</div>
  <div class="pstate">${timer.pausedAt ? 'пауза' : 'іде'} · відлік від збереженої мітки, згортання не ламає сесію</div>
  <div class="timerrow"><button data-act="timerPause">${timer.pausedAt ? 'Продовжити' : 'Пауза'}</button><button class="stop" data-act="timerStop">■ Завершити</button></div>
  <div class="pstate">${pr.second ? `Сесія ${pr.count + 1} з ${pr.second.n} · ` : ''}${fmtDur(pr.sum)} / ${h.goal.kind === 'none' ? '—' : fmtDur(h.goal.n)}</div>
  <button class="linkbtn" style="color:var(--danger);margin-top:30px" data-act="timerDiscard">Відкинути сесію</button></div>`;
}

function renderLog(sh) {
  const h = findHabit(sh.hid);
  if (!h) return '<div class="grab"></div>';
  const l = h.logs.find(x => x.id === sh.lid);
  if (!l) return '<div class="grab"></div><div class="empty">Запис не знайдено</div>';
  const d = new Date(l.ts);
  const ch = sh.changed || {};
  return `<div class="grab"></div><div class="sheethead" style="${hcolor(h)}"><h3>Запис · ${esc(h.name)}</h3><button data-act="logSave" data-sid="${sh.id}">Готово</button></div>
  ${h.type !== 'check' ? `<div class="qtyin"><input type="text" inputmode="decimal" enterkeyhint="done" value="${(ch.value ?? l.value) === null || (ch.value ?? l.value) === undefined ? '' : String(ch.value ?? l.value).replace('.', ',')}" data-in="logVal"><span>${h.type === 'time' ? 'хв' : esc(h.unit)}</span></div>` : ''}
  <div class="card">
    <div class="setrow"><span class="l">Дата</span><input type="date" value="${ch.date || l.date}" data-in="logDate" style="border:0;background:transparent;color:var(--text-2)"></div>
    <div class="setrow"><span class="l">Час</span><input type="time" value="${ch.time || pad(d.getHours()) + ':' + pad(d.getMinutes())}" data-in="logTime" style="border:0;background:transparent;color:var(--text-2)"></div>
    <div class="setrow"><span class="l">Нотатка</span><input value="${esc(ch.note ?? l.note)}" placeholder="—" data-in="logNote" style="flex:2;border:0;background:transparent;text-align:right"></div>
    <button class="setrow" data-act="logPhoto"><span class="l">Фото</span><span class="v">${l.photoId ? 'замінити' : 'додати'}</span><span class="chev">›</span></button>
    ${l.photoId ? `<button class="setrow" data-act="logPhotoDelete"><span class="l faint">Видалити фото</span></button>` : ''}
  </div>
  ${l.photoId ? `<img class="thumb" data-photo="${l.photoId}" data-act="viewPhoto" data-pid="${l.photoId}" alt="">` : ''}
  <div class="hint">${l.retro ? 'Ретро-запис · ' : ''}${l.edited ? 'Змінено · ' : ''}Створено ${fmtDate(l.date, false)}, ${fmtTime(new Date(l.ts))}.</div>
  <button class="linkbtn" style="color:var(--danger)" data-act="logDelete">Видалити запис</button>`;
}

export function renderSheet(sh) {
  if ((sh.t === 'editor' || sh.t === 'sub') && !ui.editor) return '';
  const anim = sh.shown ? 'noanim' : '';
  sh.shown = true;
  const wrap = (inner, cls = '') => `<div class="overlay ${anim}" data-act="closeSheet" data-sid="${sh.id}"><div class="sheet ${cls}" data-stop="1">${inner}</div></div>`;
  switch (sh.t) {
    case 'editor':
      return `<div class="overlay ${anim}" style="background:none"><div class="sheet full" data-stop="1">${renderEditor()}</div></div>`;
    case 'sub': return wrap(renderSub(sh));
    case 'menu': {
      const items = sh.items.map((it, i) => `<button class="${it.danger ? 'danger' : ''}" data-act="menuItem" data-sid="${sh.id}" data-i="${i}">${esc(it.label)}</button>`).join('');
      if (sh.title) return `<div class="overlay ${anim}" data-act="closeSheet" data-sid="${sh.id}"><div class="confirm glass" data-stop="1"><div class="mtitle">${esc(sh.title)}</div>${items}<button class="cancel" data-act="closeSheet" data-sid="${sh.id}">Скасувати</button></div></div>`;
      const pos = sh.anchor && sh.anchor.y !== undefined
        ? `top:${Math.round(sh.anchor.y)}px;left:50%;transform:translateX(-50%)`
        : 'top:calc(var(--safe-t) + 54px);right:12px';
      return `<div class="overlay anch ${anim}" data-act="closeSheet" data-sid="${sh.id}"><div class="popmenu glass" data-stop="1" style="${pos}">${items}</div></div>`;
    }
    case 'qty': return wrap(renderQty(sh));
    case 'timer': return wrap(renderTimer(sh), 'full');
    case 'log': return wrap(renderLog(sh));
    case 'newpick': return wrap(renderNewPick(sh));
    case 'photo': return `<div class="overlay ${anim}" data-act="closeSheet" data-sid="${sh.id}" style="justify-content:center;background:rgba(0,0,0,.85)"><img class="photoview" data-photo="${sh.pid}" alt="" style="margin:0 12px"></div>`;
    case 'info': return wrap(`<div class="grab"></div><h3 style="margin:6px 0 8px">${esc(sh.title)}</h3><p class="muted">${sh.body}</p>${(sh.buttons || []).map((b, i) => `<button class="bigbtn ${i ? 'sec' : ''}" data-act="infoBtn" data-sid="${sh.id}" data-i="${i}">${esc(b.label)}</button>`).join('')}<button class="linkbtn" data-act="closeSheet" data-sid="${sh.id}">${sh.buttons && sh.buttons.length ? 'Скасувати' : 'Закрити'}</button>`);
  }
  return '';
}
