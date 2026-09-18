import { useCallback, useState } from 'react';
import { api, ApiError } from '../api.ts';
import { useAuth } from '../auth.tsx';
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
  Segmented,
  useToast,
} from '../components/ui.tsx';
import { EmojiPicker } from '../components/EmojiPicker.tsx';
import { ACCENTS } from '../theme.tsx';
import type { PinRequest, Role, User } from '../types.ts';

interface MemberDraft {
  id: number;
  name: string;
  username: string;
  pin: string;
  role: Role;
  avatar: string;
  color: string;
}

const blankDraft: MemberDraft = {
  id: 0,
  name: '',
  username: '',
  pin: '',
  role: 'kid',
  avatar: '🧒',
  color: ACCENTS[0],
};

export function ParentFamily() {
  const { t } = useI18n();
  const { user: me, refresh } = useAuth();
  const toast = useToast();
  const errorText = useErrorText();

  const [users, setUsers] = useState<User[] | null>(null);
  const [requests, setRequests] = useState<PinRequest[]>([]);
  const [draft, setDraft] = useState<MemberDraft | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const [newPin, setNewPin] = useState('');
  const [deleting, setDeleting] = useState<User | null>(null);
  const [promoting, setPromoting] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [{ users: list }, { requests: open }] = await Promise.all([
        api.users(),
        api.pinRequests(),
      ]);
      setUsers(list);
      setRequests(open);
    } catch {
      setUsers((current) => current ?? []);
    }
  }, []);

  // A forgotten PIN filed from the login screen shows up here on its own —
  // which matters, because the person waiting cannot get in to chase it.
  usePoll(load);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setError('');
    try {
      if (draft.id) {
        await api.updateUser(draft.id, {
          name: draft.name.trim(),
          avatar: draft.avatar,
          color: draft.color,
        });
        toast.show(t('memberUpdated'), 'good');
      } else {
        await api.createUser({
          name: draft.name.trim(),
          username: draft.username.trim().toLowerCase(),
          pin: draft.pin,
          role: draft.role,
          avatar: draft.avatar,
          color: draft.color,
        });
        toast.show(t('memberAdded'), 'good');
      }
      setDraft(null);
      await load();
    } catch (err) {
      setError(errorText(err instanceof ApiError ? err.code : 'server_error'));
    } finally {
      setBusy(false);
    }
  };

  const doResetPin = async () => {
    if (!resetting || newPin.length < 4) return;
    setBusy(true);
    setError('');
    try {
      await api.resetPin(resetting.id, newPin);
      toast.show(t('pinReset'), 'good');
      setResetting(null);
      setNewPin('');
      // The reset closes any open request from that person — reload so the
      // card above disappears without a manual refresh.
      await load();
    } catch (err) {
      setError(errorText(err instanceof ApiError ? err.code : 'server_error'));
    } finally {
      setBusy(false);
    }
  };

  const dismissRequest = async (request: PinRequest) => {
    try {
      await api.dismissPinRequest(request.id);
      toast.show(t('dismissed'));
      await load();
    } catch (err) {
      toast.show(errorText(err instanceof ApiError ? err.code : 'server_error'), 'bad');
    }
  };

  const doPromote = async () => {
    if (!promoting) return;
    setBusy(true);
    try {
      await api.makeAdmin(promoting.id);
      toast.show(t('adminTransferred'), 'good');
      setPromoting(null);
      // Our own is_admin just changed, so the session user must be refetched
      // or this screen would keep offering admin-only buttons.
      await Promise.all([load(), refresh()]);
    } catch (err) {
      toast.show(errorText(err instanceof ApiError ? err.code : 'server_error'), 'bad');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (member: User) => {
    try {
      await api.updateUser(member.id, { active: !member.active });
      await load();
    } catch (err) {
      toast.show(errorText(err instanceof ApiError ? err.code : 'server_error'), 'bad');
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.deleteUser(deleting.id);
      setDeleting(null);
      await load();
    } catch (err) {
      toast.show(errorText(err instanceof ApiError ? err.code : 'server_error'), 'bad');
    } finally {
      setBusy(false);
    }
  };

  if (users === null) return <LoadingScreen />;

  const isNew = draft?.id === 0;

  return (
    <div className="page">
      <h1>{t('familyTitle')}</h1>

      {/* Someone has tapped "forgot my PIN" on the login screen. Only shown
          when there is something to act on, so it never becomes furniture. */}
      {requests.length > 0 && (
        <Card title={`🔑 ${t('pinRequestsTitle')}`}>
          <div className="list">
            {requests.map((request) => {
              const target = users.find((candidate) => candidate.id === request.user_id);
              return (
                <div key={request.id} className="item" style={{ flexWrap: 'wrap', rowGap: 'var(--s2)' }}>
                  <Avatar emoji={request.avatar} color={request.color} size="md" />
                  <div className="grow">
                    <div className="item-title">{request.name}</div>
                    <div className="item-meta">
                      @{request.username} · {t('pinRequestFrom')}
                    </div>
                  </div>
                  {/* Full width so the buttons take their own line instead of
                      squeezing the name into a column two words wide. */}
                  <div className="row wrap" style={{ gap: 'var(--s2)', width: '100%' }}>
                    <Button
                      size="sm"
                      variant="primary"
                      className="grow"
                      disabled={!target}
                      onClick={() => {
                        if (!target) return;
                        setResetting(target);
                        setNewPin('');
                        setError('');
                      }}
                    >
                      🔑 {t('resetPin')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => dismissRequest(request)}>
                      {t('dismiss')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="row" style={{ gap: 'var(--s2)' }}>
        <Button
          variant="primary"
          className="grow"
          onClick={() => setDraft({ ...blankDraft, role: 'kid', avatar: '🧒' })}
        >
          ＋ {t('addKid')}
        </Button>
        <Button
          variant="ghost"
          className="grow"
          onClick={() => setDraft({ ...blankDraft, role: 'parent', avatar: '👤' })}
        >
          ＋ {t('addParent')}
        </Button>
      </div>

      <Card>
        {users.length === 0 ? (
          <Empty icon="👨‍👩‍👧" text={t('noUsers')} />
        ) : (
          <div className="list">
            {users.map((member) => (
              <div
                key={member.id}
                className="item"
                style={{ flexWrap: 'wrap', opacity: member.active ? 1 : 0.55 }}
              >
                <Avatar emoji={member.avatar} color={member.color} size="md" />
                <div className="grow">
                  <div className="item-title">
                    {member.name}
                    {member.id === me?.id && ' ·  ⟵'}
                  </div>
                  <div className="item-meta">
                    @{member.username} · {member.role === 'parent' ? t('parent') : t('kid')}
                    {!member.active && ` · ${t('inactive')}`}
                  </div>
                  {member.is_admin && (
                    <span className="badge badge-admin" style={{ marginTop: 4 }}>
                      {t('adminBadge')}
                    </span>
                  )}
                </div>
                {member.role === 'kid' && (
                  <div className="center">
                    <div className="stat-value tnum">{member.balance ?? 0}</div>
                    <div className="stat-label">{t('points')}</div>
                  </div>
                )}
                <div className="row wrap" style={{ gap: 'var(--s2)', width: '100%' }}>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="grow"
                    onClick={() =>
                      setDraft({
                        id: member.id,
                        name: member.name,
                        username: member.username,
                        pin: '',
                        role: member.role,
                        avatar: member.avatar,
                        color: member.color,
                      })
                    }
                  >
                    ✏️ {t('edit')}
                  </Button>
                  {/* A plain parent may reset only kids' PINs and their own —
                      resetting another parent's would be a takeover. The admin
                      exists precisely to be the exception. */}
                  {(member.role === 'kid' || member.id === me?.id || me?.is_admin) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="grow"
                      onClick={() => {
                        setResetting(member);
                        setNewPin('');
                        setError('');
                      }}
                    >
                      🔑 {t('resetPin')}
                    </Button>
                  )}
                  {me?.is_admin && member.role === 'parent' && member.active && !member.is_admin && (
                    <Button size="sm" variant="ghost" onClick={() => setPromoting(member)}>
                      🛡️
                    </Button>
                  )}
                  {member.id !== me?.id && !member.is_admin && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(member)}>
                        {member.active ? '🚫' : '✓'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(member)}>
                        🗑️
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {draft && (
        <Modal
          title={isNew ? t('addMember') : t('edit')}
          onClose={() => setDraft(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDraft(null)}>
                {t('cancel')}
              </Button>
              <Button
                variant="primary"
                busy={busy}
                disabled={
                  !draft.name.trim() ||
                  (isNew && (draft.username.trim().length < 2 || draft.pin.length < 4))
                }
                onClick={save}
              >
                {t('save')}
              </Button>
            </>
          }
        >
          <Field label={t('yourName')}>
            <input
              className="input"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value.slice(0, 60) })}
              autoFocus
            />
          </Field>

          {isNew && (
            <>
              <Field label={t('role')} composite>
                <Segmented<Role>
                  value={draft.role}
                  onChange={(role) =>
                    setDraft({ ...draft, role, avatar: role === 'parent' ? '👤' : '🧒' })
                  }
                  options={[
                    { value: 'kid', label: `🧒 ${t('kid')}` },
                    { value: 'parent', label: `👤 ${t('parent')}` },
                  ]}
                />
              </Field>

              <Field label={t('username')} hint={t('usernameHint')}>
                <input
                  className="input"
                  value={draft.username}
                  onChange={(e) =>
                    setDraft({ ...draft, username: e.target.value.toLowerCase().slice(0, 32) })
                  }
                  autoComplete="off"
                />
              </Field>

              <Field label={t('pin')} hint={t('pinHint')}>
                <input
                  className="input tnum"
                  value={draft.pin}
                  onChange={(e) =>
                    setDraft({ ...draft, pin: e.target.value.replace(/\D/g, '').slice(0, 10) })
                  }
                  inputMode="numeric"
                  autoComplete="off"
                />
              </Field>
            </>
          )}

          <Field label={t('color')} composite>
            <div className="swatches">
              {ACCENTS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  className={`swatch ${draft.color === hex ? 'is-active' : ''}`}
                  style={{ background: hex }}
                  onClick={() => setDraft({ ...draft, color: hex })}
                  aria-label={hex}
                />
              ))}
            </div>
          </Field>

          <Field label={t('avatar')} error={error || undefined} composite>
            <EmojiPicker
              value={draft.avatar}
              allowEmpty={false}
              onChange={(avatar) => setDraft({ ...draft, avatar })}
            />
          </Field>
        </Modal>
      )}

      {resetting && (
        <Modal
          title={`${t('resetPin')} · ${resetting.name}`}
          onClose={() => setResetting(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setResetting(null)}>
                {t('cancel')}
              </Button>
              <Button variant="primary" busy={busy} disabled={newPin.length < 4} onClick={doResetPin}>
                {t('save')}
              </Button>
            </>
          }
        >
          <p className="muted">{t('resetPinLead', { name: resetting.name })}</p>
          <Field label={t('newPin')} hint={t('pinHint')} error={error || undefined}>
            <input
              className="input tnum"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 10))}
              inputMode="numeric"
              autoComplete="off"
              autoFocus
            />
          </Field>
        </Modal>
      )}

      {promoting && (
        <Modal
          title={t('makeAdmin')}
          onClose={() => setPromoting(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setPromoting(null)}>
                {t('cancel')}
              </Button>
              <Button variant="primary" busy={busy} onClick={doPromote}>
                {t('confirm')}
              </Button>
            </>
          }
        >
          <p className="muted">{t('makeAdminWarn', { name: promoting.name })}</p>
        </Modal>
      )}

      {deleting && (
        <Modal
          title={t('deleteMember')}
          onClose={() => setDeleting(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleting(null)}>
                {t('cancel')}
              </Button>
              <Button variant="bad" busy={busy} onClick={doDelete}>
                {t('delete')}
              </Button>
            </>
          }
        >
          <p className="muted">{t('deleteMemberWarn', { name: deleting.name })}</p>
        </Modal>
      )}
    </div>
  );
}
