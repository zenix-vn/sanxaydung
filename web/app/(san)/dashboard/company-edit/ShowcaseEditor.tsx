'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { uploadCompanyImage, removeCompanyImage } from '@/lib/upload';
import {
  AWARD_KINDS, MAX_AWARDS, MAX_BRANCHES, MAX_FAQS, MAX_MILESTONES, MAX_PARTNERS, MAX_STAFF, PARTNER_KINDS, normalizeWebsite, safeHttpUrl,
  type Award, type Branch, type Faq, type Milestone, type Partner,
} from '@/lib/profile';
import LocationPicker from './LocationPicker';

type Msg = (m: { ok: boolean; text: string }) => void;
type Row = Record<string, any> & { id: string };
type Field = {
  key: string; label: string; type?: 'select' | 'year' | 'int' | 'url' | 'company' | 'textarea' | 'location';
  options?: Record<string, string>; required?: boolean; max?: number; placeholder?: string; full?: boolean;
  /** select cho phép bỏ trống */
  optional?: boolean;
};
type Config = {
  table: 'company_partners' | 'company_awards' | 'company_branches' | 'company_milestones' | 'company_faqs' | 'staff';
  anchor: string; title: string; note: string; addLabel: string; max: number;
  titleKey: string; fields: Field[];
  /** Bỏ trống nếu mục không có ảnh */
  image?: { key: string; label: string; folder: string };
  sub: (r: Row) => string;
};

/** Danh sách (kèm ảnh tùy chọn), sắp xếp được. Mỗi mục lưu ngay khi bấm Lưu. */
function ShowcaseList({ cfg, companyId, initial, disabled, onMsg }: { cfg: Config; companyId: string; initial: Row[]; disabled: boolean; onMsg: Msg }) {
  const supa = useMemo(() => createSupabaseBrowser(), []);
  const [rows, setRows] = useState<Row[]>(initial);
  const [editing, setEditing] = useState<string | null>(null); // id | 'new' | null
  const [form, setForm] = useState<Record<string, string>>({});
  const [image, setImage] = useState<string | null>(null);
  const [linked, setLinked] = useState<string | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Ảnh tải lên trong lúc đang sửa nhưng chưa lưu → xóa khi bỏ
  const fresh = useRef<string[]>([]);
  const locked = disabled || busy;
  const companyField = cfg.fields.find((f) => f.type === 'company');
  const hasMap = cfg.fields.some((f) => f.type === 'location');
  const img = cfg.image;

  function open(r?: Row) {
    discard();
    setEditing(r ? r.id : 'new');
    setForm(Object.fromEntries(cfg.fields.map((f) => [f.key, r?.[f.key] != null ? String(r[f.key]) : f.options && !f.optional ? Object.keys(f.options)[0] : ''])));
    setImage(img ? r?.[img.key] ?? null : null);
    setPos(r?.lat != null && r?.lng != null ? { lat: Number(r.lat), lng: Number(r.lng) } : null);
    setLinked(r?.linked_company_id ?? null);
  }
  function discard(keep?: string | null) {
    for (const url of fresh.current) if (url !== keep && img) removeCompanyImage(supa, companyId, img.folder, url);
    fresh.current = [];
  }
  function close() {
    discard();
    setEditing(null);
  }

  async function pickImage(f: File) {
    if (!img) return;
    setBusy(true);
    try {
      const url = await uploadCompanyImage(supa, companyId, img.folder, f, 1600);
      fresh.current.push(url);
      setImage(url);
    } catch (e) {
      onMsg({ ok: false, text: 'Tải ảnh thất bại: ' + (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const patch: Record<string, unknown> = img ? { [img.key]: image } : {};
    for (const f of cfg.fields) {
      if (f.type === 'location') {
        patch.lat = pos?.lat ?? null;
        patch.lng = pos?.lng ?? null;
        continue;
      }
      const v = (form[f.key] ?? '').trim();
      if (f.required && !v) return onMsg({ ok: false, text: `Nhập ${f.label.toLowerCase()}.` });
      if (f.type === 'year') {
        const n = v ? Number(v) : null;
        if (n !== null && (!Number.isInteger(n) || n < 1900 || n > new Date().getFullYear())) return onMsg({ ok: false, text: 'Năm không hợp lệ.' });
        patch[f.key] = n;
      } else if (f.type === 'int') {
        const n = v ? Number(v) : null;
        if (n !== null && (!Number.isInteger(n) || n < 0 || n > 80)) return onMsg({ ok: false, text: `${f.label} phải là số.` });
        patch[f.key] = n;
      } else if (f.type === 'url') {
        const u = v ? normalizeWebsite(v) : null;
        if (v && !u) return onMsg({ ok: false, text: `${f.label} không hợp lệ.` });
        patch[f.key] = u;
      } else patch[f.key] = v || null;
    }
    if (companyField) patch.linked_company_id = linked;
    setBusy(true);
    const old = img ? (rows.find((r) => r.id === editing)?.[img.key] as string | undefined) : undefined;
    const q = editing === 'new'
      ? supa.from(cfg.table).insert({ ...patch, company_id: companyId, sort_order: Math.max(-1, ...rows.map((r) => r.sort_order ?? 0)) + 1 }).select('*').single()
      : supa.from(cfg.table).update(patch).eq('id', editing!).select('*').single();
    const { data, error } = await q;
    setBusy(false);
    if (error) return onMsg({ ok: false, text: error.message });
    discard(image);
    if (img && old && old !== image) removeCompanyImage(supa, companyId, img.folder, old);
    setRows((rs) => (editing === 'new' ? [...rs, data as Row] : rs.map((r) => (r.id === editing ? (data as Row) : r))));
    setEditing(null);
    onMsg({ ok: true, text: 'Đã lưu.' });
  }

  async function remove(r: Row) {
    if (!confirm(`Xóa “${r[cfg.titleKey]}”?`)) return;
    setBusy(true);
    const { error } = await supa.from(cfg.table).delete().eq('id', r.id);
    if (!error) {
      if (img) await removeCompanyImage(supa, companyId, img.folder, r[img.key]);
      setRows((rs) => rs.filter((x) => x.id !== r.id));
    }
    setBusy(false);
    if (error) onMsg({ ok: false, text: error.message });
  }

  async function move(i: number, d: number) {
    const next = [...rows];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    const prev = rows;
    setRows(next.map((r, k) => ({ ...r, sort_order: k })));
    setBusy(true);
    const res = await Promise.all(next.map((r, k) => supa.from(cfg.table).update({ sort_order: k }).eq('id', r.id)));
    setBusy(false);
    const err = res.find((x) => x.error)?.error;
    if (err) {
      setRows(prev);
      onMsg({ ok: false, text: 'Không lưu được thứ tự: ' + err.message });
    }
  }

  const editor = (
    <div className="crud-form">
      <div className={img ? 'sc-form' : undefined}>
        {img && (
          <div>
            <button type="button" className="sc-img pick" onClick={() => fileRef.current?.click()} disabled={locked}>
              {safeHttpUrl(image) ? <img src={image!} alt="" /> : <span><svg className="ic"><use href="#ic-camera" /></svg>{img.label}</span>}
            </button>
            {image && <button type="button" className="btn-link danger" onClick={() => setImage(null)} disabled={locked}>Gỡ ảnh</button>}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) pickImage(f); e.target.value = ''; }} />
          </div>
        )}
        <div className="form-grid">
          {cfg.fields.map((f) => (
            <div key={f.key} className={f.full || f.type === 'company' || f.type === 'textarea' || f.type === 'location' ? 'full' : ''}>
              <label htmlFor={`${cfg.anchor}-${f.key}`}>{f.label}{f.required && <span className="req"> *</span>}</label>
              {f.type === 'select' ? (
                <select id={`${cfg.anchor}-${f.key}`} className="select" value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                  {f.optional && <option value="">—</option>}
                  {Object.entries(f.options!).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              ) : f.type === 'company' ? (
                <CompanySearch
                  id={`${cfg.anchor}-${f.key}`} selfId={companyId} value={form[f.key]} linked={linked} placeholder={f.placeholder} max={f.max}
                  onText={(v) => { setForm({ ...form, [f.key]: v }); setLinked(null); }}
                  onPick={(c) => { setForm({ ...form, [f.key]: c.name }); setLinked(c.id); }}
                />
              ) : f.type === 'textarea' ? (
                <textarea id={`${cfg.anchor}-${f.key}`} className="textarea" style={{ minHeight: 90 }} maxLength={f.max} value={form[f.key]} placeholder={f.placeholder} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              ) : f.type === 'location' ? (
                hasMap && <LocationPicker value={pos} onChange={setPos} province={form.province_code ?? ''} />
              ) : (
                <input id={`${cfg.anchor}-${f.key}`} className="input" inputMode={f.type === 'year' || f.type === 'int' ? 'numeric' : undefined} maxLength={f.max} value={form[f.key]} placeholder={f.placeholder} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="row mt-16" style={{ gap: 8 }}>
        <button type="button" className="btn btn-orange btn-sm" onClick={save} disabled={busy}>{busy ? 'Đang xử lý…' : 'Lưu'}</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={close} disabled={busy}>Hủy</button>
      </div>
    </div>
  );

  return (
    <div className="card-block" id={cfg.anchor}>
      <h2 className="between">
        <span>{cfg.title}</span>
        <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>{rows.length}/{cfg.max}</span>
      </h2>
      <p className="muted mb-16">{cfg.note}</p>
      {rows.length === 0 && editing !== 'new' && <p className="muted" style={{ fontSize: 13 }}>Chưa có mục nào.</p>}
      {rows.map((r, i) =>
        editing === r.id ? (
          <div key={r.id}>{editor}</div>
        ) : (
          <div key={r.id} className="crud-row">
            {img && <span className="sc-thumb">{safeHttpUrl(r[img.key]) && <img src={r[img.key]} alt="" loading="lazy" />}</span>}
            <div style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
              <b style={{ color: 'var(--navy)' }}>{r[cfg.titleKey]}</b>
              <div className="muted" style={{ fontSize: 12.5 }}>{cfg.sub(r)}</div>
            </div>
            {!disabled && (
              <div className="row sc-actions">
                <button type="button" className="sc-arrow" onClick={() => move(i, -1)} disabled={busy || editing !== null || i === 0} aria-label="Chuyển lên"><svg className="ic" style={{ transform: 'rotate(90deg)' }}><use href="#ic-chevron-left" /></svg></button>
                <button type="button" className="sc-arrow" onClick={() => move(i, 1)} disabled={busy || editing !== null || i === rows.length - 1} aria-label="Chuyển xuống"><svg className="ic"><use href="#ic-chevron-down" /></svg></button>
                <button type="button" className="btn-link" onClick={() => open(r)} disabled={busy}>Sửa</button>
                <button type="button" className="btn-link danger" onClick={() => remove(r)} disabled={busy}>Xóa</button>
              </div>
            )}
          </div>
        ),
      )}
      {editing === 'new' && editor}
      {!disabled && editing === null && rows.length < cfg.max && (
        <button type="button" className="btn btn-outline btn-sm mt-16" onClick={() => open()}>
          <svg className="ic"><use href="#ic-plus" /></svg> {cfg.addLabel}
        </button>
      )}
    </div>
  );
}

type Hit = { id: string; name: string };

/** Ô tên có gợi ý doanh nghiệp đang có hồ sơ trên sàn (chọn để liên kết; gõ tự do cũng được). */
function CompanySearch({ id, selfId, value, linked, onText, onPick, placeholder, max }: {
  id: string; selfId: string; value: string; linked: string | null; onText: (v: string) => void; onPick: (c: Hit) => void; placeholder?: string; max?: number;
}) {
  const supa = useMemo(() => createSupabaseBrowser(), []);
  const [hits, setHits] = useState<Hit[]>([]);
  useEffect(() => {
    const q = value.trim().replace(/[%_\\]/g, ' ');
    if (linked || q.length < 3) return setHits([]);
    let stale = false;
    const t = setTimeout(async () => {
      const { data } = await supa.from('companies').select('id, name').eq('status', 'published').is('deleted_at', null).neq('id', selfId).ilike('name', `%${q}%`).limit(6);
      if (!stale) setHits((data ?? []) as Hit[]);
    }, 300);
    return () => { stale = true; clearTimeout(t); };
  }, [value, linked, selfId, supa]);
  return (
    <>
      <input id={id} className="input" value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onText(e.target.value)} />
      {linked ? (
        <div className="hint" style={{ color: 'var(--green)' }}>✓ Đã liên kết với hồ sơ trên Sàn Xây Dựng. Sửa tên để bỏ liên kết.</div>
      ) : hits.length > 0 ? (
        <div className="sc-hits">
          <small>Có trên sàn, bấm để liên kết:</small>
          {hits.map((h) => <button type="button" key={h.id} onClick={() => onPick(h)}>{h.name}</button>)}
        </div>
      ) : null}
    </>
  );
}

type ListProps<T> = { companyId: string; initial: T[]; disabled: boolean; onMsg: Msg };

export function PartnersEditor(p: ListProps<Partner>) {
  return (
    <ShowcaseList
      {...p}
      cfg={{
        table: 'company_partners', anchor: 'partners', title: 'Khách hàng & đối tác tiêu biểu', max: MAX_PARTNERS,
        note: 'Hiển thị dạng dải logo, ghi rõ do doanh nghiệp tự giới thiệu. Chỉ nêu tên đơn vị đồng ý cho bạn công khai.',
        addLabel: 'Thêm khách hàng / đối tác', titleKey: 'name', image: { key: 'logo_url', label: 'Logo', folder: 'partners' },
        sub: (r) => [PARTNER_KINDS[r.kind], r.linked_company_id ? 'Đã liên kết hồ sơ trên sàn' : null, r.website].filter(Boolean).join(' · '),
        fields: [
          { key: 'name', label: 'Tên đơn vị', type: 'company', required: true, max: 120, placeholder: 'Gõ tên để tìm trên sàn hoặc nhập tự do' },
          { key: 'kind', label: 'Quan hệ', type: 'select', options: PARTNER_KINDS },
          { key: 'website', label: 'Website', type: 'url', max: 300, placeholder: 'Không bắt buộc' },
        ],
      }}
    />
  );
}

export function AwardsEditor(p: ListProps<Award>) {
  return (
    <ShowcaseList
      {...p}
      cfg={{
        table: 'company_awards', anchor: 'awards', title: 'Giải thưởng & chứng nhận', max: MAX_AWARDS,
        note: 'ISO, bằng khen, giải thưởng ngành… Hiển thị với nhãn “Doanh nghiệp tự công bố”. Giấy tờ cần sàn xác minh hãy nộp ở mục Xác minh.',
        addLabel: 'Thêm giải thưởng / chứng nhận', titleKey: 'title', image: { key: 'image_url', label: 'Ảnh chụp', folder: 'awards' },
        sub: (r) => [AWARD_KINDS[r.kind], r.issuer, r.year].filter(Boolean).join(' · '),
        fields: [
          { key: 'title', label: 'Tên', required: true, max: 160, placeholder: 'vd. ISO 9001:2015' },
          { key: 'kind', label: 'Loại', type: 'select', options: AWARD_KINDS },
          { key: 'issuer', label: 'Đơn vị cấp', max: 160 },
          { key: 'year', label: 'Năm', type: 'year', max: 4 },
        ],
      }}
    />
  );
}

export function StaffEditor(p: ListProps<Record<string, any> & { id: string }>) {
  return (
    <ShowcaseList
      {...p}
      cfg={{
        table: 'staff', anchor: 'staff', title: 'Nhân sự chủ chốt', max: MAX_STAFF,
        note: 'Giới thiệu chỉ huy trưởng, kỹ sư chính kèm ảnh chân dung và chứng chỉ hành nghề để tăng độ tin cậy. Chỉ đăng khi người đó đồng ý.',
        addLabel: 'Thêm nhân sự', titleKey: 'full_name', image: { key: 'avatar_url', label: 'Ảnh chân dung', folder: 'staff' },
        sub: (r) => [r.title, r.experience_years != null ? `${r.experience_years} năm KN` : null, r.certificate].filter(Boolean).join(' · '),
        fields: [
          { key: 'full_name', label: 'Họ tên', required: true, max: 120 },
          { key: 'title', label: 'Chức danh', max: 120, placeholder: 'vd. Chỉ huy trưởng' },
          { key: 'experience_years', label: 'Số năm kinh nghiệm', type: 'int', max: 2 },
          { key: 'certificate', label: 'Chứng chỉ hành nghề', max: 200, placeholder: 'vd. Giám sát thi công hạng II' },
          { key: 'bio', label: 'Giới thiệu ngắn', type: 'textarea', max: 600 },
        ],
      }}
    />
  );
}

export function MilestonesEditor(p: ListProps<Milestone>) {
  return (
    <ShowcaseList
      {...p}
      cfg={{
        table: 'company_milestones', anchor: 'milestones', title: 'Mốc phát triển', max: MAX_MILESTONES,
        note: 'Các cột mốc đáng nhớ. Trang hồ sơ tự xếp theo năm.',
        addLabel: 'Thêm cột mốc', titleKey: 'title', image: { key: 'image_url', label: 'Ảnh', folder: 'milestones' },
        sub: (r) => [r.year, r.description].filter(Boolean).join(' · ').slice(0, 140),
        fields: [
          { key: 'year', label: 'Năm', type: 'year', required: true, max: 4 },
          { key: 'title', label: 'Sự kiện', required: true, max: 160, placeholder: 'vd. Thành lập công ty' },
          { key: 'description', label: 'Mô tả', type: 'textarea', max: 600 },
        ],
      }}
    />
  );
}

export function BranchesEditor({ provinces, ...p }: ListProps<Branch> & { provinces: { code: string; name: string }[] }) {
  const options = Object.fromEntries(provinces.map((x) => [x.code, x.name]));
  return (
    <ShowcaseList
      {...p}
      cfg={{
        table: 'company_branches', anchor: 'branches', title: 'Chi nhánh & văn phòng', max: MAX_BRANCHES,
        note: 'Địa chỉ, số điện thoại và vị trí trên bản đồ. Số điện thoại nhập ở đây hiển thị công khai đầy đủ.',
        addLabel: 'Thêm chi nhánh', titleKey: 'name',
        sub: (r) => [r.address, options[r.province_code], r.phone, r.lat != null ? 'Đã ghim bản đồ' : null].filter(Boolean).join(' · '),
        fields: [
          { key: 'name', label: 'Tên chi nhánh', required: true, max: 120, placeholder: 'vd. Văn phòng Đà Nẵng' },
          { key: 'phone', label: 'Điện thoại', max: 30 },
          { key: 'address', label: 'Địa chỉ', max: 300, full: true },
          { key: 'province_code', label: 'Tỉnh/thành', type: 'select', options, optional: true },
          { key: 'location', label: 'Vị trí trên bản đồ', type: 'location' },
        ],
      }}
    />
  );
}

export function FaqEditor(p: ListProps<Faq>) {
  return (
    <ShowcaseList
      {...p}
      cfg={{
        table: 'company_faqs', anchor: 'faqs', title: 'Câu hỏi thường gặp', max: MAX_FAQS,
        note: 'Trả lời sẵn những điều khách hay hỏi: phạm vi nhận việc, bảo hành, cách báo giá… Giúp trang dễ được tìm thấy trên Google.',
        addLabel: 'Thêm câu hỏi', titleKey: 'question',
        sub: (r) => String(r.answer).slice(0, 140),
        fields: [
          { key: 'question', label: 'Câu hỏi', required: true, max: 200, full: true },
          { key: 'answer', label: 'Trả lời', type: 'textarea', required: true, max: 2000 },
        ],
      }}
    />
  );
}
