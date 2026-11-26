'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/components/admin/ui';
import { GROUP_LABEL } from '@/lib/admin-labels';
import { createSupabaseBrowser } from '@/lib/supabase/client';

type Preview = { recipients: number; companies: number | null; unreachable: number | null };
const BLANK = { audience: 'companies', group: '', province: '', verified: '', plan: '' };

export default function BroadcastForm({ provinces }: { provinces: { code: string; name: string }[] }) {
  const { toast, ask } = useAdmin();
  const router = useRouter();
  const [filter, setFilter] = useState(BLANK);
  const [msg, setMsg] = useState({ title: '', body: '', link: '' });
  const [pv, setPv] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const clean = Object.fromEntries(Object.entries(filter).filter(([k, v]) => v && (k === 'audience' || filter.audience === 'companies')));
  const key = JSON.stringify(clean);

  useEffect(() => {
    let stale = false;
    setPv(null);
    createSupabaseBrowser().rpc('admin_broadcast_preview', { _filter: JSON.parse(key) }).then(({ data, error }) => {
      if (stale) return;
      if (error) toast('err', error.message); else setPv(data as Preview);
    });
    return () => { stale = true; };
  }, [key, toast]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!pv?.recipients) return;
    const ok = await ask({ title: `Gửi cho ${pv.recipients} người?`, message: `“${msg.title}”\n${msg.body}\n\nThông báo đã gửi không thu hồi được.`, confirmLabel: 'Gửi' });
    if (!ok) return;
    setBusy(true);
    const { data, error } = await createSupabaseBrowser().rpc('admin_broadcast_send', { _filter: clean, _title: msg.title, _body: msg.body, _link: msg.link || null });
    setBusy(false);
    if (error) return toast('err', error.message);
    toast('ok', `Đã gửi cho ${data} người`);
    setMsg({ title: '', body: '', link: '' });
    router.refresh();
  }

  const pick = (k: keyof typeof BLANK, label: string, options: [string, string][]) => (
    <label>{label}
      <select className="adm-in" value={filter[k]} onChange={(e) => setFilter({ ...filter, [k]: e.target.value })}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );

  return (
    <form className="adm-card" onSubmit={send} style={{ marginBottom: 16 }}>
      <div className="hd"><h2>Soạn thông báo</h2></div>
      <div className="bd">
        <div className="adm-fields">
          {pick('audience', 'Gửi tới', [['companies', 'Chủ & quản trị doanh nghiệp'], ['no_company', 'Người dùng chưa có doanh nghiệp'], ['all', 'Mọi người dùng']])}
          {filter.audience === 'companies' && (<>
            {pick('group', 'Nhóm lĩnh vực', [['', 'Tất cả'], ...Object.entries(GROUP_LABEL)])}
            {pick('province', 'Tỉnh/thành', [['', 'Toàn quốc'], ...provinces.map((p): [string, string] => [p.code, p.name])])}
            {pick('verified', 'Xác minh', [['', 'Tất cả'], ['no', 'Chưa xác minh'], ['yes', 'Đã xác minh']])}
            {pick('plan', 'Gói', [['', 'Tất cả'], ['free', 'Đang dùng miễn phí'], ['paid', 'Đang trả phí']])}
          </>)}
          <label className="full">Tiêu đề *<input className="adm-in" required maxLength={120} value={msg.title} onChange={(e) => setMsg({ ...msg, title: e.target.value })} placeholder="vd. Xác minh hồ sơ để được ưu tiên hiển thị" /></label>
          <label className="full">Nội dung *<textarea className="adm-in" required rows={3} maxLength={1000} value={msg.body} onChange={(e) => setMsg({ ...msg, body: e.target.value })} /></label>
          <label className="full">Liên kết trong sàn (không bắt buộc)<input className="adm-in" value={msg.link} onChange={(e) => setMsg({ ...msg, link: e.target.value })} placeholder="/dashboard/verify" /></label>
        </div>
        <div className="adm-reach" aria-live="polite">
          {!pv ? 'Đang đếm người nhận…' : (<>
            <b>{pv.recipients}</b> người sẽ nhận
            {pv.companies != null && <span> · {pv.companies} doanh nghiệp khớp bộ lọc{pv.unreachable ? `, trong đó ${pv.unreachable} chưa có người quản lý nên không nhận được (cần liên hệ qua điện thoại)` : ''}</span>}
          </>)}
        </div>
        <button className="ab p" type="submit" disabled={busy || !pv?.recipients}>{busy ? 'Đang gửi…' : 'Gửi thông báo'}</button>
      </div>
    </form>
  );
}
