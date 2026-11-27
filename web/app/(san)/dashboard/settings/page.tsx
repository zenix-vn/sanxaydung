import type { Metadata } from 'next';
import { requireUserCompany } from '@/lib/supabase/company';
import PrivacyActions from './PrivacyActions';

export const metadata: Metadata = { title: 'Cài đặt tài khoản' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { user, role } = await requireUserCompany('/dashboard/settings');
  return (
    <div style={{ maxWidth: 680, margin: '48px auto', padding: '0 20px' }}>
      <div className="crumb"><a href="/dashboard">Bảng điều khiển</a><svg className="ic"><use href="#ic-chevron-right" /></svg> Cài đặt</div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--navy)', margin: '10px 0 16px' }}>Cài đặt tài khoản</h1>
      <div className="card-block">
        <h2>Tài khoản</h2>
        <p className="muted" style={{ fontSize: 14 }}>{user.email ?? user.phone ?? user.id}</p>
        <form method="post" action="/login/signout" style={{ marginTop: 12 }}>
          <button className="btn btn-outline btn-sm" type="submit"><svg className="ic"><use href="#ic-logout" /></svg> Đăng xuất</button>
        </form>
      </div>
      <PrivacyActions isOwner={role === 'owner'} />
    </div>
  );
}
