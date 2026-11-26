'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { ServicesEditor, EquipmentEditor, type Photo } from './PortfolioEditor';
import ProjectsEditor, { type Project } from './ProjectsEditor';
import { PartnersEditor, AwardsEditor, StaffEditor, MilestonesEditor, BranchesEditor, FaqEditor } from './ShowcaseEditor';
import { BannerFields, ContactFields } from './ExtraSettings';
import { AboutFields, SectionsEditor } from './ContentEditors';
import RichTextEditor from './RichTextEditor';
import { AppearanceEditor, HighlightsEditor, LinksEditor, toProfileForm, buildProfileSettings } from './AppearanceEditor';
import GalleryEditor from './GalleryEditor';
import { shrinkImage } from '@/lib/image';
import { cssUrl, type Award, type Branch, type Faq, type GalleryItem, type Milestone, type Partner } from '@/lib/profile';

type Company = Record<string, any>;
type Cat = { id: string; name: string; group_key: string };
type Prov = { code: string; name: string };
type Doc = { id: string; title: string; file_url: string; visibility: 'public' | 'members' | 'connections'; size_bytes: number | null };

const SIZES = ['1–10 người', '11–50 người', '51–200 người', 'Trên 200 người'];
const VIS: Record<Doc['visibility'], string> = { public: 'Công khai', members: 'Thành viên', connections: 'Đối tác kết nối' };
const MAX_IMG = 5 * 1024 * 1024;
const MAX_DOC = 20 * 1024 * 1024; // khớp giới hạn bucket company-documents
const DOC_TYPES = '.pdf,.docx,.xlsx,.jpg,.jpeg,.png,.webp';

function slugify(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
const ext = (f: File) => (f.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');

export default function CompanyEditForm(props: {
  company: Company; canEdit: boolean; canAdmin: boolean; categories: Cat[]; provinces: Prov[];
  initialCategoryIds: string[]; initialProvinceCodes: string[]; initialProjects: Project[]; initialDocs: Doc[];
  services: any[]; staff: any[]; equipment: any[]; projectPhotos: (Photo & { owner_id: string })[];
  gallery: GalleryItem[]; partners: Partner[]; awards: Award[]; milestones: Milestone[]; branches: Branch[]; faqs: Faq[];
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
  const [profile, setProfile] = useState(() => toProfileForm(co.profile_settings));
  const [catIds, setCatIds] = useState<string[]>(props.initialCategoryIds);
  const [locs, setLocs] = useState<string[]>(props.initialProvinceCodes);
  const [docs, setDocs] = useState<Doc[]>(props.initialDocs);
  const [completeness, setCompleteness] = useState<number>(co.profile_completeness ?? 0);
  const [status, setStatus] = useState<string>(co.status ?? 'draft');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Thông báo nổi theo màn hình; báo thành công tự ẩn, báo lỗi giữ đến khi bấm đóng
  useEffect(() => {
    if (!msg?.ok) return;
    const t = setTimeout(() => setMsg(null), 6000);
    return () => clearTimeout(t);
  }, [msg]);
  const logoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<any>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const toggle = (arr: string[], v: string, fn: (a: string[]) => void) =>
    fn(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const disabled = !props.canEdit || busy;
  // Tên, đường dẫn, pháp lý, trạng thái, màu thương hiệu: chỉ chủ sở hữu / quản trị (CSDL cũng chặn)
  const adminOnly = disabled || !props.canAdmin;

  async function upload(original: File, kind: 'logo' | 'cover') {
    setMsg(null);
    if (!original.type.startsWith('image/')) return setMsg({ ok: false, text: 'Chỉ nhận file ảnh.' });
    setBusy(true);
    try {
      // Logo giữ nguyên định dạng: còn dùng làm ảnh xem trước khi chia sẻ link
      const file = kind === 'logo' ? original : await shrinkImage(original, 2400);
      if (file.size > MAX_IMG) throw new Error('Ảnh tối đa 5MB.');
      const path = `${co.id}/${kind}-${Date.now()}.${ext(file)}`;
      const { error } = await supa.storage.from('company-logos').upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const url = supa.storage.from('company-logos').getPublicUrl(path).data.publicUrl;
      const col = kind === 'logo' ? 'logo_url' : 'cover_url';
      const { data, error: e2 } = await supa.from('companies').update({ [col]: url }).eq('id', co.id).select('profile_completeness').single();
      if (e2) throw e2;
      kind === 'logo' ? setLogo(url) : setCover(url);
      // Ảnh bìa mới → điểm lấy nét cũ không còn đúng
      if (kind === 'cover') setProfile((p) => ({ ...p, focus: { x: 50, y: 50 } }));
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
    const built = buildProfileSettings(profile);
    if ('error' in built) return setMsg({ ok: false, text: built.error });

    setBusy(true);
    try {
      const patch: Record<string, unknown> = {
        name: f.name.trim(), slug, legal_name: f.legal_name.trim() || null,
        founded_year: year, size_range: f.size_range || null,
        intro: f.intro.trim() || null, description: f.description.trim() || null,
        phone: f.phone.trim() || null, email: f.email.trim() || null,
        website: f.website.trim() || null, province_code: f.province_code || null,
        address: f.address.trim() || null,
        profile_settings: built.settings,
      };
      if (publish) patch.status = 'published';
      if (!props.canAdmin) {
        for (const k of ['name', 'slug', 'legal_name']) delete patch[k];
        // Giữ đúng màu đang lưu (quản trị có thể vừa đổi) — biên tập viên không được ghi đè
        const { data: cur, error: e0 } = await supa.from('companies').select('profile_settings').eq('id', co.id).single();
        if (e0) throw e0;
        const color = (cur.profile_settings as Record<string, unknown> | null)?.brand_color;
        const next: Record<string, unknown> = { ...built.settings };
        if (color === undefined) delete next.brand_color;
        else next.brand_color = color;
        patch.profile_settings = next;
      }
      const { data, error } = await supa.from('companies').update(patch).eq('id', co.id)
        .select('profile_completeness, status, slug').single();
      if (error) throw error.code === '23505' ? new Error('Đường dẫn này đã có doanh nghiệp khác dùng.') : error;
      setF((p) => ({ ...p, slug: data.slug }));
      setCompleteness(data.profile_completeness ?? 0);
      setStatus(data.status);
      setProfile(toProfileForm(built.settings));

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
      setMsg({ ok: true, text: publish ? 'Đã lưu & xuất bản hồ sơ.' : data.status === 'published' ? 'Đã lưu thay đổi.' : 'Đã lưu nháp.' });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function addDoc(file: File) {
    setMsg(null);
    if (file.size > MAX_DOC) return setMsg({ ok: false, text: 'Tài liệu tối đa 20MB.' });
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
  const initialsOf = (co.name as string).split(' ').filter((w) => w.length > 1).slice(-2).map((w) => w[0].toUpperCase()).join('');

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .edit-grid{display:grid;grid-template-columns:230px 1fr;gap:24px;align-items:start}
        .edit-grid>div{min-width:0}
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
        .toast{position:sticky;top:80px;z-index:45;padding:10px 14px;border-radius:10px;font-size:13px;margin-bottom:16px;box-shadow:var(--shadow-sm)}
        .toast.ok{background:#f0fbf4;color:#0d6b3f;border:1px solid #b6e6c9}
        .toast.err{background:#fdf0ee;color:#c0392b;border:1px solid #f3c6bf}
        .sub-h{font-size:15px;font-weight:800;color:var(--navy);margin:10px 0 4px}
        .swatches{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
        .sw{width:32px;height:32px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px var(--line);cursor:pointer}
        .sw.auto{width:auto;border-radius:20px;padding:0 12px;font-size:12.5px;font-weight:600;color:var(--navy);background:#fff}
        .sw.on{box-shadow:0 0 0 3px var(--navy)}
        .sw:disabled,.sw-custom input:disabled{opacity:.35;cursor:not-allowed}
        .sw.on:disabled{opacity:1}
        .swatches label.sw-custom{display:flex;align-items:center;gap:8px;margin:0;font-size:12.5px;cursor:pointer}
        .sw-custom input{width:36px;height:32px;padding:0;border:none;background:none;cursor:pointer}
        .sw-demo{display:inline-block;color:#fff;font-weight:700;border-radius:8px;padding:5px 12px;margin:0 6px}
        .focus-pick{position:relative;display:inline-block;max-width:100%;padding:0;border:none;background:none;cursor:crosshair;line-height:0}
        .focus-pick img{max-width:100%;max-height:300px;border-radius:10px}
        .focus-pick span{position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 2px var(--orange),0 2px 8px rgba(0,0,0,.4);pointer-events:none}
        .focus-sliders{display:flex;gap:20px;flex-wrap:wrap;margin:10px 0}
        .focus-sliders label{display:flex;align-items:center;gap:8px;margin:0;font-size:12.5px}
        .focus-previews{display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap}
        .focus-previews figure{margin:0}
        .focus-previews figure div{border-radius:8px;background-size:cover;background-color:#e6ebf1}
        .focus-previews .desk div{width:320px;max-width:70vw;aspect-ratio:1280/220}
        .focus-previews .mob div{width:125px;aspect-ratio:390/220}
        .focus-previews figcaption{font-size:11.5px;color:var(--muted);margin-top:4px}
        .hl-row{display:grid;grid-template-columns:150px 1fr;gap:10px;margin-bottom:10px}
        .gal-edit{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px}
        .ge{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff}
        .ge.dragging{opacity:.45}
        .ge-img{position:relative;aspect-ratio:4/3;background:#e6ebf1;display:grid;place-items:center;font-size:12.5px;color:var(--muted);cursor:grab}
        .ge-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
        .ge-img i{position:absolute;left:6px;top:6px;display:flex;align-items:center;gap:4px;font-style:normal;font-size:11px;font-weight:700;color:#fff;background:rgba(2,30,72,.75);border-radius:6px;padding:3px 7px}
        .ge-img i svg{width:12px;height:12px}
        .ge .input{border:none;border-top:1px solid var(--line-2);border-radius:0;font-size:12.5px;padding:8px 10px}
        .ge-bar{display:flex;border-top:1px solid var(--line-2)}
        .ge-bar button{flex:1;display:grid;place-items:center;padding:7px;background:none;border:none;cursor:pointer;color:var(--navy)}
        .ge-bar button:hover:not(:disabled){background:#f6f8fb}
        .ge-bar button:disabled{opacity:.3;cursor:default}
        .ge-bar button.del{color:#c0392b}
        .ge-bar svg{width:16px;height:16px}
        .gal-add{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:16px}
        .gal-add .input{flex:1;min-width:220px;width:auto}
        .card-block{scroll-margin-top:82px}
        .rte{border:1px solid var(--line);border-radius:10px;overflow:hidden}
        .rte-bar{display:flex;flex-wrap:wrap;gap:2px;padding:6px;background:#f6f8fb;border-bottom:1px solid var(--line)}
        .rte-bar button{display:flex;align-items:center;gap:5px;padding:6px 10px;border:none;border-radius:7px;background:none;color:var(--navy);font:600 12.5px/1 inherit;cursor:pointer}
        .rte-bar button:hover:not(:disabled),.rte-bar button.on{background:#fff;box-shadow:0 0 0 1px var(--line)}
        .rte-bar button:disabled{opacity:.4;cursor:default}
        .rte-bar svg{width:14px;height:14px}
        .rte-bar .rte-eye{margin-left:auto}
        .rte .textarea{border:none;border-radius:0;box-shadow:none}
        .rte-preview{padding:14px;min-height:220px}
        .sc-form{display:grid;grid-template-columns:130px 1fr;gap:14px;align-items:start}
        .sc-img.pick{width:130px;height:100px;border:2px dashed var(--line);border-radius:10px;background:#fff;display:grid;place-items:center;overflow:hidden;padding:0;cursor:pointer;margin-bottom:6px}
        .sc-img.pick img{width:100%;height:100%;object-fit:contain}
        .sc-img.pick span{display:flex;flex-direction:column;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--muted)}
        .sc-img.pick svg{width:20px;height:20px}
        .sc-thumb{width:56px;height:42px;border-radius:8px;background:#eef1f5;border:1px solid var(--line-2);overflow:hidden;flex:none}
        .sc-thumb img{width:100%;height:100%;object-fit:contain}
        .sc-actions{gap:12px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
        .sc-arrow,.sc-star{background:none;border:none;padding:4px;cursor:pointer;color:var(--navy);display:grid;place-items:center}
        .sc-arrow:disabled{opacity:.25;cursor:default}
        .sc-arrow svg,.sc-star svg{width:16px;height:16px}
        .sc-star{color:var(--muted)}
        .sc-star.on{color:var(--orange)}
        .sc-star.on svg{fill:currentColor}
        .sc-star svg{width:19px;height:19px}
        .sc-hits{display:flex;flex-direction:column;gap:2px;margin-top:6px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:6px}
        .sc-hits small{color:var(--muted);font-size:11.5px;padding:2px 6px}
        .sc-hits button{text-align:left;border:none;background:none;padding:6px;border-radius:6px;cursor:pointer;font:600 13px inherit;color:var(--navy)}
        .sc-hits button:hover{background:#f6f8fb}
        .sec-order{list-style:none;margin:0;padding:0}
        .loc-map{height:260px;border-radius:10px;border:1px solid var(--line);background:#e6ebf1;position:relative;z-index:0}
        .bn-list{display:flex;flex-wrap:wrap;gap:10px}
        .bn{position:relative;width:150px;height:64px;border-radius:8px;background:#e6ebf1 center/cover}
        .bn button{position:absolute;right:4px;top:4px;width:22px;height:22px;border:none;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;display:grid;place-items:center;cursor:pointer}
        .bn button svg{width:12px;height:12px}
        .bn.add{display:flex;align-items:center;justify-content:center;gap:6px;border:2px dashed var(--line);background:#fff;color:var(--muted);font:600 12.5px inherit;cursor:pointer}
        .bn.add svg{width:18px;height:18px}
        .bn-video{display:block;max-width:100%;width:420px;border-radius:10px;background:#000}
        .ge-img em{position:absolute;left:0;right:0;bottom:0;font-style:normal;font-size:11px;font-weight:700;text-align:center;color:#fff;background:rgba(192,57,43,.92);padding:3px}
        .sec-order li{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line-2);font-size:13.5px}
        .sec-order li:last-child{border-bottom:none}
        .sec-order .n{width:22px;color:var(--muted);font-size:12px}
        .sec-order .t{flex:1;min-width:0;font-weight:600;color:var(--navy)}
        .sec-order li.off .t{color:var(--muted);text-decoration:line-through}
        .sec-order label{display:flex;align-items:center;gap:6px;margin:0;font-size:12.5px;font-weight:600;color:var(--muted);width:92px;cursor:pointer}
        .sec-order button{width:30px;height:30px;display:grid;place-items:center;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--navy);cursor:pointer}
        .sec-order button:disabled{opacity:.3;cursor:default}
        .sec-order button svg{width:15px;height:15px}
        @media(max-width:900px){.edit-grid{grid-template-columns:1fr}.sec-nav{position:static;display:flex;flex-wrap:wrap;gap:4px}}
        @media(max-width:600px){.sec-order li{gap:8px}.sec-order .n{display:none}.sec-order label{width:auto;font-size:0;padding:6px}.crud-row{flex-wrap:wrap}.sc-actions{width:100%}.sc-form{grid-template-columns:1fr}.hl-row{grid-template-columns:110px 1fr}.gal-edit{grid-template-columns:1fr 1fr;gap:10px}}
      ` }} />

      <section className="pagehead" style={{ padding: '22px 0' }}>
        <div className="container">
          <div className="crumb">
            <a href="/dashboard">Bảng điều khiển</a>
            <svg className="ic"><use href="#ic-chevron-right" /></svg>
            Chỉnh sửa hồ sơ
          </div>
          <div className="between">
            <h1>Chỉnh sửa hồ sơ doanh nghiệp</h1>
            <div className="row wrap" style={{ gap: 8 }}>
              {props.canEdit && (
                <a className="btn btn-ghost" href="/dashboard/company-edit/history">
                  <svg className="ic"><use href="#ic-clock" /></svg> Lịch sử
                </a>
              )}
              <a className="btn btn-ghost" href={`/cong-ty/${f.slug || co.slug}`} target="_blank" rel="noopener">
                <svg className="ic"><use href="#ic-building" /></svg> Xem trang
              </a>
              <a className="btn btn-ghost" href={`/cong-ty/${f.slug || co.slug}?khach=1`} target="_blank" rel="noopener">
                <svg className="ic"><use href="#ic-eye" /></svg> Xem như khách
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="block" style={{ paddingTop: 26 }}>
        <div className="container edit-grid">
          <div>
            <nav className="sec-nav mb-24">
              <a href="#basic"><svg className="ic"><use href="#ic-building" /></svg> Thông tin cơ bản</a>
              <a href="#media"><svg className="ic"><use href="#ic-image" /></svg> Logo &amp; ảnh bìa</a>
              <a href="#appearance"><svg className="ic"><use href="#ic-paint" /></svg> Giao diện trang</a>
              <a href="#field"><svg className="ic"><use href="#ic-briefcase" /></svg> Lĩnh vực &amp; khu vực</a>
              <a href="#intro"><svg className="ic"><use href="#ic-file-text" /></svg> Giới thiệu</a>
              <a href="#highlights"><svg className="ic"><use href="#ic-chart" /></svg> Số liệu nổi bật</a>
              <a href="#gallery"><svg className="ic"><use href="#ic-camera" /></svg> Thư viện ảnh/video</a>
              <a href="#projects"><svg className="ic"><use href="#ic-clipboard" /></svg> Dự án</a>
              <a href="#partners"><svg className="ic"><use href="#ic-people" /></svg> Khách hàng &amp; đối tác</a>
              <a href="#awards"><svg className="ic"><use href="#ic-award" /></svg> Giải thưởng</a>
              <a href="#services"><svg className="ic"><use href="#ic-tag" /></svg> Dịch vụ</a>
              <a href="#staff"><svg className="ic"><use href="#ic-users" /></svg> Nhân sự &amp; thiết bị</a>
              <a href="#milestones"><svg className="ic"><use href="#ic-calendar" /></svg> Mốc phát triển</a>
              <a href="#branches"><svg className="ic"><use href="#ic-pin" /></svg> Chi nhánh</a>
              <a href="#faqs"><svg className="ic"><use href="#ic-chat" /></svg> Câu hỏi thường gặp</a>
              <a href="#docs"><svg className="ic"><use href="#ic-folder" /></svg> Hồ sơ năng lực</a>
              <a href="#contact"><svg className="ic"><use href="#ic-phone" /></svg> Liên hệ &amp; mạng xã hội</a>
              <a href="#layout"><svg className="ic"><use href="#ic-sliders" /></svg> Bố cục trang</a>
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
            {msg && <div className={`toast ${msg.ok ? 'ok' : 'err'}`} role="status" onClick={() => setMsg(null)} title="Bấm để đóng">{msg.text}</div>}

            <div className="card-block" id="basic">
              <h2>Thông tin cơ bản</h2>
              <p className="muted mb-16">Thông tin nhận diện doanh nghiệp trên nền tảng.</p>
              {props.canEdit && !props.canAdmin && <p className="hint mb-8">Bạn là biên tập viên: tên hiển thị, đường dẫn và tên pháp lý chỉ chủ sở hữu hoặc quản trị viên sửa được.</p>}
              <div className="form-row">
                <div className="field-group">
                  <label>Tên hiển thị <span className="req">*</span></label>
                  <input className="input" value={f.name} onChange={set('name')} disabled={adminOnly} />
                </div>
                <div className="field-group">
                  <label>Đường dẫn hồ sơ (slug)</label>
                  <input className="input" value={f.slug} onChange={set('slug')} disabled={adminOnly} />
                  <div className="hint">sanxaydung.vn/cong-ty/<b>{slugify(f.slug) || '…'}</b></div>
                </div>
              </div>
              <div className="form-row">
                <div className="field-group">
                  <label>Tên pháp lý</label>
                  <input className="input" value={f.legal_name} onChange={set('legal_name')} disabled={adminOnly} />
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
              <p className="muted mb-16">Logo vuông (tối đa 5MB), ảnh bìa ngang nên từ 1600×400 (ảnh lớn được tự thu nhỏ). Hiển thị công khai ngay.</p>
              <div className="media-edit">
                <div className="logo-up" style={logo ? { backgroundImage: `url(${logo})` } : undefined} onClick={() => !disabled && logoRef.current?.click()}>
                  {!logo && initialsOf}
                  <span className="cam"><svg className="ic"><use href="#ic-camera" /></svg></span>
                </div>
                <div className="cover-up" style={cover ? { backgroundImage: cssUrl(cover), backgroundPosition: `${profile.focus.x}% ${profile.focus.y}%` } : undefined}>
                  <button type="button" className="btn" disabled={disabled} onClick={() => coverRef.current?.click()} style={{ background: 'rgba(255,255,255,.9)', color: 'var(--navy)' }}>
                    <svg className="ic"><use href="#ic-camera" /></svg> Đổi ảnh bìa
                  </button>
                </div>
              </div>
              <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => { const x = e.target.files?.[0]; if (x) upload(x, 'logo'); e.target.value = ''; }} />
              <input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => { const x = e.target.files?.[0]; if (x) upload(x, 'cover'); e.target.value = ''; }} />
            </div>

            <AppearanceEditor value={profile} onChange={setProfile} disabled={disabled} cover={cover} canBrand={props.canAdmin}>
              <BannerFields value={profile} onChange={setProfile} disabled={disabled} companyId={co.id} onMsg={setMsg} />
            </AppearanceEditor>

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
                <RichTextEditor companyId={co.id} value={f.description} onChange={(description) => setF((p) => ({ ...p, description }))} disabled={disabled} onMsg={setMsg} />
              </div>
              <AboutFields value={profile} onChange={setProfile} disabled={disabled} />
            </div>

            <HighlightsEditor value={profile} onChange={setProfile} disabled={disabled} />

            <GalleryEditor companyId={co.id} initial={props.gallery} disabled={!props.canEdit} onMsg={setMsg} />

            <ProjectsEditor companyId={co.id} initial={props.initialProjects} initialPhotos={props.projectPhotos} provinces={props.provinces} disabled={!props.canEdit} onMsg={setMsg} />

            <PartnersEditor companyId={co.id} initial={props.partners} disabled={!props.canEdit} onMsg={setMsg} />

            <AwardsEditor companyId={co.id} initial={props.awards} disabled={!props.canEdit} onMsg={setMsg} />

            <div className="card-block" id="services">
              <h2>Dịch vụ cung cấp</h2>
              <p className="muted mb-16">Hiển thị ở mục “Dịch vụ cung cấp” trên hồ sơ công khai. Mỗi mục lưu ngay khi bấm Lưu.</p>
              <ServicesEditor companyId={co.id} rows={props.services} disabled={!props.canEdit} onMsg={setMsg} />
            </div>

            <StaffEditor companyId={co.id} initial={props.staff} disabled={!props.canEdit} onMsg={setMsg} />

            <div className="card-block" id="equipment">
              <h2>Máy móc &amp; thiết bị</h2>
              <EquipmentEditor companyId={co.id} rows={props.equipment} disabled={!props.canEdit} onMsg={setMsg} />
            </div>

            <MilestonesEditor companyId={co.id} initial={props.milestones} disabled={!props.canEdit} onMsg={setMsg} />

            <BranchesEditor companyId={co.id} initial={props.branches} provinces={props.provinces} disabled={!props.canEdit} onMsg={setMsg} />

            <FaqEditor companyId={co.id} initial={props.faqs} disabled={!props.canEdit} onMsg={setMsg} />

            <div className="card-block" id="docs">
              <h2 className="between">
                <span>Hồ sơ năng lực</span>
                {props.canEdit && (
                  <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => docRef.current?.click()}>
                    <svg className="ic"><use href="#ic-upload" /></svg> Tải tài liệu
                  </button>
                )}
              </h2>
              <input ref={docRef} type="file" accept={DOC_TYPES} hidden onChange={(e) => { const x = e.target.files?.[0]; if (x) addDoc(x); e.target.value = ''; }} />
              <p className="muted mb-16">
                PDF, Word, Excel hoặc ảnh, tối đa 20MB/file. <b>Công khai</b>: mọi khách xem hồ sơ đều tải được.{' '}
                <b>Đối tác kết nối</b>: chỉ doanh nghiệp đã hoàn tất kết nối với bạn. <b>Thành viên</b>: chỉ nội bộ. Tên file là tên hiển thị.
              </p>
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
              <ContactFields value={profile} onChange={setProfile} disabled={disabled} hasPhone={!!f.phone.trim()} />
              <LinksEditor value={profile} onChange={setProfile} disabled={disabled} />
            </div>

            <SectionsEditor value={profile} onChange={setProfile} disabled={disabled} />

            <div className="savebar">
              <a className="btn btn-outline" href="/dashboard">Hủy</a>
              {status === 'published' ? (
                // Hồ sơ đang công khai: lưu là áp dụng ngay, không có "bản nháp"
                <button type="button" className="btn btn-orange" disabled={disabled} onClick={() => save(false)}>
                  <svg className="ic"><use href="#ic-check" /></svg> {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
                </button>
              ) : (
                <>
                  <button type="button" className={`btn ${props.canAdmin && status === 'draft' ? 'btn-outline' : 'btn-orange'}`} disabled={disabled} onClick={() => save(false)}>{status === 'draft' ? 'Lưu nháp' : 'Lưu'}</button>
                  {props.canAdmin && status === 'draft' && (
                    <button type="button" className="btn btn-orange" disabled={disabled} onClick={() => save(true)}>
                      <svg className="ic"><use href="#ic-check" /></svg> {busy ? 'Đang lưu…' : 'Lưu & xuất bản'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
