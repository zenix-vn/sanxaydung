'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { useAdmin } from '@/components/admin/ui';

// Cấp gói theo slug doanh nghiệp (sau khi nhận chuyển khoản)
export default function GrantPlan({ plans }: { plans: { id: string; name: string }[] }) {
  const { toast } = useAdmin();
  const router = useRouter();
  const [slug, setSlug] = useState('');
  const [plan, setPlan] = useState(plans[0]?.id ?? '');
  const [months, setMonths] = useState('1');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const supa = createSupabaseBrowser();
    const key = slug.trim().replace(/^.*\/cong-ty\//, '').replace(/\/$/, '');
    const { data: co } = await supa.from('companies').select('id, name').eq('slug', key).maybeSingle();
    if (!co) { setBusy(false); return toast('err', `Không tìm thấy doanh nghiệp có slug “${key}”`); }
    const { error } = await supa.rpc('admin_grant_plan', { _company: (co as { id: string }).id, _plan: plan, _months: Number(months) });
    setBusy(false);
    if (error) return toast('err', error.message);
    toast('ok', `Đã cấp gói cho ${(co as { name: string }).name}`);
    setSlug('');
    router.refresh();
  }

  if (plans.length === 0) return <div className="notice">Chưa có gói nào trong bảng <code>plans</code>.</div>;
  return (
    <form className="adm-card" onSubmit={submit} style={{ marginBottom: 16 }}>
      <div className="hd"><h2>Cấp gói thủ công</h2></div>
      <div className="bd adm-search" style={{ alignItems: 'center' }}>
        <input className="adm-in" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Slug hoặc đường dẫn /cong-ty/…" required style={{ flex: '1 1 260px' }} aria-label="Slug doanh nghiệp" />
        <select className="adm-in" value={plan} onChange={(e) => setPlan(e.target.value)} aria-label="Gói">{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <input className="adm-in" type="number" min={1} max={36} value={months} onChange={(e) => setMonths(e.target.value)} style={{ width: 90 }} aria-label="Số tháng" />
        <span className="muted">tháng</span>
        <button className="ab o" type="submit" disabled={busy}>{busy ? 'Đang cấp…' : 'Cấp gói'}</button>
      </div>
    </form>
  );
}
