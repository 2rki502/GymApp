import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { goBack, useRouter } from '@/lib/router';
import { Icon } from './Icon';

const scrollMemory = new Map<string, number>();

interface Props {
  title: string;
  /** iOS large title that collapses into the nav bar on scroll */
  large?: boolean;
  /** small caps line above the large title */
  eyebrow?: ReactNode;
  back?: { label?: string; to: string };
  left?: ReactNode;
  right?: ReactNode;
  /** content rendered under the large title (e.g. segmented control) */
  header?: ReactNode;
  children: ReactNode;
  /** extra bottom space (e.g. when a fixed footer is present) */
  bottomInset?: number;
  className?: string;
}

export function Screen({ title, large, eyebrow, back, left, right, header, children, bottomInset = 0, className }: Props) {
  const { path } = useRouter();
  const scroller = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const pathRef = useRef(path);

  // Restore and remember scroll position per route.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = scrollMemory.get(path) ?? 0;
    pathRef.current = path;
    return () => {
      scrollMemory.set(pathRef.current, el.scrollTop);
    };
  }, [path]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const threshold = large ? 38 : 4;
    const onScroll = () => setScrolled(el.scrollTop > threshold);
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [large]);

  // Tapping the active tab again scrolls to top.
  useEffect(() => {
    const onTop = () => scroller.current?.scrollTo({ top: 0, behavior: 'smooth' });
    window.addEventListener('forge:scrolltop', onTop);
    return () => window.removeEventListener('forge:scrolltop', onTop);
  }, []);

  return (
    <div ref={scroller} className={`screen ${className ?? ''}`} style={{ ['--bottom-inset' as string]: `${bottomInset}px` }}>
      <header className={`navbar ${scrolled ? 'is-scrolled' : ''} ${large ? 'has-large' : ''}`}>
        <div className="navbar-inner">
          <div className="navbar-side">
            {back ? (
              <button className="nav-back" onClick={() => goBack(back.to)} aria-label={`Back to ${back.label ?? 'previous'}`}>
                <Icon name="chevronLeft" size={26} stroke={2.4} />
                <span>{back.label ?? 'Back'}</span>
              </button>
            ) : (
              left
            )}
          </div>
          <div className="navbar-title" aria-hidden={large && !scrolled}>
            {title}
          </div>
          <div className="navbar-side navbar-right">{right}</div>
        </div>
      </header>
      {eyebrow && <div className="large-eyebrow">{eyebrow}</div>}
      {large && <h1 className="large-title">{title}</h1>}
      {header}
      <div className="screen-body">{children}</div>
    </div>
  );
}

/** Section heading inside a screen. */
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="section-title">
      <h2>{children}</h2>
      {action}
    </div>
  );
}
