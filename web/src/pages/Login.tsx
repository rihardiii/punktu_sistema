import { useEffect, useState } from 'react';
import { api, ApiError } from '../api.ts';
import { useAuth } from '../auth.tsx';
import { useErrorText, useI18n } from '../i18n.tsx';
import { Avatar, Button, Card, Empty, LoadingScreen, Modal, useToast } from '../components/ui.tsx';
import { PinPad } from '../components/PinPad.tsx';
import type { Face } from '../types.ts';

/**
 * Two steps: tap your face, then type your PIN. A six-year-old should not have
 * to remember and type a username on a phone keyboard.
 */
export function Login() {
  const { t } = useI18n();
  const errorText = useErrorText();
  const toast = useToast();
  const { login } = useAuth();

  const [faces, setFaces] = useState<Face[] | null>(null);
  const [selected, setSelected] = useState<Face | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [askingReset, setAskingReset] = useState(false);

  useEffect(() => {
    api
      .faces()
      .then((data) => setFaces(data.users))
      .catch(() => setFaces([]));
  }, []);

  const attempt = async () => {
    if (!selected || pin.length < 4 || busy) return;
    setBusy(true);
    setError('');
    try {
      await login(selected.username, pin);
    } catch (err) {
      // A lockout carries the seconds left, so say when to come back rather
      // than leaving a kid tapping at a PIN that cannot work yet.
      if (err instanceof ApiError && err.code === 'too_many_attempts' && err.detail) {
        setError(t('lockedOut', { n: Math.max(1, Math.ceil(Number(err.detail) / 60)) }));
      } else {
        setError(errorText(err instanceof ApiError ? err.code : 'server_error'));
      }
      setPin('');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setBusy(false);
    }
  };

  const requestReset = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await api.requestPinReset(selected.username);
      toast.show(t('pinRequestSent'), 'good');
      setAskingReset(false);
    } catch {
      toast.show(errorText('server_error'), 'bad');
    } finally {
      setBusy(false);
    }
  };

  if (faces === null) return <LoadingScreen />;

  // --- step 2: PIN ---
  if (selected) {
    return (
      <div className="page page-narrow" style={{ paddingTop: 'var(--s6)' }}>
        <div className="center col" style={{ gap: 'var(--s2)', alignItems: 'center' }}>
          <Avatar emoji={selected.avatar} color={selected.color} size="lg" />
          <h1>{selected.name}</h1>
          <p className="muted">{t('enterPin')}</p>
        </div>

        <PinPad value={pin} onChange={setPin} onComplete={attempt} shake={shake} />

        {error && <p className="error-text center">{error}</p>}

        <div className="col" style={{ gap: 'var(--s2)' }}>
          <Button variant="primary" block busy={busy} disabled={pin.length < 4} onClick={attempt}>
            {t('logIn')}
          </Button>
          <Button
            variant="ghost"
            block
            onClick={() => {
              setSelected(null);
              setPin('');
              setError('');
            }}
          >
            {t('back')}
          </Button>
          <button className="link-button" onClick={() => setAskingReset(true)}>
            {t('forgotPin')}
          </button>
        </div>

        {askingReset && (
          <Modal
            title={t('forgotPin')}
            onClose={() => setAskingReset(false)}
            footer={
              <>
                <Button variant="ghost" onClick={() => setAskingReset(false)}>
                  {t('cancel')}
                </Button>
                <Button variant="primary" busy={busy} onClick={requestReset}>
                  {t('sendRequest')}
                </Button>
              </>
            }
          >
            {/* A parent's request goes to the admin, a kid's to any parent. */}
            <p className="muted">
              {selected.role === 'parent' ? t('forgotPinAdminLead') : t('forgotPinLead')}
            </p>
          </Modal>
        )}
      </div>
    );
  }

  // --- step 1: who are you ---
  return (
    <div className="page page-narrow" style={{ paddingTop: 'var(--s6)' }}>
      <div className="center col" style={{ gap: 'var(--s1)', marginBottom: 'var(--s3)' }}>
        <div style={{ fontSize: '3rem' }} aria-hidden>
          ⭐
        </div>
        <h1>{t('appName')}</h1>
        <p className="muted">{t('tagline')}</p>
      </div>

      <Card title={t('whoAreYou')}>
        {faces.length === 0 ? (
          <Empty icon="👋" text={t('noUsers')} />
        ) : (
          <div className="faces">
            {faces.map((face) => (
              <button key={face.id} className="face" onClick={() => setSelected(face)}>
                <Avatar emoji={face.avatar} color={face.color} size="md" />
                <span className="face-name">{face.name}</span>
                <span className="face-role">{face.role === 'parent' ? t('parent') : t('kid')}</span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
