import { useCallback, useState } from 'react';
import { api, ApiError } from '../api.ts';
import { useAuth } from '../auth.tsx';
import { useErrorText, useI18n } from '../i18n.tsx';
import { usePoll, useSeen } from '../live.tsx';
import {
  Button,
  Card,
  Empty,
  Field,
  LoadingScreen,
  Modal,
  StatusBadge,
  useFormatDate,
  useToast,
} from '../components/ui.tsx';
import type { Balance, Redemption, Reward } from '../types.ts';

export function KidShop() {
  const { t, pick, lang } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const errorText = useErrorText();
  const formatDate = useFormatDate();
  // The answers to reward requests are listed on this screen, so the tab badge
  // has done its job once the kid is here.
  useSeen('reward');

  const [balance, setBalance] = useState<Balance | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [mine, setMine] = useState<Redemption[]>([]);
  const [chosen, setChosen] = useState<Reward | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const kidId = user!.id;

  const load = useCallback(async () => {
    try {
      const [b, r, m] = await Promise.all([api.balance(kidId), api.rewards(), api.redemptions()]);
      setBalance(b);
      setRewards(r.rewards);
      setMine(m.redemptions);
    } finally {
      setLoading(false);
    }
  }, [kidId]);

  usePoll(load);

  const request = async () => {
    if (!chosen) return;
    setBusy(true);
    try {
      await api.requestReward(chosen.id, note.trim());
      setChosen(null);
      setNote('');
      toast.show(t('rewardRequested'), 'good');
      await load();
    } catch (err) {
      toast.show(errorText(err instanceof ApiError ? err.code : 'server_error'), 'bad');
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (id: number) => {
    try {
      await api.cancelRedemption(id);
      toast.show(t('withdrawn'));
      await load();
    } catch (err) {
      toast.show(errorText(err instanceof ApiError ? err.code : 'server_error'), 'bad');
    }
  };

  if (loading) return <LoadingScreen />;

  // Spendable points exclude anything already tied up in a pending request.
  const available = balance?.available ?? 0;

  return (
    <div className="page">
      <div className="hero">
        <div className="hero-label">{t('available')}</div>
        <div className="hero-value tnum">{available}</div>
        <div className="hero-sub">
          <span>{t('shopLead')}</span>
        </div>
      </div>

      <Card title={t('shopTitle')}>
        {rewards.length === 0 ? (
          <Empty icon="🎁" text={t('noRewards')} />
        ) : (
          <div className="tile-grid">
            {rewards.map((reward) => {
              const affordable = available >= reward.cost;
              return (
                <button
                  key={reward.id}
                  className="tile"
                  disabled={!affordable}
                  onClick={() => setChosen(reward)}
                  title={
                    affordable ? undefined : t('needMore', { n: reward.cost - available })
                  }
                >
                  {!affordable && (
                    <span className="tile-lock" aria-hidden>
                      🔒
                    </span>
                  )}
                  <span className="tile-icon" aria-hidden>
                    {reward.icon || '🎁'}
                  </span>
                  <span className="tile-title">{pick(reward)}</span>
                  <span className="tile-points is-cost tnum">
                    {reward.cost} {t('pointsShort')}
                  </span>
                  {!affordable && (
                    <span className="hint" style={{ fontSize: '0.7rem' }}>
                      {t('needMore', { n: reward.cost - available })}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <Card title={t('myWishes')}>
        {mine.length === 0 ? (
          <Empty icon="✨" text={t('noRequests')} />
        ) : (
          <div className="list">
            {mine.slice(0, 10).map((r) => (
              <div key={r.id} className="item">
                <span className="item-icon" aria-hidden>
                  {r.reward_icon || '🎁'}
                </span>
                <div className="grow">
                  <div className="item-title truncate">{r.reward_title}</div>
                  <div className="item-meta row" style={{ gap: 'var(--s2)' }}>
                    <StatusBadge status={r.status} />
                    <span>{formatDate(r.created_at)}</span>
                  </div>
                  {r.review_note && <div className="item-meta">💬 {r.review_note}</div>}
                </div>
                <span className={`item-amount tnum ${r.status === 'approved' ? 'is-minus' : ''}`}>
                  −{r.cost}
                </span>
                {r.status === 'pending' && (
                  <Button size="sm" variant="ghost" onClick={() => withdraw(r.id)}>
                    {t('withdraw')}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {chosen && (
        <Modal
          title={pick(chosen)}
          onClose={() => setChosen(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setChosen(null)}>
                {t('cancel')}
              </Button>
              <Button variant="primary" busy={busy} onClick={request}>
                {t('request')}
              </Button>
            </>
          }
        >
          <div className="center col" style={{ gap: 'var(--s2)', alignItems: 'center' }}>
            <div style={{ fontSize: '3.4rem' }} aria-hidden>
              {chosen.icon || '🎁'}
            </div>
            <div className="tile-points is-cost tnum" style={{ fontSize: '1.1rem' }}>
              {t('cost')} {chosen.cost} {t('points')}
            </div>
            {(lang === 'en' ? chosen.description_en : chosen.description_lv) && (
              <p className="muted center">
                {lang === 'en'
                  ? chosen.description_en || chosen.description_lv
                  : chosen.description_lv}
              </p>
            )}
            <p className="hint">
              {available} → {available - chosen.cost}
            </p>
          </div>
          <Field label={`${t('addNote')} (${t('optional')})`}>
            <textarea
              className="textarea"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 300))}
            />
          </Field>
        </Modal>
      )}
    </div>
  );
}
