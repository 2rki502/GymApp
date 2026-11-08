import { describe, expect, it } from 'vitest';
import { defaultSettings } from '@/store/useData';
import { resolveTheme } from './theme';

describe('theme', () => {
  it('honours explicit choices regardless of the OS', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
  it('follows the OS when set to system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
  it('defaults to dark', () => {
    expect(defaultSettings().theme).toBe('dark');
  });
});
