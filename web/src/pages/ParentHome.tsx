import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api.ts';
import { useErrorText, useI18n } from '../i18n.tsx';
import { usePoll } from '../live.tsx';
import {
  Avatar,
  Button,
  Card,
  Empty,
  Field,
  LoadingScreen,
  Modal,
  useToast,
} from '../components/ui.tsx';
import type { KidSummary, Overview } from '../types.ts';

export function ParentHome() {
  const { t } = useI18n();
  const toast = useToast();
  const errorText = useErrorText();

  const [overview, setOverview] = useState<Overview | null>(null);
  const [adjusting, setAdjusting] = useState<KidSummary | null>(null);
  const [amount, setAmount] = useState('10');
  const [reason, setReason] = useState('');
  const [sign, setSign] = useState<1 | -1>(1);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setOverview(await api.overview());
    } catch {
      // Only the first failure needs a stand-in; a later one leaves the numbers
      // already on screen alone rather than blanking them.
      setOverview((current) => current ?? { pendingSubmissions: 0, pendingRedemptions: 0, kids: [] });
    }
  }, []);

  usePoll(load);

  const applyAdjustment = async () => {
    if (!adjusting) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || !reason.trim()) return;
    setBusy(true);
    try {
      await api.adjust(adjusting.id, sign * Math.round(value), reason.trim());
      toast.show(t('pointsAdjusted'), 'good');
      setAdjusting(null);
      setReason('');
      setAmount('10');
      await load();
    } catch (err) {
      toast.show(errorText(err instanceof ApiError ? err.code : 'server_error'), 'bad');
    } finally {
      setBusy(false);
    }
  };

  if (overview === null) return <LoadingScreen />;

  const waiting = overview.pendingSubmissions + overview.pendingRedemptions;

  return (
    <div className="page">
      <h1>{t('parentHome')}</h1>

      <Link to="/queue" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="hero">
          <div className="hero-label">{t('waitingForYou')}</div>
          <div className="hero-value tnum">{waiting}</div>
          <div className="hero-sub">
            <span>
              ⭐ {overview.pendingSubmissions} {t('deedRequests')}
            </span>
            <span>
              🎁 {overview.pendingRedemptions} {t('rewardRequests')}
            </span>
          </div>
        </div>
      </Link>

      <Card title={t('familyTitle')}>
        {overview.kids.length === 0 ? (
          <Empty icon="👨‍👩‍👧" text={t('noUsers')} />
        ) : (
          <div className="list">
            {overview.kids.map((kid) => (
              <div key={kid.id} className="item" style={{ flexWrap: 'wrap' }}>
                <Avatar emoji={kid.avatar} color={kid.color} size="md" />
                <div className="grow">
                  <div className="item-title">{kid.name}</div>
                  <div className="item-meta">
                    {t('thisWeek')}: +{kid.earnedThisWeek}
                    {kid.pending > 0 && ` · ⏳ +${kid.pending}`}
                    {kid.reserved > 0 && ` · 🔒 ${kid.reserved}`}
                  </div>
                </div>
                <div className="center">
                  <div className="stat-value tnum">{kid.balance}</div>
                  <div className="stat-label">{t('points')}</div>
                </div>
                <div className="row" style={{ gap: 'var(--s2)', width: '100%' }}>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="grow"
                    onClick={() => {
                      setAdjusting(kid);
                      setSign(1);
                    }}
                  >
                    ＋ {t('givePoints')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="grow"
                    onClick={() => {
                      setAdjusting(kid);
                      setSign(-1);
                    }}
                  >
                    − {t('takePoints')}
                  </Button>
                  <Link to={`/kid/${kid.id}`} className="btn btn-sm btn-ghost grow">
                    {t('navHistory')}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {adjusting && (
        <Modal
          title={`${sign > 0 ? t('givePoints') : t('takePoints')} · ${adjusting.name}`}
          onClose={() => setAdjusting(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setAdjusting(null)}>
                {t('cancel')}
              </Button>
              <Button
                variant="primary"
                busy={busy}
                disabled={!reason.trim() || Number(amount) <= 0}
                onClick={applyAdjustment}
              >
                {t('confirm')}
              </Button>
            </>
          }
        >
          <Field label={t('amount')}>
            <input
              className="input tnum"
              type="number"
              min={1}
              max={100000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="numeric"
            />
          </Field>
          <Field label={t('reason')} hint={t('reasonRequired')}>
            <input
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 200))}
              autoFocus
            />
          </Field>
          <p className="hint">
            {adjusting.balance} → {adjusting.balance + sign * (Number(amount) || 0)}
          </p>
        </Modal>
      )}
    </div>
  );
}
