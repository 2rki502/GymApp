import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { onStorageError } from '@/store/storage';

/**
 * Imperative iOS-style alerts, action sheets and toasts:
 *   if (await confirm({ title: 'Delete?', destructive: true })) …
 */
interface ConfirmOpts {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}
interface Action {
  label: string;
  destructive?: boolean;
  onSelect: () => void;
}
interface ActionSheetOpts {
  title?: string;
  message?: string;
  actions: Action[];
}

interface DialogState {
  confirm: (ConfirmOpts & { resolve: (v: boolean) => void }) | null;
  sheet: ActionSheetOpts | null;
  toast: { id: number; text: string; tone: 'default' | 'success' | 'error' } | null;
}

const useDialogs = create<DialogState>(() => ({ confirm: null, sheet: null, toast: null }));

export function confirm(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => useDialogs.setState({ confirm: { ...opts, resolve } }));
}

export function actionSheet(opts: ActionSheetOpts) {
  useDialogs.setState({ sheet: opts });
}

let toastId = 0;
export function toast(text: string, tone: 'default' | 'success' | 'error' = 'default') {
  useDialogs.setState({ toast: { id: ++toastId, text, tone } });
}

export function DialogHost() {
  const { confirm: c, sheet, toast: t } = useDialogs();

  useEffect(() => onStorageError((m) => toast(m, 'error')), []);

  useEffect(() => {
    if (!t) return;
    const id = t.id;
    const h = setTimeout(() => {
      if (useDialogs.getState().toast?.id === id) useDialogs.setState({ toast: null });
    }, 2600);
    return () => clearTimeout(h);
  }, [t]);

  const closeConfirm = (v: boolean) => {
    c?.resolve(v);
    useDialogs.setState({ confirm: null });
  };

  return createPortal(
    <>
      {c && (
        <div className="alert-root" role="alertdialog" aria-modal="true" aria-label={c.title}>
          <div className="alert-backdrop" onClick={() => closeConfirm(false)} />
          <div className="alert">
            <div className="alert-text">
              <h3>{c.title}</h3>
              {c.message && <p>{c.message}</p>}
            </div>
            <div className="alert-actions">
              <button onClick={() => closeConfirm(false)}>{c.cancelLabel ?? 'Cancel'}</button>
              <button className={c.destructive ? 'is-destructive' : 'is-primary'} onClick={() => closeConfirm(true)}>
                {c.confirmLabel ?? 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
      {sheet && (
        <div className="asheet-root" role="dialog" aria-modal="true">
          <div className="alert-backdrop" onClick={() => useDialogs.setState({ sheet: null })} />
          <div className="asheet">
            <div className="asheet-group">
              {(sheet.title || sheet.message) && (
                <div className="asheet-head">
                  {sheet.title && <strong>{sheet.title}</strong>}
                  {sheet.message && <span>{sheet.message}</span>}
                </div>
              )}
              {sheet.actions.map((a) => (
                <button
                  key={a.label}
                  className={a.destructive ? 'is-destructive' : ''}
                  onClick={() => {
                    useDialogs.setState({ sheet: null });
                    a.onSelect();
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <div className="asheet-group">
              <button className="is-cancel" onClick={() => useDialogs.setState({ sheet: null })}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {t && (
        <div key={t.id} className={`toast toast-${t.tone}`} role="status">
          {t.text}
        </div>
      )}
    </>,
    document.body,
  );
}
