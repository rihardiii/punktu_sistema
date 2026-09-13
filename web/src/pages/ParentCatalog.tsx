import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api.ts';
import { useErrorText, useI18n } from '../i18n.tsx';
import {
  Button,
  Card,
  Empty,
  Field,
  LoadingScreen,
  Modal,
  Segmented,
  useToast,
} from '../components/ui.tsx';
import { EmojiPicker } from '../components/EmojiPicker.tsx';
import type { Deed, Reward } from '../types.ts';

type Tab = 'deeds' | 'rewards';

/** Blank row used when adding, so the same form handles create and edit. */
const emptyDraft = {
  id: 0,
  title_lv: '',
  title_en: '',
  icon: '',
  value: 10,
  category: '',
  description_lv: '',
  description_en: '',
  active: 1,
};

type Draft = typeof emptyDraft;

export function ParentCatalog() {
  const { t, pick } = useI18n();
  const toast = useToast();
  const errorText = useErrorText();

  const [tab, setTab] = useState<Tab>('deeds');
  const [deeds, setDeeds] = useState<Deed[] | null>(null);
  const [rewards, setRewards] = useState<Reward[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [d, r] = await Promise.all([api.deeds(true), api.rewards(true)]);
    setDeeds(d.deeds);
    setRewards(r.rewards);
  }, []);

  useEffect(() => {
    void load().catch(() => {
      setDeeds([]);
      setRewards([]);
    });
  }, [load]);

  const save = async () => {
    if (!draft || !draft.title_lv.trim()) return;
    setBusy(true);
    try {
      if (tab === 'deeds') {
        const body = {
          title_lv: draft.title_lv.trim(),
          title_en: draft.title_en.trim(),
          icon: draft.icon,
          points: draft.value,
          category: draft.category.trim(),
          active: draft.active,
        };
        if (draft.id) await api.updateDeed(draft.id, body);
        else await api.createDeed(body);
        toast.show(t('deedSaved'), 'good');
      } else {
        const body = {
          title_lv: draft.title_lv.trim(),
          title_en: draft.title_en.trim(),
          icon: draft.icon,
          cost: draft.value,
          description_lv: draft.description_lv.trim(),
          description_en: draft.description_en.trim(),
          active: draft.active,
        };
        if (draft.id) await api.updateReward(draft.id, body);
        else await api.createReward(body);
        toast.show(t('rewardSaved'), 'good');
      }
      setDraft(null);
      await load();
    } catch (err) {
      toast.show(errorText(err instanceof ApiError ? err.code : 'server_error'), 'bad');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete?.id) return;
    setBusy(true);
    try {
      if (tab === 'deeds') await api.deleteDeed(confirmDelete.id);
      else await api.deleteReward(confirmDelete.id);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      toast.show(errorText(err instanceof ApiError ? err.code : 'server_error'), 'bad');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (item: Deed | Reward) => {
    try {
      const next = item.active === 1 ? 0 : 1;
      if (tab === 'deeds') await api.updateDeed(item.id, { active: next });
      else await api.updateReward(item.id, { active: next });
      await load();
    } catch (err) {
      toast.show(errorText(err instanceof ApiError ? err.code : 'server_error'), 'bad');
    }
  };

  if (deeds === null || rewards === null) return <LoadingScreen />;

  const rows: Array<Deed | Reward> = tab === 'deeds' ? deeds : rewards;
  const valueOf = (row: Deed | Reward) => ('points' in row ? row.points : row.cost);

  return (
    <div className="page">
      <div className="row-between wrap">
        <h1>{tab === 'deeds' ? t('manageDeeds') : t('manageRewards')}</h1>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'deeds', label: `⭐ ${t('navDeeds')}` },
            { value: 'rewards', label: `🎁 ${t('navShop')}` },
          ]}
        />
      </div>

      <Button
        variant="primary"
        block
        onClick={() =>
          setDraft({ ...emptyDraft, value: tab === 'deeds' ? 10 : 50 })
        }
      >
        ＋ {tab === 'deeds' ? t('newDeed') : t('newReward')}
      </Button>

      <Card>
        {rows.length === 0 ? (
          <Empty icon={tab === 'deeds' ? '⭐' : '🎁'} text={t('noRewards')} />
        ) : (
          <div className="list">
            {rows.map((row) => (
              <div
                key={row.id}
                className="item"
                style={{ flexWrap: 'wrap', opacity: row.active ? 1 : 0.55 }}
              >
                <span className="item-icon" aria-hidden>
                  {row.icon || (tab === 'deeds' ? '⭐' : '🎁')}
                </span>
                <div className="grow">
                  <div className="item-title truncate">{pick(row)}</div>
                  <div className="item-meta">
                    {'category' in row && row.category ? `${row.category} · ` : ''}
                    {row.active ? t('active') : t('inactive')}
                  </div>
                </div>
                <span className="item-amount tnum">
                  {tab === 'deeds' ? '+' : ''}
                  {valueOf(row)}
                </span>
                <div className="row" style={{ gap: 'var(--s2)', width: '100%' }}>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="grow"
                    onClick={() =>
                      setDraft({
                        id: row.id,
                        title_lv: row.title_lv,
                        title_en: row.title_en,
                        icon: row.icon,
                        value: valueOf(row),
                        category: 'category' in row ? row.category : '',
                        description_lv: 'description_lv' in row ? row.description_lv : '',
                        description_en: 'description_en' in row ? row.description_en : '',
                        active: row.active,
                      })
                    }
                  >
                    ✏️ {t('edit')}
                  </Button>
                  <Button size="sm" variant="ghost" className="grow" onClick={() => toggleActive(row)}>
                    {row.active ? `🚫 ${t('deactivate')}` : `✓ ${t('activate')}`}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setConfirmDelete({ ...emptyDraft, id: row.id, title_lv: pick(row) })
                    }
                  >
                    🗑️
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {draft && (
        <Modal
          title={
            draft.id
              ? tab === 'deeds'
                ? t('editDeed')
                : t('editReward')
              : tab === 'deeds'
                ? t('newDeed')
                : t('newReward')
          }
          onClose={() => setDraft(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDraft(null)}>
                {t('cancel')}
              </Button>
              <Button
                variant="primary"
                busy={busy}
                disabled={!draft.title_lv.trim() || draft.value < 1}
                onClick={save}
              >
                {t('save')}
              </Button>
            </>
          }
        >
          <Field label={t('titleLv')}>
            <input
              className="input"
              value={draft.title_lv}
              onChange={(e) => setDraft({ ...draft, title_lv: e.target.value.slice(0, 80) })}
              autoFocus
            />
          </Field>

          <Field label={`${t('titleEn')} (${t('optional')})`}>
            <input
              className="input"
              value={draft.title_en}
              onChange={(e) => setDraft({ ...draft, title_en: e.target.value.slice(0, 80) })}
            />
          </Field>

          <Field label={tab === 'deeds' ? t('pointValue') : t('costValue')}>
            <input
              className="input tnum"
              type="number"
              min={1}
              value={draft.value}
              onChange={(e) => setDraft({ ...draft, value: Math.max(1, Number(e.target.value) || 1) })}
              inputMode="numeric"
            />
          </Field>

          {tab === 'deeds' ? (
            <Field label={`${t('category')} (${t('optional')})`}>
              <input
                className="input"
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value.slice(0, 40) })}
              />
            </Field>
          ) : (
            <Field label={`${t('description')} (${t('optional')})`}>
              <textarea
                className="textarea"
                value={draft.description_lv}
                onChange={(e) => setDraft({ ...draft, description_lv: e.target.value.slice(0, 300) })}
              />
            </Field>
          )}

          <Field label={t('icon')} hint={t('iconHint')} composite>
            <EmojiPicker value={draft.icon} onChange={(icon) => setDraft({ ...draft, icon })} />
          </Field>
        </Modal>
      )}

      {confirmDelete && (
        <Modal
          title={`${t('delete')}: ${confirmDelete.title_lv}`}
          onClose={() => setConfirmDelete(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
                {t('cancel')}
              </Button>
              <Button variant="bad" busy={busy} onClick={remove}>
                {t('delete')}
              </Button>
            </>
          }
        >
          <p className="muted">{tab === 'deeds' ? t('deleteDeedWarn') : t('deleteRewardWarn')}</p>
        </Modal>
      )}
    </div>
  );
}
