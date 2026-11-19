'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { useMe } from '@/lib/me-client';
import { canEdit } from '@/lib/roles';
import { parseMoney } from '@/lib/ui';

const TYPES: [string, string][] = [
  ['need_contractor', 'Tìm nhà thầu'],
  ['need_crew', 'Tìm đội thi công'],
  ['need_supplier', 'Tìm nhà cung cấp'],
  ['partnership', 'Tìm đối tác hợp tác'],
  ['offer_service', 'Chào dịch vụ / năng lực'],
  ['opportunity', 'Cơ hội khác'],
];

export default function NewListingForm({
  categories,
  provinces,
}: {
  categories: { id: string; name: string }[];
  provinces: { code: string; name: string }[];
}) {
  const me = useMe();
  const router = useRouter();
  const [companyId, setCompanyId] = useState('');
  const [type, setType] = useState('need_contractor');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [province, setProvince] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [deadline, setDeadline] = useState('');
  const [locationText, setLocationText] = useState('');
  const [startDate, setStartDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const editable = me.companies.filter(canEdit);
  const cid = companyId || editable[0]?.id || '';

  if (!me.ready) return <p className="muted">Đang tải…</p>;
  if (!me.userId) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <p className="muted" style={{ marginBottom: 14 }}>Bạn cần đăng nhập để đăng tin.</p>
        <a className="btn btn-orange" href="/login?redirect=/marketplace/new">Đăng nhập</a>
      </div>
    );
  }
  if (editable.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <p className="muted" style={{ marginBottom: 14 }}>
          Chỉ thành viên (biên tập viên trở lên) của một doanh nghiệp mới đăng được tin. Hãy nhận hồ sơ doanh nghiệp của bạn trước.
        </p>
        <a className="btn btn-orange" href="/dashboard">Vào bảng điều khiển</a>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const bf = from ? parseMoney(from) : null;
    const bt = to ? parseMoney(to) : null;
    if ((from && bf == null) || (to && bt == null)) return setErr('Ngân sách chưa đúng định dạng (vd. 500.000.000, 5 tỷ, 800tr).');
    if (bf != null && bt != null && bf > bt) return setErr('Ngân sách “từ” phải nhỏ hơn hoặc bằng “đến”.');
    setBusy(true);
    const supa = createSupabaseBrowser();
    const { data, error } = await supa
      .from('marketplace_listings')
      .insert({
        company_id: cid,
        author_id: me.userId,
        type,
        title: title.trim(),
        description: description.trim() || null,
        category_id: categoryId || null,
        province_code: province || null,
        budget_from: bf,
        budget_to: bt,
        deadline: deadline || null,
        location_text: locationText.trim() || null,
        start_date: startDate || null,
      })
      .select('id')
      .single();
    setBusy(false);
    if (error) return setErr(error.message);
    router.push(`/marketplace/${data.id}`);
  }

  return (
    <form onSubmit={submit}>
      {editable.length > 1 && (
        <div className="field-group">
          <label>Đăng với tư cách</label>
          <select className="input" value={cid} onChange={(e) => setCompanyId(e.target.value)}>
            {editable.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      <div className="field-group">
        <label>Loại tin <span className="req">*</span></label>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <div className="field-group">
        <label>Tiêu đề <span className="req">*</span></label>
        <input className="input" required minLength={10} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="vd. Cần tổng thầu tòa văn phòng 15 tầng tại Q.7" />
      </div>
      <div className="field-group">
        <label>Mô tả yêu cầu</label>
        <textarea className="textarea" style={{ minHeight: 140 }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Quy mô, hạng mục, yêu cầu năng lực, tiến độ mong muốn…" maxLength={8000} />
      </div>
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div className="field-group" style={{ marginBottom: 0 }}>
          <label>Lĩnh vực</label>
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— Chọn —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field-group" style={{ marginBottom: 0 }}>
          <label>Tỉnh / thành</label>
          <select className="input" value={province} onChange={(e) => setProvince(e.target.value)}>
            <option value="">Toàn quốc</option>
            {provinces.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div className="field-group" style={{ marginBottom: 0 }}>
          <label>Ngân sách từ (VNĐ)</label>
          <input className="input" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="vd. 500.000.000 hoặc 5 tỷ" />
        </div>
        <div className="field-group" style={{ marginBottom: 0 }}>
          <label>Ngân sách đến (VNĐ)</label>
          <input className="input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="vd. 800tr" />
        </div>
      </div>
      <div className="field-group">
        <label>Địa điểm công trình</label>
        <input className="input" value={locationText} onChange={(e) => setLocationText(e.target.value)} placeholder="vd. Quận 7, TP.HCM" maxLength={200} />
      </div>
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div className="field-group" style={{ marginBottom: 0 }}>
          <label>Hạn nhận báo giá</label>
          <input className="input" type="date" value={deadline} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDeadline(e.target.value)} />
        </div>
        <div className="field-group" style={{ marginBottom: 0 }}>
          <label>Dự kiến khởi công</label>
          <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
      </div>
      {err && <div className="notice" style={{ background: '#fdecea', color: '#a12622', marginBottom: 14 }}>{err}</div>}
      <button className="btn btn-orange btn-lg" type="submit" disabled={busy}>
        {busy ? 'Đang đăng…' : 'Đăng tin'}
      </button>
    </form>
  );
}
