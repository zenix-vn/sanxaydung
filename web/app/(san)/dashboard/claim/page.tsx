import type { Metadata } from 'next';
import { requireUserCompany } from '@/lib/supabase/company';
import { toE164VN, toLocalVN } from '@/lib/phone';
import ClaimButton from './ClaimButton';

export const metadata: Metadata = { title: 'Nhận hồ sơ doanh nghiệp' };
export const dynamic = 'force-dynamic';

export default async function ClaimPage({ searchParams }: { searchParams: { phone?: string } }) {
  const { supa, user } = await requireUserCompany('/dashboard/claim');

  // SĐT mặc định: SĐT đã xác thực khi đăng nhập
  const raw = searchParams.phone ?? (user.phone ? `0${user.phone.replace(/^\+?84/, '')}` : '');
  const local = raw ? toLocalVN(raw) : null;
  const e164 = raw ? toE164VN(raw) : null;
  const invalid = !!raw && !local;

  let results: { id: string; name: string; slug: string; address: string | null; verified_tier: string }[] = [];
  if (local && e164) {
    const variants = [local, e164, e164.slice(1), `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`];
    const { data } = await supa
      .from('companies')
      .select('id, name, slug, address, verified_tier, phone')
      .is('owner_id', null)
      .is('deleted_at', null)
      .in('phone', variants)
      .limit(10);
    results = (data ?? []) as typeof results;
  }
  const phoneVerified = !!user.phone && !!local && toLocalVN(user.phone) === local;

  // Hồ sơ khớp email Google đã xác thực (email người điền form đăng ký) → nhận ngay, không cần duyệt
  const { data: mineRaw } = await supa.rpc('my_claimable_companies');
  const mine = (mineRaw ?? []) as { id: string; name: string; slug: string; address: string | null; verified_tier: string }[];

  return (
    <div style={{ maxWidth: 640, margin: '48px auto', padding: '0 20px' }}>
      <div className="crumb"><a href="/dashboard">Bảng điều khiển</a><svg className="ic"><use href="#ic-chevron-right" /></svg> Nhận hồ sơ</div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--navy)', margin: '10px 0 6px' }}>Nhận hồ sơ doanh nghiệp</h1>
      <p className="muted mb-16">Hồ sơ doanh nghiệp có thể đã được tạo sẵn từ dữ liệu đăng ký. Nếu bạn đăng nhập bằng đúng email đã dùng khi đăng ký, hồ sơ sẽ hiện ngay bên dưới.</p>

      {mine.length > 0 && (
        <div className="card-block" style={{ marginBottom: 16, borderColor: 'var(--orange)' }}>
          <div className="pill-note mb-16">
            <svg className="ic"><use href="#ic-shield-check" /></svg>
            <span>Email <b>{user.email}</b> khớp với email đăng ký của {mine.length === 1 ? 'hồ sơ sau' : `${mine.length} hồ sơ sau`} — bạn có thể nhận quyền quản lý ngay.</span>
          </div>
          {mine.map((c) => (
            <div key={c.id} className="act-row" style={{ gap: 14 }}>
              <div style={{ flex: 1 }}>
                <b style={{ color: 'var(--navy)' }}>{c.name}</b>
                <div className="muted" style={{ fontSize: 12.5 }}>{c.address ?? 'Chưa có địa chỉ'}</div>
              </div>
              <ClaimButton companyId={c.id} note={`Nhận hồ sơ theo email Google ${user.email}`} />
            </div>
          ))}
        </div>
      )}

      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy)', margin: '20px 0 10px' }}>Hoặc tìm theo số điện thoại</h2>

      <form method="get" className="card-block" style={{ display: 'flex', gap: 10, alignItems: 'end' }}>
        <div className="field-group" style={{ flex: 1, marginBottom: 0 }}>
          <label>Số điện thoại của doanh nghiệp</label>
          <input className="input" name="phone" defaultValue={raw} placeholder="09xx xxx xxx" />
        </div>
        <button className="btn btn-orange" type="submit"><svg className="ic"><use href="#ic-search" /></svg> Tìm</button>
      </form>
      {invalid && <p style={{ color: '#c0392b', fontSize: 13, marginTop: 10 }}>Số điện thoại không hợp lệ.</p>}

      {local && (
        <div className="card-block" style={{ marginTop: 16 }}>
          {!phoneVerified && results.length > 0 && (
            <div className="pill-note mb-16">
              <svg className="ic"><use href="#ic-shield" /></svg>
              <span>Yêu cầu nhận hồ sơ theo số điện thoại sẽ được đội ngũ Sàn Xây Dựng duyệt thủ công. Muốn nhận ngay, hãy đăng nhập Google bằng đúng email đã dùng khi đăng ký.</span>
            </div>
          )}
          {results.length === 0 ? (
            <>
              <p className="muted" style={{ fontSize: 14 }}>Không tìm thấy hồ sơ chưa có chủ với số <b>{local}</b>.</p>
              <a className="btn btn-outline mt-16" href="/dashboard/new">Tạo hồ sơ mới</a>
            </>
          ) : (
            results.map((c) => (
              <div key={c.id} className="act-row" style={{ gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <b style={{ color: 'var(--navy)' }}>{c.name}</b>
                  <div className="muted" style={{ fontSize: 12.5 }}>{c.address ?? 'Chưa có địa chỉ'}</div>
                </div>
                <ClaimButton companyId={c.id} note={`Yêu cầu nhận hồ sơ theo SĐT ${local}`} />
              </div>
            ))
          )}
        </div>
      )}

      <p className="muted" style={{ fontSize: 13, marginTop: 20 }}>
        Không có hồ sơ nào? <a href="/dashboard/new" style={{ color: 'var(--orange)', fontWeight: 600 }}>Tạo doanh nghiệp mới →</a>
      </p>
    </div>
  );
}
