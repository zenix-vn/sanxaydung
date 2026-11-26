// Dùng chung client + server (không import gì phía server).
export type PlatformRole = 'owner' | 'admin' | 'moderator';
export const ROLE_LABEL: Record<PlatformRole | 'member', string> = {
  owner: 'Chủ sở hữu', admin: 'Quản trị viên', moderator: 'Kiểm duyệt viên', member: 'Thành viên',
};
const RANK: Record<string, number> = { owner: 3, admin: 2, moderator: 1 };
export const hasRole = (role: string | null | undefined, min: PlatformRole) => (RANK[role ?? ''] ?? 0) >= RANK[min];
