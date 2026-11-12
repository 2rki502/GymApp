// Dev-only review sheet for every animation: a filmstrip through each loop (in-between
// frames included) plus any biomechanics audit failures. Not part of the app bundle.
// Open /debug.html?only=squat_back,deadlift to narrow it, &n=8 for more frames.
import { createRoot } from 'react-dom/client';
import { EXERCISES } from '@/data/exercises';
import { auditPattern } from '@/features/library/figure/audit';
import { FigureFrame } from '@/features/library/figure/Figure';
import { PATTERNS } from '@/features/library/figure/patterns';
import { sampleLoop } from '@/features/library/figure/scene';

const params = new URLSearchParams(location.search);
const only = params.get('only')?.split(',');
const n = Number(params.get('n') ?? 6);
const cols = Number(params.get('cols') ?? 2);
document.documentElement.style.setProperty('--cols', String(cols));
const names = new Map(EXERCISES.map((e) => [e.anim, e.name]));
const entries = Object.entries(PATTERNS).filter(([k]) => !only || only.includes(k));

createRoot(document.getElementById('root')!).render(
  <div className="grid">
    {entries.map(([id, p]) => {
      const issues = auditPattern(p);
      return (
        <div className={`cell${issues.length ? ' bad' : ''}`} key={id}>
          <b>{names.get(id) ?? '(unused)'}</b> · {id}
          <div className="row">
            {sampleLoop(p, n).map((pose, i) => (
              <div key={i}>
                <FigureFrame pattern={p} pose={pose} fit="scene" focus={EXERCISES.find((e) => e.anim === id)?.primary} />
              </div>
            ))}
          </div>
          {issues.map((x, i) => (
            <div className="issue" key={i}>
              [{x.rule}] {x.detail}
            </div>
          ))}
        </div>
      );
    })}
  </div>,
);
