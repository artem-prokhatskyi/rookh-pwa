/* Обгортки експорту/імпорту з повідомленнями. */
import * as B from './backup.js';
import { toast, pushSheet, menu } from './ui.js';
import { render } from './render/index.js';
import { ui, habits } from './state.js';
import { plural, P, esc } from './util.js';

export async function exportCsv() {
  try {
    const r = await B.exportCsv();
    if (r !== 'cancel') toast('CSV збережено');
  } catch (e) { console.error(e); toast('Не вдалося експортувати CSV'); }
}

export async function exportBackup() {
  try {
    const r = await B.exportBackup();
    if (r.res !== 'cancel') toast(`Бекап: ${r.habits} ${plural(r.habits, P.zvychka)}, ${r.logs} ${plural(r.logs, P.zapys)}, ${r.photos} фото`);
  } catch (e) { console.error(e); toast('Не вдалося зробити бекап'); }
}

export async function importBackupFlow() {
  let data;
  try {
    const f = await B.pickFile('application/json,.json');
    if (!f) return;
    data = await B.readBackup(f);
  } catch (e) {
    console.error(e);
    toast('Файл не схожий на бекап Rookh');
    return;
  }
  const nH = data.habits.length;
  const nL = data.habits.reduce((a, h) => a + ((h.logs && h.logs.length) || 0), 0);
  const nP = data.photos ? Object.keys(data.photos).length : 0;
  pushSheet({
    t: 'info',
    title: 'Імпорт бекапу',
    body: `Знайдено: ${nH} ${plural(nH, P.zvychka)}, ${nL} ${plural(nL, P.zapys)}, ${nP} фото.<br>Від ${esc(String(data.exportedAt || '').slice(0, 16).replace('T', ' '))}.`,
    buttons: [
      { label: 'Додати до наявних', fn: () => run(data, 'merge') },
      { label: 'Замінити все', fn: () => menu('Замінити всі поточні дані?', [{ label: 'Замінити', danger: true, fn: () => run(data, 'replace') }]) },
    ],
  });
}

async function run(data, mode) {
  try {
    const r = await B.applyBackup(data, mode);
    ui.stack = []; ui.sheets = []; ui.editor = null;
    render();
    toast(`Імпортовано: ${r.habits} ${plural(r.habits, P.zvychka)}, ${r.logs} ${plural(r.logs, P.zapys)}`);
  } catch (e) {
    console.error(e);
    toast('Імпорт не вдався');
  }
}

export async function wipeAll() { return B.wipeAll(); }
