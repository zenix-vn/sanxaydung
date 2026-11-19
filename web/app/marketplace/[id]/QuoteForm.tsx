'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { useMe } from '@/lib/me-client';
import { canEdit } from '@/lib/roles';
import { parseMoney } from '@/lib/ui';

export default function QuoteForm({ listingId, ownerCompanyId }: { listingId: string; ownerCompanyId: string }) {
  const me = useMe();
  const router = useRouter();
  const [companyId, setCompanyId] = useState('');
  const [price, setPrice] = useState('');
  const [timeline, setTimeline] = useState('');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Chỉ doanh nghiệp KHÁC chủ tin mới được báo giá
  const eligible = me.companies.filter((c) => canEdit(c) && c.id !== ownerCompanyId);
  const cid = companyId || eligible[0]?.id || '';
  const isOwner = me.companies.some((c) => c.id === ownerCompanyId);

  // Đã báo giá rồi? (unique listing_id + company_id)
  useEffect(() => {
    if (!cid) return;
    createSupabaseBrowser()
      .from('quotes')
      .select('id')
      .eq('listing_id', listingId)
      .eq('company_id', cid)
      .maybeSingle()
      .then(({ data }) => setSent(!!data));
  }, [cid, listingId]);

  if (!me.ready) return <p className="muted">Đang tải…</p>;
  if (!me.userId) {
    return (
      <div className="pill-note">
        <svg className="ic"><use href="#ic-shield-check" /></svg>
        <span>
          <a href={`/login?redirect=/marketplace/${listingId}`} style={{ color: 'var(--orange)', fontWeight: 700 }}>Đăng nhập</a> để gửi báo giá với tư cách doanh nghiệp của bạn.
        </span>
      </div>
    );
  }
  if (isOwner && eligible.length === 0) {
    return <p className="muted">Đây là tin của doanh nghiệp bạn — báo giá nhận được hiển thị bên dưới.</p>;
  }
  if (eligible.length === 0) {
    return (
      <div className="pill-note">
        <svg className="ic"><use href="#ic-lock" /></svg>
        <span>Bạn cần là biên tập viên trở lên của một doanh nghiệp để gửi báo giá. <a href="/dashboard" style={{ color: 'var(--orange)', fontWeight: 700 }}>Vào bảng điều khiển</a></span>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const amount = parseMoney(price);
    if (amount == null || amount <= 0) return setErr('Giá đề xuất chưa đúng (vd. 52.000.000.000 hoặc 52 tỷ).');
    setLoading(true);
    const supa = createSupabaseBrowser();
    const message = [timeline.trim() && `Thời gian thi công: ${timeline.trim()}`, note.trim()].filter(Boolean).join('\n\n') || null;
    const { error } = await supa.from('quotes').insert({ listing_id: listingId, company_id: cid, amount, message });
    if (error) {
      setLoading(false);
      return setErr(error.code === '23505' ? 'Doanh nghiệp của bạn đã báo giá cho tin này.' : error.message);
    }
    // Tạo kết nối (nền cho đánh giá xác thực sau này) — không chặn luồng nếu lỗi
    await supa.rpc('create_connection', { _target: ownerCompanyId, _as_company: cid, _listing: listingId });
    setLoading(false);
    setSent(true);
    router.refresh();
  }

  if (sent) {
    return (
      <div className="notice" style={{ background: 'var(--green-soft)', borderColor: '#86efac', color: '#166534' }}>
        <svg className="ic" style={{ width: 18, height: 18 }}><use href="#ic-check" /></svg>
        Doanh nghiệp của bạn đã gửi báo giá cho tin này.{' '}
        <a href={`/chat?to=${ownerCompanyId}&listing=${listingId}`} style={{ color: 'inherit', fontWeight: 700 }}>Nhắn tin cho chủ tin →</a>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      {eligible.length > 1 && (
        <div className="field-group">
          <label>Báo giá với tư cách</label>
          <select className="input" value={cid} onChange={(e) => setCompanyId(e.target.value)}>
            {eligible.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div className="field-group" style={{ marginBottom: 0 }}>
          <label>Giá đề xuất (VNĐ) <span className="req">*</span></label>
          <input className="input" placeholder="vd. 52.000.000.000 hoặc 52 tỷ" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </div>
        <div className="field-group" style={{ marginBottom: 0 }}>
          <label>Thời gian thi công</label>
          <input className="input" placeholder="vd. 18 tháng" value={timeline} onChange={(e) => setTimeline(e.target.value)} />
        </div>
      </div>
      <div className="field-group">
        <label>Thư ngỏ / thuyết minh</label>
        <textarea className="textarea" placeholder="Giới thiệu năng lực, kinh nghiệm công trình tương tự, cam kết tiến độ..." value={note} onChange={(e) => setNote(e.target.value)} style={{ minHeight: 120 }} maxLength={5000} />
      </div>
      {err && <div className="notice" style={{ background: '#fdecea', color: '#a12622', marginBottom: 14 }}>{err}</div>}
      <button className="btn btn-orange btn-lg" type="submit" disabled={loading}>
        {loading ? 'Đang gửi…' : (<><svg className="ic"><use href="#ic-send" /></svg> Gửi báo giá</>)}
      </button>
    </form>
  );
}
