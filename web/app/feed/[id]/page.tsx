import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getMe, canAdmin } from '@/lib/me';
import { POST_TYPES } from '@/lib/format';
import { SITE_URL, colorFor, initials, thumb, timeAgo } from '@/lib/ui';
import LikeButton from '../LikeButton';
import ShareButton from '../ShareButton';
import Comments, { type Comment } from './Comments';

export const dynamic = 'force-dynamic';

type Post = {
  id: string; company_id: string; type: string; title: string | null; body: string | null; like_count: number; comment_count: number; created_at: string;
  companies: { id: string; name: string; slug: string; logo_url: string | null; verified_tier: string } | null;
};

const getPost = cache(async (id: string): Promise<Post | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await createSupabaseServer()
    .from('posts')
    .select('id, company_id, type, title, body, like_count, comment_count, created_at, companies ( id, name, slug, logo_url, verified_tier )')
    .eq('id', id)
    .eq('status', 'published')
    .is('deleted_at', null)
    .maybeSingle();
  return (data as unknown as Post) ?? null;
});

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const p = await getPost(params.id);
  if (!p) return { title: 'Không tìm thấy bài viết' };
  const title = p.title ?? `${p.companies?.name ?? 'Doanh nghiệp'} — ${POST_TYPES[p.type]?.label ?? 'Bài viết'}`;
  const description = (p.body ?? '').slice(0, 160) || undefined;
  return { title, description, alternates: { canonical: `${SITE_URL}/feed/${p.id}` }, openGraph: { title, description, type: 'article', url: `${SITE_URL}/feed/${p.id}` } };
}

export default async function PostPage({ params }: { params: { id: string } }) {
  const p = await getPost(params.id);
  if (!p) notFound();
  const supa = createSupabaseServer();
  const [{ data: med }, { data: cm }, me] = await Promise.all([
    supa.from('media').select('url, kind').eq('owner_type', 'post').eq('owner_id', p.id).order('sort_order'),
    supa
      .from('post_comments')
      .select('id, body, created_at, author_id, companies ( id, name, slug, logo_url )')
      .eq('post_id', p.id)
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('created_at')
      .limit(200),
    getMe(),
  ]);
  let liked = false;
  if (me.userId) {
    const { data } = await supa.from('post_reactions').select('post_id').eq('user_id', me.userId).eq('post_id', p.id).maybeSingle();
    liked = !!data;
  }
  const co = p.companies;
  const t = POST_TYPES[p.type] ?? POST_TYPES.news;
  const imgs = ((med ?? []) as { url: string; kind: string }[]).filter((m) => m.kind === 'image').map((m) => m.url);
  const canModerate = me.companies.some((c) => c.id === p.company_id && canAdmin(c));

  return (
    <section className="block" style={{ background: 'var(--bg)', paddingTop: 26 }}>
      <style>{`
        .post-d{background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow-sm);overflow:hidden}
        .post-d .hd{display:flex;gap:12px;align-items:center;padding:18px 20px 10px}
        .post-d .ava{width:46px;height:46px;border-radius:11px;color:#fff;font-weight:800;display:grid;place-items:center;flex:none;object-fit:cover}
        .post-d .bd{padding:4px 20px 16px;font-size:14.5px;color:#31414f;white-space:pre-line}
        .post-d img.pimg{width:100%;display:block;max-height:520px;object-fit:cover}
        .post-d .actions{display:flex;border-top:1px solid var(--line-2)}
        .post-d .actions a{flex:1;padding:11px;text-align:center;font-size:13.5px;font-weight:600;color:var(--muted);display:flex;align-items:center;justify-content:center;gap:7px;text-decoration:none;cursor:pointer}
        .post-d .actions a:hover{background:#f6f8fb;color:var(--navy)}
        .cmt{display:flex;gap:10px;margin-bottom:12px}
        .cmt .ca{width:34px;height:34px;border-radius:9px;color:#fff;font-size:11px;font-weight:800;display:grid;place-items:center;flex:none}
        .cmt .bubble{background:#f3f6f9;border-radius:12px;padding:8px 12px;font-size:13.5px}
        .cmt .bubble a{color:var(--navy);text-decoration:none}
        .cmt .bubble p{margin:2px 0 0;white-space:pre-line}
      `}</style>
      <div className="container" style={{ maxWidth: 760 }}>
        <div className="crumb mb-16"><a href="/feed">Tin tức ngành</a><svg className="ic"><use href="#ic-chevron-right" /></svg><span>{t.label}</span></div>
        <article className="post-d mb-24">
          <div className="hd">
            {co?.logo_url ? <img className="ava" src={thumb(co.logo_url, 92)} alt="" /> : <span className="ava" style={{ background: colorFor(co?.id ?? p.id) }}>{initials(co?.name ?? '?')}</span>}
            <div style={{ flex: 1 }}>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)' }}>
                {co ? <a href={`/cong-ty/${co.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>{co.name}</a> : 'Doanh nghiệp'}
              </h4>
              <small className="muted">{timeAgo(p.created_at)} · <span className={`badge ${t.cls}`}>{t.label}</span></small>
            </div>
          </div>
          <div className="bd">
            {p.title && <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)', marginBottom: 8, whiteSpace: 'normal' }}>{p.title}</h1>}
            {p.body}
          </div>
          {imgs.map((u) => <img key={u} className="pimg" src={u} alt="" />)}
          <div className="actions">
            <LikeButton postId={p.id} initialLiked={liked} initialCount={p.like_count} />
            <a href="#comments"><svg className="ic"><use href="#ic-chat" /></svg> {p.comment_count} bình luận</a>
            <ShareButton path={`/feed/${p.id}`} title={p.title ?? co?.name ?? 'Bài viết'} />
          </div>
        </article>
        <div className="card-block" id="comments">
          <h2>Bình luận</h2>
          <Comments postId={p.id} initial={(cm ?? []) as unknown as Comment[]} canModerate={canModerate} />
        </div>
      </div>
    </section>
  );
}
