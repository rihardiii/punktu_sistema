import { useCallback, useState } from 'react';
import { api, ApiError } from '../api.ts';
import { useErrorText, useI18n } from '../i18n.tsx';
import { usePoll, useLive } from '../live.tsx';
import {
  Avatar,
  Button,
  Card,
  Empty,
  Field,
  LoadingScreen,
  Modal,
  useFormatDate,
  useToast,
} from '../components/ui.tsx';
import type { Redemption, Submission } from '../types.ts';

type Pending =
  | { kind: 'deed'; row: Submission }
  | { kind: 'reward'; row: Redemption };

/**
 * The parent's main screen: everything waiting for a decision, deeds and reward
 * requests together, oldest first so nothing sits forgotten at the bottom.
 */
export function ParentQueue() {
  const { t } = useI18n();
  const toast = useToast();
  const errorText = useErrorText();
  const formatDate = useFormatDate();
  const { refresh } = useLive();

  const [items, setItems] = useState<Pending[] | null>(null);
  const [rejecting, setRejecting] = useState<Pending | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [subs, reds] = await Promise.all([
        api.submissions({ status: 'pending' }),
        api.redemptions({ status: 'pending' }),
      ]);
      const merged: Pending[] = [
        ...subs.submissions.map((row) => ({ kind: 'deed' as const, row })),
        ...reds.redemptions.map((row) => ({ kind: 'reward' as const, row })),
      ];
      merged.sort((a, b) => a.row.created_at.localeCompare(b.row.created_at));
      setItems(merged);
    } catch {
      setItems((current) => current ?? []);
    }
  }, []);

  // The queue is the screen most likely to be sitting open on a kitchen tablet
  // while a kid files something in the next room.
  usePoll(load);

  const decide = async (item: Pending, decision: 'approve' | 'reject', note = '') => {
    const key = `${item.kind}-${item.row.id}`;
    setBusyId(key);
    try {
      if (item.kind === 'deed') await api.reviewSubmission(item.row.id, decision, note);
      else await api.reviewRedemption(item.row.id, decision, note);
      toast.show(decision === 'approve' ? t('approvedToast') : t('rejectedToast'),
        decision === 'approve' ? 'good' : 'neutral');
      await load();
    } catch (err) {
      toast.show(errorText(err instanceof ApiError ? err.code : 'server_error'), 'bad');
      await load();
    } finally {
      // The tab badge counts exactly what this screen just changed, so it
      // should not lag a decision by up to a poll interval.
      refresh();
      setBusyId(null);
      setRejecting(null);
      setRejectNote('');
    }
  };

  if (items === null) return <LoadingScreen />;

  const deeds = items.filter((i) => i.kind === 'deed');
  const rewards = items.filter((i) => i.kind === 'reward');

  const renderItem = (item: Pending) => {
    const key = `${item.kind}-${item.row.id}`;
    const isDeed = item.kind === 'deed';
    const title = isDeed ? item.row.deed_title : item.row.reward_title;
    const icon = isDeed ? item.row.deed_icon : item.row.reward_icon;
    const amount = isDeed ? `+${item.row.points}` : `−${item.row.cost}`;

    return (
      <div key={key} className="item" style={{ flexWrap: 'wrap' }}>
        <Avatar emoji={item.row.kid_avatar} color={item.row.kid_color} size="md" />
        <div className="grow">
          <div className="item-title">
            {item.row.kid_name} · {icon || (isDeed ? '⭐' : '🎁')} {title}
          </div>
          <div className="item-meta">{formatDate(item.row.created_at)}</div>
          {item.row.note && <div className="item-meta">💬 {item.row.note}</div>}
        </div>
        <span className={`item-amount tnum ${isDeed ? 'is-plus' : 'is-minus'}`}>{amount}</span>
        <div className="row" style={{ gap: 'var(--s2)', width: '100%' }}>
          <Button
            variant="good"
            size="sm"
            className="grow"
            busy={busyId === key}
            onClick={() => decide(item, 'approve')}
          >
            ✓ {t('approve')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="grow"
            disabled={busyId === key}
            onClick={() => setRejecting(item)}
          >
            ✕ {t('reject')}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="page">
      <h1>{t('waitingForYou')}</h1>

      {items.length === 0 ? (
        <Card>
          <Empty icon="🎉" text={t('nothingToReview')} />
        </Card>
      ) : (
        <>
          {deeds.length > 0 && (
            <Card title={`${t('deedRequests')} (${deeds.length})`}>
              <div className="list">{deeds.map(renderItem)}</div>
            </Card>
          )}
          {rewards.length > 0 && (
            <Card title={`${t('rewardRequests')} (${rewards.length})`}>
              <div className="list">{rewards.map(renderItem)}</div>
            </Card>
          )}
        </>
      )}

      {rejecting && (
        <Modal
          title={t('rejectReason')}
          onClose={() => setRejecting(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setRejecting(null)}>
                {t('cancel')}
              </Button>
              <Button variant="bad" onClick={() => decide(rejecting, 'reject', rejectNote.trim())}>
                {t('reject')}
              </Button>
            </>
          }
        >
          <Field label={`${t('addNote')} (${t('optional')})`} hint={t('rejectReasonHint')}>
            <textarea
              className="textarea"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value.slice(0, 300))}
              autoFocus
            />
          </Field>
        </Modal>
      )}
    </div>
  );
}
