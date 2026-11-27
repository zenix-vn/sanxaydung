'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { useMe } from '@/lib/me-client';
import { colorFor, initials, thumb, timeAgo } from '@/lib/ui';

export type Comment = {
  id: string; body: string; created_at: string; author_id: string;
  companies: { id: string; name: string; slug: string; logo_url: string | null } | null;
};

export default function Comments({ postId, initial, canModerate }: { postId: string; initial: Comment[]; canModerate: boolean }) {
  const me = useMe();
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [body, setBody] = useState('');
  const [as, setAs] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cid = as || me.companies[0]?.id || '';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !cid || !me.userId) return;
    setBusy(true);
    setErr(null);
    const { data, error } = await createSupabaseBrowser()
      .from('post_comments')
      .insert({ post_id: postId, company_id: cid, author_id: me.userId, body: body.trim() })
      .select('id, body, created_at, author_id, companies ( id, name, slug, logo_url )')
      .single();
    setBusy(false);
    if (error) return setErr(error.message);
    setItems((x) => [...x, data as unknown as Comment]);
    setBody('');
    router.refresh();
  }

  async function remove(c: Comment) {
    if (!confirm('Xóa bình luận này?')) return;
    const mine = c.author_id === me.userId;
    const { error } = await createSupabaseBrowser()
      .from('post_comments')
      .update(mine ? { deleted_at: new Date().toISOString() } : { status: 'hidden' })
      .eq('id', c.id);
    if (error) return alert(error.message);
    setItems((x) => x.filter((y) => y.id !== c.id));
    router.refresh();
  }

  return (
    <div>
      {items.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Chưa có bình luận. Hãy là người đầu tiên.</p>}
      {items.map((c) => {
        const co = c.companies;
        return (
          <div key={c.id} className="cmt">
            {co?.logo_url ? (
              <img src={thumb(co.logo_url, 72)} alt="" className="ca" style={{ objectFit: 'cover' }} />
            ) : (
              <span className="ca" style={{ background: colorFor(co?.id ?? c.id) }}>{initials(co?.name ?? '?')}</span>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="bubble">
                {co ? <a href={`/cong-ty/${co.slug}`}><b>{co.name}</b></a> : <b>Doanh nghiệp</b>}
                <p>{c.body}</p>
              </div>
              <small className="muted">
                {timeAgo(c.created_at)}
                {(c.author_id === me.userId || canModerate) && (
                  <> · <button type="button" className="btn-link danger" onClick={() => remove(c)}>{c.author_id === me.userId ? 'Xóa' : 'Ẩn'}</button></>
                )}
              </small>
            </div>
          </div>
        );
      })}

      {!me.ready ? null : !me.userId ? (
        <p className="mt-16" style={{ fontSize: 13.5 }}><a href={`/login?redirect=/feed/${postId}`} style={{ color: 'var(--orange)', fontWeight: 600 }}>Đăng nhập</a> để bình luận.</p>
      ) : me.companies.length === 0 ? (
        <p className="muted mt-16" style={{ fontSize: 13 }}>Bình luận nhân danh doanh nghiệp — <a href="/dashboard">tạo hoặc nhận hồ sơ</a> trước.</p>
      ) : (
        <form onSubmit={submit} className="mt-16">
          {me.companies.length > 1 && (
            <select className="select" value={cid} onChange={(e) => setAs(e.target.value)} style={{ marginBottom: 8, width: 'auto' }} aria-label="Bình luận với tư cách">
              {me.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <textarea className="textarea" required maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Viết bình luận…" style={{ minHeight: 70 }} />
          {err && <div className="notice" style={{ background: '#fdecea', color: '#a12622', marginTop: 8 }}>{err}</div>}
          <button className="btn btn-orange btn-sm mt-8" type="submit" disabled={busy || !body.trim()}>{busy ? 'Đang gửi…' : 'Gửi bình luận'}</button>
        </form>
      )}
    </div>
  );
}
