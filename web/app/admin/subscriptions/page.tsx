import type { Metadata } from 'next';
import { requireAdmin, pageOf, fmtDate, PAGE_SIZE } from '@/lib/admin';
import { colorFor } from '@/lib/ui';
import { Act, Empty, Pager, Status, Tabs, Who } from '@/components/admin/ui';
import GrantPlan from './GrantPlan';

export const metadata: Metadata = { title: 'Gói & thanh toán' };
type Row = { id: string; plan_id: string | null; status: string; started_at: string; expires_at: string | null; companies: { id: string; name: string; slug: string; logo_url: string | null } | null; plans: { name: string | null; price_month: number | null } | null };

export default async function SubscriptionsPage({ searchParams }: { searchParams: { status?: string; page?: string } }) {
  const { supa } = await requireAdmin('/admin/subscriptions', 'admin');
  const status = ['active', 'cancelled', 'past_due'].includes(searchParams.status ?? '') ? searchParams.status! : 'active';
  const { page, from, to } = pageOf(searchParams);
  const [{ data, count }, { data: plans }] = await Promise.all([
    supa.from('subscriptions').select('id, plan_id, status, started_at, expires_at, companies ( id, name, slug, logo_url ), plans ( name, price_month )', { count: 'exact' })
      .eq('status', status).order('started_at', { ascending: false }).range(from, to),
    supa.from('plans').select('id, name, price_month').order('price_month'),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const now = Date.now();

  return (
    <>
      <div className="adm-h">
        <div><h1>Gói & thanh toán</h1><p>Thanh toán hiện qua chuyển khoản thủ công: nhận tiền → cấp gói tại đây (hoặc ở trang Doanh nghiệp).</p></div>
      </div>
      <GrantPlan plans={((plans ?? []) as { id: string; name: string | null }[]).map((p) => ({ id: p.id, name: p.name ?? p.id }))} />
      <div className="adm-bar">
        <Tabs base="/admin/subscriptions" current={status} items={[{ key: 'active', label: 'Đang chạy' }, { key: 'past_due', label: 'Quá hạn' }, { key: 'cancelled', label: 'Đã hủy' }]} />
      </div>
      <div className="adm-card">
        {rows.length === 0 ? <Empty title="Chưa có thuê bao" /> : (
          <div className="adm-tw"><table className="adm-t">
            <thead><tr><th>Doanh nghiệp</th><th>Gói</th><th>Bắt đầu</th><th>Hết hạn</th><th>Trạng thái</th><th /></tr></thead>
            <tbody>{rows.map((r) => {
              const left = r.expires_at ? Math.ceil((new Date(r.expires_at).getTime() - now) / 86400000) : null;
              return (
                <tr key={r.id}>
                  <td><Who name={r.companies?.name ?? '—'} logo={r.companies?.logo_url} color={colorFor(r.companies?.id ?? r.id)} /></td>
                  <td><b style={{ color: 'var(--navy)' }}>{r.plans?.name ?? r.plan_id}</b>{r.plans?.price_month ? <small className="muted"> · {Number(r.plans.price_month).toLocaleString('vi-VN')} ₫/tháng</small> : null}</td>
                  <td>{fmtDate(r.started_at)}</td>
                  <td>{fmtDate(r.expires_at)}{left != null && r.status === 'active' && <small className={left <= 7 ? '' : 'muted'} style={left <= 7 ? { color: 'var(--red)', marginLeft: 6, fontWeight: 600 } : { marginLeft: 6 }}>{left < 0 ? 'đã hết hạn' : `còn ${left} ngày`}</small>}</td>
                  <td><Status s={r.status} /></td>
                  <td><div className="acts">{r.status === 'active' && <Act label="Hủy gói" tone="d" fn="admin_cancel_subscription" args={{ _id: r.id }} confirm={{ title: 'Hủy thuê bao?', message: 'Doanh nghiệp sẽ mất quyền lợi của gói ngay lập tức.', confirmLabel: 'Hủy gói' }} success="Đã hủy gói" />}</div></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
        <Pager base="/admin/subscriptions" params={{ status }} page={page} total={count ?? 0} size={PAGE_SIZE} />
      </div>
    </>
  );
}
