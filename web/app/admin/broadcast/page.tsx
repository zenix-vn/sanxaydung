import type { Metadata } from 'next';
import { requireAdmin, fmtDate } from '@/lib/admin';
import { Empty } from '@/components/admin/ui';
import BroadcastForm from './BroadcastForm';

export const metadata: Metadata = { title: 'Gửi thông báo' };

type Row = { id: string; title: string; body: string; recipients: number; created_at: string; profiles: { full_name: string | null } | null };

export default async function BroadcastPage() {
  const { supa } = await requireAdmin('/admin/broadcast', 'admin');
  const [{ data: provs }, { data }] = await Promise.all([
    supa.from('provinces').select('code, name').order('name'),
    supa.from('broadcasts').select('id, title, body, recipients, created_at, profiles:sent_by ( full_name )').order('created_at', { ascending: false }).limit(20),
  ]);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <div className="adm-h"><div><h1>Gửi thông báo</h1><p>Thông báo hiện ở biểu tượng chuông trong ứng dụng. Chưa gửi được email hay SMS vì máy chủ chưa cấu hình dịch vụ gửi.</p></div></div>
      <BroadcastForm provinces={(provs ?? []) as { code: string; name: string }[]} />
      <div className="adm-card">
        <div className="hd"><h2>Đã gửi gần đây</h2></div>
        {rows.length === 0 ? <Empty title="Chưa gửi thông báo nào" /> : (
          <div className="adm-tw"><table className="adm-t">
            <thead><tr><th>Thời gian</th><th>Nội dung</th><th className="num">Người nhận</th><th>Người gửi</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.created_at, true)}</td>
                <td style={{ maxWidth: 460 }}><b style={{ color: 'var(--navy)' }}>{r.title}</b><div className="muted">{r.body}</div></td>
                <td className="num">{r.recipients}</td>
                <td>{r.profiles?.full_name ?? '—'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </>
  );
}
