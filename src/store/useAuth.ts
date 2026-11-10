import { create } from 'zustand';
import type { Key } from '@/i18n';

/**
 * Device-local accounts. There is no server yet: accounts live in this browser's
 * storage, and all of them share the same workout data. Passwords are stored only as
 * salted PBKDF2 hashes. Swap this module for a real auth service (Firebase, Supabase…)
 * without touching the screens: they only use `user`, `signIn`, `signUp` and `signOut`.
 */
export interface AuthUser {
  email: string;
  name: string;
}

interface Account extends AuthUser {
  salt: string;
  hash: string;
  /** 'pbkdf2' normally; 'basic' when Web Crypto is unavailable (plain-HTTP LAN testing). */
  algo: 'pbkdf2' | 'basic';
  createdAt: string;
}

/**
 * Master switch for the login requirement. While false (development phase), the app
 * opens straight to the dashboard and the Account section in Profile is hidden.
 * All sign-in code and saved accounts are untouched: set to true to re-enable login.
 */
export const AUTH_ENABLED: boolean = false;

const ACCOUNTS_KEY = 'forge:accounts';
const SESSION_KEY = 'forge:session';

function store(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? globalThis.localStorage : globalThis.sessionStorage;
  } catch {
    return null;
  }
}

function loadAccounts(): Account[] {
  try {
    const raw = store('local')?.getItem(ACCOUNTS_KEY);
    const list = raw ? (JSON.parse(raw) as Account[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveAccounts(list: Account[]) {
  try {
    store('local')?.setItem(ACCOUNTS_KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked: the account just won't survive a reload */
  }
}

function loadSession(): AuthUser | null {
  for (const kind of ['session', 'local'] as const) {
    try {
      const raw = store(kind)?.getItem(SESSION_KEY);
      if (!raw) continue;
      const email = JSON.parse(raw) as string;
      const acc = loadAccounts().find((a) => a.email === email);
      if (acc) return { email: acc.email, name: acc.name };
    } catch {
      /* ignore */
    }
  }
  return null;
}

function saveSession(email: string | null, remember: boolean) {
  for (const kind of ['session', 'local'] as const) {
    try {
      store(kind)?.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }
  if (!email) return;
  try {
    store(remember ? 'local' : 'session')?.setItem(SESSION_KEY, JSON.stringify(email));
  } catch {
    /* ignore */
  }
}

const toHex = (buf: ArrayBuffer | Uint8Array) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return toHex(bytes);
}

const hasSubtle = () => typeof globalThis.crypto?.subtle?.importKey === 'function';

async function hashPassword(password: string, salt: string, algo: Account['algo']): Promise<string> {
  if (algo === 'pbkdf2') {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 120_000, hash: 'SHA-256' }, key, 256);
    return toHex(bits);
  }
  // Fallback for insecure contexts (no Web Crypto): FNV-1a over many rounds. Not strong,
  // but these accounts only guard data that is already on the same device.
  let h = 0x811c9dc5;
  const s = salt + password;
  for (let round = 0; round < 5000; round++) {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h ^= round;
  }
  return h.toString(16).padStart(8, '0');
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
export const MIN_PASSWORD = 6;

type Result = { ok: true } | { ok: false; error: Key };

interface AuthState {
  user: AuthUser | null;
  signIn: (email: string, password: string, remember: boolean) => Promise<Result>;
  signUp: (name: string, email: string, password: string, remember: boolean) => Promise<Result>;
  signOut: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: loadSession(),

  async signIn(emailIn, password, remember) {
    const email = normalizeEmail(emailIn);
    if (!isValidEmail(email)) return { ok: false, error: 'auth.errEmail' };
    const acc = loadAccounts().find((a) => a.email === email);
    if (!acc || (acc.algo === 'pbkdf2' && !hasSubtle())) return { ok: false, error: 'auth.errWrong' };
    if ((await hashPassword(password, acc.salt, acc.algo)) !== acc.hash) return { ok: false, error: 'auth.errWrong' };
    saveSession(email, remember);
    set({ user: { email, name: acc.name } });
    return { ok: true };
  },

  async signUp(nameIn, emailIn, password, remember) {
    const name = nameIn.trim();
    const email = normalizeEmail(emailIn);
    if (!name) return { ok: false, error: 'auth.errName' };
    if (!isValidEmail(email)) return { ok: false, error: 'auth.errEmail' };
    if (password.length < MIN_PASSWORD) return { ok: false, error: 'auth.errPassword' };
    const accounts = loadAccounts();
    if (accounts.some((a) => a.email === email)) return { ok: false, error: 'auth.errExists' };
    const salt = randomSalt();
    const algo: Account['algo'] = hasSubtle() ? 'pbkdf2' : 'basic';
    const hash = await hashPassword(password, salt, algo);
    saveAccounts([...accounts, { email, name, salt, hash, algo, createdAt: new Date().toISOString() }]);
    saveSession(email, remember);
    set({ user: { email, name } });
    return { ok: true };
  },

  signOut() {
    saveSession(null, false);
    set({ user: null });
  },
}));
