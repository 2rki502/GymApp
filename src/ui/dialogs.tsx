import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { t } from '@/i18n';
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
  const { confirm: c, sheet, toast: current } = useDialogs();

  useEffect(() => onStorageError((m) => toast(m, 'error')), []);

  useEffect(() => {
    if (!current) return;
    const id = current.id;
    const h = setTimeout(() => {
      if (useDialogs.getState().toast?.id === id) useDialogs.setState({ toast: null });
    }, 2600);
    return () => clearTimeout(h);
  }, [current]);

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
              <button onClick={() => closeConfirm(false)}>{c.cancelLabel ?? t('common.cancel')}</button>
              <button className={c.destructive ? 'is-destructive' : 'is-primary'} onClick={() => closeConfirm(true)}>
                {c.confirmLabel ?? t('common.ok')}
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
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      {current && (
        <div key={current.id} className={`toast toast-${current.tone}`} role="status">
          {current.text}
        </div>
      )}
    </>,
    document.body,
  );
}
