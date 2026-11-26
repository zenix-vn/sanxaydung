import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin, pageOf, fmtDate, PAGE_SIZE } from '@/lib/admin';
import { colorFor } from '@/lib/ui';
import { vnd } from '@/lib/plans';
import { Act, Empty, ExportLink, Pager, Status, Tabs, Who } from '@/components/admin/ui';
import RecordPayment from './RecordPayment';

export const metadata: Metadata = { title: 'Gói & thanh toán' };

type Co = { id: string; name: string; logo_url: string | null; phone: string | null } | null;
type Sub = { id: string; plan_id: string | null; status: string; started_at: string; expires_at: string | null; companies: Co; plans: { name: string | null } | null };
type Pay = {
  id: string; months: number; amount: number; method: string; invoice_no: string | null; reference: string | null; note: string | null; paid_at: string;
  voided_at: string | null; void_reason: string | null; companies: Co; plans: { name: string | null } | null; recorder: { full_name: string | null } | null;
};
type Summary = { month: number; last_month: number; year: number; paying: number; expiring: number; overdue: number };
const METHOD: Record<string, string> = { bank_transfer: 'Chuyển khoản', cash: 'Tiền mặt', other: 'Khác' };
const TABS = ['active', 'expiring', 'payments', 'past_due', 'cancelled'];
const DAY = 86400000;

export default async function SubscriptionsPage({ searchParams }: { searchParams: { status?: string; page?: string } }) {
  const { supa } = await requireAdmin('/admin/subscriptions', 'admin');
  const tab = TABS.includes(searchParams.status ?? '') ? searchParams.status! : 'active';
  const { page, from, to } = pageOf(searchParams);
  const soon = new Date(Date.now() + 30 * DAY).toISOString();

  const list = async () => {
    if (tab === 'payments') {
      return supa.from('payments')
        .select('id, months, amount, method, invoice_no, reference, note, paid_at, voided_at, void_reason, companies ( id, name, logo_url, phone ), plans ( name ), recorder:recorded_by ( full_name )', { count: 'exact' })
        .order('paid_at', { ascending: false }).order('created_at', { ascending: false }).range(from, to);
    }
    let q = supa.from('subscriptions').select('id, plan_id, status, started_at, expires_at, companies ( id, name, logo_url, phone ), plans ( name )', { count: 'exact' }).range(from, to);
    if (tab === 'expiring') q = q.eq('status', 'active').lte('expires_at', soon).order('expires_at');
    else q = q.eq('status', tab).order('started_at', { ascending: false });
    return q;
  };
  const [{ data, count, error }, { data: sum }, { data: plans }] = await Promise.all([
    list(), supa.rpc('admin_billing_summary'), supa.from('plans').select('id, name, price_month').order('price_month'),
  ]);
  const s = sum as Summary | null;
  const rows = (data ?? []) as unknown[];
  const now = Date.now();
  const planOpts = ((plans ?? []) as { id: string; name: string | null; price_month: number | null }[]).map((p) => ({ id: p.id, name: p.name ?? p.id, price: Number(p.price_month ?? 0) }));

  const kpis = s ? [
    { l: 'Thu tháng này', v: vnd(s.month), d: `Tháng trước ${vnd(s.last_month)}`, icon: 'ic-coin', tone: 'g' },
    { l: 'Thu từ đầu năm', v: vnd(s.year), icon: 'ic-trending' },
    { l: 'Doanh nghiệp đang trả phí', v: String(s.paying), icon: 'ic-building' },
    { l: 'Sắp hết hạn trong 30 ngày', v: String(s.expiring), d: s.overdue ? `${s.overdue} gói đã quá hạn` : undefined, icon: 'ic-clock', tone: 'o' },
  ] : [];

  return (
    <>
      <div className="adm-h">
        <div><h1>Gói & thanh toán</h1><p>Thu tiền qua chuyển khoản thủ công: nhận tiền → ghi nhận tại đây để kích hoạt hoặc gia hạn gói.</p></div>
        <div className="adm-hd-acts"><Link className="ab" href="/admin/plans"><svg className="ic"><use href="#ic-tag" /></svg> Bảng giá</Link><ExportLink kind={tab === 'payments' ? 'payments' : 'subscriptions'} /></div>
      </div>
      <div className="adm-kpis">
        {kpis.map((k) => (
          <div className="kpi" key={k.l}>
            <div className={`ico ${k.tone ?? ''}`}><svg className="ic"><use href={`#${k.icon}`} /></svg></div>
            <div><div className="v">{k.v}</div><div className="l">{k.l}</div>{k.d && <div className="d">{k.d}</div>}</div>
          </div>
        ))}
      </div>
      <RecordPayment plans={planOpts} />
      <div className="adm-bar">
        <Tabs base="/admin/subscriptions" current={tab} items={[
          { key: 'active', label: 'Đang chạy' }, { key: 'expiring', label: 'Sắp / đã hết hạn', count: (s?.expiring ?? 0) + (s?.overdue ?? 0) },
          { key: 'payments', label: 'Phiếu thu' }, { key: 'past_due', label: 'Quá hạn' }, { key: 'cancelled', label: 'Đã hủy' },
        ]} />
      </div>
      <div className="adm-card">
        {error ? <Empty title="Không tải được dữ liệu" hint={error.message} />
          : rows.length === 0 ? <Empty title={tab === 'payments' ? 'Chưa có phiếu thu' : tab === 'expiring' ? 'Không có gói nào sắp hết hạn' : 'Chưa có thuê bao'} />
          : tab === 'payments' ? (
            <div className="adm-tw"><table className="adm-t">
              <thead><tr><th>Ngày</th><th>Doanh nghiệp</th><th className="num">Số tiền</th><th>Nội dung</th><th>Chứng từ</th><th>Người ghi</th><th /></tr></thead>
              <tbody>{(rows as Pay[]).map((p) => (
                <tr key={p.id} className={p.voided_at ? 'void' : ''}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(p.paid_at)}</td>
                  <td><Who name={p.companies?.name ?? '—'} logo={p.companies?.logo_url} color={colorFor(p.companies?.id ?? p.id)} href={p.companies ? `/admin/companies/${p.companies.id}` : undefined} /></td>
                  <td className="num amt"><b>{vnd(p.amount)}</b></td>
                  <td>{p.plans?.name ? `${p.plans.name}${p.months ? ` · ${p.months} tháng` : ''}` : 'Dịch vụ khác'}<br /><small className="muted">{METHOD[p.method] ?? p.method}{p.note ? ` · ${p.note}` : ''}</small></td>
                  <td><small>{p.invoice_no ? `HĐ ${p.invoice_no}` : '—'}<br /><span className="muted">{p.reference}</span></small></td>
                  <td>{p.recorder?.full_name ?? '—'}</td>
                  <td><div className="acts">{p.voided_at
                    ? <span className="bdg r" title={p.void_reason ?? ''}>Đã hủy</span>
                    : <Act label="Hủy phiếu" tone="d" fn="admin_void_payment" args={{ _id: p.id }} fieldArgs={{ reason: '_reason' }}
                        confirm={{ title: 'Hủy phiếu thu?', message: 'Phiếu không còn tính vào doanh thu. Gói đã kích hoạt KHÔNG tự thu hồi — hủy gói riêng nếu cần.', confirmLabel: 'Hủy phiếu', fields: [{ key: 'reason', label: 'Lý do', type: 'textarea', required: true }] }} success="Đã hủy phiếu thu" />}</div></td>
                </tr>
              ))}</tbody>
            </table></div>
          ) : (
            <div className="adm-tw"><table className="adm-t">
              <thead><tr><th>Doanh nghiệp</th><th>Gói</th><th>Bắt đầu</th><th>Hết hạn</th><th>Trạng thái</th><th /></tr></thead>
              <tbody>{(rows as Sub[]).map((r) => {
                const left = r.expires_at ? Math.ceil((new Date(r.expires_at).getTime() - now) / DAY) : null;
                const due = r.status !== 'cancelled' && left != null && left <= 30;
                return (
                  <tr key={r.id}>
                    <td><Who name={r.companies?.name ?? '—'} sub={r.companies?.phone} logo={r.companies?.logo_url} color={colorFor(r.companies?.id ?? r.id)} href={r.companies ? `/admin/companies/${r.companies.id}` : undefined} /></td>
                    <td><b style={{ color: 'var(--navy)' }}>{r.plans?.name ?? r.plan_id}</b></td>
                    <td>{fmtDate(r.started_at)}</td>
                    <td>{fmtDate(r.expires_at)}{left != null && r.status === 'active' && <small style={left <= 7 ? { color: 'var(--red)', marginLeft: 6, fontWeight: 600 } : { marginLeft: 6, color: 'var(--muted)' }}>{left <= 0 ? 'đã hết hạn' : `còn ${left} ngày`}</small>}</td>
                    <td><Status s={r.status} /></td>
                    <td><div className="acts">
                      {due && <Act label="Nhắc gia hạn" icon="ic-bell" fn="admin_remind_renewal" args={{ _sub: r.id }} confirm={{ title: 'Gửi nhắc gia hạn?', message: 'Gửi thông báo trong ứng dụng cho chủ và quản trị của doanh nghiệp. Mỗi gói chỉ nhắc 3 ngày một lần.', confirmLabel: 'Gửi' }} success="Đã gửi nhắc gia hạn" />}
                      {r.status === 'active' && <Act label="Hủy gói" tone="d" fn="admin_cancel_subscription" args={{ _id: r.id }} confirm={{ title: 'Hủy thuê bao?', message: 'Doanh nghiệp sẽ mất quyền lợi của gói ngay lập tức.', confirmLabel: 'Hủy gói' }} success="Đã hủy gói" />}
                    </div></td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          )}
        <Pager base="/admin/subscriptions" params={{ status: tab }} page={page} total={count ?? 0} size={PAGE_SIZE} />
      </div>
    </>
  );
}
