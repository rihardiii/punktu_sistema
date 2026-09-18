import { useCallback, useState } from 'react';
import { api, ApiError } from '../api.ts';
import { useErrorText, useI18n } from '../i18n.tsx';
import { usePoll } from '../live.tsx';
import { fromClock, toClock, windowsLabel } from '../time.ts';
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
import type { Deed, Reward, TimeWindow } from '../types.ts';

type Tab = 'deeds' | 'rewards';

/** A time window while it is being edited: "07:00" text, as a time input gives it. */
interface DraftWindow {
  start: string;
  end: string;
}

const MAX_WINDOWS = 4;

/**
 * Blank row used when adding, so the same form handles create and edit.
 * `value` is the raw text of the points/cost box, not a number: a number would
 * have to be clamped on every keystroke, which makes the box impossible to
 * clear — you would have to type the new figure around the old one. The same
 * goes for `max_per_day`.
 */
const emptyDraft = {
  id: 0,
  title_lv: '',
  title_en: '',
  icon: '',
  value: '10',
  category: '',
  description_lv: '',
  description_en: '',
  active: true,
  max_per_day: '0',
  windows: [] as DraftWindow[],
};

type Draft = typeof emptyDraft;

/** The typed points/cost, or 0 while the box is empty or half-typed. */
const draftValue = (draft: Draft) => Number(draft.value) || 0;

/**
 * The row "＋ Pievienot laiku" adds. The first is the morning most of these
 * chores belong to; a later one starts clear of everything already set, so
 * adding a second window does not greet the parent with an overlap error it
 * created itself. With no room left before midnight the row comes up blank.
 */
function nextWindow(existing: DraftWindow[]): DraftWindow {
  const ends = existing.map((row) => fromClock(row.end)).filter((m): m is number => m !== null);
  if (ends.length === 0) return { start: '07:00', end: '10:00' };

  const start = Math.max(...ends) + 30;
  if (start + 30 > 1439) return { start: '', end: '' };
  return { start: toClock(start), end: toClock(Math.min(start + 120, 1439)) };
}

/** The windows in minutes, sorted — the shape the server stores. */
function toWindows(rows: DraftWindow[]): TimeWindow[] {
  return rows
    .map((row) => ({ start_min: fromClock(row.start), end_min: fromClock(row.end) }))
    .filter((w): w is TimeWindow => w.start_min !== null && w.end_min !== null)
    .sort((a, b) => a.start_min - b.start_min);
}

/** The rule in one line for the catalog list: "🕒 07:00–10:00 · 2×". */
function ruleSummary(row: Deed): string {
  const parts: string[] = [];
  if (row.windows.length > 0) parts.push(`🕒 ${windowsLabel(row.windows)}`);
  if (row.max_per_day > 0) parts.push(`${row.max_per_day}×`);
  return parts.join(' · ');
}

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
    try {
      const [d, r] = await Promise.all([api.deeds(true), api.rewards(true)]);
      setDeeds(d.deeds);
      setRewards(r.rewards);
    } catch {
      setDeeds((current) => current ?? []);
      setRewards((current) => current ?? []);
    }
  }, []);

  usePoll(load);

  /*
   * Half-typed and contradictory windows are caught here rather than by the
   * server, because "invalid value" in a toast tells a parent nothing about
   * which of the four rows they got wrong.
   */
  const windowProblem = (rows: DraftWindow[]): string => {
    const parsed = rows.map((row) => ({ s: fromClock(row.start), e: fromClock(row.end) }));
    if (parsed.some((w) => w.s === null || w.e === null)) return t('windowIncomplete');

    const sorted = parsed
      .map((w) => ({ s: w.s!, e: w.e! }))
      .sort((a, b) => a.s - b.s);
    if (sorted.some((w) => w.e <= w.s)) return t('windowBackwards');
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]!.s <= sorted[i - 1]!.e) return t('windowOverlap');
    }
    return '';
  };

  const canSave = (d: Draft): boolean =>
    !!d.title_lv.trim() &&
    draftValue(d) >= 1 &&
    (tab !== 'deeds' || windowProblem(d.windows) === '');

  const patchWindow = (index: number, patch: Partial<DraftWindow>) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            windows: current.windows.map((w, i) => (i === index ? { ...w, ...patch } : w)),
          }
        : current,
    );

  const save = async () => {
    if (!draft || !canSave(draft)) return;
    setBusy(true);
    try {
      if (tab === 'deeds') {
        const body = {
          title_lv: draft.title_lv.trim(),
          title_en: draft.title_en.trim(),
          icon: draft.icon,
          points: draftValue(draft),
          category: draft.category.trim(),
          active: draft.active,
          max_per_day: Number(draft.max_per_day) || 0,
          windows: toWindows(draft.windows),
        };
        if (draft.id) await api.updateDeed(draft.id, body);
        else await api.createDeed(body);
        toast.show(t('deedSaved'), 'good');
      } else {
        const body = {
          title_lv: draft.title_lv.trim(),
          title_en: draft.title_en.trim(),
          icon: draft.icon,
          cost: draftValue(draft),
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
      const next = item.active !== 1;
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
      {/*
        Not `row-between wrap`: "Labo darbu saraksts" is half again as long as
        "Good deeds", so on a phone in Latvian the toggle was pushed onto a
        ragged second line. It now takes a full-width row of its own until
        there is room for both, which reads deliberate in either language.
      */}
      <div className="page-head">
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
        onClick={() => setDraft({ ...emptyDraft, value: tab === 'deeds' ? '10' : '50' })}
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
                  {'windows' in row && ruleSummary(row) && (
                    <div className="item-meta">{ruleSummary(row)}</div>
                  )}
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
                        value: String(valueOf(row)),
                        category: 'category' in row ? row.category : '',
                        description_lv: 'description_lv' in row ? row.description_lv : '',
                        description_en: 'description_en' in row ? row.description_en : '',
                        active: row.active === 1,
                        max_per_day: 'max_per_day' in row ? String(row.max_per_day) : '0',
                        windows:
                          'windows' in row
                            ? row.windows.map((w) => ({
                                start: toClock(w.start_min),
                                end: toClock(w.end_min),
                              }))
                            : [],
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
              <Button variant="primary" busy={busy} disabled={!canSave(draft)} onClick={save}>
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

          {/*
            A text box rather than type="number": the box has to be allowed to
            stand empty mid-edit, so you can clear "1" and type "5" instead of
            threading the new figure around the old one. Digits are filtered
            out on the way in, and Save stays disabled until there is a number.
          */}
          <Field label={tab === 'deeds' ? t('pointValue') : t('costValue')}>
            <input
              className="input tnum"
              type="text"
              value={draft.value}
              onChange={(e) =>
                setDraft({ ...draft, value: e.target.value.replace(/\D/g, '').slice(0, 7) })
              }
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
            />
          </Field>

          {tab === 'deeds' ? (
            <>
              <Field label={`${t('category')} (${t('optional')})`}>
                <input
                  className="input"
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value.slice(0, 40) })}
                />
              </Field>

              <Field label={t('timesPerDay')} hint={t('timesPerDayHint')}>
                <input
                  className="input tnum"
                  type="text"
                  value={draft.max_per_day}
                  onChange={(e) =>
                    setDraft({ ...draft, max_per_day: e.target.value.replace(/\D/g, '').slice(0, 2) })
                  }
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                />
              </Field>

              {/*
                Several windows rather than one from/to pair, because the chore
                that asked for this — teeth — happens morning *and* evening,
                which a single range cannot say.
              */}
              <Field
                label={t('timeWindows')}
                hint={draft.windows.length === 0 ? t('anyTimeHint') : t('timeWindowsHint')}
                error={windowProblem(draft.windows) || undefined}
                composite
              >
                {draft.windows.map((window, index) => (
                  <div className="row" key={index} style={{ gap: 'var(--s2)' }}>
                    <input
                      className="input tnum"
                      type="time"
                      value={window.start}
                      aria-label={t('fromTime')}
                      onChange={(e) => patchWindow(index, { start: e.target.value })}
                    />
                    <span aria-hidden>–</span>
                    <input
                      className="input tnum"
                      type="time"
                      value={window.end}
                      aria-label={t('toTime')}
                      onChange={(e) => patchWindow(index, { end: e.target.value })}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t('delete')}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          windows: draft.windows.filter((_, i) => i !== index),
                        })
                      }
                    >
                      🗑️
                    </Button>
                  </div>
                ))}
                {draft.windows.length < MAX_WINDOWS && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setDraft({ ...draft, windows: [...draft.windows, nextWindow(draft.windows)] })
                    }
                  >
                    ＋ {t('addWindow')}
                  </Button>
                )}
              </Field>
            </>
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
