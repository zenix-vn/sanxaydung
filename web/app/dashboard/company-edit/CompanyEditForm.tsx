'use client';
import { useMemo, useRef, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';

type Company = Record<string, any>;
type Cat = { id: string; name: string; group_key: string };
type Prov = { code: string; name: string };
type Project = { id: string; title: string; role: string | null; year: number | null; province_code: string | null };
type Doc = { id: string; title: string; file_url: string; visibility: 'public' | 'members' | 'connections'; size_bytes: number | null };

const SIZES = ['1–10 người', '11–50 người', '51–200 người', 'Trên 200 người'];
const VIS: Record<Doc['visibility'], string> = { public: 'Công khai', members: 'Thành viên', connections: 'Đối tác kết nối' };
const MAX_IMG = 5 * 1024 * 1024;
const MAX_DOC = 25 * 1024 * 1024;

function slugify(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
const ext = (f: File) => (f.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');

export default function CompanyEditForm(props: {
  company: Company; canEdit: boolean; categories: Cat[]; provinces: Prov[];
  initialCategoryIds: string[]; initialProvinceCodes: string[]; initialProjects: Project[]; initialDocs: Doc[];
}) {
  const supa = useMemo(() => createSupabaseBrowser(), []);
  const co = props.company;
  const [f, setF] = useState({
    name: co.name ?? '', slug: co.slug ?? '', legal_name: co.legal_name ?? '',
    founded_year: co.founded_year ? String(co.founded_year) : '', size_range: co.size_range ?? '',
    intro: co.intro ?? '', description: co.description ?? '',
    phone: co.phone ?? '', email: co.email ?? '', website: co.website ?? '',
    province_code: co.province_code ?? '', address: co.address ?? '',
  });
  const [logo, setLogo] = useState<string | null>(co.logo_url ?? null);
  const [cover, setCover] = useState<string | null>(co.cover_url ?? null);
  const [catIds, setCatIds] = useState<string[]>(props.initialCategoryIds);
  const [locs, setLocs] = useState<string[]>(props.initialProvinceCodes);
  const [projects, setProjects] = useState<Project[]>(props.initialProjects);
  const [docs, setDocs] = useState<Doc[]>(props.initialDocs);
  const [completeness, setCompleteness] = useState<number>(co.profile_completeness ?? 0);
  const [status, setStatus] = useState<string>(co.status ?? 'draft');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [np, setNp] = useState({ title: '', role: '', year: '', province_code: '' });
  const logoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<any>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const toggle = (arr: string[], v: string, fn: (a: string[]) => void) =>
    fn(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const disabled = !props.canEdit || busy;

  async function upload(file: File, kind: 'logo' | 'cover') {
    setMsg(null);
    if (!file.type.startsWith('image/')) return setMsg({ ok: false, text: 'Chỉ nhận file ảnh.' });
    if (file.size > MAX_IMG) return setMsg({ ok: false, text: 'Ảnh tối đa 5MB.' });
    setBusy(true);
    try {
      const path = `${co.id}/${kind}-${Date.now()}.${ext(file)}`;
      const { error } = await supa.storage.from('company-logos').upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const url = supa.storage.from('company-logos').getPublicUrl(path).data.publicUrl;
      const col = kind === 'logo' ? 'logo_url' : 'cover_url';
      const { data, error: e2 } = await supa.from('companies').update({ [col]: url }).eq('id', co.id).select('profile_completeness').single();
      if (e2) throw e2;
      kind === 'logo' ? setLogo(url) : setCover(url);
      setCompleteness(data?.profile_completeness ?? completeness);
      setMsg({ ok: true, text: kind === 'logo' ? 'Đã cập nhật logo.' : 'Đã cập nhật ảnh bìa.' });
    } catch (err) {
      setMsg({ ok: false, text: 'Tải ảnh thất bại: ' + (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function save(publish: boolean) {
    setMsg(null);
    if (!f.name.trim()) return setMsg({ ok: false, text: 'Tên hiển thị là bắt buộc.' });
    const slug = slugify(f.slug || f.name);
    if (!slug) return setMsg({ ok: false, text: 'Đường dẫn hồ sơ không hợp lệ.' });
    const year = f.founded_year ? parseInt(f.founded_year, 10) : null;
    if (year !== null && (isNaN(year) || year < 1900 || year > new Date().getFullYear()))
      return setMsg({ ok: false, text: 'Năm thành lập không hợp lệ.' });
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) return setMsg({ ok: false, text: 'Email không hợp lệ.' });

    setBusy(true);
    try {
      const patch: Record<string, unknown> = {
        name: f.name.trim(), slug, legal_name: f.legal_name.trim() || null,
        founded_year: year, size_range: f.size_range || null,
        intro: f.intro.trim() || null, description: f.description.trim() || null,
        phone: f.phone.trim() || null, email: f.email.trim() || null,
        website: f.website.trim() || null, province_code: f.province_code || null,
        address: f.address.trim() || null,
      };
      if (publish) patch.status = 'published';
      const { data, error } = await supa.from('companies').update(patch).eq('id', co.id)
        .select('profile_completeness, status, slug').single();
      if (error) throw error.code === '23505' ? new Error('Đường dẫn này đã có doanh nghiệp khác dùng.') : error;
      setF((p) => ({ ...p, slug: data.slug }));
      setCompleteness(data.profile_completeness ?? 0);
      setStatus(data.status);

      // Đồng bộ lĩnh vực + khu vực (xóa rồi chèn lại)
      await supa.from('company_categories').delete().eq('company_id', co.id);
      if (catIds.length) {
        const { error: e } = await supa.from('company_categories').insert(catIds.map((category_id) => ({ company_id: co.id, category_id })));
        if (e) throw e;
      }
      await supa.from('company_locations').delete().eq('company_id', co.id);
      if (locs.length) {
        const { error: e } = await supa.from('company_locations').insert(locs.map((province_code) => ({ company_id: co.id, province_code })));
        if (e) throw e;
      }
      setMsg({ ok: true, text: publish ? 'Đã lưu & xuất bản hồ sơ.' : 'Đã lưu nháp.' });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function addProject() {
    if (!np.title.trim()) return setMsg({ ok: false, text: 'Nhập tên dự án.' });
    const year = np.year ? parseInt(np.year, 10) : null;
    const { data, error } = await supa.from('projects').insert({
      company_id: co.id, title: np.title.trim(), role: np.role.trim() || null,
      year: year && !isNaN(year) ? year : null, province_code: np.province_code || null,
    }).select('id, title, role, year, province_code').single();
    if (error) return setMsg({ ok: false, text: error.message });
    setProjects((p) => [data as Project, ...p]);
    setNp({ title: '', role: '', year: '', province_code: '' });
  }
  async function delProject(id: string) {
    if (!confirm('Xóa dự án này?')) return;
    const { error } = await supa.from('projects').delete().eq('id', id);
    if (error) return setMsg({ ok: false, text: error.message });
    setProjects((p) => p.filter((x) => x.id !== id));
  }

  async function addDoc(file: File) {
    setMsg(null);
    if (file.size > MAX_DOC) return setMsg({ ok: false, text: 'Tài liệu tối đa 25MB.' });
    setBusy(true);
    try {
      const path = `${co.id}/${Date.now()}-${slugify(file.name.replace(/\.[^.]+$/, '')) || 'tai-lieu'}.${ext(file)}`;
      const { error } = await supa.storage.from('company-documents').upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data, error: e2 } = await supa.from('documents').insert({
        company_id: co.id, title: file.name, file_url: path, visibility: 'connections', size_bytes: file.size,
      }).select('id, title, file_url, visibility, size_bytes').single();
      if (e2) throw e2;
      setDocs((d) => [data as Doc, ...d]);
    } catch (err) {
      setMsg({ ok: false, text: 'Tải tài liệu thất bại: ' + (err as Error).message });
    } finally {
      setBusy(false);
    }
  }
  async function openDoc(d: Doc) {
    const { data, error } = await supa.storage.from('company-documents').createSignedUrl(d.file_url, 120);
    if (error || !data) return setMsg({ ok: false, text: 'Không mở được tài liệu: ' + (error?.message ?? '') });
    window.open(data.signedUrl, '_blank', 'noopener');
  }
  async function setVis(id: string, visibility: Doc['visibility']) {
    const { error } = await supa.from('documents').update({ visibility }).eq('id', id);
    if (error) return setMsg({ ok: false, text: error.message });
    setDocs((d) => d.map((x) => (x.id === id ? { ...x, visibility } : x)));
  }
  async function delDoc(doc: Doc) {
    if (!confirm('Xóa tài liệu này?')) return;
    await supa.storage.from('company-documents').remove([doc.file_url]);
    const { error } = await supa.from('documents').delete().eq('id', doc.id);
    if (error) return setMsg({ ok: false, text: error.message });
    setDocs((d) => d.filter((x) => x.id !== doc.id));
  }

  const checklist = [
    { ok: !!f.name && !!f.intro && !!f.description, label: 'Tên & giới thiệu' },
    { ok: !!logo && !!cover, label: 'Logo & ảnh bìa' },
    { ok: !!f.phone && !!f.address && !!f.province_code, label: 'Liên hệ & địa chỉ' },
    { ok: !!f.founded_year && !!f.website, label: 'Năm thành lập & website' },
  ];
  const provName = (c: string | null) => props.provinces.find((p) => p.code === c)?.name ?? '—';
  const initialsOf = (co.name as string).split(' ').filter((w) => w.length > 1).slice(-2).map((w) => w[0].toUpperCase()).join('');

  return (
    <>
      <style>{`
        .edit-grid{display:grid;grid-template-columns:230px 1fr;gap:24px;align-items:start}
        .sec-nav{position:sticky;top:82px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px;box-shadow:var(--shadow-sm)}
        .sec-nav a{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:9px;font-size:13.5px;font-weight:600;color:var(--text);text-decoration:none}
        .sec-nav a svg{width:17px;height:17px;color:var(--muted)}
        .sec-nav a:hover{background:#f6f8fb}
        .media-edit{display:flex;gap:18px;align-items:flex-end;flex-wrap:wrap}
        .cover-up{flex:1;min-width:260px;height:130px;border-radius:12px;background:#12439c center/cover;display:grid;place-items:center;position:relative}
        .logo-up{width:100px;height:100px;border-radius:16px;background:#12439c center/cover;color:#fff;display:grid;place-items:center;font-weight:800;font-size:30px;position:relative;flex:none;cursor:pointer}
        .logo-up .cam{position:absolute;bottom:-6px;right:-6px;width:34px;height:34px;border-radius:50%;background:var(--orange);color:#fff;display:grid;place-items:center;border:3px solid #fff}
        .logo-up .cam svg{width:16px;height:16px}
        .savebar{position:sticky;bottom:0;background:#fff;border-top:1px solid var(--line);padding:14px 0;display:flex;justify-content:flex-end;align-items:center;gap:12px;z-index:40}
        .tagpick{display:flex;gap:8px;flex-wrap:wrap}
        .tagpick .chip{cursor:pointer;user-select:none}
        .completeness-widget{background:linear-gradient(135deg,#021e48,#12439c);color:#fff;border-radius:14px;padding:18px}
        .completeness-widget .n{font-size:30px;font-weight:800}
        .completeness-widget .progress{background:rgba(255,255,255,.2);margin:10px 0 14px}
        .completeness-widget li{list-style:none;font-size:12.5px;color:#c6d3e2;display:flex;align-items:center;gap:8px;padding:4px 0}
        .completeness-widget li svg{width:14px;height:14px;flex:none}
        .hint{font-size:12px;color:var(--muted);margin-top:5px}
        .table{width:100%;border-collapse:collapse;font-size:13.5px}
        .table th{text-align:left;padding:8px 12px;color:var(--muted);font-weight:600;font-size:12.5px;border-bottom:1px solid var(--line)}
        .table td{padding:10px 12px;border-bottom:1px solid var(--line-2)}
        .table tr:last-child td{border-bottom:none}
        .toast{padding:10px 14px;border-radius:10px;font-size:13px;margin-bottom:16px}
        .toast.ok{background:#f0fbf4;color:#0d6b3f;border:1px solid #b6e6c9}
        .toast.err{background:#fdf0ee;color:#c0392b;border:1px solid #f3c6bf}
        @media(max-width:900px){.edit-grid{grid-template-columns:1fr}.sec-nav{position:static;display:flex;flex-wrap:wrap;gap:4px}}
      `}</style>

      <section className="pagehead" style={{ padding: '22px 0' }}>
        <div className="container">
          <div className="crumb">
            <a href="/dashboard">Bảng điều khiển</a>
            <svg className="ic"><use href="#ic-chevron-right" /></svg>
            Chỉnh sửa hồ sơ
          </div>
          <div className="between">
            <h1>Chỉnh sửa hồ sơ doanh nghiệp</h1>
            <a className="btn btn-ghost" href={`/cong-ty/${co.slug}`}>
              <svg className="ic"><use href="#ic-eye" /></svg> Xem trước
            </a>
          </div>
        </div>
      </section>

      <section className="block" style={{ paddingTop: 26 }}>
        <div className="container edit-grid">
          <div>
            <nav className="sec-nav mb-24">
              <a href="#basic"><svg className="ic"><use href="#ic-building" /></svg> Thông tin cơ bản</a>
              <a href="#media"><svg className="ic"><use href="#ic-image" /></svg> Logo &amp; ảnh bìa</a>
              <a href="#field"><svg className="ic"><use href="#ic-briefcase" /></svg> Lĩnh vực &amp; khu vực</a>
              <a href="#intro"><svg className="ic"><use href="#ic-file-text" /></svg> Giới thiệu</a>
              <a href="#projects"><svg className="ic"><use href="#ic-clipboard" /></svg> Dự án</a>
              <a href="#docs"><svg className="ic"><use href="#ic-folder" /></svg> Hồ sơ năng lực</a>
              <a href="#contact"><svg className="ic"><use href="#ic-phone" /></svg> Liên hệ</a>
            </nav>
            <div className="completeness-widget">
              <div>Độ hoàn thiện hồ sơ</div>
              <div className="n">{completeness}%</div>
              <div className="progress"><div className="bar" style={{ width: `${completeness}%` }} /></div>
              <ul>
                {checklist.map((c) => (
                  <li key={c.label}>
                    <svg className="ic" style={{ color: c.ok ? '#4ade80' : 'var(--orange-2)' }}><use href={c.ok ? '#ic-check' : '#ic-plus'} /></svg> {c.label}
                  </li>
                ))}
              </ul>
              <div style={{ fontSize: 12, color: '#9db3cd', marginTop: 8 }}>
                Trạng thái: {status === 'published' ? 'Đã xuất bản' : status === 'draft' ? 'Bản nháp' : 'Bị tạm khóa'}
              </div>
            </div>
          </div>

          <div>
            {!props.canEdit && <div className="toast err">Bạn chỉ có quyền xem. Cần vai trò Editor trở lên để chỉnh sửa hồ sơ.</div>}
            {msg && <div className={`toast ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}

            <div className="card-block" id="basic">
              <h2>Thông tin cơ bản</h2>
              <p className="muted mb-16">Thông tin nhận diện doanh nghiệp trên nền tảng.</p>
              <div className="form-row">
                <div className="field-group">
                  <label>Tên hiển thị <span className="req">*</span></label>
                  <input className="input" value={f.name} onChange={set('name')} disabled={disabled} />
                </div>
                <div className="field-group">
                  <label>Đường dẫn hồ sơ (slug)</label>
                  <input className="input" value={f.slug} onChange={set('slug')} disabled={disabled} />
                  <div className="hint">sanxaydung.vn/cong-ty/<b>{slugify(f.slug) || '…'}</b></div>
                </div>
              </div>
              <div className="form-row">
                <div className="field-group">
                  <label>Tên pháp lý</label>
                  <input className="input" value={f.legal_name} onChange={set('legal_name')} disabled={disabled} />
                </div>
                <div className="field-group">
                  <label>
                    Mã số thuế{' '}
                    {co.verified_tier !== 'none' && <span className="badge green" style={{ fontWeight: 600 }}><svg className="ic"><use href="#ic-check" /></svg> Verified</span>}
                  </label>
                  <input className="input" value={co.tax_code ?? ''} readOnly placeholder="Chưa có — cập nhật ở mục Xác minh" style={{ background: '#f6f8fb' }} />
                </div>
              </div>
              <div className="form-row">
                <div className="field-group">
                  <label>Năm thành lập</label>
                  <input className="input" inputMode="numeric" value={f.founded_year} onChange={set('founded_year')} disabled={disabled} />
                </div>
                <div className="field-group">
                  <label>Quy mô nhân sự</label>
                  <select className="select" value={f.size_range} onChange={set('size_range')} disabled={disabled}>
                    <option value="">— Chọn —</option>
                    {SIZES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="card-block" id="media">
              <h2>Logo &amp; ảnh bìa</h2>
              <p className="muted mb-16">Ảnh tối đa 5MB, lưu công khai trong <code>company-logos/{'{company_id}'}/</code>.</p>
              <div className="media-edit">
                <div className="logo-up" style={logo ? { backgroundImage: `url(${logo})` } : undefined} onClick={() => !disabled && logoRef.current?.click()}>
                  {!logo && initialsOf}
                  <span className="cam"><svg className="ic"><use href="#ic-camera" /></svg></span>
                </div>
                <div className="cover-up" style={cover ? { backgroundImage: `url(${cover})` } : undefined}>
                  <button type="button" className="btn" disabled={disabled} onClick={() => coverRef.current?.click()} style={{ background: 'rgba(255,255,255,.9)', color: 'var(--navy)' }}>
                    <svg className="ic"><use href="#ic-camera" /></svg> Đổi ảnh bìa
                  </button>
                </div>
              </div>
              <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => { const x = e.target.files?.[0]; if (x) upload(x, 'logo'); e.target.value = ''; }} />
              <input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => { const x = e.target.files?.[0]; if (x) upload(x, 'cover'); e.target.value = ''; }} />
            </div>

            <div className="card-block" id="field">
              <h2>Lĩnh vực &amp; khu vực hoạt động</h2>
              <p className="muted mb-16">Giúp doanh nghiệp xuất hiện đúng bộ lọc &amp; gợi ý AI Matching (GĐ2).</p>
              <div className="field-group">
                <label>Nhóm &amp; lĩnh vực</label>
                <div className="tagpick">
                  {props.categories.map((c) => (
                    <span key={c.id} className={`chip ${catIds.includes(c.id) ? 'active' : ''}`} onClick={() => !disabled && toggle(catIds, c.id, setCatIds)}>{c.name}</span>
                  ))}
                </div>
              </div>
              <div className="field-group">
                <label>Khu vực hoạt động</label>
                <div className="tagpick">
                  {props.provinces.map((p) => (
                    <span key={p.code} className={`chip ${locs.includes(p.code) ? 'active' : ''}`} onClick={() => !disabled && toggle(locs, p.code, setLocs)}>{p.name}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="card-block" id="intro">
              <h2>Giới thiệu doanh nghiệp</h2>
              <p className="muted mb-16">Nội dung này tối ưu SEO cho Company Page (schema.org Organization).</p>
              <div className="field-group">
                <label>Mô tả ngắn (intro)</label>
                <input className="input" maxLength={200} value={f.intro} onChange={set('intro')} disabled={disabled} />
              </div>
              <div className="field-group">
                <label>Giới thiệu chi tiết</label>
                <textarea className="textarea" style={{ minHeight: 140 }} value={f.description} onChange={set('description')} disabled={disabled} />
              </div>
            </div>

            <div className="card-block" id="projects">
              <h2>Dự án portfolio</h2>
              {projects.length > 0 && (
                <table className="table">
                  <thead><tr><th>Dự án</th><th>Vai trò</th><th>Năm</th><th>Khu vực</th><th></th></tr></thead>
                  <tbody>
                    {projects.map((p) => (
                      <tr key={p.id}>
                        <td><b style={{ color: 'var(--navy)' }}>{p.title}</b></td>
                        <td>{p.role ?? '—'}</td><td>{p.year ?? '—'}</td><td>{provName(p.province_code)}</td>
                        <td><button type="button" disabled={disabled} onClick={() => delProject(p.id)} title="Xóa"><svg className="ic" style={{ width: 16, height: 16, color: 'var(--muted)' }}><use href="#ic-x" /></svg></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {props.canEdit && (
                <div className="form-row mt-16" style={{ alignItems: 'end' }}>
                  <div className="field-group"><label>Tên dự án</label><input className="input" value={np.title} onChange={(e) => setNp({ ...np, title: e.target.value })} /></div>
                  <div className="field-group"><label>Vai trò</label><input className="input" placeholder="Tổng thầu…" value={np.role} onChange={(e) => setNp({ ...np, role: e.target.value })} /></div>
                  <div className="field-group"><label>Năm</label><input className="input" inputMode="numeric" value={np.year} onChange={(e) => setNp({ ...np, year: e.target.value })} /></div>
                  <div className="field-group">
                    <label>Khu vực</label>
                    <select className="select" value={np.province_code} onChange={(e) => setNp({ ...np, province_code: e.target.value })}>
                      <option value="">—</option>
                      {props.provinces.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                    </select>
                  </div>
                  <button type="button" className="btn btn-outline btn-sm" onClick={addProject} style={{ marginBottom: 16 }}><svg className="ic"><use href="#ic-plus" /></svg> Thêm</button>
                </div>
              )}
            </div>

            <div className="card-block" id="docs">
              <h2 className="between">
                <span>Hồ sơ năng lực</span>
                {props.canEdit && (
                  <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => docRef.current?.click()}>
                    <svg className="ic"><use href="#ic-upload" /></svg> Tải tài liệu
                  </button>
                )}
              </h2>
              <input ref={docRef} type="file" hidden onChange={(e) => { const x = e.target.files?.[0]; if (x) addDoc(x); e.target.value = ''; }} />
              <p className="muted mb-16">Đặt mức riêng tư: công khai / thành viên / chỉ đối tác đã kết nối (tối đa 25MB/file).</p>
              {docs.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Chưa có tài liệu.</p>}
              {docs.map((d) => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 0', borderBottom: '1px solid var(--line-2)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <svg className="ic" style={{ color: 'var(--blue)' }}><use href={d.visibility === 'public' ? '#ic-file-text' : '#ic-lock'} /></svg>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => openDoc(d)} title="Mở tài liệu">
                      {d.title}{d.size_bytes ? ` (${(d.size_bytes / 1048576).toFixed(1)}MB)` : ''}
                    </span>
                  </span>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select className="select" style={{ width: 'auto' }} value={d.visibility} disabled={disabled} onChange={(e) => setVis(d.id, e.target.value as Doc['visibility'])}>
                      {(Object.keys(VIS) as Doc['visibility'][]).map((k) => <option key={k} value={k}>{VIS[k]}</option>)}
                    </select>
                    {props.canEdit && <button type="button" disabled={busy} onClick={() => delDoc(d)} title="Xóa"><svg className="ic" style={{ width: 16, height: 16, color: 'var(--muted)' }}><use href="#ic-x" /></svg></button>}
                  </span>
                </div>
              ))}
            </div>

            <div className="card-block" id="contact">
              <h2>Thông tin liên hệ</h2>
              <div className="form-row">
                <div className="field-group"><label>Điện thoại</label><input className="input" value={f.phone} onChange={set('phone')} disabled={disabled} /></div>
                <div className="field-group"><label>Email</label><input className="input" type="email" value={f.email} onChange={set('email')} disabled={disabled} /></div>
              </div>
              <div className="form-row">
                <div className="field-group"><label>Website</label><input className="input" value={f.website} onChange={set('website')} disabled={disabled} /></div>
                <div className="field-group">
                  <label>Tỉnh/thành trụ sở</label>
                  <select className="select" value={f.province_code} onChange={set('province_code')} disabled={disabled}>
                    <option value="">— Chọn —</option>
                    {props.provinces.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="field-group"><label>Địa chỉ</label><input className="input" value={f.address} onChange={set('address')} disabled={disabled} /></div>
            </div>

            <div className="savebar">
              <a className="btn btn-outline" href="/dashboard">Hủy</a>
              <button type="button" className="btn btn-outline" disabled={disabled} onClick={() => save(false)}>Lưu nháp</button>
              <button type="button" className="btn btn-orange" disabled={disabled} onClick={() => save(true)}>
                <svg className="ic"><use href="#ic-check" /></svg> {busy ? 'Đang lưu…' : 'Lưu & xuất bản'}
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
