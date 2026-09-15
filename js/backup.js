/* Експорт CSV, повний бекап JSON + фото, імпорт. */
import { dbClear, dbPutMany, dbGetAll } from './db.js';
import { settings, habits, stripHabit, indexHabit, bump, saveSettings } from './state.js';
import { activeLogs } from './engine.js';
import { getPhotoBlob, putPhotoBlob } from './photos.js';
import { uid, pad, fmtTime, dkey } from './util.js';

const stamp = () => {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
};

async function deliver(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return 'share'; } catch (e) {
      if (e && e.name === 'AbortError') return 'cancel';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'download';
}

const csvCell = v => {
  const s = String(v ?? '');
  return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export function buildCsv() {
  const rows = [['habit', 'type', 'unit', 'date', 'time', 'value', 'note', 'retro', 'edited']];
  habits.forEach(h => {
    activeLogs(h).forEach(l => {
      const d = new Date(l.ts);
      rows.push([h.name, h.type, h.unit, l.date, pad(d.getHours()) + ':' + pad(d.getMinutes()),
        l.value ?? '', l.note || '', l.retro ? '1' : '', l.edited ? '1' : '']);
    });
  });
  return '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\n');
}

export async function exportCsv() {
  return deliver(new Blob([buildCsv()], { type: 'text/csv' }), `rookh-${stamp()}.csv`);
}

const blobToDataUrl = blob => new Promise(res => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => res(null);
  r.readAsDataURL(blob);
});
const dataUrlToBlob = async url => (await fetch(url)).blob();

export async function buildBackup() {
  const photos = {};
  for (const h of habits) {
    for (const l of h.logs) {
      if (!l.photoId || photos[l.photoId]) continue;
      const b = await getPhotoBlob(l.photoId);
      if (b) photos[l.photoId] = await blobToDataUrl(b);
    }
  }
  const data = {
    app: 'rookh', version: 1, exportedAt: new Date().toISOString(),
    settings: { ...settings },
    habits: habits.map(h => ({ ...stripHabit(h), logs: h.logs })),
    photos,
  };
  return data;
}

export async function exportBackup() {
  const data = await buildBackup();
  const json = JSON.stringify(data);
  const res = await deliver(new Blob([json], { type: 'application/json' }), `rookh-backup-${stamp()}.json`);
  return { res, habits: data.habits.length, logs: data.habits.reduce((a, h) => a + h.logs.length, 0), photos: Object.keys(data.photos).length };
}

export function pickFile(accept) {
  return new Promise(resolve => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept;
    inp.style.position = 'fixed';
    inp.style.left = '-1000px';
    document.body.appendChild(inp);
    inp.onchange = () => { const f = inp.files && inp.files[0]; inp.remove(); resolve(f || null); };
    inp.oncancel = () => { inp.remove(); resolve(null); };
    inp.click();
  });
}

export async function readBackup(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!data || data.app !== 'rookh' || !Array.isArray(data.habits)) throw new Error('Це не бекап Rookh');
  return data;
}

function sanitizeHabit(raw) {
  const h = { ...raw };
  h.logs = Array.isArray(raw.logs) ? raw.logs : [];
  h.goal = Object.assign({ kind: 'min', n: 1, period: 'day', everyN: 3, intervalH: 8, tolH: 1, second: null }, raw.goal || {});
  h.schedule = Object.assign({ days: null, start: dkey(new Date()), end: null }, raw.schedule || {});
  h.time = Object.assign({ window: null, retro: 'yesterday' }, raw.time || {});
  h.reminders = Array.isArray(raw.reminders) ? raw.reminders : [];
  h.tags = Array.isArray(raw.tags) ? raw.tags : [];
  h.presets = Array.isArray(raw.presets) ? raw.presets : [];
  h.desc = raw.desc || '';
  h.type = ['check', 'qty', 'time'].includes(raw.type) ? raw.type : 'check';
  h.color = Number(raw.color) || 0;
  h.icon = raw.icon || '•';
  h.archived = !!raw.archived;
  h.paused = raw.paused || null;
  h.order = Number(raw.order) || 0;
  return h;
}

export async function applyBackup(data, mode /* 'replace' | 'merge' */) {
  const incoming = data.habits.map(sanitizeHabit);
  if (mode === 'replace') {
    await Promise.all([dbClear('habits'), dbClear('logs'), dbClear('photos')]);
    habits.length = 0;
  }
  const existingIds = new Set(habits.map(h => h.id));
  const photoMap = {};
  const outHabits = [], outLogs = [];
  let order = habits.length;

  for (const h of incoming) {
    let id = h.id || uid();
    if (existingIds.has(id)) id = uid();
    existingIds.add(id);
    const logs = h.logs.map(l => {
      const nl = { ...l, id: uid(), habitId: id };
      if (nl.photoId) {
        if (!photoMap[nl.photoId]) photoMap[nl.photoId] = uid();
        nl.photoId = photoMap[nl.photoId];
      }
      nl.deleted = !!nl.deleted;
      return nl;
    }).sort((a, b) => a.ts - b.ts);
    const nh = { ...h, id, order: order++ };
    delete nh.logs;
    const mem = { ...nh, logs };
    indexHabit(mem);
    habits.push(mem);
    outHabits.push(nh);
    outLogs.push(...logs);
  }

  await dbPutMany('habits', outHabits);
  await dbPutMany('logs', outLogs);
  if (data.photos) {
    for (const [oldId, url] of Object.entries(data.photos)) {
      const newId = photoMap[oldId];
      if (!newId || !url) continue;
      try { await putPhotoBlob(newId, await dataUrlToBlob(url)); } catch (e) { console.warn('фото не імпортовано', e); }
    }
  }
  if (mode === 'replace' && data.settings) {
    Object.assign(settings, data.settings);
    saveSettings();
  }
  bump();
  return { habits: incoming.length, logs: outLogs.length };
}

export async function wipeAll() {
  await Promise.all([dbClear('habits'), dbClear('logs'), dbClear('photos'), dbClear('kv')]);
  habits.length = 0;
  bump();
}
