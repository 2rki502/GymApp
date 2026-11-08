import type { StateStorage } from 'zustand/middleware';
import { t } from '@/i18n';

/**
 * Storage adapter for persisted state. Currently localStorage; replace this module
 * with a remote/IndexedDB-backed implementation to add sync without touching stores.
 */
type Listener = (message: string) => void;
const listeners = new Set<Listener>();
export const onStorageError = (fn: Listener) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

const memory = new Map<string, string>();

function ls(): Storage | null {
  try {
    const s = globalThis.localStorage;
    const probe = '__forge_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

const backing = ls();

export const safeStorage: StateStorage = {
  getItem: (key) => (backing ? backing.getItem(key) : memory.get(key) ?? null),
  setItem: (key, value) => {
    if (!backing) {
      memory.set(key, value);
      return;
    }
    try {
      backing.setItem(key, value);
    } catch {
      listeners.forEach((fn) => fn(t('err.storageFull')));
    }
  },
  removeItem: (key) => (backing ? backing.removeItem(key) : void memory.delete(key)),
};

export const storageAvailable = backing !== null;

/** Ask the browser not to evict our data (Safari evicts idle site data otherwise). */
export async function requestPersistence(): Promise<void> {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) {
      await navigator.storage.persist?.();
    }
  } catch {
    /* best effort */
  }
}
