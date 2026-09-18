import { useEffect, useState } from 'react';
import { api, ApiError } from '../api.ts';
import { useAuth } from '../auth.tsx';
import { useErrorText, useI18n, type Lang } from '../i18n.tsx';
import { ACCENTS, useTheme, type ThemeMode } from '../theme.tsx';
import { Avatar, Button, Card, Field, Modal, Segmented, useToast } from '../components/ui.tsx';

export function Settings() {
  const { t, lang, setLang } = useI18n();
  const { mode, setMode, accent, setAccent } = useTheme();
  const { user, logout } = useAuth();
  const toast = useToast();
  const errorText = useErrorText();

  /*
   * Versija tiek prasīta serverim, nevis iešūta šajā paketē. Katrs commit to
   * paceļ, serveris to nolasa startējot, bet pakete mainītos tikai pēc
   * pārbūvēšanas — tāpēc šis ekrāns rādīja 0.12, kad īstenībā jau bija 0.12.1.
   * Tas arī nozīmē, ka noglabāta (service worker) pakete nevar rādīt vecu
   * skaitli: `/api` netiek kešots nekad.
   */
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api
      .health()
      .then((health) => {
        if (!cancelled) setVersion(health.version);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const [changing, setChanging] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submitPin = async () => {
    setBusy(true);
    setError('');
    try {
      await api.changePin(currentPin, newPin);
      toast.show(t('pinChanged'), 'good');
      setChanging(false);
      setCurrentPin('');
      setNewPin('');
    } catch (err) {
      setError(errorText(err instanceof ApiError ? err.code : 'server_error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <h1>{t('settingsTitle')}</h1>

      <Card title={t('account')}>
        <div className="row">
          <Avatar emoji={user?.avatar ?? '🙂'} color={user?.color} size="lg" />
          <div className="grow">
            <div style={{ fontWeight: 800, fontSize: '1.15rem' }}>{user?.name}</div>
            <div className="item-meta">
              @{user?.username} · {user?.role === 'parent' ? t('parent') : t('kid')}
            </div>
          </div>
        </div>
        <hr className="divider" />
        <div className="row" style={{ gap: 'var(--s2)' }}>
          <Button variant="ghost" className="grow" onClick={() => setChanging(true)}>
            🔑 {t('changePin')}
          </Button>
          <Button variant="ghost" className="grow" onClick={() => void logout()}>
            🚪 {t('logOut')}
          </Button>
        </div>
      </Card>

      <Card title={t('appearance')}>
        <Field label={t('theme')} composite>
          <Segmented<ThemeMode>
            value={mode}
            onChange={setMode}
            options={[
              { value: 'light', label: `☀️ ${t('themeLight')}` },
              { value: 'dark', label: `🌙 ${t('themeDark')}` },
              { value: 'system', label: `⚙️ ${t('themeSystem')}` },
            ]}
          />
        </Field>

        <Field label={t('accentColor')} composite>
          <div className="swatches">
            {ACCENTS.map((hex) => (
              <button
                key={hex}
                type="button"
                className={`swatch ${accent === hex ? 'is-active' : ''}`}
                style={{ background: hex }}
                onClick={() => setAccent(hex)}
                aria-label={hex}
                aria-pressed={accent === hex}
              />
            ))}
            {/* Fully custom colour — the "custom" part of dark / light / custom. */}
            <label
              className="swatch"
              style={{
                background: `conic-gradient(from 180deg, #e8623c, #f2c14e, #2fae7d, #0ea5b7, #6c8ef5, #7c5ce0, #e0568b, #e8623c)`,
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
              }}
              title={t('accentColor')}
            >
              <input
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
            </label>
          </div>
        </Field>

        <Field label={t('language')} composite>
          <Segmented<Lang>
            value={lang}
            onChange={setLang}
            options={[
              { value: 'lv', label: '🇱🇻 Latviski' },
              { value: 'en', label: '🇬🇧 English' },
            ]}
          />
        </Field>
      </Card>

      <Card title={t('aboutApp')}>
        <div className="row-between">
          <span className="muted">{t('version')}</span>
          <span className="tnum" style={{ fontWeight: 800 }}>
            {/* Dash, not a stale number, when the server cannot be reached. */}
            {version ?? '—'}
          </span>
        </div>
      </Card>

      {changing && (
        <Modal
          title={t('changePin')}
          onClose={() => setChanging(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setChanging(false)}>
                {t('cancel')}
              </Button>
              <Button
                variant="primary"
                busy={busy}
                disabled={currentPin.length < 4 || newPin.length < 4}
                onClick={submitPin}
              >
                {t('save')}
              </Button>
            </>
          }
        >
          <Field label={t('currentPin')}>
            <input
              className="input tnum"
              type="password"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 10))}
              inputMode="numeric"
              autoFocus
            />
          </Field>
          <Field label={t('newPin')} hint={t('pinHint')} error={error || undefined}>
            <input
              className="input tnum"
              type="password"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 10))}
              inputMode="numeric"
            />
          </Field>
        </Modal>
      )}
    </div>
  );
}
