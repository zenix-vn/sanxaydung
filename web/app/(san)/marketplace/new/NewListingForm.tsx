'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { useMe } from '@/lib/me-client';
import { canEdit } from '@/lib/roles';
import { parseMoney } from '@/lib/ui';
import { BoqEditor, cleanBoq, type BoqItem } from '@/components/Boq';

const TYPES: [string, string][] = [
  ['need_contractor', 'Tìm nhà thầu'],
  ['need_crew', 'Tìm đội thi công'],
  ['need_supplier', 'Tìm nhà cung cấp'],
  ['partnership', 'Tìm đối tác hợp tác'],
  ['offer_service', 'Chào dịch vụ / năng lực'],
  ['opportunity', 'Cơ hội khác'],
];

/** Dữ liệu tin có sẵn → form chạy ở chế độ sửa. */
export type ListingInit = {
  id: string; company_id: string; type: string; title: string; description: string | null; category_id: string | null;
  province_code: string | null; budget_from: number | null; budget_to: number | null; deadline: string | null;
  location_text: string | null; start_date: string | null; boq?: unknown;
};

const money = (n: number | null) => (n == null ? '' : n.toLocaleString('vi-VN'));

export default function NewListingForm({
  categories,
  provinces,
  initial,
  defaultCompanyId,
}: {
  categories: { id: string; name: string }[];
  provinces: { code: string; name: string }[];
  initial?: ListingInit;
  defaultCompanyId?: string;
}) {
  const me = useMe();
  const router = useRouter();
  const [companyId, setCompanyId] = useState(initial?.company_id ?? defaultCompanyId ?? '');
  const [type, setType] = useState(initial?.type ?? 'need_contractor');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? '');
  const [province, setProvince] = useState(initial?.province_code ?? '');
  const [from, setFrom] = useState(money(initial?.budget_from ?? null));
  const [to, setTo] = useState(money(initial?.budget_to ?? null));
  const [deadline, setDeadline] = useState(initial?.deadline ?? '');
  const [locationText, setLocationText] = useState(initial?.location_text ?? '');
  const [startDate, setStartDate] = useState(initial?.start_date ?? '');
  const [boq, setBoq] = useState<BoqItem[]>(cleanBoq(initial?.boq));
  const [showBoq, setShowBoq] = useState(cleanBoq(initial?.boq).length > 0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const editable = me.companies.filter(canEdit);
  const cid = initial?.company_id ?? (editable.some((c) => c.id === companyId) ? companyId : editable[0]?.id ?? '');

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
    const items = boq.map((r) => ({ ...r, name: r.name.trim(), unit: r.unit.trim() })).filter((r) => r.name);
    if (items.some((r) => r.qty != null && r.qty < 0)) return setErr('Khối lượng không được âm.');
    setBusy(true);
    const supa = createSupabaseBrowser();
    const fields = {
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
        boq: showBoq ? items : [],
    };
    if (initial) {
      const { error } = await supa.from('marketplace_listings').update(fields).eq('id', initial.id);
      setBusy(false);
      if (error) return setErr(error.message);
      router.push('/dashboard/listings');
      router.refresh();
      return;
    }
    const { data, error } = await supa
      .from('marketplace_listings')
      .insert({ ...fields, company_id: cid, author_id: me.userId })
      .select('id')
      .single();
    setBusy(false);
    if (error) return setErr(error.message);
    router.push(`/marketplace/${data.id}`);
  }

  return (
    <form onSubmit={submit}>
      {!initial && editable.length > 1 && (
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
          <input className="input" type="date" value={deadline} min={initial ? undefined : new Date().toISOString().slice(0, 10)} onChange={(e) => setDeadline(e.target.value)} />
        </div>
        <div className="field-group" style={{ marginBottom: 0 }}>
          <label>Dự kiến khởi công</label>
          <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
      </div>
      <div className="field-group">
        <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={showBoq} onChange={(e) => setShowBoq(e.target.checked)} style={{ accentColor: 'var(--orange)' }} />
          Đính kèm bảng khối lượng (BOQ) — nhà thầu báo đơn giá theo từng hạng mục, dễ so sánh
        </label>
        {showBoq && <BoqEditor value={boq} onChange={setBoq} />}
      </div>
      {err && <div className="notice" style={{ background: '#fdecea', color: '#a12622', marginBottom: 14 }}>{err}</div>}
      <button className="btn btn-orange btn-lg" type="submit" disabled={busy}>
        {busy ? 'Đang lưu…' : initial ? 'Lưu thay đổi' : 'Đăng tin'}
      </button>
    </form>
  );
}
