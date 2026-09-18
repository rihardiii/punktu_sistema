import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api.ts';
import { useAuth } from '../auth.tsx';
import { useErrorText, useI18n } from '../i18n.tsx';
import { usePoll, useSeen } from '../live.tsx';
import { windowsLabel } from '../time.ts';
import {
  Button,
  Card,
  Confetti,
  Empty,
  Field,
  LoadingScreen,
  Modal,
  StatusBadge,
  useFormatDate,
  useToast,
} from '../components/ui.tsx';
import type { Balance, Deed, Submission } from '../types.ts';

export function KidHome() {
  const { t, pick } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const errorText = useErrorText();
  const formatDate = useFormatDate();
  // This is the screen that shows what a parent decided about a deed, so being
  // here is what "seen" means — the badge on the tab clears.
  useSeen('deed');

  const [balance, setBalance] = useState<Balance | null>(null);
  const [deeds, setDeeds] = useState<Deed[]>([]);
  const [mine, setMine] = useState<Submission[]>([]);
  const [chosen, setChosen] = useState<Deed | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [loading, setLoading] = useState(true);

  const kidId = user!.id;

  const load = useCallback(async () => {
    try {
      const [b, d, s] = await Promise.all([api.balance(kidId), api.deeds(), api.submissions()]);
      setBalance(b);
      setDeeds(d.deeds);
      setMine(s.submissions);
    } finally {
      setLoading(false);
    }
  }, [kidId]);

  // Polled, so a parent's decision — and a deed's time window opening — reach
  // the kid's screen on their own.
  usePoll(load);

  // A previously-pending deed that is now approved means a parent said yes
  // while the kid was looking at the screen — worth a celebration.
  const [seenApproved, setSeenApproved] = useState<number | null>(null);
  useEffect(() => {
    const latestApproved = mine.find((s) => s.status === 'approved');
    if (!latestApproved) return;
    if (seenApproved === null) {
      setSeenApproved(latestApproved.id);
    } else if (latestApproved.id !== seenApproved) {
      setSeenApproved(latestApproved.id);
      setCelebrate(true);
    }
  }, [mine, seenApproved]);

  const submit = async () => {
    if (!chosen) return;
    setBusy(true);
    try {
      await api.submitDeed(chosen.id, note.trim());
      setChosen(null);
      setNote('');
      toast.show(t('deedSubmitted'), 'good');
      await load();
    } catch (err) {
      toast.show(errorText(err instanceof ApiError ? err.code : 'server_error'), 'bad');
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (id: number) => {
    try {
      await api.cancelSubmission(id);
      toast.show(t('withdrawn'));
      await load();
    } catch (err) {
      toast.show(errorText(err instanceof ApiError ? err.code : 'server_error'), 'bad');
    }
  };

  if (loading) return <LoadingScreen />;

  const recent = mine.slice(0, 8);

  /** The small line under a tile: when the deed is open, and how many are left. */
  const ruleNote = (deed: Deed): string => {
    if (deed.locked === 'limit') return `✅ ${t('doneForToday')}`;
    const parts: string[] = [];
    if (deed.windows.length > 0) parts.push(`🕒 ${windowsLabel(deed.windows)}`);
    if (deed.max_per_day > 0) parts.push(`${deed.done_today}/${deed.max_per_day} ${t('todayShort')}`);
    return parts.join(' · ');
  };

  /** Spelled out in full for anyone who hovers or holds the tile. */
  const lockHint = (deed: Deed): string | undefined => {
    if (deed.locked === 'limit') return t('doneForToday');
    if (deed.locked === 'window') return t('availableAt', { times: windowsLabel(deed.windows) });
    return undefined;
  };

  return (
    <div className="page">
      {celebrate && <Confetti onDone={() => setCelebrate(false)} />}

      <div className="hero">
        <div className="hero-label">{t('myPoints')}</div>
        <div className="hero-value tnum">{balance?.balance ?? 0}</div>
        <div className="hero-sub">
          {!!balance?.pending && (
            <span>
              ⏳ +{balance.pending} {t('pendingPoints')}
            </span>
          )}
          {!!balance?.reserved && (
            <span>
              🔒 {balance.reserved} {t('reservedPoints')}
            </span>
          )}
        </div>
      </div>

      <Card title={t('whatDidYouDo')}>
        <p className="hint" style={{ marginBottom: 'var(--s3)' }}>
          {t('pickDeed')}
        </p>
        {deeds.length === 0 ? (
          <Empty icon="📭" text={t('noRequests')} />
        ) : (
          <div className="tile-grid">
            {deeds.map((deed) => (
              <button
                key={deed.id}
                className="tile"
                disabled={deed.locked !== ''}
                onClick={() => setChosen(deed)}
                title={lockHint(deed)}
              >
                {deed.locked !== '' && (
                  <span className="tile-lock" aria-hidden>
                    {deed.locked === 'limit' ? '✅' : '🕒'}
                  </span>
                )}
                <span className="tile-icon" aria-hidden>
                  {deed.icon || '⭐'}
                </span>
                <span className="tile-title">{pick(deed)}</span>
                {/*
                  A locked tile has to say why, or it just looks broken. An open
                  one still shows its rule, so the limit is never a surprise the
                  first time it bites.
                */}
                {ruleNote(deed) && <span className="tile-note">{ruleNote(deed)}</span>}
                <span className="tile-points tnum">
                  +{deed.points} {t('pointsShort')}
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card title={t('myRequests')}>
        {recent.length === 0 ? (
          <Empty icon="🌱" text={t('noRequests')} />
        ) : (
          <div className="list">
            {recent.map((s) => (
              <div key={s.id} className="item">
                <span className="item-icon" aria-hidden>
                  {s.deed_icon || '⭐'}
                </span>
                <div className="grow">
                  <div className="item-title truncate">{s.deed_title}</div>
                  <div className="item-meta row" style={{ gap: 'var(--s2)' }}>
                    <StatusBadge status={s.status} />
                    <span>{formatDate(s.created_at)}</span>
                  </div>
                  {s.review_note && <div className="item-meta">💬 {s.review_note}</div>}
                </div>
                <span className={`item-amount tnum ${s.status === 'approved' ? 'is-plus' : ''}`}>
                  +{s.points}
                </span>
                {s.status === 'pending' && (
                  <Button size="sm" variant="ghost" onClick={() => withdraw(s.id)}>
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
              <Button variant="primary" busy={busy} onClick={submit}>
                {t('submitDeed')}
              </Button>
            </>
          }
        >
          <div className="center col" style={{ gap: 'var(--s2)', alignItems: 'center' }}>
            <div style={{ fontSize: '3.4rem' }} aria-hidden>
              {chosen.icon || '⭐'}
            </div>
            <div className="tile-points tnum" style={{ fontSize: '1.1rem' }}>
              +{chosen.points} {t('points')}
            </div>
          </div>
          <Field label={`${t('addNote')} (${t('optional')})`}>
            <textarea
              className="textarea"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 300))}
              placeholder={t('notePlaceholder')}
            />
          </Field>
        </Modal>
      )}
    </div>
  );
}
