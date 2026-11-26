import type { Metadata } from 'next';
import { requireAdmin, type AdminStats } from '@/lib/admin';
import AdminShell from './AdminShell';
import './admin.css';

export const metadata: Metadata = { title: { default: 'Quản trị', template: '%s | Quản trị' }, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supa, name, email, role } = await requireAdmin();
  const { data } = await supa.rpc('admin_stats');
  const s = (data ?? {}) as Partial<AdminStats>;
  const counts = {
    verifications_pending: s.verifications_pending ?? 0,
    claims_pending: s.claims_pending ?? 0,
    reports_open: s.reports_open ?? 0,
    registrations_pending: s.registrations_pending ?? 0,
  };
  return (
    <AdminShell counts={counts} name={name} email={email} role={role}>
      {children}
    </AdminShell>
  );
}
