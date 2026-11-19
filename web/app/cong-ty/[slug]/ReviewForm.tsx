'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';

export interface Eligible { connectionId: string; reviewerId: string; reviewerName: string }

const CRITERIA: [string, string][] = [
  ['quality', 'Chất lượng'],
  ['progress', 'Tiến độ'],
  ['cost', 'Chi phí'],
  ['cooperation', 'Thái độ hợp tác'],
  ['safety', 'An toàn'],
  ['warranty', 'Bảo hành'],
];

export default function ReviewForm({ targetId, eligible }: { targetId: string; eligible: Eligible[] }) {
  const router = useRouter();
  const [pick, setPick] = useState(eligible[0]?.connectionId ?? '');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) return <div className="notice" style={{ background: 'var(--green-soft)', color: '#166534' }}>Cảm ơn bạn! Đánh giá đã được ghi nhận.</div>;
  const chosen = eligible.find((e) => e.connectionId === pick) ?? eligible[0];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (CRITERIA.some(([k]) => !scores[k])) return setErr('Vui lòng chấm đủ 6 tiêu chí (1–5 sao).');
    setBusy(true);
    setErr(null);
    const { error } = await createSupabaseBrowser().rpc('submit_review', {
      _connection: chosen.connectionId,
      _reviewer: chosen.reviewerId,
      _target: targetId,
      _quality: scores.quality,
      _progress: scores.progress,
      _cost: scores.cost,
      _cooperation: scores.cooperation,
      _safety: scores.safety,
      _warranty: scores.warranty,
      _comment: comment.trim() || null,
    });
    setBusy(false);
    if (error) return setErr(error.code === '23505' ? 'Bạn đã đánh giá kết nối này rồi.' : error.message);
    setDone(true);
    router.refresh();
  }

  return (
    <form onSubmit={submit} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
      <h3 style={{ fontSize: 15, color: 'var(--navy)', marginBottom: 10 }}>Viết đánh giá</h3>
      {eligible.length > 1 && (
        <select className="input" value={pick} onChange={(e) => setPick(e.target.value)} style={{ marginBottom: 12 }}>
          {eligible.map((x) => <option key={x.connectionId} value={x.connectionId}>Với tư cách: {x.reviewerName}</option>)}
        </select>
      )}
      {CRITERIA.map(([k, label]) => (
        <div key={k} className="between" style={{ padding: '6px 0' }}>
          <span style={{ fontSize: 13.5 }}>{label}</span>
          <span>
            {[1, 2, 3, 4, 5].map((n) => (
              <a key={n} onClick={() => setScores({ ...scores, [k]: n })} style={{ cursor: 'pointer', fontSize: 22, color: n <= (scores[k] ?? 0) ? 'var(--orange)' : '#cfd6de' }} aria-label={`${label} ${n} sao`}>★</a>
            ))}
          </span>
        </div>
      ))}
      <textarea className="textarea" placeholder="Chia sẻ trải nghiệm hợp tác (không bắt buộc)" value={comment} onChange={(e) => setComment(e.target.value)} style={{ minHeight: 90, width: '100%', marginTop: 10 }} maxLength={3000} />
      {err && <p style={{ color: '#a12622', fontSize: 13, margin: '8px 0' }}>{err}</p>}
      <button className="btn btn-orange" type="submit" disabled={busy} style={{ marginTop: 10 }}>{busy ? 'Đang gửi…' : 'Gửi đánh giá'}</button>
    </form>
  );
}
