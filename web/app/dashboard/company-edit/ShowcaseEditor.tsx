'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { uploadCompanyImage, removeCompanyImage } from '@/lib/upload';
import {
  AWARD_KINDS, MAX_AWARDS, MAX_PARTNERS, PARTNER_KINDS, normalizeWebsite, safeHttpUrl,
  type Award, type Partner,
} from '@/lib/profile';

type Msg = (m: { ok: boolean; text: string }) => void;
type Row = Record<string, any> & { id: string };
type Field = { key: string; label: string; type?: 'select' | 'year' | 'url' | 'company'; options?: Record<string, string>; required?: boolean; max?: number; placeholder?: string };
type Config = {
  table: 'company_partners' | 'company_awards'; anchor: string; title: string; note: string; addLabel: string; max: number;
  titleKey: string; imageKey: string; imageLabel: string; folder: string; fields: Field[];
  sub: (r: Row) => string;
};

/** Danh sách có ảnh, sắp xếp được. Mỗi mục lưu ngay khi bấm Lưu. */
function ShowcaseList({ cfg, companyId, initial, disabled, onMsg }: { cfg: Config; companyId: string; initial: Row[]; disabled: boolean; onMsg: Msg }) {
  const supa = useMemo(() => createSupabaseBrowser(), []);
  const [rows, setRows] = useState<Row[]>(initial);
  const [editing, setEditing] = useState<string | null>(null); // id | 'new' | null
  const [form, setForm] = useState<Record<string, string>>({});
  const [image, setImage] = useState<string | null>(null);
  const [linked, setLinked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Ảnh tải lên trong lúc đang sửa nhưng chưa lưu → xóa khi bỏ
  const fresh = useRef<string[]>([]);
  const locked = disabled || busy;
  const companyField = cfg.fields.find((f) => f.type === 'company');

  function open(r?: Row) {
    discard();
    setEditing(r ? r.id : 'new');
    setForm(Object.fromEntries(cfg.fields.map((f) => [f.key, r?.[f.key] != null ? String(r[f.key]) : f.options ? Object.keys(f.options)[0] : ''])));
    setImage(r?.[cfg.imageKey] ?? null);
    setLinked(r?.linked_company_id ?? null);
  }
  function discard(keep?: string | null) {
    for (const url of fresh.current) if (url !== keep) removeCompanyImage(supa, companyId, cfg.folder, url);
    fresh.current = [];
  }
  function close() {
    discard();
    setEditing(null);
  }

  async function pickImage(f: File) {
    setBusy(true);
    try {
      const url = await uploadCompanyImage(supa, companyId, cfg.folder, f, 1600);
      fresh.current.push(url);
      setImage(url);
    } catch (e) {
      onMsg({ ok: false, text: 'Tải ảnh thất bại: ' + (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const patch: Record<string, unknown> = { [cfg.imageKey]: image };
    for (const f of cfg.fields) {
      const v = (form[f.key] ?? '').trim();
      if (f.required && !v) return onMsg({ ok: false, text: `Nhập ${f.label.toLowerCase()}.` });
      if (f.type === 'year') {
        const n = v ? Number(v) : null;
        if (n !== null && (!Number.isInteger(n) || n < 1900 || n > new Date().getFullYear())) return onMsg({ ok: false, text: 'Năm không hợp lệ.' });
        patch[f.key] = n;
      } else if (f.type === 'url') {
        const u = v ? normalizeWebsite(v) : null;
        if (v && !u) return onMsg({ ok: false, text: `${f.label} không hợp lệ.` });
        patch[f.key] = u;
      } else patch[f.key] = v || null;
    }
    if (companyField) patch.linked_company_id = linked;
    setBusy(true);
    const old = rows.find((r) => r.id === editing)?.[cfg.imageKey] as string | undefined;
    const q = editing === 'new'
      ? supa.from(cfg.table).insert({ ...patch, company_id: companyId, sort_order: Math.max(-1, ...rows.map((r) => r.sort_order ?? 0)) + 1 }).select('*').single()
      : supa.from(cfg.table).update(patch).eq('id', editing!).select('*').single();
    const { data, error } = await q;
    setBusy(false);
    if (error) return onMsg({ ok: false, text: error.message });
    discard(image);
    if (old && old !== image) removeCompanyImage(supa, companyId, cfg.folder, old);
    setRows((rs) => (editing === 'new' ? [...rs, data as Row] : rs.map((r) => (r.id === editing ? (data as Row) : r))));
    setEditing(null);
    onMsg({ ok: true, text: 'Đã lưu.' });
  }

  async function remove(r: Row) {
    if (!confirm(`Xóa “${r[cfg.titleKey]}”?`)) return;
    setBusy(true);
    const { error } = await supa.from(cfg.table).delete().eq('id', r.id);
    if (!error) {
      await removeCompanyImage(supa, companyId, cfg.folder, r[cfg.imageKey]);
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
      <div className="sc-form">
        <div>
          <button type="button" className="sc-img pick" onClick={() => fileRef.current?.click()} disabled={locked}>
            {safeHttpUrl(image) ? <img src={image!} alt="" /> : <span><svg className="ic"><use href="#ic-camera" /></svg>{cfg.imageLabel}</span>}
          </button>
          {image && <button type="button" className="btn-link danger" onClick={() => setImage(null)} disabled={locked}>Gỡ ảnh</button>}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) pickImage(f); e.target.value = ''; }} />
        </div>
        <div className="form-grid">
          {cfg.fields.map((f) => (
            <div key={f.key} className={f.type === 'company' ? 'full' : ''}>
              <label>{f.label}{f.required && <span className="req"> *</span>}</label>
              {f.type === 'select' ? (
                <select className="select" value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                  {Object.entries(f.options!).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              ) : f.type === 'company' ? (
                <CompanySearch
                  selfId={companyId} value={form[f.key]} linked={linked} placeholder={f.placeholder} max={f.max}
                  onText={(v) => { setForm({ ...form, [f.key]: v }); setLinked(null); }}
                  onPick={(c) => { setForm({ ...form, [f.key]: c.name }); setLinked(c.id); }}
                />
              ) : (
                <input className="input" inputMode={f.type === 'year' ? 'numeric' : undefined} maxLength={f.max} value={form[f.key]} placeholder={f.placeholder} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
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
            <span className="sc-thumb">{safeHttpUrl(r[cfg.imageKey]) && <img src={r[cfg.imageKey]} alt="" loading="lazy" />}</span>
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
function CompanySearch({ selfId, value, linked, onText, onPick, placeholder, max }: {
  selfId: string; value: string; linked: string | null; onText: (v: string) => void; onPick: (c: Hit) => void; placeholder?: string; max?: number;
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
      <input className="input" value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onText(e.target.value)} />
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
        addLabel: 'Thêm khách hàng / đối tác', titleKey: 'name', imageKey: 'logo_url', imageLabel: 'Logo', folder: 'partners',
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
        addLabel: 'Thêm giải thưởng / chứng nhận', titleKey: 'title', imageKey: 'image_url', imageLabel: 'Ảnh chụp', folder: 'awards',
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
