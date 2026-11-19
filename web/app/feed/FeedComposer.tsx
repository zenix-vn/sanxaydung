'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { useMe } from '@/lib/me-client';
import { canEdit } from '@/lib/roles';

const TYPES: [string, string][] = [
  ['news', 'Tin tức'],
  ['new_project', 'Dự án mới'],
  ['completed_project', 'Dự án hoàn thành'],
  ['recruitment', 'Tuyển dụng'],
  ['equipment', 'Thiết bị'],
  ['certificate', 'Chứng nhận'],
  ['promotion', 'Khuyến mãi'],
  ['activity', 'Hoạt động'],
];
const MAX_IMG = 4;
const MAX_MB = 5;

export default function FeedComposer() {
  const me = useMe();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const [type, setType] = useState('news');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const editable = me.companies.filter(canEdit);
  const cid = companyId || editable[0]?.id || '';

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    e.target.value = '';
    const ok = list.filter((f) => ['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(f.type) && f.size <= MAX_MB * 1024 * 1024);
    if (ok.length < list.length) setErr(`Chỉ nhận ảnh JPG/PNG/WebP, tối đa ${MAX_MB}MB/ảnh.`);
    setFiles((cur) => [...cur, ...ok].slice(0, MAX_IMG));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cid || (!body.trim() && !title.trim())) return;
    setBusy(true);
    setErr(null);
    try {
      const supa = createSupabaseBrowser();
      const { data: post, error } = await supa
        .from('posts')
        .insert({ company_id: cid, author_id: me.userId, type, title: title.trim() || null, body: body.trim() || null })
        .select('id')
        .single();
      if (error) throw error;

      const media: { company_id: string; owner_type: string; owner_id: string; kind: string; url: string; sort_order: number }[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const ext = (f.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        const path = `${cid}/${post.id}/${i}.${ext || 'jpg'}`; // quy ước: {company_id}/{post_id}/{file}
        const up = await supa.storage.from('post-media').upload(path, f, { contentType: f.type, upsert: true });
        if (up.error) throw up.error;
        const { data: pub } = supa.storage.from('post-media').getPublicUrl(path);
        media.push({ company_id: cid, owner_type: 'post', owner_id: post.id, kind: 'image', url: pub.publicUrl, sort_order: i });
      }
      if (media.length) {
        const { error: me2 } = await supa.from('media').insert(media);
        if (me2) throw me2;
      }
      setTitle('');
      setBody('');
      setFiles([]);
      setOpen(false);
      router.refresh();
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const trigger = (label: string, icon: string, t?: string) => (
    <a
      className="a"
      onClick={() => {
        if (t) setType(t);
        setOpen(true);
      }}
    >
      <svg className="ic"><use href={`#${icon}`} /></svg> {label}
    </a>
  );

  // Chưa đăng nhập → dẫn đi đăng nhập; chưa có quyền → dẫn về dashboard
  if (me.ready && !me.userId) {
    return (
      <div className="composer">
        <a href="/login?redirect=/feed" style={{ display: 'block', color: 'var(--muted)', textDecoration: 'none' }}>
          Đăng nhập để chia sẻ tin tức, dự án, cơ hội hợp tác…
        </a>
      </div>
    );
  }
  if (me.ready && editable.length === 0) {
    return (
      <div className="composer">
        <a href="/dashboard" style={{ display: 'block', color: 'var(--muted)', textDecoration: 'none' }}>
          Bạn cần là thành viên (biên tập viên trở lên) của một doanh nghiệp để đăng bài →
        </a>
      </div>
    );
  }

  return (
    <div className="composer">
      {!open ? (
        <>
          <div className="top">
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--line)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <svg className="ic" style={{ color: 'var(--muted)' }}><use href="#ic-building" /></svg>
            </div>
            <a onClick={() => setOpen(true)} style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 24, padding: '11px 16px', fontSize: 14, background: '#f6f8fb', color: 'var(--muted)', cursor: 'pointer' }}>
              Chia sẻ tin tức, dự án, cơ hội hợp tác…
            </a>
          </div>
          <div className="acts">
            {trigger('Dự án', 'ic-building', 'new_project')}
            {trigger('Tuyển dụng', 'ic-people', 'recruitment')}
            {trigger('Chứng nhận', 'ic-award', 'certificate')}
            {trigger('Ảnh', 'ic-image')}
          </div>
        </>
      ) : (
        <form onSubmit={submit}>
          <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {editable.length > 1 && (
              <select className="input" style={{ width: 'auto' }} value={cid} onChange={(e) => setCompanyId(e.target.value)}>
                {editable.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <select className="input" style={{ width: 'auto' }} value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <input className="input" placeholder="Tiêu đề (không bắt buộc)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} style={{ width: '100%', marginBottom: 8 }} />
          <textarea className="textarea" placeholder="Bạn muốn chia sẻ điều gì?" value={body} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 100, width: '100%' }} maxLength={5000} />
          {files.length > 0 && (
            <div style={{ display: 'flex', gap: 8, margin: '10px 0', flexWrap: 'wrap' }}>
              {files.map((f, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={URL.createObjectURL(f)} alt="" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 8 }} />
                  <a onClick={() => setFiles(files.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -6, right: -6, background: '#111', color: '#fff', width: 20, height: 20, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, cursor: 'pointer' }}>×</a>
                </div>
              ))}
            </div>
          )}
          {err && <p style={{ color: '#a12622', fontSize: 13, margin: '8px 0' }}>{err}</p>}
          <div className="between" style={{ marginTop: 10 }}>
            <div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={pick} />
              <a className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>
                <svg className="ic"><use href="#ic-image" /></svg> Thêm ảnh ({files.length}/{MAX_IMG})
              </a>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <a className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>Hủy</a>
              <button className="btn btn-orange btn-sm" type="submit" disabled={busy || (!body.trim() && !title.trim())}>
                {busy ? 'Đang đăng…' : 'Đăng bài'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
