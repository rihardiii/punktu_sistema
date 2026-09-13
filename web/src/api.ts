import type {
  Balance,
  Deed,
  Face,
  LedgerEntry,
  Overview,
  Redemption,
  Reward,
  Submission,
  User,
} from './types.ts';

/** An API error carrying the server's machine-readable code for translation. */
export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
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
    const code =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : 'server_error';
    throw new ApiError(res.status, code);
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

  // --- catalog ---
  deeds: (all = false) => get<{ deeds: Deed[] }>(`/catalog/deeds${all ? '?all=true' : ''}`),
  createDeed: (body: Partial<Deed>) => send<{ deed: Deed }>('POST', '/catalog/deeds', body),
  updateDeed: (id: number, body: Partial<Deed>) =>
    send<{ deed: Deed }>('PATCH', `/catalog/deeds/${id}`, body),
  deleteDeed: (id: number) => send<{ ok: true }>('DELETE', `/catalog/deeds/${id}`),

  rewards: (all = false) => get<{ rewards: Reward[] }>(`/catalog/rewards${all ? '?all=true' : ''}`),
  createReward: (body: Partial<Reward>) => send<{ reward: Reward }>('POST', '/catalog/rewards', body),
  updateReward: (id: number, body: Partial<Reward>) =>
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
};
