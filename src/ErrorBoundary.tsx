import { Component, type ReactNode } from 'react';

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
          <h3>Something went wrong</h3>
          <p>Your data is safe. Try going back, or reload the app.</p>
          <div className="btn-row" style={{ width: '100%', maxWidth: 320 }}>
            <button className="btn" onClick={() => history.back()}>
              Go Back
            </button>
            <button className="btn btn-primary" onClick={() => location.reload()}>
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
