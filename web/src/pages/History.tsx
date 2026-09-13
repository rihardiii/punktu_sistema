import { useEffect, useState } from 'react';
import { api } from '../api.ts';
import { useAuth } from '../auth.tsx';
import { useI18n } from '../i18n.tsx';
import { Card, Empty, LoadingScreen, useFormatDate } from '../components/ui.tsx';
import type { LedgerEntry } from '../types.ts';

const REF_ICON: Record<LedgerEntry['ref_type'], string> = {
  submission: '⭐',
  redemption: '🎁',
  adjustment: '✏️',
};

/** The full point ledger for one kid — every plus and minus, with its reason. */
export function History({ kidId: kidIdProp }: { kidId?: number }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const formatDate = useFormatDate();
  const kidId = kidIdProp ?? user!.id;

  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);

  useEffect(() => {
    api
      .ledger(kidId)
      .then((data) => setEntries(data.entries))
      .catch(() => setEntries([]));
  }, [kidId]);

  if (entries === null) return <LoadingScreen />;

  const earned = entries.filter((e) => e.delta > 0).reduce((sum, e) => sum + e.delta, 0);
  const spent = entries.filter((e) => e.delta < 0).reduce((sum, e) => sum - e.delta, 0);

  return (
    <div className="page">
      <h1>{t('historyTitle')}</h1>

      <div className="stats">
        <div className="stat">
          <div className="stat-value tnum" style={{ color: 'var(--good)' }}>
            {earned > 0 ? `+${earned}` : '0'}
          </div>
          <div className="stat-label">{t('earned')}</div>
        </div>
        <div className="stat">
          <div className="stat-value tnum" style={{ color: 'var(--bad)' }}>
            {spent > 0 ? `−${spent}` : '0'}
          </div>
          <div className="stat-label">{t('spent')}</div>
        </div>
        <div className="stat">
          <div className="stat-value tnum">{earned - spent}</div>
          <div className="stat-label">{t('myPoints')}</div>
        </div>
      </div>

      <Card>
        {entries.length === 0 ? (
          <Empty icon="📖" text={t('noHistory')} />
        ) : (
          <div className="list">
            {entries.map((entry) => (
              <div key={entry.id} className="item">
                <span className="item-icon" aria-hidden>
                  {REF_ICON[entry.ref_type]}
                </span>
                <div className="grow">
                  <div className="item-title truncate">
                    {entry.reason || t(entry.ref_type === 'adjustment' ? 'adjustment' : 'points')}
                  </div>
                  <div className="item-meta">
                    {formatDate(entry.created_at)}
                    {entry.created_by_name && ` · ${t('by')} ${entry.created_by_name}`}
                  </div>
                </div>
                <span className={`item-amount tnum ${entry.delta > 0 ? 'is-plus' : 'is-minus'}`}>
                  {entry.delta > 0 ? '+' : '−'}
                  {Math.abs(entry.delta)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
