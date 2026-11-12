import { describe, expect, it } from 'vitest';
import { EXERCISES } from '@/data/exercises';
import { auditAll } from './audit';
import { PATTERNS } from './patterns';

describe('exercise animations', () => {
  it('pass the biomechanics audit', () => {
    const report = auditAll();
    const lines = Object.entries(report).flatMap(([id, issues]) => issues.map((i) => `${id}: [${i.rule}] ${i.detail}`));
    if ((globalThis as { process?: { env: Record<string, string> } }).process?.env.AUDIT_REPORT) console.log(`AUDIT ${Object.keys(report).length} patterns\n${lines.join('\n')}`);
    expect(lines).toEqual([]);
  });

  it('gives every exercise its own animation', () => {
    const seen = new Map<string, string>();
    for (const e of EXERCISES) {
      expect(PATTERNS[e.anim!], `${e.id} → ${e.anim}`).toBeDefined();
      expect(seen.get(e.anim!), `${e.id} shares "${e.anim}"`).toBeUndefined();
      seen.set(e.anim!, e.id);
    }
  });
});
