import type { Metadata } from 'next';
import { createSupabaseServer } from '@/lib/supabase/server';
import { ROLE_LABELS } from '@/lib/format';
import { initials, thumb } from '@/lib/ui';
import AcceptButton from './AcceptButton';

export const metadata: Metadata = { title: 'Lời mời tham gia doanh nghiệp', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

type Inv = { company_name: string; company_slug: string; logo_url: string | null; role: string; email_hint: string; email_match: boolean; expired: boolean; accepted: boolean };

export default async function InvitePage({ params }: { params: { token: string } }) {
  const supa = createSupabaseServer();
  const [{ data: { user } }, { data }] = await Promise.all([
    supa.auth.getUser(),
    supa.rpc('get_invitation', { _token: params.token }),
  ]);
  const inv = data as Inv | null;
  const here = `/moi/${params.token}`;

  let body: React.ReactNode;
  if (!inv) body = <p className="muted">Lời mời không tồn tại hoặc link không đúng. Hãy hỏi lại người đã mời bạn.</p>;
  else if (inv.accepted) body = <><p className="muted mb-16">Lời mời này đã được sử dụng.</p><a className="btn btn-outline" href="/dashboard">Vào bảng điều khiển</a></>;
  else if (inv.expired) body = <p className="muted">Lời mời đã hết hạn hoặc bị thu hồi. Hãy đề nghị quản trị viên của {inv.company_name} gửi lời mời mới.</p>;
  else if (!user) {
    body = (
      <>
        <p className="mb-16">Đăng nhập bằng email <b>{inv.email_hint}</b> để nhận lời mời.</p>
        <a className="btn btn-orange btn-lg" href={`/login?redirect=${encodeURIComponent(here)}`}>Đăng nhập để tiếp tục</a>
      </>
    );
  } else if (!inv.email_match) {
    body = (
      <>
        <p className="mb-16">Lời mời này gửi tới <b>{inv.email_hint}</b>, khác với tài khoản bạn đang đăng nhập ({user.email}).</p>
        <a className="btn btn-outline" href={`/login/signout`}>Đăng xuất để đổi tài khoản</a>
      </>
    );
  } else {
    body = (
      <>
        <p className="mb-16">Bạn sẽ tham gia với vai trò <b>{ROLE_LABELS[inv.role] ?? inv.role}</b>.</p>
        <AcceptButton token={params.token} />
      </>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: '64px auto', padding: '0 20px' }}>
      <div className="card-block" style={{ textAlign: 'center' }}>
        {inv && (
          <div style={{ marginBottom: 18 }}>
            {inv.logo_url ? (
              <img src={thumb(inv.logo_url, 128)} alt="" style={{ width: 64, height: 64, borderRadius: 14, objectFit: 'cover' }} />
            ) : (
              <span style={{ width: 64, height: 64, borderRadius: 14, background: 'var(--navy)', color: '#fff', fontWeight: 800, fontSize: 20, display: 'inline-grid', placeItems: 'center' }}>{initials(inv.company_name)}</span>
            )}
            <h1 style={{ fontSize: 21, fontWeight: 800, color: 'var(--navy)', marginTop: 12 }}>Tham gia {inv.company_name}</h1>
          </div>
        )}
        {!inv && <h1 style={{ fontSize: 21, fontWeight: 800, color: 'var(--navy)', marginBottom: 12 }}>Lời mời không hợp lệ</h1>}
        {body}
      </div>
    </div>
  );
}
