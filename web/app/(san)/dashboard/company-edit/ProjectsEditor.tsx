'use client';
import { Fragment, useMemo, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { MAX_FEATURED, PROJECT_KINDS } from '@/lib/profile';
import { ProjectPhotos, type Photo } from './PortfolioEditor';

export type Project = { id: string; title: string; role: string | null; year: number | null; province_code: string | null; cover_url: string | null; kind: string | null; is_featured: boolean };
type Prov = { code: string; name: string };
type Msg = (m: { ok: boolean; text: string }) => void;

const COLS = 'id, title, role, year, province_code, cover_url, kind, is_featured';
const BLANK = { title: '', role: '', year: '', province_code: '', kind: '' };

export default function ProjectsEditor({
  companyId, initial, initialPhotos, provinces, disabled, onMsg,
}: {
  companyId: string; initial: Project[]; initialPhotos: (Photo & { owner_id: string })[]; provinces: Prov[]; disabled: boolean; onMsg: Msg;
}) {
  const supa = useMemo(() => createSupabaseBrowser(), []);
  const [projects, setProjects] = useState<Project[]>(initial);
  const [photos, setPhotos] = useState(initialPhotos);
  const [photosOpen, setPhotosOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // id | 'new' | null
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const featured = projects.filter((p) => p.is_featured).length;
  const provName = (c: string | null) => provinces.find((p) => p.code === c)?.name;

  function open(p?: Project) {
    setEditing(p ? p.id : 'new');
    setForm(p ? { title: p.title, role: p.role ?? '', year: p.year ? String(p.year) : '', province_code: p.province_code ?? '', kind: p.kind ?? '' } : BLANK);
  }

  async function save() {
    if (!form.title.trim()) return onMsg({ ok: false, text: 'Nhập tên dự án.' });
    const year = form.year.trim() ? Number(form.year) : null;
    if (year !== null && (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 10)) return onMsg({ ok: false, text: 'Năm dự án không hợp lệ.' });
    const patch = { title: form.title.trim(), role: form.role.trim() || null, year, province_code: form.province_code || null, kind: form.kind || null };
    setBusy(true);
    const q = editing === 'new'
      ? supa.from('projects').insert({ ...patch, company_id: companyId }).select(COLS).single()
      : supa.from('projects').update(patch).eq('id', editing!).select(COLS).single();
    const { data, error } = await q;
    setBusy(false);
    if (error) return onMsg({ ok: false, text: error.message });
    const row = data as Project;
    setProjects((ps) => (editing === 'new' ? [row, ...ps] : ps.map((p) => (p.id === row.id ? row : p))));
    if (editing === 'new') setPhotosOpen(row.id);
    setEditing(null);
    onMsg({ ok: true, text: 'Đã lưu dự án.' });
  }

  async function feature(p: Project) {
    if (!p.is_featured && featured >= MAX_FEATURED) return onMsg({ ok: false, text: `Chỉ ghim tối đa ${MAX_FEATURED} dự án nổi bật. Bỏ ghim một dự án trước.` });
    setBusy(true);
    const { error } = await supa.from('projects').update({ is_featured: !p.is_featured }).eq('id', p.id);
    setBusy(false);
    if (error) return onMsg({ ok: false, text: error.message });
    setProjects((ps) => ps.map((x) => (x.id === p.id ? { ...x, is_featured: !p.is_featured } : x)));
  }

  async function del(id: string) {
    if (!confirm('Xóa dự án này?')) return;
    await supa.from('media').delete().eq('owner_type', 'project').eq('owner_id', id);
    const { error } = await supa.from('projects').delete().eq('id', id);
    if (error) return onMsg({ ok: false, text: error.message });
    setProjects((p) => p.filter((x) => x.id !== id));
  }

  const editor = (
    <div className="crud-form">
      <div className="form-grid">
        <div className="full"><label>Tên dự án <span className="req">*</span></label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div>
          <label>Loại công trình</label>
          <select className="select" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="">—</option>
            {Object.entries(PROJECT_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div><label>Vai trò</label><input className="input" placeholder="Tổng thầu…" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
        <div><label>Năm</label><input className="input" inputMode="numeric" maxLength={4} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></div>
        <div>
          <label>Khu vực</label>
          <select className="select" value={form.province_code} onChange={(e) => setForm({ ...form, province_code: e.target.value })}>
            <option value="">—</option>
            {provinces.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div className="row mt-16" style={{ gap: 8 }}>
        <button type="button" className="btn btn-orange btn-sm" onClick={save} disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu'}</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(null)} disabled={busy}>Hủy</button>
      </div>
    </div>
  );

  return (
    <div className="card-block" id="projects">
      <h2 className="between">
        <span>Dự án portfolio</span>
        <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Nổi bật {featured}/{MAX_FEATURED}</span>
      </h2>
      <p className="muted mb-16">Bấm ngôi sao để ghim tối đa {MAX_FEATURED} dự án lên đầu. Chọn loại công trình để khách lọc được.</p>
      {projects.length === 0 && editing !== 'new' && <p className="muted" style={{ fontSize: 13 }}>Chưa có dự án.</p>}
      {projects.map((p) => {
        const mine = photos.filter((x) => x.owner_id === p.id);
        return (
          <Fragment key={p.id}>
            {editing === p.id ? editor : (
              <div className="crud-row">
                <span className="sc-thumb">{p.cover_url && <img src={p.cover_url} alt="" loading="lazy" />}</span>
                <div style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                  <b style={{ color: 'var(--navy)' }}>{p.title}</b>
                  <div className="muted" style={{ fontSize: 12.5 }}>{[p.kind ? PROJECT_KINDS[p.kind] : null, p.role, p.year, provName(p.province_code)].filter(Boolean).join(' · ') || 'Chưa có thông tin'}</div>
                </div>
                <div className="row sc-actions">
                  <button type="button" className={`sc-star ${p.is_featured ? 'on' : ''}`} onClick={() => feature(p)} disabled={disabled || busy} aria-pressed={p.is_featured} aria-label="Ghim dự án nổi bật" title="Ghim nổi bật">
                    <svg className="ic"><use href={p.is_featured ? '#ic-star-f' : '#ic-star'} /></svg>
                  </button>
                  <button type="button" className="btn-link" onClick={() => setPhotosOpen(photosOpen === p.id ? null : p.id)}>Ảnh{mine.length ? ` (${mine.length})` : ''}</button>
                  {!disabled && <button type="button" className="btn-link" onClick={() => open(p)} disabled={busy}>Sửa</button>}
                  {!disabled && <button type="button" className="btn-link danger" onClick={() => del(p.id)} disabled={busy}>Xóa</button>}
                </div>
              </div>
            )}
            {photosOpen === p.id && (
              <div style={{ background: '#fafbfc', padding: 10, borderRadius: 10 }}>
                <ProjectPhotos
                  companyId={companyId}
                  projectId={p.id}
                  cover={p.cover_url}
                  photos={mine}
                  onChange={(list) => setPhotos((all) => [...all.filter((x) => x.owner_id !== p.id), ...list.map((x) => ({ ...x, owner_id: p.id }))])}
                  disabled={disabled}
                  onMsg={onMsg}
                  onCover={(url) => setProjects((ps) => ps.map((x) => (x.id === p.id ? { ...x, cover_url: url } : x)))}
                />
              </div>
            )}
          </Fragment>
        );
      })}
      {editing === 'new' && editor}
      {!disabled && editing === null && (
        <button type="button" className="btn btn-outline btn-sm mt-16" onClick={() => open()}>
          <svg className="ic"><use href="#ic-plus" /></svg> Thêm dự án
        </button>
      )}
    </div>
  );
}
