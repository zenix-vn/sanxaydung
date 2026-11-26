'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/components/admin/ui';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import type { Plan } from '@/lib/plans';

const LIMITS = [['listings', 'Tin đăng / tháng'], ['members', 'Số thành viên'], ['featured', 'Tin nổi bật / tháng']] as const;

export default function PlanEditor({ plan }: { plan: Plan }) {
  const { toast } = useAdmin();
  const router = useRouter();
  const init = () => ({
    name: plan.name, price: String(plan.price_month), desc: plan.features.desc ?? '',
    bullets: (plan.features.bullets ?? []).join('\n'), excluded: (plan.features.excluded ?? []).join('\n'),
    contact: !!plan.features.contact,
    listings: String(plan.features.listings ?? 0), members: String(plan.features.members ?? 0), featured: String(plan.features.featured ?? 0),
  });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(init);
  const [busy, setBusy] = useState(false);
  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await createSupabaseBrowser().rpc('admin_update_plan', {
      _id: plan.id, _name: f.name, _price: Number(f.price),
      _features: { desc: f.desc.trim(), bullets: lines(f.bullets), excluded: lines(f.excluded), contact: f.contact, listings: Number(f.listings), members: Number(f.members), featured: Number(f.featured) },
    });
    setBusy(false);
    if (error) return toast('err', error.message);
    toast('ok', 'Đã lưu. Trang bảng giá cập nhật trong khoảng 1 phút.');
    setOpen(false);
    router.refresh();
  }

  if (!open) return <button type="button" className="ab" onClick={() => { setF(init()); setOpen(true); }}><svg className="ic"><use href="#ic-edit" /></svg> Sửa gói</button>;
  return (
    <div className="adm-modal-bg">
      <form className="adm-modal wide" role="dialog" aria-modal="true" aria-label={`Sửa gói ${plan.name}`} onSubmit={save}>
        <h3>Sửa gói {plan.name}</h3>
        <p>Thay đổi hiện ngay trên trang bảng giá công khai. Thuê bao đang chạy giữ nguyên thời hạn.</p>
        <div className="adm-form">
          <label>Tên gói *<input className="adm-in" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label>Giá mỗi tháng (₫) *<input className="adm-in" type="number" min={0} step={1000} required value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></label>
          <label className="full">Mô tả ngắn<input className="adm-in" value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} /></label>
          <label className="full">Quyền lợi (mỗi dòng một ý)<textarea className="adm-in" rows={7} value={f.bullets} onChange={(e) => setF({ ...f, bullets: e.target.value })} /></label>
          <label className="full">Không bao gồm (mỗi dòng một ý)<textarea className="adm-in" rows={3} value={f.excluded} onChange={(e) => setF({ ...f, excluded: e.target.value })} /></label>
          {LIMITS.map(([k, label]) => (
            <label key={k}>{label}<input className="adm-in" type="number" min={-1} required value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
          ))}
        </div>
        <p style={{ margin: '8px 0' }}>Hạn mức: −1 là không giới hạn. Hạn mức hiện chỉ hiển thị và ghi nhận, hệ thống chưa tự chặn khi vượt.</p>
        <label className="adm-inline"><input type="checkbox" checked={f.contact} onChange={(e) => setF({ ...f, contact: e.target.checked })} /> Hiển thị &ldquo;Liên hệ&rdquo; thay cho giá trên trang công khai</label>
        <div className="ft">
          <button type="button" className="ab" onClick={() => setOpen(false)}>Hủy</button>
          <button type="submit" className="ab p" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu gói'}</button>
        </div>
      </form>
    </div>
  );
}
