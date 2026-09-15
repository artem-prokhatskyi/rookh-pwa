/* IndexedDB: habits, logs, photos, kv. Одна база на пристрій, без міграцій даних між версіями схеми. */

const DB_NAME = 'rookh';
const DB_VER = 1;
let _db = null;
let onError = err => console.error('[rookh][db]', err);
export function setDbErrorHandler(fn) { onError = fn; }

export function openDb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('habits')) db.createObjectStore('habits', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('logs')) {
        const s = db.createObjectStore('logs', { keyPath: 'id' });
        s.createIndex('habitId', 'habitId', { unique: false });
      }
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'key' });
    };
    req.onsuccess = () => {
      _db = req.result;
      _db.onversionchange = () => { _db.close(); _db = null; };
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB заблоковано іншою вкладкою'));
  });
}

function tx(store, mode) {
  return openDb().then(db => db.transaction(store, mode).objectStore(store));
}
const wrap = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export const dbGetAll = store => tx(store, 'readonly').then(s => wrap(s.getAll()));
export const dbGet = (store, key) => tx(store, 'readonly').then(s => wrap(s.get(key)));
export const dbPut = (store, value) => tx(store, 'readwrite').then(s => wrap(s.put(value)));
export const dbDelete = (store, key) => tx(store, 'readwrite').then(s => wrap(s.delete(key)));
export const dbClear = store => tx(store, 'readwrite').then(s => wrap(s.clear()));

export function dbPutMany(store, values) {
  if (!values.length) return Promise.resolve();
  return openDb().then(db => new Promise((res, rej) => {
    const t = db.transaction(store, 'readwrite');
    const s = t.objectStore(store);
    values.forEach(v => s.put(v));
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  }));
}
export function dbDeleteMany(store, keys) {
  if (!keys.length) return Promise.resolve();
  return openDb().then(db => new Promise((res, rej) => {
    const t = db.transaction(store, 'readwrite');
    const s = t.objectStore(store);
    keys.forEach(k => s.delete(k));
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  }));
}

/* Черга записів: усе послідовно, помилки — в один обробник, UI ніколи не чекає. */
let chain = Promise.resolve();
export function persist(fn) {
  chain = chain.then(fn).catch(err => { onError(err); });
  return chain;
}
export const flush = () => chain;

export const kvGet = key => dbGet('kv', key).then(r => (r ? r.value : undefined));
export const kvSet = (key, value) => dbPut('kv', { key, value });
