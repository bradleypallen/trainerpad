// IndexedDB wrapper — promise-based, no dependencies.
const DB_NAME = 'trainerpad';
const DB_VERSION = 1;
const STORES = ['clients', 'sessions', 'assessments', 'exercises', 'settings'];

let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('clients'))
        db.createObjectStore('clients', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('sessions')) {
        const s = db.createObjectStore('sessions', { keyPath: 'id' });
        s.createIndex('clientId', 'clientId', { unique: false });
      }
      if (!db.objectStoreNames.contains('assessments')) {
        const a = db.createObjectStore('assessments', { keyPath: 'id' });
        a.createIndex('clientId', 'clientId', { unique: false });
      }
      if (!db.objectStoreNames.contains('exercises'))
        db.createObjectStore('exercises', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings'))
        db.createObjectStore('settings', { keyPath: 'key' });
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const os = t.objectStore(store);
    const out = fn(os);
    t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
    t.onerror = () => reject(t.error);
  }));
}

export function put(store, obj) {
  return tx(store, 'readwrite', (os) => { os.put(obj); return obj; });
}

export function del(store, id) {
  return tx(store, 'readwrite', (os) => { os.delete(id); });
}

export function get(store, id) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

export function getAll(store) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }));
}

export function getAllByClient(store, clientId) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).index('clientId').getAll(clientId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }));
}

export function uid() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

// ---- Backup / restore ----
export async function exportAll() {
  const data = {};
  for (const s of STORES) data[s] = await getAll(s);
  return {
    app: 'TrainerPad',
    version: DB_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export async function importAll(payload, { replace = true } = {}) {
  if (!payload || payload.app !== 'TrainerPad' || !payload.data)
    throw new Error('Not a valid TrainerPad backup file.');
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const t = db.transaction(STORES, 'readwrite');
    for (const s of STORES) {
      const os = t.objectStore(s);
      if (replace) os.clear();
      for (const row of payload.data[s] || []) os.put(row);
    }
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}

// Ask the browser to protect our storage from eviction.
export function requestPersistence() {
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
}
