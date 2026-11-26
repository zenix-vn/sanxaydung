'use client';
import { useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';

/** Phản hồi của doanh nghiệp dưới một đánh giá; chủ/quản trị doanh nghiệp được viết và sửa. */
export default function ReviewReply({ reviewId, companyName, initial, canReply }: {
  reviewId: string; companyName: string; initial: string | null; canReply: boolean;
}) {
  // giữ bản vừa lưu ở máy khách vì dữ liệu trang công khai được cache ngắn hạn
  const [reply, setReply] = useState(initial);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const text = (draft ?? '').trim();
    const { error } = await createSupabaseBrowser().rpc('reply_review', { _review: reviewId, _reply: text || null });
    setBusy(false);
    if (error) return setErr(error.message);
    setReply(text || null); setDraft(null);
  }

  if (draft !== null) {
    return (
      <form onSubmit={save} style={{ marginTop: 10, display: 'grid', gap: 8 }}>
        <textarea className="input" rows={3} autoFocus maxLength={2000} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Trả lời lịch sự, nêu rõ sự việc. Mọi người đều đọc được." aria-label="Phản hồi đánh giá" />
        {err && <span style={{ color: '#c0392b', fontSize: 12.5 }}>{err}</span>}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-orange btn-sm" disabled={busy || (!draft.trim() && !reply)}>{busy ? 'Đang lưu…' : draft.trim() || !reply ? 'Gửi phản hồi' : 'Xóa phản hồi'}</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setDraft(null)}>Hủy</button>
        </div>
      </form>
    );
  }
  return (
    <>
      {reply && (
        <div style={{ marginTop: 10, padding: '10px 14px', background: '#f6f8fb', borderLeft: '3px solid var(--navy)', borderRadius: 8 }}>
          <b style={{ fontSize: 12.5, color: 'var(--navy)' }}>Phản hồi từ {companyName}</b>
          <p style={{ margin: '4px 0 0', whiteSpace: 'pre-line' }}>{reply}</p>
        </div>
      )}
      {canReply && (
        <button type="button" onClick={() => setDraft(reply ?? '')} style={{ background: 'none', border: 'none', padding: '8px 0 0', color: 'var(--orange)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          {reply ? 'Sửa phản hồi' : 'Phản hồi đánh giá'}
        </button>
      )}
    </>
  );
}
