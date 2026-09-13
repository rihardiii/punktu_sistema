export type Role = 'parent' | 'kid';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface UserRow {
  id: number;
  username: string;
  name: string;
  role: Role;
  pin_hash: string;
  pin_salt: string;
  avatar: string;
  color: string;
  active: number;
  created_at: string;
  created_by: number | null;
}

/** A user as sent to the client — never includes PIN material. */
export interface PublicUser {
  id: number;
  username: string;
  name: string;
  role: Role;
  avatar: string;
  color: string;
  active: boolean;
  created_at: string;
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role,
    avatar: row.avatar,
    color: row.color,
    active: row.active === 1,
    created_at: row.created_at,
  };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: PublicUser;
      sessionToken?: string;
    }
  }
}
