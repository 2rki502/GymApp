/**
 * Progress photos live in IndexedDB as Blobs (localStorage is far too small).
 * Images are downscaled and re-encoded as JPEG before storing.
 */
const DB_NAME = 'forge-photos';
const STORE = 'photos';

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Photo storage is not available in this browser.'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open photo storage.'));
  });
  dbPromise.catch(() => (dbPromise = null));
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.onabort = () => reject(t.error ?? new Error('Storage transaction aborted.'));
      }),
  );
}

/**
 * Photos are stored as raw bytes + MIME type rather than Blobs: some WebKit builds
 * reject Blob values in IndexedDB ("Error preparing Blob/File data"), while
 * ArrayBuffers are supported everywhere.
 */
interface StoredPhoto {
  type: string;
  data: ArrayBuffer;
}

export async function putPhoto(id: string, blob: Blob): Promise<void> {
  const record: StoredPhoto = { type: blob.type || 'image/jpeg', data: await blob.arrayBuffer() };
  await tx('readwrite', (s) => s.put(record, id));
}

export async function getPhoto(id: string): Promise<Blob | undefined> {
  const v = await tx<StoredPhoto | Blob | undefined>('readonly', (s) => s.get(id));
  if (!v) return undefined;
  if (v instanceof Blob) return v; // tolerate records written as Blobs
  return new Blob([v.data], { type: v.type });
}
export const deletePhoto = (id: string) => tx('readwrite', (s) => s.delete(id)).then(() => undefined);
export const clearPhotos = () => tx('readwrite', (s) => s.clear()).then(() => undefined);

/** Downscale to `maxSide` and encode as JPEG. Handles EXIF orientation via createImageBitmap where supported. */
export async function compressImage(file: Blob, maxSide = 1440, quality = 0.84): Promise<{ blob: Blob; width: number; height: number }> {
  const source = await loadImage(file);
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const width = Math.round(source.width * scale);
  const height = Math.round(source.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process image.');
  ctx.drawImage(source.img, 0, 0, width, height);
  if ('close' in source.img) (source.img as ImageBitmap).close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image.'))), 'image/jpeg', quality),
  );
  return { blob, width, height };
}

async function loadImage(file: Blob): Promise<{ img: CanvasImageSource; width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      return { img: bmp, width: bmp.width, height: bmp.height };
    } catch {
      /* fall back to <img> (older Safari / HEIC edge cases) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { img, width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    throw new Error('This image format is not supported.');
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
