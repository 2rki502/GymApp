// Dev-only visual check of every animation pattern's keyframes. Not part of the app bundle.
import { createRoot } from 'react-dom/client';
import { FigureFrame } from '@/features/library/figure/Figure';
import { normalize } from '@/features/library/figure/kinematics';
import { PATTERNS } from '@/features/library/figure/patterns';

const params = new URLSearchParams(location.search);
const only = params.get('only')?.split(',');
const entries = Object.entries(PATTERNS).filter(([k]) => !only || only.includes(k));

createRoot(document.getElementById('root')!).render(
  <div className="grid">
    {entries.map(([id, p]) => (
      <div className="cell" key={id}>
        {id}
        <div className="row">
          {p.frames.map((f, i) => (
            <div key={i}>
              <FigureFrame pattern={p} pose={normalize(f)} />
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>,
);
