import { beforeEach, describe, expect, it } from 'vitest';
import { useAuth } from './useAuth';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage(), configurable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: memoryStorage(), configurable: true });
  useAuth.setState({ user: null });
});

describe('device accounts', () => {
  it('creates an account, signs out and signs back in', async () => {
    const { signUp, signOut, signIn } = useAuth.getState();
    expect(await signUp('Sam', ' Sam@Example.com ', 'secret1', true)).toEqual({ ok: true });
    expect(useAuth.getState().user).toEqual({ email: 'sam@example.com', name: 'Sam' });
    expect(localStorage.getItem('forge:accounts')).not.toContain('secret1');

    signOut();
    expect(useAuth.getState().user).toBeNull();
    expect(await signIn('SAM@example.com', 'secret1', false)).toEqual({ ok: true });
    expect(useAuth.getState().user?.name).toBe('Sam');
  });

  it('rejects bad input, duplicates and wrong passwords', async () => {
    const { signUp, signIn } = useAuth.getState();
    expect(await signUp('', 'a@b.co', 'secret1', true)).toEqual({ ok: false, error: 'auth.errName' });
    expect(await signUp('A', 'not-an-email', 'secret1', true)).toEqual({ ok: false, error: 'auth.errEmail' });
    expect(await signUp('A', 'a@b.co', '123', true)).toEqual({ ok: false, error: 'auth.errPassword' });
    expect(await signUp('A', 'a@b.co', 'secret1', true)).toEqual({ ok: true });
    expect(await signUp('B', 'A@B.co', 'secret2', true)).toEqual({ ok: false, error: 'auth.errExists' });
    expect(await signIn('a@b.co', 'wrong-pass', true)).toEqual({ ok: false, error: 'auth.errWrong' });
    expect(await signIn('nobody@b.co', 'secret1', true)).toEqual({ ok: false, error: 'auth.errWrong' });
  });

  it('"remember me" decides where the session is kept', async () => {
    await useAuth.getState().signUp('A', 'a@b.co', 'secret1', false);
    expect(sessionStorage.getItem('forge:session')).toBe('"a@b.co"');
    expect(localStorage.getItem('forge:session')).toBeNull();
    await useAuth.getState().signIn('a@b.co', 'secret1', true);
    expect(localStorage.getItem('forge:session')).toBe('"a@b.co"');
    expect(sessionStorage.getItem('forge:session')).toBeNull();
  });
});
