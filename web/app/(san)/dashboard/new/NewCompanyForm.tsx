'use client';
import { useMemo, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { toLocalVN } from '@/lib/phone';

export default function NewCompanyForm({ userId, defaultPhone }: { userId: string; defaultPhone: string }) {
  const supa = useMemo(() => createSupabaseBrowser(), []);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(defaultPhone);
  const [tax, setTax] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dup, setDup] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setDup(false);
    const local = toLocalVN(phone);
    if (!name.trim()) return setErr('Nhập tên doanh nghiệp.');
    if (!local) return setErr('Số điện thoại không hợp lệ.');
    if (tax && !/^\d{10}(-?\d{3})?$/.test(tax.trim())) return setErr('Mã số thuế gồm 10 hoặc 13 chữ số (có thể để trống).');
    setBusy(true);
    try {
      // RPC tạo công ty + thành viên owner atomic; SĐT trùng → 23505 → gợi ý nhận hồ sơ
      const { data: newId, error } = await supa.rpc('create_company', { _name: name.trim(), _phone: local, _tax_code: tax.trim() || null });
      if (error) {
        if (error.code === '23505') { setDup(true); return; }
        throw error;
      }
      // Đặt công ty vừa tạo làm công ty đang làm việc rồi chuyển tới trang hoàn thiện hồ sơ
      window.location.assign(`/dashboard/switch?to=${newId}&next=/dashboard/company-edit`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '48px auto', padding: '0 20px' }}>
      <div className="crumb"><a href="/dashboard">Bảng điều khiển</a><svg className="ic"><use href="#ic-chevron-right" /></svg> Tạo doanh nghiệp</div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--navy)', margin: '10px 0 16px' }}>Tạo doanh nghiệp mới</h1>
      <form className="card-block" onSubmit={submit}>
        <div className="field-group"><label>Tên doanh nghiệp <span className="req">*</span></label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field-group"><label>Số điện thoại <span className="req">*</span></label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xx xxx xxx" /><div className="hint">Dùng để chống trùng hồ sơ và để bạn nhận lại hồ sơ nếu đã có sẵn.</div></div>
        <div className="field-group"><label>Mã số thuế (không bắt buộc)</label><input className="input" value={tax} onChange={(e) => setTax(e.target.value)} /></div>
        {dup && (
          <div className="pill-note mb-16">
            <svg className="ic"><use href="#ic-building" /></svg>
            <span>Số điện thoại này đã có hồ sơ trên sàn. <a href={`/dashboard/claim?phone=${encodeURIComponent(phone)}`} style={{ color: 'var(--orange)', fontWeight: 600 }}>Nhận hồ sơ đó →</a></span>
          </div>
        )}
        {err && <p style={{ color: '#c0392b', fontSize: 13, marginBottom: 12 }}>{err}</p>}
        <button className="btn btn-orange btn-lg" disabled={busy} type="submit">{busy ? 'Đang tạo…' : 'Tạo & tiếp tục hoàn thiện hồ sơ'}</button>
      </form>
    </div>
  );
}
