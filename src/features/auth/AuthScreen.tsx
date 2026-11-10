import { useState, type FormEvent } from 'react';
import { ExerciseAnimation } from '@/features/library/figure/Figure';
import { t, type Key } from '@/i18n';
import { vibrate } from '@/lib/feedback';
import { useAuth } from '@/store/useAuth';
import { useData } from '@/store/useData';
import { toast } from '@/ui/dialogs';
import { Icon } from '@/ui/Icon';
import './auth.css';

type Mode = 'signin' | 'signup';

/** Full-screen sign-in / create-account screen shown before the app. */
export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<Key | null>(null);
  const [busy, setBusy] = useState(false);
  const { signIn, signUp } = useAuth();

  const signup = mode === 'signup';

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = signup ? await signUp(name, email, password, remember) : await signIn(email, password, remember);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      vibrate([20, 40, 20]);
      return;
    }
    // A new account names the profile if it has no name yet.
    if (signup) {
      const { settings, updateSettings } = useData.getState();
      if (!settings.name.trim()) updateSettings({ name: name.trim() });
    }
  }

  function switchMode() {
    setMode(signup ? 'signin' : 'signup');
    setError(null);
  }

  return (
    <div className="auth">
      <div className="auth-bg" aria-hidden="true">
        <span className="auth-slab s1" />
        <span className="auth-slab s2" />
        <span className="auth-slab s3" />
      </div>

      <div className="auth-inner">
        <header className="auth-hero">
          <ExerciseAnimation anim="curl" className="auth-figure" />
          <div className="auth-brand">
            <span className="auth-welcome">{t('auth.welcome')}</span>
            <h1 className="auth-logo">Forge</h1>
          </div>
        </header>
        <p className="auth-tagline">{t(signup ? 'auth.taglineSignup' : 'auth.tagline')}</p>

        <form className="auth-form" onSubmit={submit} noValidate>
          {signup && (
            <label className="auth-field">
              <Icon name="user" size={22} className="auth-field-icon" />
              <input
                type="text"
                autoComplete="name"
                placeholder={t('auth.name')}
                aria-label={t('auth.name')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          <label className="auth-field">
            <Icon name="mail" size={22} className="auth-field-icon" />
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              dir="auto"
              placeholder={t('auth.email')}
              aria-label={t('auth.email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="auth-field">
            <Icon name="lock" size={22} className="auth-field-icon" />
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete={signup ? 'new-password' : 'current-password'}
              dir="auto"
              placeholder={t('auth.password')}
              aria-label={t('auth.password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="auth-eye"
              aria-label={t(showPassword ? 'auth.hidePassword' : 'auth.showPassword')}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
            >
              <Icon name={showPassword ? 'eye' : 'eyeOff'} size={22} />
            </button>
          </label>

          <div className="auth-options">
            <label className="auth-remember">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span className="auth-radio" aria-hidden="true" />
              <span>{t('auth.remember')}</span>
            </label>
            {!signup && (
              <button type="button" className="auth-link" onClick={() => toast(t('auth.forgotSoon'))}>
                {t('auth.forgot')}
              </button>
            )}
          </div>

          {error && (
            <p className="auth-error" role="alert">
              {t(error)}
            </p>
          )}

          <button type="submit" className="auth-submit" disabled={busy}>
            <span>{t(signup ? 'auth.signUp' : 'auth.signIn')}</span>
            <Icon name="arrowRight" size={24} stroke={2.4} />
          </button>
        </form>

        <div className="auth-or">
          <span>{t('auth.or')}</span>
        </div>

        <button type="button" className="auth-google" onClick={() => toast(t('auth.googleSoon'))}>
          <GoogleG />
          <span>{t('auth.google')}</span>
        </button>

        <p className="auth-switch">
          {t(signup ? 'auth.haveAccount' : 'auth.noAccount')}{' '}
          <button type="button" className="auth-link is-underlined" onClick={switchMode}>
            {t(signup ? 'auth.signIn' : 'auth.signUp')}
          </button>
        </p>
      </div>
    </div>
  );
}

/** Multicolour Google "G" mark for the Google sign-in button. */
function GoogleG() {
  return (
    <svg className="auth-google-g" width="30" height="30" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
