/* Фото до логів: стиснення до 1600 px і зберігання Blob у IndexedDB. */
import { dbGet, dbPut, dbDelete } from './db.js';
import { uid } from './util.js';

const urls = new Map();   // photoId -> objectURL
const pending = new Map();

const MAX = 1600;

export async function savePhoto(file) {
  const blob = await compress(file);
  const id = uid();
  await dbPut('photos', { id, blob, createdAt: Date.now() });
  urls.set(id, URL.createObjectURL(blob));
  return id;
}

async function compress(file) {
  try {
    const bmp = await createImageBitmap(file);
    let { width: w, height: h } = bmp;
    const k = Math.min(1, MAX / Math.max(w, h));
    w = Math.round(w * k); h = Math.round(h * k);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(bmp, 0, 0, w, h);
    bmp.close && bmp.close();
    const out = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.82));
    return out || file;
  } catch (e) {
    console.warn('[rookh] стиснення не вдалося, зберігаю оригінал', e);
    return file;
  }
}

export function photoUrlSync(id) { return id ? urls.get(id) || null : null; }

export async function loadPhotoUrl(id) {
  if (!id) return null;
  if (urls.has(id)) return urls.get(id);
  if (pending.has(id)) return pending.get(id);
  const p = dbGet('photos', id).then(rec => {
    if (!rec || !rec.blob) { pending.delete(id); return null; }
    const u = URL.createObjectURL(rec.blob);
    urls.set(id, u);
    pending.delete(id);
    return u;
  }).catch(() => { pending.delete(id); return null; });
  pending.set(id, p);
  return p;
}

/* після рендера підставляє src у <img data-photo="id"> */
export function hydratePhotos(root) {
  root.querySelectorAll('img[data-photo]').forEach(async img => {
    const id = img.dataset.photo;
    const cached = photoUrlSync(id);
    if (cached) { img.src = cached; return; }
    const u = await loadPhotoUrl(id);
    if (u && img.isConnected) img.src = u;
  });
}

export async function deletePhoto(id) {
  if (!id) return;
  const u = urls.get(id);
  if (u) { URL.revokeObjectURL(u); urls.delete(id); }
  await dbDelete('photos', id);
}

export async function getPhotoBlob(id) {
  const rec = await dbGet('photos', id);
  return rec ? rec.blob : null;
}
export async function putPhotoBlob(id, blob) {
  await dbPut('photos', { id, blob, createdAt: Date.now() });
}
