'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { fmtRange } from '@/lib/format';
import { parseMoney } from '@/lib/ui';

const MAX_IMG = 5 * 1024 * 1024;
const MAX_PHOTOS = 12;
const ext = (f: File) => (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
const rid = () => Math.random().toString(36).slice(2, 10);

type Msg = (m: { ok: boolean; text: string }) => void;

// ======================= Ảnh dự án =======================
export type Photo = { id: string; url: string; caption: string | null };

/** Ảnh bìa (projects.cover_url) + thư viện ảnh (media owner_type='project') của một dự án. */
export function ProjectPhotos({
  companyId, projectId, cover, photos: initial, disabled, onMsg, onCover, onChange,
}: {
  companyId: string; projectId: string; cover: string | null; photos: Photo[]; disabled: boolean; onMsg: Msg;
  onCover: (url: string | null) => void; onChange: (photos: Photo[]) => void;
}) {
  const supa = useMemo(() => createSupabaseBrowser(), []);
  const [photos, setPhotos] = useState<Photo[]>(initial);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    onChange(photos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function add(files: FileList) {
    const list = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
    if (!list.length) return onMsg({ ok: false, text: `Tối đa ${MAX_PHOTOS} ảnh mỗi dự án.` });
    setBusy(true);
    let hasCover = !!cover;
    try {
      for (const f of list) {
        if (!f.type.startsWith('image/')) throw new Error(`${f.name}: chỉ nhận file ảnh.`);
        if (f.size > MAX_IMG) throw new Error(`${f.name}: ảnh tối đa 5MB.`);
        const path = `${companyId}/projects/${projectId}/${Date.now()}-${rid()}.${ext(f)}`;
        const up = await supa.storage.from('company-gallery').upload(path, f, { contentType: f.type });
        if (up.error) throw up.error;
        const url = supa.storage.from('company-gallery').getPublicUrl(path).data.publicUrl;
        const { data, error } = await supa
          .from('media')
          .insert({ company_id: companyId, owner_type: 'project', owner_id: projectId, kind: 'image', url, sort_order: photos.length })
          .select('id, url, caption')
          .single();
        if (error) throw error;
        setPhotos((p) => [...p, data as Photo]);
        // Ảnh đầu tiên tự làm ảnh bìa nếu dự án chưa có
        if (!hasCover) {
          await setAsCover(url);
          hasCover = true;
        }
      }
      onMsg({ ok: true, text: 'Đã tải ảnh dự án.' });
    } catch (e) {
      onMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function setAsCover(url: string | null) {
    const { error } = await supa.from('projects').update({ cover_url: url }).eq('id', projectId);
    if (error) return onMsg({ ok: false, text: error.message });
    onCover(url);
  }

  async function remove(p: Photo) {
    if (!confirm('Xóa ảnh này?')) return;
    setBusy(true);
    const marker = '/company-gallery/';
    const i = p.url.indexOf(marker);
    if (i >= 0) await supa.storage.from('company-gallery').remove([decodeURIComponent(p.url.slice(i + marker.length))]);
    const { error } = await supa.from('media').delete().eq('id', p.id);
    setBusy(false);
    if (error) return onMsg({ ok: false, text: error.message });
    setPhotos((x) => x.filter((y) => y.id !== p.id));
    if (cover === p.url) await setAsCover(photos.find((y) => y.id !== p.id)?.url ?? null);
  }

  return (
    <div className="pphotos">
      {photos.map((p) => (
        <div key={p.id} className={`pp ${cover === p.url ? 'is-cover' : ''}`} style={{ backgroundImage: `url(${p.url})` }}>
          {cover === p.url ? (
            <span className="tag">Ảnh bìa</span>
          ) : (
            !disabled && <button type="button" className="tag" onClick={() => setAsCover(p.url)} disabled={busy}>Đặt làm bìa</button>
          )}
          {!disabled && (
            <button type="button" className="del" onClick={() => remove(p)} disabled={busy} aria-label="Xóa ảnh">
              <svg className="ic"><use href="#ic-x" /></svg>
            </button>
          )}
        </div>
      ))}
      {!disabled && photos.length < MAX_PHOTOS && (
        <button type="button" className="pp add" onClick={() => ref.current?.click()} disabled={busy}>
          <svg className="ic"><use href="#ic-camera" /></svg>
          <span>{busy ? 'Đang tải…' : 'Thêm ảnh'}</span>
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files?.length) add(e.target.files); e.target.value = ''; }} />
    </div>
  );
}

// ======================= Danh sách CRUD chung =======================
type Field = { key: string; label: string; type?: 'text' | 'number' | 'money' | 'textarea'; placeholder?: string; required?: boolean; full?: boolean };
type Row = Record<string, any> & { id: string };

function CrudList({
  table, companyId, fields, rows: initial, disabled, onMsg, render, emptyText, addLabel,
}: {
  table: 'services' | 'equipment';
  companyId: string; fields: Field[]; rows: Row[]; disabled: boolean; onMsg: Msg;
  render: (r: Row) => React.ReactNode; emptyText: string; addLabel: string;
}) {
  const supa = useMemo(() => createSupabaseBrowser(), []);
  const blank = () => Object.fromEntries(fields.map((f) => [f.key, ''])) as Record<string, string>;
  const [rows, setRows] = useState<Row[]>(initial);
  const [editing, setEditing] = useState<string | null>(null); // id | 'new' | null
  const [form, setForm] = useState<Record<string, string>>(blank());
  const [busy, setBusy] = useState(false);

  function open(r?: Row) {
    setEditing(r ? r.id : 'new');
    setForm(
      r
        ? Object.fromEntries(fields.map((f) => [f.key, r[f.key] == null ? '' : f.type === 'money' ? Number(r[f.key]).toLocaleString('vi-VN') : String(r[f.key])]))
        : blank(),
    );
  }

  async function save() {
    const patch: Record<string, unknown> = {};
    for (const f of fields) {
      const v = (form[f.key] ?? '').trim();
      if (f.required && !v) return onMsg({ ok: false, text: `Nhập ${f.label.toLowerCase()}.` });
      if (f.type === 'number') {
        const n = v ? parseInt(v, 10) : null;
        if (v && (n == null || isNaN(n) || n < 0)) return onMsg({ ok: false, text: `${f.label} phải là số.` });
        patch[f.key] = n;
      } else if (f.type === 'money') {
        const n = v ? parseMoney(v) : null;
        if (v && n == null) return onMsg({ ok: false, text: `${f.label} chưa đúng định dạng (vd. 500.000, 5tr, 1 tỷ).` });
        patch[f.key] = n;
      } else patch[f.key] = v || null;
    }
    setBusy(true);
    const q = editing === 'new'
      ? supa.from(table).insert({ ...patch, company_id: companyId }).select('*').single()
      : supa.from(table).update(patch).eq('id', editing!).select('*').single();
    const { data, error } = await q;
    setBusy(false);
    if (error) return onMsg({ ok: false, text: error.message });
    setRows((rs) => (editing === 'new' ? [...rs, data as Row] : rs.map((r) => (r.id === editing ? (data as Row) : r))));
    setEditing(null);
  }

  async function del(id: string) {
    if (!confirm('Xóa mục này?')) return;
    setBusy(true);
    const { error } = await supa.from(table).delete().eq('id', id);
    setBusy(false);
    if (error) return onMsg({ ok: false, text: error.message });
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  const editor = (
    <div className="crud-form">
      <div className="form-grid">
        {fields.map((f) => (
          <div key={f.key} className={f.full || f.type === 'textarea' ? 'full' : ''}>
            <label>{f.label}{f.required && <span className="req"> *</span>}</label>
            {f.type === 'textarea' ? (
              <textarea className="textarea" style={{ minHeight: 70 }} value={form[f.key]} placeholder={f.placeholder} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
            ) : (
              <input className="input" inputMode={f.type === 'number' ? 'numeric' : undefined} value={form[f.key]} placeholder={f.placeholder} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
            )}
          </div>
        ))}
      </div>
      <div className="row mt-16" style={{ gap: 8 }}>
        <button type="button" className="btn btn-orange btn-sm" onClick={save} disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu'}</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(null)} disabled={busy}>Hủy</button>
      </div>
    </div>
  );

  return (
    <div>
      {rows.length === 0 && editing !== 'new' && <p className="muted" style={{ fontSize: 13 }}>{emptyText}</p>}
      {rows.map((r) =>
        editing === r.id ? (
          <div key={r.id}>{editor}</div>
        ) : (
          <div key={r.id} className="crud-row">
            <div style={{ flex: 1, minWidth: 0 }}>{render(r)}</div>
            {!disabled && (
              <div className="row" style={{ gap: 12 }}>
                <button type="button" className="btn-link" onClick={() => open(r)} disabled={busy}>Sửa</button>
                <button type="button" className="btn-link danger" onClick={() => del(r.id)} disabled={busy}>Xóa</button>
              </div>
            )}
          </div>
        ),
      )}
      {editing === 'new' && editor}
      {!disabled && editing === null && (
        <button type="button" className="btn btn-outline btn-sm mt-16" onClick={() => open()}>
          <svg className="ic"><use href="#ic-plus" /></svg> {addLabel}
        </button>
      )}
    </div>
  );
}

export function ServicesEditor(p: { companyId: string; rows: Row[]; disabled: boolean; onMsg: Msg }) {
  return (
    <CrudList
      {...p}
      table="services"
      addLabel="Thêm dịch vụ"
      emptyText="Chưa có dịch vụ. Liệt kê dịch vụ chính để khách hàng tìm thấy bạn đúng nhu cầu."
      fields={[
        { key: 'name', label: 'Tên dịch vụ', required: true, placeholder: 'vd. Thi công nhà xưởng thép tiền chế', full: true },
        { key: 'price_from', label: 'Giá từ', type: 'money', placeholder: 'vd. 3.500.000' },
        { key: 'price_to', label: 'Giá đến', type: 'money', placeholder: 'vd. 5tr' },
        { key: 'price_unit', label: 'Đơn vị tính', placeholder: 'vd. m², bộ, gói' },
        { key: 'description', label: 'Mô tả', type: 'textarea' },
      ]}
      render={(r) => (
        <>
          <b style={{ color: 'var(--navy)' }}>{r.name}</b>
          {fmtRange(r.price_from, r.price_to, r.price_unit) && <span className="muted" style={{ fontSize: 12.5 }}> · {fmtRange(r.price_from, r.price_to, r.price_unit)}</span>}
          {r.description && <div className="muted" style={{ fontSize: 12.5 }}>{String(r.description).slice(0, 140)}</div>}
        </>
      )}
    />
  );
}

export function EquipmentEditor(p: { companyId: string; rows: Row[]; disabled: boolean; onMsg: Msg }) {
  return (
    <CrudList
      {...p}
      table="equipment"
      addLabel="Thêm thiết bị"
      emptyText="Chưa có thiết bị. Liệt kê máy móc chính (cẩu tháp, máy xúc, giàn giáo…)."
      fields={[
        { key: 'name', label: 'Tên thiết bị', required: true },
        { key: 'quantity', label: 'Số lượng', type: 'number' },
        { key: 'note', label: 'Ghi chú', placeholder: 'vd. Sức nâng 8 tấn, đời 2020', full: true },
      ]}
      render={(r) => (
        <>
          <b style={{ color: 'var(--navy)' }}>{r.name}</b>
          {r.quantity != null && <span className="muted" style={{ fontSize: 12.5 }}> · SL {r.quantity}</span>}
          {r.note && <div className="muted" style={{ fontSize: 12.5 }}>{r.note}</div>}
        </>
      )}
    />
  );
}
