import { useState } from 'react';
import { useAuth } from '../auth.tsx';
import { ApiError } from '../api.ts';
import { useErrorText, useI18n } from '../i18n.tsx';
import { Button, Card, Field } from '../components/ui.tsx';

/** First run: there are no users yet, so create the first parent. */
export function Setup() {
  const { t } = useI18n();
  const errorText = useErrorText();
  const { completeSetup } = useAuth();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await completeSetup({ name: name.trim(), username: username.trim(), pin });
    } catch (err) {
      setError(errorText(err instanceof ApiError ? err.code : 'server_error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page page-narrow" style={{ paddingTop: 'var(--s7)' }}>
      <div className="center col" style={{ gap: 'var(--s2)', marginBottom: 'var(--s4)' }}>
        <div style={{ fontSize: '3.4rem' }} aria-hidden>
          ⭐
        </div>
        <h1>{t('setupTitle')}</h1>
        <p className="muted">{t('setupLead')}</p>
      </div>

      <Card>
        <form className="col" onSubmit={submit}>
          <Field label={t('yourName')}>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mamma"
              autoComplete="name"
              required
            />
          </Field>

          <Field label={t('username')} hint={t('usernameHint')}>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="mamma"
              autoComplete="username"
              inputMode="text"
              required
            />
          </Field>

          <Field label={t('pin')} hint={t('pinHint')} error={error || undefined}>
            <input
              className="input tnum"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 10))}
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              placeholder="••••"
              required
            />
          </Field>

          <Button
            type="submit"
            variant="primary"
            block
            busy={busy}
            disabled={!name.trim() || username.trim().length < 2 || pin.length < 4}
          >
            {t('createAccount')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
