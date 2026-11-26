'use client';
import { useState } from 'react';
import { supa as loadSupa } from '@/lib/supabase/lazy';

const REASONS = ['Thông tin sai sự thật / mạo danh', 'Nội dung lừa đảo hoặc spam', 'Xâm phạm quyền / thông tin cá nhân', 'Khác'];

// Báo cáo hồ sơ vi phạm → bảng reports (RLS: reporter_id = người đang đăng nhập).
export default function ReportButton({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setState('busy'); setErr(null);
    const supa = await loadSupa();
    const { data: { user } } = await supa.auth.getUser();
    if (!user) { window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`; return; }
    const { error } = await supa.from('reports').insert({
      reporter_id: user.id, entity_type: 'company', entity_id: companyId,
      reason: note.trim() ? `${reason}: ${note.trim()}`.slice(0, 1000) : reason,
    });
    if (error) { setErr('Chưa gửi được báo cáo. Vui lòng thử lại.'); setState('idle'); return; }
    setState('done');
  }

  if (state === 'done') return <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>Đã gửi báo cáo, cảm ơn bạn</span>;
  return (
    <span style={{ position: 'relative', fontWeight: 400 }}>
      <a href="#" onClick={(e) => { e.preventDefault(); setOpen(!open); }} style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>Báo cáo</a>
      {open && (
        <span style={{ position: 'absolute', right: 0, top: 26, zIndex: 20, width: 300, background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 14, boxShadow: 'var(--shadow)', display: 'grid', gap: 10, textAlign: 'left' }}>
          <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
          <textarea className="input" rows={3} placeholder="Mô tả thêm (không bắt buộc)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={800} />
          {err && <span style={{ color: '#c0392b', fontSize: 12.5 }}>{err}</span>}
          <button className="btn btn-orange btn-sm" disabled={state === 'busy'} onClick={submit}>{state === 'busy' ? 'Đang gửi…' : 'Gửi báo cáo'}</button>
        </span>
      )}
    </span>
  );
}
