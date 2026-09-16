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

export interface Deed {
  id: number;
  title_lv: string;
  title_en: string;
  icon: string;
  points: number;
  category: string;
  active: number;
  sort_order: number;
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
