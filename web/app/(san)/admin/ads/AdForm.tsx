'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/components/admin/ui';
import CompanyPicker, { type Picked } from '@/components/admin/CompanyPicker';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { AD_SLOTS } from '@/lib/admin-labels';

export type AdRow = {
  id: string; title: string | null; slot: string; creative_url: string; target_url: string; starts_at: string | null; ends_at: string | null; status: string;
  company_id: string | null; company: string | null; company_phone: string | null; impressions: number; clicks: number; impressions_30: number; clicks_30: number;
};
// ngày (giờ Việt Nam) ↔ mốc thời gian
const toDay = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }) : '');
const startOf = (d: string) => (d ? `${d}T00:00:00+07:00` : null);
const endOf = (d: string) => (d ? `${d}T23:59:59+07:00` : null);

export default function AdForm({ ad }: { ad?: AdRow }) {
  const { toast } = useAdmin();
  const router = useRouter();
  const init = () => ({ title: ad?.title ?? '', slot: ad?.slot ?? 'home_banner', image: ad?.creative_url ?? '', target: ad?.target_url ?? '', from: toDay(ad?.starts_at ?? null), to: toDay(ad?.ends_at ?? null) });
  const initCo = (): Picked | null => (ad?.company_id ? { id: ad.company_id, name: ad.company ?? '', phone: ad.company_phone } : null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(init);
  const [company, setCompany] = useState<Picked | null>(initCo);
  const [busy, setBusy] = useState('');

  async function upload(file: File | undefined) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return toast('err', 'Chỉ nhận ảnh JPG, PNG hoặc WebP');
    if (file.size > 2 * 1024 * 1024) return toast('err', 'Ảnh tối đa 2MB');
    setBusy('Đang tải ảnh…');
    const supa = createSupabaseBrowser();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${file.type.split('/')[1]}`;
    const { error } = await supa.storage.from('ad-creatives').upload(path, file, { contentType: file.type });
    setBusy('');
    if (error) return toast('err', `Tải ảnh thất bại: ${error.message}`);
    setF((p) => ({ ...p, image: supa.storage.from('ad-creatives').getPublicUrl(path).data.publicUrl }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.image) return toast('err', 'Chọn ảnh quảng cáo');
    setBusy('Đang lưu…');
    const { error } = await createSupabaseBrowser().rpc('admin_save_ad', {
      _id: ad?.id ?? null, _title: f.title, _slot: f.slot, _creative_url: f.image, _target_url: f.target.trim(),
      _company: company?.id ?? null, _starts_at: startOf(f.from), _ends_at: endOf(f.to),
    });
    setBusy('');
    if (error) return toast('err', error.message);
    toast('ok', 'Đã lưu quảng cáo');
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" className={ad ? 'ab' : 'ab o'} onClick={() => { setF(init()); setCompany(initCo()); setOpen(true); }}>
        <svg className="ic"><use href={ad ? '#ic-edit' : '#ic-plus'} /></svg> {ad ? 'Sửa' : 'Thêm quảng cáo'}
      </button>
    );
  }
  return (
    <div className="adm-modal-bg">
      <form className="adm-modal wide" role="dialog" aria-modal="true" aria-label={ad ? 'Sửa quảng cáo' : 'Thêm quảng cáo'} onSubmit={save}>
        <h3>{ad ? 'Sửa quảng cáo' : 'Thêm quảng cáo'}</h3>
        <p>Ảnh ngang, khuyến nghị 1200 × 240 px, tối đa 2MB. Nhiều quảng cáo cùng vị trí sẽ luân phiên ngẫu nhiên.</p>
        <div className="adm-form">
          <label className="full">Tiêu đề (mô tả ảnh) *<input className="adm-in" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <label>Vị trí<select className="adm-in" value={f.slot} onChange={(e) => setF({ ...f, slot: e.target.value })}>{Object.entries(AD_SLOTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Liên kết đích *<input className="adm-in" required value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} placeholder="https://… hoặc /cong-ty/…" /></label>
          <label>Chạy từ ngày<input className="adm-in" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
          <label>Đến hết ngày<input className="adm-in" type="date" min={f.from || undefined} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
          <div className="full adm-lbl"><span>Doanh nghiệp tài trợ (không bắt buộc)</span><CompanyPicker value={company} onChange={setCompany} /></div>
          <div className="full adm-lbl"><span>Ảnh *</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => upload(e.target.files?.[0])} />
            {f.image && <img src={f.image} alt="Xem trước" className="adm-preview" />}
          </div>
        </div>
        <div className="ft">
          <button type="button" className="ab" onClick={() => setOpen(false)}>Hủy</button>
          <button type="submit" className="ab p" disabled={!!busy}>{busy || 'Lưu'}</button>
        </div>
      </form>
    </div>
  );
}
