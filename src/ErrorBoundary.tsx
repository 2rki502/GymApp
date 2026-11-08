import { Component, type ReactNode } from 'react';
import { t } from '@/i18n';

/** Keeps one broken screen from taking down the whole app; data stays intact. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[Forge] screen error', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="screen">
        <div className="empty" style={{ paddingTop: 'calc(var(--safe-top) + 80px)' }}>
          <h3>{t('err.title')}</h3>
          <p>{t('err.text')}</p>
          <div className="btn-row" style={{ width: '100%', maxWidth: 320 }}>
            <button className="btn" onClick={() => history.back()}>
              {t('err.goBack')}
            </button>
            <button className="btn btn-primary" onClick={() => location.reload()}>
              {t('err.reload')}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
