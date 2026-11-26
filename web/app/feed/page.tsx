import type { Metadata } from 'next';
import { createSupabaseServer } from '@/lib/supabase/server';
import { SUPABASE_URL } from '@/lib/env';
import { colorFor, initials, thumb, timeAgo } from '@/lib/ui';
import FeedComposer from './FeedComposer';
import LikeButton from './LikeButton';
import ShareButton from '@/components/ShareButton';
import { POST_TYPES } from '@/lib/format';

export const metadata: Metadata = { title: 'Tin tức ngành' };
export const dynamic = 'force-dynamic';

const POST_TYPE_MAP = POST_TYPES;

interface PostRow {
  id: string;
  company_id: string;
  author_id: string | null;
  type: string;
  title: string | null;
  body: string | null;
  status: string;
  like_count: number;
  comment_count: number;
  created_at: string;
  companies: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    verified_tier: string;
  } | null;
  media?: { url: string; kind: string }[];
}

const PAGE_SIZE = 15;

async function getPosts(type?: string, before?: string): Promise<{ posts: PostRow[]; liked: Set<string>; hasMore: boolean }> {
  if (!SUPABASE_URL) return { posts: [], liked: new Set(), hasMore: false };
  try {
    const supa = createSupabaseServer();
    let q = supa
      .from('posts')
      .select(`
        id, company_id, author_id, type, title, body, status,
        like_count, comment_count, created_at,
        companies ( id, name, slug, logo_url, verified_tier )
      `)
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE + 1);
    if (type && POST_TYPE_MAP[type]) q = q.eq('type', type);
    if (before) q = q.lt('created_at', before); // keyset theo created_at
    // Bài viết và người dùng hiện tại lấy song song
    const [{ data }, { data: { user } }] = await Promise.all([q, supa.auth.getUser()]);
    const rows = (data ?? []) as unknown as PostRow[];
    const hasMore = rows.length > PAGE_SIZE;
    const posts = rows.slice(0, PAGE_SIZE);
    if (!posts.length) return { posts, liked: new Set(), hasMore };

    const ids = posts.map((p) => p.id);
    // Ảnh: bảng media dùng owner_type/owner_id (không có FK tới posts)
    const [{ data: med }, { data: rx }] = await Promise.all([
      supa.from('media').select('owner_id, url, kind, sort_order').eq('owner_type', 'post').in('owner_id', ids).order('sort_order'),
      user ? supa.from('post_reactions').select('post_id').eq('user_id', user.id).in('post_id', ids) : Promise.resolve({ data: [] as { post_id: string }[] }),
    ]);
    const byPost = new Map<string, { url: string; kind: string }[]>();
    for (const m of (med ?? []) as { owner_id: string; url: string; kind: string }[]) {
      byPost.set(m.owner_id, [...(byPost.get(m.owner_id) ?? []), { url: m.url, kind: m.kind }]);
    }
    posts.forEach((p) => (p.media = byPost.get(p.id) ?? []));

    const liked = new Set<string>(((rx ?? []) as { post_id: string }[]).map((r) => r.post_id));
    return { posts, liked, hasMore };
  } catch {
    return { posts: [], liked: new Set(), hasMore: false };
  }
}

async function getSuggestions() {
  if (!SUPABASE_URL) return [];
  try {
    const supa = createSupabaseServer();
    const { data } = await supa
      .from('companies')
      .select('id, name, slug, logo_url, verified_tier, trust_score')
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('trust_score', { ascending: false })
      .limit(4);
    return (data ?? []) as { id: string; name: string; slug: string; logo_url: string | null; verified_tier: string; trust_score: number }[];
  } catch {
    return [];
  }
}

export default async function FeedPage({ searchParams }: { searchParams: { type?: string; before?: string } }) {
  const type = searchParams.type && POST_TYPE_MAP[searchParams.type] ? searchParams.type : undefined;
  const [{ posts, liked, hasMore }, suggestions] = await Promise.all([getPosts(type, searchParams.before), getSuggestions()]);
  const nextHref = posts.length
    ? `/feed?${type ? `type=${type}&` : ''}before=${encodeURIComponent(posts[posts.length - 1].created_at)}`
    : '';
  const navCls = (t?: string) => (t === type ? 'active' : '');

  return (
    <>
      <style>{`
        .feed-grid{display:grid;grid-template-columns:240px 1fr 300px;gap:24px;align-items:start}
        .side-card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px;box-shadow:var(--shadow-sm);margin-bottom:18px}
        .side-nav a{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:9px;font-size:14px;font-weight:600;color:var(--text);text-decoration:none}
        .side-nav a svg{width:18px;height:18px;color:var(--muted)}
        .side-nav a.active{background:var(--orange-soft);color:var(--orange)}
        .side-nav a.active svg{color:var(--orange)}
        .side-nav a:hover:not(.active){background:#f6f8fb}
        .composer{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px;box-shadow:var(--shadow-sm);margin-bottom:20px}
        .composer .top{display:flex;gap:12px;align-items:center}
        .composer input{flex:1;border:1px solid var(--line);border-radius:24px;padding:11px 16px;font-size:14px;background:#f6f8fb}
        .composer .acts{display:flex;gap:6px;margin-top:12px;flex-wrap:wrap}
        .composer .acts .a{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--muted);padding:7px 12px;border-radius:8px;cursor:pointer}
        .composer .acts .a:hover{background:#f6f8fb}
        .composer .acts .a svg{width:16px;height:16px}
        .post{background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow-sm);margin-bottom:20px;overflow:hidden}
        .post .head{display:flex;gap:12px;align-items:center;padding:16px 18px 0}
        .post .head .ava{width:46px;height:46px;border-radius:11px;font-weight:800;color:#fff;display:grid;place-items:center;flex:none;font-size:16px}
        .post .head h4{font-size:14.5px;font-weight:700;color:var(--navy);display:flex;align-items:center;gap:6px}
        .post .head small{font-size:12px;color:var(--muted)}
        .post .ptype{margin:12px 18px 0}
        .post .body{padding:12px 18px}
        .post .body p{font-size:14px;color:#31414f;line-height:1.65}
        .post .pimg{width:100%;max-height:360px;object-fit:cover;margin-top:6px}
        .post .stats{padding:10px 18px;font-size:12.5px;color:var(--muted);display:flex;gap:16px;border-top:1px solid var(--line-2)}
        .post .actions{display:flex;border-top:1px solid var(--line-2)}
        .post .actions a{flex:1;padding:11px;text-align:center;font-size:13.5px;font-weight:600;color:var(--muted);display:flex;align-items:center;justify-content:center;gap:7px;text-decoration:none;cursor:pointer}
        .post .actions a:hover{background:#f6f8fb;color:var(--navy)}
        .post .actions svg{width:17px;height:17px}
        .trend a{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--line-2);font-size:13px;text-decoration:none;color:inherit}
        .trend a:last-child{border-bottom:none}
        .trend a b{color:var(--navy)}
        .trend a span{color:var(--muted);font-size:12px}
        .sugg{display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line-2)}
        .sugg:last-child{border-bottom:none}
        .sugg .ava-s{width:38px;height:38px;border-radius:9px;font-weight:800;color:#fff;display:grid;place-items:center;font-size:13px;flex:none}
        .sugg h5{font-size:13px;font-weight:700;color:var(--navy)}
        .sugg small{font-size:11.5px;color:var(--muted)}
        .empty-feed{text-align:center;padding:48px 24px;color:var(--muted)}
        .empty-feed svg{width:48px;height:48px;opacity:.3;margin-bottom:12px}
        @media(max-width:1024px){.feed-grid{grid-template-columns:1fr}.feed-grid aside{display:none}}
      `}</style>
      <h1 className="sr-only">Tin tức ngành xây dựng</h1>

      <div className="container" style={{ padding: '24px 20px 48px' }}>
        <div className="feed-grid">

          {/* LEFT sidebar */}
          <aside>
            <div className="side-card">
              <nav className="side-nav">
                <a className={navCls(undefined)} href="/feed">
                  <svg className="ic"><use href="#ic-layers" /></svg> Tất cả bài viết
                </a>
                <a className={navCls('completed_project')} href="/feed?type=completed_project">
                  <svg className="ic"><use href="#ic-building" /></svg> Dự án
                </a>
                <a className={navCls('recruitment')} href="/feed?type=recruitment">
                  <svg className="ic"><use href="#ic-people" /></svg> Tuyển dụng
                </a>
                <a className={navCls('certificate')} href="/feed?type=certificate">
                  <svg className="ic"><use href="#ic-award" /></svg> Chứng nhận
                </a>
                <a href="/marketplace">
                  <svg className="ic"><use href="#ic-briefcase" /></svg> Marketplace
                </a>
                <a href="/directory">
                  <svg className="ic"><use href="#ic-search" /></svg> Tìm đối tác
                </a>
              </nav>
            </div>
            <div className="side-card" style={{ background: 'linear-gradient(135deg,#021e48,#12439c)', color: '#fff', border: 'none' }}>
              <h4 style={{ color: '#fff', fontSize: 14, marginBottom: 8 }}>Đăng bài doanh nghiệp</h4>
              <p style={{ fontSize: 13, color: '#c6d3e2', marginBottom: 14 }}>Chia sẻ dự án, thông báo tuyển dụng, chứng nhận và cơ hội hợp tác.</p>
              <a className="btn btn-orange btn-block btn-sm" href="#composer">Đăng bài →</a>
            </div>
          </aside>

          {/* MAIN feed */}
          <div>
            <div id="composer"><FeedComposer /></div>

            {/* Post list */}
            {posts.length === 0 ? (
              <div className="empty-feed">
                <svg className="ic"><use href="#ic-layers" /></svg>
                <p>Chưa có bài viết nào. Hãy là người đầu tiên chia sẻ!</p>
              </div>
            ) : (
              posts.map((post) => {
                const co = post.companies;
                const typeInfo = POST_TYPE_MAP[post.type] ?? POST_TYPE_MAP.news;
                const ini = co ? initials(co.name) : '?';
                const bg = co ? colorFor(co.id) : '#555';
                const imgs = (post.media ?? []).filter((m) => m.kind === 'image').map((m) => m.url);

                return (
                  <article key={post.id} className="post">
                    <div className="head">
                      <a href={co ? `/cong-ty/${co.slug}` : '#'} style={{ textDecoration: 'none' }}>
                        {co?.logo_url ? (
                          <img
                            src={thumb(co.logo_url, 92)}
                            alt={co.name}
                            loading="lazy"
                            style={{ width: 46, height: 46, borderRadius: 11, objectFit: 'cover', flexShrink: 0 }}
                          />
                        ) : (
                          <span className="ava" style={{ background: bg }}>{ini}</span>
                        )}
                      </a>
                      <div style={{ flex: 1 }}>
                        <h4>
                          <a href={co ? `/cong-ty/${co.slug}` : '#'} style={{ color: 'inherit', textDecoration: 'none' }}>
                            {co?.name ?? 'Doanh nghiệp'}
                          </a>
                          {co?.verified_tier !== 'none' && (
                            <svg className="ic" style={{ width: 15, height: 15, color: 'var(--green)' }}><use href="#ic-shield-check" /></svg>
                          )}
                        </h4>
                        <small>
                          {timeAgo(post.created_at)} ·{' '}
                          <svg className="ic" style={{ width: 12, height: 12, verticalAlign: -1 }}><use href="#ic-globe" /></svg>{' '}
                          Công khai
                        </small>
                      </div>
                      <a className="btn btn-icon btn-outline" style={{ border: 'none' }} href={`/feed/${post.id}`} title="Xem bài viết" aria-label="Xem bài viết">
                        <svg className="ic"><use href="#ic-dots" /></svg>
                      </a>
                    </div>

                    <div className="ptype">
                      <span className={`badge ${typeInfo.cls}`}>
                        <svg className="ic"><use href={`#${typeInfo.icon}`} /></svg> {typeInfo.label}
                      </span>
                    </div>

                    <div className="body">
                      {post.title && <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}><a href={`/feed/${post.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{post.title}</a></h3>}
                      {post.body && <p>{post.body}</p>}
                    </div>

                    {imgs.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: imgs.length > 1 ? '1fr 1fr' : '1fr', gap: 2 }}>
                        {imgs.map((u) => <img key={u} className="pimg" src={u} alt="" loading="lazy" style={{ marginTop: 0, maxHeight: imgs.length > 1 ? 220 : 360, height: imgs.length > 1 ? 220 : undefined }} />)}
                      </div>
                    )}

                    {post.comment_count > 0 && (
                      <div className="stats"><a href={`/feed/${post.id}#comments`} style={{ color: 'inherit' }}>{post.comment_count} bình luận</a></div>
                    )}

                    <div className="actions">
                      <LikeButton postId={post.id} initialLiked={liked.has(post.id)} initialCount={post.like_count} />
                      <a href={`/feed/${post.id}#comments`}><svg className="ic"><use href="#ic-chat" /></svg> Bình luận</a>
                      <ShareButton path={`/feed/${post.id}`} title={post.title ?? post.companies?.name ?? 'Bài viết'} />
                    </div>
                  </article>
                );
              })
            )}
            {hasMore && (
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <a className="btn btn-outline" href={nextHref}>Xem bài cũ hơn</a>
              </div>
            )}
            {searchParams.before && (
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <a href={type ? `/feed?type=${type}` : '/feed'} style={{ color: 'var(--orange)', fontWeight: 600 }}>← Về bài mới nhất</a>
              </div>
            )}
          </div>

          {/* RIGHT sidebar */}
          <aside>
            {suggestions.length > 0 && (
              <div className="side-card">
                <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>Doanh nghiệp uy tín</h4>
                {suggestions.map((c) => (
                  <div className="sugg" key={c.id}>
                    {c.logo_url ? (
                      <img src={thumb(c.logo_url, 76)} alt={c.name} loading="lazy" style={{ width: 38, height: 38, borderRadius: 9, objectFit: 'cover', flex: 'none' }} />
                    ) : (
                      <span className="ava-s" style={{ background: colorFor(c.id) }}>{initials(c.name)}</span>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h5>{c.name}</h5>
                      <small>Trust Score {Math.round(c.trust_score ?? 0)}</small>
                    </div>
                    <a className="btn btn-outline btn-sm" href={`/cong-ty/${c.slug}`}>Xem</a>
                  </div>
                ))}
              </div>
            )}
            <div className="side-card" style={{ background: 'linear-gradient(135deg,#021e48,#12439c)', color: '#fff', border: 'none' }}>
              <h4 style={{ color: '#fff', fontSize: 15 }}>Tăng uy tín hồ sơ</h4>
              <p style={{ fontSize: 13, color: '#c6d3e2', margin: '8px 0 14px' }}>Hoàn thiện hồ sơ, xác minh doanh nghiệp và thêm dự án để được xếp cao hơn trong danh bạ — miễn phí.</p>
              <a className="btn btn-orange btn-block" href="/dashboard/trust">Xem cách tăng điểm →</a>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
