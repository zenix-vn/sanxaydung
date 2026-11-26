import type { Metadata } from 'next';
import { requireUserCompany } from '@/lib/supabase/company';
import { canAdmin } from '@/lib/roles';
import { fmtDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Gói & thanh toán' };
export const dynamic = 'force-dynamic';

type Billing = {
  subscription: { plan_id: string; plan_name: string | null; status: string; started_at: string; expires_at: string | null; price_month: number | null } | null;
  payments: { id: string; plan_name: string | null; months: number; amount: number; method: string; invoice_no: string | null; paid_at: string; voided: boolean }[];
};

const METHOD: Record<string, string> = { bank_transfer: 'Chuyển khoản', cash: 'Tiền mặt', other: 'Khác' };
const vnd = (n: number) => `${Number(n).toLocaleString('vi-VN')} ₫`;

export default async function BillingPage() {
  const { supa, company, role } = await requireUserCompany('/dashboard/billing');
  if (!company) return null;

  if (!canAdmin({ role: role ?? 'member' })) {
    return (
      <div>
        <div className="dpage-head"><div><h1>Gói &amp; thanh toán</h1></div></div>
        <div className="dcard"><p className="muted">Chỉ chủ sở hữu hoặc quản trị viên của doanh nghiệp xem được thông tin thanh toán.</p></div>
      </div>
    );
  }

  const { data, error } = await supa.rpc('my_billing', { _company: company.id });
  const b = (data ?? { subscription: null, payments: [] }) as Billing;
  const sub = b.subscription;
  const daysLeft = sub?.expires_at ? Math.ceil((new Date(sub.expires_at).getTime() - Date.now()) / 86400000) : null;

  return (
    <div>
      <div className="dpage-head">
        <div>
          <h1>Gói &amp; thanh toán</h1>
          <p>Gói thành viên hiện tại và lịch sử thanh toán của {company.name as string}.</p>
        </div>
        <a className="btn btn-outline" href="/pricing">Xem bảng giá</a>
      </div>

      {error && <div className="notice mb-16" style={{ background: '#fdecea', color: '#a12622' }}>Không tải được dữ liệu thanh toán: {error.message}</div>}

      <div className="dcard mb-24">
        <h3>Gói hiện tại</h3>
        {sub ? (
          <div className="row" style={{ justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy)' }}>{sub.plan_name ?? sub.plan_id}</div>
              <div className="muted" style={{ fontSize: 13 }}>
                Bắt đầu {fmtDate(sub.started_at)}
                {sub.expires_at ? ` · hết hạn ${fmtDate(sub.expires_at)}` : ' · không thời hạn'}
              </div>
              {daysLeft != null && daysLeft <= 14 && (
                <span className={`badge ${daysLeft <= 3 ? 'red' : 'orange'}`} style={{ marginTop: 8 }}>
                  {daysLeft > 0 ? `Còn ${daysLeft} ngày` : 'Đã hết hạn'}
                </span>
              )}
              {sub.status === 'past_due' && <span className="badge red" style={{ marginTop: 8, marginLeft: 6 }}>Quá hạn thanh toán</span>}
            </div>
            <a className="btn btn-orange" href={`/pricing/checkout?plan=${encodeURIComponent(sub.plan_id)}&billing=year`}>Gia hạn gói</a>
          </div>
        ) : (
          <div className="row" style={{ justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <p className="muted" style={{ margin: 0 }}>Doanh nghiệp đang dùng gói miễn phí.</p>
            <a className="btn btn-orange" href="/pricing">Nâng cấp gói</a>
          </div>
        )}
      </div>

      <div className="dcard">
        <h3>Lịch sử thanh toán</h3>
        {b.payments.length === 0 ? (
          <div className="empty"><svg className="ic"><use href="#ic-coin" /></svg>Chưa có giao dịch nào.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Ngày</th><th>Nội dung</th><th>Hình thức</th><th>Số hóa đơn</th><th style={{ textAlign: 'right' }}>Số tiền</th></tr></thead>
              <tbody>
                {b.payments.map((p) => (
                  <tr key={p.id} style={p.voided ? { opacity: 0.55 } : undefined}>
                    <td>{fmtDate(p.paid_at)}</td>
                    <td>
                      {p.plan_name ? `Gói ${p.plan_name}` : 'Dịch vụ'}{p.months ? ` · ${p.months} tháng` : ''}
                      {p.voided && <span className="badge gray" style={{ marginLeft: 6 }}>Đã hủy</span>}
                    </td>
                    <td>{METHOD[p.method] ?? p.method}</td>
                    <td>{p.invoice_no ?? '—'}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap', textDecoration: p.voided ? 'line-through' : undefined }}><b>{vnd(p.amount)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>Cần hóa đơn VAT hoặc đối soát? Liên hệ hotro@sanxaydung.vn kèm số hóa đơn.</p>
      </div>
    </div>
  );
}
