import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin, fmtDate } from '@/lib/admin';
import { MEMBER_ROLE, TIER } from '@/lib/admin-labels';
import { Status } from '@/components/admin/ui';
import { Card, None } from '@/components/admin/card';

export const metadata: Metadata = { title: 'Xem như người dùng' };
export const dynamic = 'force-dynamic';

type View = {
  companies: { id: string; name: string; slug: string; status: string; verified_tier: string; completeness: number; trust_score: number; role: string; plan: string | null; unclaimed_fields: string[] }[];
  notifications: { title: string | null; body: string | null; link: string | null; is_read: boolean; created_at: string }[];
  unread: number;
  listings: { id: string; title: string; status: string; quotes: number; created_at: string }[];
  quotes: { listing_id: string; title: string; amount: number | null; status: string; created_at: string }[];
  conversations: number;
};
const QUOTE: Record<string, string> = { sent: 'Đã gửi', shortlisted: 'Vào danh sách chọn', accepted: 'Được chọn', rejected: 'Bị từ chối', withdrawn: 'Đã rút' };

export default async function ViewAsPage({ params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  // Mỗi lần tải trang đều được ghi vào nhật ký (trong hàm admin_view_as_user)
  const { supa } = await requireAdmin(`/admin/users/${params.id}`, 'owner');
  const { data, error } = await supa.rpc('admin_view_as_user', { _user: params.id });
  if (error) throw new Error(error.message);
  const v = data as View;

  return (
    <>
      <Link href={`/admin/users/${params.id}`} className="adm-back">← Về trang người dùng</Link>
      <div className="adm-warn" role="note">
        <b>Chế độ xem hỗ trợ — chỉ đọc.</b>
        <div>Bạn đang xem dữ liệu người dùng này thấy trên bảng điều khiển. Lượt xem đã được ghi vào nhật ký. Nội dung tin nhắn riêng không hiển thị.</div>
      </div>
      <div className="adm-grid2">
        <div className="adm-stack">
          <Card title="Doanh nghiệp của họ">
            {v.companies.length === 0 ? <None>Người dùng chưa có hồ sơ doanh nghiệp — bảng điều khiển sẽ mời tạo hoặc nhận hồ sơ.</None> : (
              <ul className="adm-log">{v.companies.map((c) => (
                <li key={c.id}>
                  <span>
                    <Link href={`/admin/companies/${c.id}`} style={{ color: 'var(--navy)', fontWeight: 600 }}>{c.name}</Link><br />
                    <small>{MEMBER_ROLE[c.role] ?? c.role} · {TIER[c.verified_tier]?.l} · hồ sơ {c.completeness}% · Trust {Math.round(c.trust_score ?? 0)} · gói {c.plan ?? 'Free'}</small>
                    {c.unclaimed_fields.length > 0 && <><br /><small>Còn thiếu: {c.unclaimed_fields.join(', ')}</small></>}
                  </span>
                  <Status s={c.status} />
                </li>
              ))}</ul>
            )}
          </Card>
          <Card title="Tin đăng">
            {v.listings.length === 0 ? <None>Chưa đăng tin nào.</None> : (
              <ul className="adm-log">{v.listings.map((l) => (
                <li key={l.id}><span><a href={`/marketplace/${l.id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--navy)', fontWeight: 600 }}>{l.title}</a><br /><small>{fmtDate(l.created_at)} · {l.quotes} báo giá</small></span><Status s={l.status} /></li>
              ))}</ul>
            )}
          </Card>
          <Card title="Báo giá đã gửi">
            {v.quotes.length === 0 ? <None>Chưa gửi báo giá nào.</None> : (
              <ul className="adm-log">{v.quotes.map((q, i) => (
                <li key={i}><span><a href={`/marketplace/${q.listing_id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--navy)', fontWeight: 600 }}>{q.title}</a><br /><small>{fmtDate(q.created_at)} · {q.amount != null ? `${Number(q.amount).toLocaleString('vi-VN')} ₫` : 'Thương lượng'}</small></span><span className="bdg">{QUOTE[q.status] ?? q.status}</span></li>
              ))}</ul>
            )}
          </Card>
        </div>
        <div className="adm-stack">
          <Card title={`Thông báo (${v.unread} chưa đọc)`}>
            {v.notifications.length === 0 ? <None>Không có thông báo.</None> : (
              <ul className="adm-log">{v.notifications.map((n, i) => (
                <li key={i}><span>{n.is_read ? n.title : <b style={{ color: 'var(--navy)' }}>{n.title}</b>}<br /><small>{n.body}</small></span><small>{fmtDate(n.created_at, true)}</small></li>
              ))}</ul>
            )}
          </Card>
          <Card title="Tin nhắn"><None>Đang tham gia {v.conversations} cuộc trò chuyện. Nội dung không hiển thị để bảo vệ quyền riêng tư.</None></Card>
        </div>
      </div>
    </>
  );
}
