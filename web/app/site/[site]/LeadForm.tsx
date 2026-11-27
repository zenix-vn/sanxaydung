'use client';
import { useRef, useState } from 'react';

const NEEDS = [
  { v: 'quote', label: 'Báo giá công trình' },
  { v: 'consult', label: 'Tư vấn' },
  { v: 'other', label: 'Khác' },
];

export default function LeadForm({ companyId, companyName }: { companyId: string; companyName: string }) {
  const started = useRef(Date.now());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const f = new FormData(e.currentTarget);
    const phone = String(f.get('phone') ?? '').replace(/[^\d+]/g, '');
    if (String(f.get('name') ?? '').trim().length < 2) return setErr('Vui lòng nhập họ tên.');
    if (!/^(?:\+?84|0)\d{9,10}$/.test(phone)) return setErr('Số điện thoại chưa đúng, ví dụ 0912 345 678.');
    setBusy(true);
    try {
      const res = await fetch('/api/site-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: companyId,
          name: f.get('name'), phone: f.get('phone'), email: f.get('email'),
          need: f.get('need'), message: f.get('message'), website: f.get('website'),
          path: window.location.pathname, elapsed: Date.now() - started.current,
        }),
      });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !out.ok) throw new Error(out.error || 'Chưa gửi được yêu cầu, vui lòng thử lại.');
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Chưa gửi được yêu cầu, vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="ws-done" role="status">
        <span className="ws-ico"><svg className="ic"><use href="#ic-check" /></svg></span>
        <h3>Đã gửi yêu cầu!</h3>
        <p>{companyName} đã nhận được thông tin và sẽ liên hệ lại với bạn sớm nhất.</p>
      </div>
    );
  }

  return (
    <form className="ws-form" onSubmit={submit} noValidate>
      <div className="ws-row2">
        <label>Họ và tên *<input name="name" autoComplete="name" required maxLength={100} placeholder="Nguyễn Văn A" /></label>
        <label>Số điện thoại *<input name="phone" type="tel" inputMode="tel" autoComplete="tel" required maxLength={20} placeholder="0912 345 678" /></label>
      </div>
      <label>Email<input name="email" type="email" autoComplete="email" maxLength={200} placeholder="(không bắt buộc)" /></label>
      <fieldset>
        <legend>Bạn cần</legend>
        <div className="ws-needs">
          {NEEDS.map((n, i) => (
            <label key={n.v}><input type="radio" name="need" value={n.v} defaultChecked={i === 0} /><span>{n.label}</span></label>
          ))}
        </div>
      </fieldset>
      <label>Mô tả công trình<textarea name="message" rows={4} maxLength={2000} placeholder="Loại công trình, diện tích, địa điểm, thời gian dự kiến…" /></label>
      {/* Ô bẫy cho bot — người dùng không nhìn thấy */}
      <input className="ws-hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      {err && <p className="ws-err" role="alert">{err}</p>}
      <button className="ws-btn ws-btn-lg ws-btn-block" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi yêu cầu'}</button>
      <p className="ws-note">Thông tin chỉ được gửi tới {companyName} để liên hệ tư vấn.</p>
    </form>
  );
}
