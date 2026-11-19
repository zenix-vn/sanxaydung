// Kiểu & hàm kiểm tra vai trò — an toàn để import ở cả client lẫn server.
export interface MyCompany {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  role: 'owner' | 'admin' | 'editor' | 'member' | string;
}

export const canEdit = (c: Pick<MyCompany, 'role'>) => ['owner', 'admin', 'editor'].includes(c.role);
export const canAdmin = (c: Pick<MyCompany, 'role'>) => ['owner', 'admin'].includes(c.role);
