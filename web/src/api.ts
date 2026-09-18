import type {
  Balance,
  Deed,
  Face,
  LedgerEntry,
  Notifications,
  Overview,
  PinRequest,
  Redemption,
  Reward,
  Submission,
  User,
} from './types.ts';

/**
 * The body of a catalog write. A row carries `active` as the 0/1 SQLite stores,
 * but the server wants a real boolean on the way back in, so the patch type
 * swaps it — otherwise `Partial<Deed>` happily typechecks a `1` the server
 * rejects as an invalid value.
 *
 * `done_today` and `locked` are dropped for the same reason in reverse: the
 * server computes them and stores neither, so sending them back is meaningless.
 */
type CatalogPatch<T> = Partial<
  Omit<T, 'id' | 'active' | 'done_today' | 'locked'> & { active: boolean }
>;

/** An API error carrying the server's machine-readable code for translation. */
export class ApiError extends Error {
  status: number;
  code: string;
  /** Free-form extra from the server — the lockout countdown, for instance. */
  detail: string | undefined;

  constructor(status: number, code: string, detail?: string) {
    super(code);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      ...init,
    });
  } catch {
    // Fetch only rejects on a transport failure — the server is unreachable.
    throw new ApiError(0, 'network_error');
  }

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const body = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    const code = 'error' in body ? String(body.error) : 'server_error';
    const detail = 'detail' in body && body.detail != null ? String(body.detail) : undefined;
    throw new ApiError(res.status, code, detail);
  }
  return data as T;
}

const get = <T,>(path: string) => request<T>(path);
const send = <T,>(method: string, path: string, body?: unknown) =>
  request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  // --- auth ---
  setupStatus: () => get<{ needsSetup: boolean }>('/auth/setup/status'),
  setup: (body: { name: string; username: string; pin: string }) =>
    send<{ user: User }>('POST', '/auth/setup', body),
  login: (username: string, pin: string) =>
    send<{ user: User }>('POST', '/auth/login', { username, pin }),
  logout: () => send<{ ok: true }>('POST', '/auth/logout'),
  me: () => get<{ user: User | null }>('/auth/me'),
  faces: () => get<{ users: Face[] }>('/auth/faces'),
  changePin: (currentPin: string, newPin: string) =>
    send<{ ok: true }>('POST', '/auth/change-pin', { currentPin, newPin }),
  /** "I forgot my PIN" from the login screen — no session needed. */
  requestPinReset: (username: string) =>
    send<{ ok: true }>('POST', '/auth/pin-request', { username }),

  // --- family ---
  users: () => get<{ users: User[] }>('/users'),
  createUser: (body: {
    name: string;
    username: string;
    pin: string;
    role: 'parent' | 'kid';
    avatar?: string;
    color?: string;
  }) => send<{ user: User }>('POST', '/users', body),
  updateUser: (id: number, body: Partial<Pick<User, 'name' | 'avatar' | 'color' | 'active'>>) =>
    send<{ user: User }>('PATCH', `/users/${id}`, body),
  resetPin: (id: number, pin: string) => send<{ ok: true }>('POST', `/users/${id}/reset-pin`, { pin }),
  deleteUser: (id: number) => send<{ ok: true }>('DELETE', `/users/${id}?purge=true`),
  pinRequests: () => get<{ requests: PinRequest[] }>('/users/pin-requests'),
  dismissPinRequest: (id: number) =>
    send<{ ok: true }>('POST', `/users/pin-requests/${id}/dismiss`),
  makeAdmin: (id: number) => send<{ user: User }>('POST', `/users/${id}/make-admin`),

  // --- catalog ---
  deeds: (all = false) => get<{ deeds: Deed[] }>(`/catalog/deeds${all ? '?all=true' : ''}`),
  createDeed: (body: CatalogPatch<Deed>) => send<{ deed: Deed }>('POST', '/catalog/deeds', body),
  updateDeed: (id: number, body: CatalogPatch<Deed>) =>
    send<{ deed: Deed }>('PATCH', `/catalog/deeds/${id}`, body),
  deleteDeed: (id: number) => send<{ ok: true }>('DELETE', `/catalog/deeds/${id}`),

  rewards: (all = false) => get<{ rewards: Reward[] }>(`/catalog/rewards${all ? '?all=true' : ''}`),
  createReward: (body: CatalogPatch<Reward>) =>
    send<{ reward: Reward }>('POST', '/catalog/rewards', body),
  updateReward: (id: number, body: CatalogPatch<Reward>) =>
    send<{ reward: Reward }>('PATCH', `/catalog/rewards/${id}`, body),
  deleteReward: (id: number) => send<{ ok: true }>('DELETE', `/catalog/rewards/${id}`),

  // --- submissions ---
  submissions: (query: { status?: string; kidId?: number } = {}) => {
    const qs = new URLSearchParams();
    if (query.status) qs.set('status', query.status);
    if (query.kidId) qs.set('kidId', String(query.kidId));
    return get<{ submissions: Submission[] }>(`/submissions${qs.size ? `?${qs}` : ''}`);
  },
  submitDeed: (deedId: number, note = '', kidId?: number) =>
    send<{ submission: Submission }>('POST', '/submissions', { deedId, note, kidId }),
  reviewSubmission: (id: number, decision: 'approve' | 'reject', note = '') =>
    send<{ submission: Submission }>('POST', `/submissions/${id}/review`, { decision, note }),
  cancelSubmission: (id: number) => send<{ ok: true }>('DELETE', `/submissions/${id}`),

  // --- redemptions ---
  redemptions: (query: { status?: string; kidId?: number } = {}) => {
    const qs = new URLSearchParams();
    if (query.status) qs.set('status', query.status);
    if (query.kidId) qs.set('kidId', String(query.kidId));
    return get<{ redemptions: Redemption[] }>(`/redemptions${qs.size ? `?${qs}` : ''}`);
  },
  requestReward: (rewardId: number, note = '', kidId?: number) =>
    send<{ redemption: Redemption }>('POST', '/redemptions', { rewardId, note, kidId }),
  reviewRedemption: (id: number, decision: 'approve' | 'reject', note = '') =>
    send<{ redemption: Redemption }>('POST', `/redemptions/${id}/review`, { decision, note }),
  cancelRedemption: (id: number) => send<{ ok: true }>('DELETE', `/redemptions/${id}`),

  // --- points ---
  balance: (kidId: number) => get<Balance>(`/points/balance/${kidId}`),
  ledger: (kidId: number) => get<{ entries: LedgerEntry[] }>(`/points/ledger/${kidId}`),
  adjust: (kidId: number, delta: number, reason: string) =>
    send<{ balance: number }>('POST', '/points/adjust', { kidId, delta, reason }),
  overview: () => get<Overview>('/points/overview'),

  // --- notifications ---
  /** Polled by the live layer: badge counts for a parent, answers for a kid. */
  notifications: () => get<Notifications>('/notifications'),
};
