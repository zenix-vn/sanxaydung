import type { Metadata } from 'next';
import { requireAdmin, hasRole } from '@/lib/admin';
import { limitText, shortVnd, vnd, yearlyPrice, type Plan } from '@/lib/plans';
import PlanEditor from './PlanEditor';

export const metadata: Metadata = { title: 'Bảng giá' };

export default async function PlansPage() {
  const { supa, role } = await requireAdmin('/admin/plans', 'admin');
  const [{ data }, { data: subs }] = await Promise.all([
    supa.from('plans').select('id, name, price_month, features').order('price_month'),
    supa.from('subscriptions').select('plan_id').eq('status', 'active').limit(5000),
  ]);
  const plans = ((data ?? []) as Plan[]).map((p) => ({ ...p, price_month: Number(p.price_month ?? 0), features: p.features ?? {} }));
  const using = (id: string) => ((subs ?? []) as { plan_id: string }[]).filter((s) => s.plan_id === id).length;
  const isOwner = hasRole(role, 'owner');

  return (
    <>
      <div className="adm-h">
        <div><h1>Bảng giá</h1><p>Nội dung ở đây hiển thị trên trang <a href="/pricing" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)' }}>/pricing</a> và trang thanh toán.{!isOwner && ' Chỉ Chủ sở hữu mới sửa được.'}</p></div>
      </div>
      <div className="adm-plans">
        {plans.map((p) => (
          <section className="adm-card" key={p.id}>
            <div className="hd"><h2>{p.name}</h2>{isOwner && <PlanEditor plan={p} />}</div>
            <div className="bd">
              <div className="price">{vnd(p.price_month)}<small> /tháng</small></div>
              <p className="muted">{p.features.contact ? 'Trang công khai hiển thị "Liên hệ"' : p.price_month > 0 ? `Trả năm: ${shortVnd(yearlyPrice(p.price_month))} (giảm 20%)` : 'Miễn phí'}</p>
              <dl>
                <div><dt>Đang sử dụng</dt><dd>{using(p.id)} thuê bao</dd></div>
                <div><dt>Tin đăng / tháng</dt><dd>{limitText(p.features.listings)}</dd></div>
                <div><dt>Thành viên</dt><dd>{limitText(p.features.members)}</dd></div>
                <div><dt>Tin nổi bật</dt><dd>{limitText(p.features.featured)}</dd></div>
              </dl>
              <ul>{(p.features.bullets ?? []).map((b) => <li key={b}>{b}</li>)}</ul>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
