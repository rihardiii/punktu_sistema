export type Role = 'parent' | 'kid';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: number;
  username: string;
  name: string;
  role: Role;
  avatar: string;
  color: string;
  active: boolean;
  created_at: string;
  /** The one parent who can reset another parent's forgotten PIN. */
  is_admin: boolean;
  balance?: number | null;
}

/** An open "I forgot my PIN", filed from the login screen. */
export interface PinRequest {
  id: number;
  user_id: number;
  created_at: string;
  name: string;
  username: string;
  role: Role;
  avatar: string;
  color: string;
}

export interface Face {
  id: number;
  username: string;
  name: string;
  role: Role;
  avatar: string;
  color: string;
}

/** Minutes since midnight, both ends inclusive: 420–600 reads as 07:00–10:00. */
export interface TimeWindow {
  start_min: number;
  end_min: number;
}

/** Why a deed cannot be filed right now — '' means it can. */
export type DeedLock = '' | 'window' | 'limit';

export interface Deed {
  id: number;
  title_lv: string;
  title_en: string;
  icon: string;
  points: number;
  category: string;
  active: number;
  sort_order: number;
  /** When it may be filed. Empty = any time of day. */
  windows: TimeWindow[];
  /** How many times a day it may be filed. 0 = as often as you like. */
  max_per_day: number;
  /** Worked out by the server, on the family's clock — never stored. */
  done_today: number;
  locked: DeedLock;
}

export interface Reward {
  id: number;
  title_lv: string;
  title_en: string;
  icon: string;
  cost: number;
  description_lv: string;
  description_en: string;
  active: number;
  sort_order: number;
}

export interface Submission {
  id: number;
  kid_id: number;
  deed_id: number | null;
  deed_title: string;
  deed_icon: string;
  points: number;
  note: string;
  status: ReviewStatus;
  created_at: string;
  reviewed_at: string | null;
  review_note: string;
  kid_name: string;
  kid_avatar: string;
  kid_color: string;
  reviewer_name: string | null;
}

export interface Redemption {
  id: number;
  kid_id: number;
  reward_id: number | null;
  reward_title: string;
  reward_icon: string;
  cost: number;
  note: string;
  status: ReviewStatus;
  created_at: string;
  reviewed_at: string | null;
  review_note: string;
  kid_name: string;
  kid_avatar: string;
  kid_color: string;
  reviewer_name: string | null;
}

export interface LedgerEntry {
  id: number;
  kid_id: number;
  delta: number;
  reason: string;
  ref_type: 'submission' | 'redemption' | 'adjustment';
  ref_id: number | null;
  created_at: string;
  created_by_name: string | null;
}

export interface Balance {
  kidId: number;
  balance: number;
  pending: number;
  reserved: number;
  available: number;
}

export interface KidSummary {
  id: number;
  name: string;
  avatar: string;
  color: string;
  balance: number;
  pending: number;
  reserved: number;
  earnedThisWeek: number;
}

export interface Overview {
  pendingSubmissions: number;
  pendingRedemptions: number;
  kids: KidSummary[];
}

/** A parent's answer to one of this kid's requests, as it arrives for display. */
export interface AnswerEvent {
  /** Stable across polls — what the client remembers having already shown. */
  key: string;
  kind: 'deed' | 'reward';
  title: string;
  icon: string;
  status: 'approved' | 'rejected';
  /** Points gained (deed) or spent (reward), always positive. */
  amount: number;
  note: string;
  reviewed_at: string;
}

/** What the app polls for: badge numbers for a parent, answers for a kid. */
export interface Notifications {
  pendingSubmissions: number;
  pendingRedemptions: number;
  pinRequests: number;
  events: AnswerEvent[];
}
