'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { useMe } from '@/lib/me-client';
import { colorFor, fmtMoney, initials } from '@/lib/ui';

interface Co {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  verified_tier: string;
  trust_score: number;
}
interface Conv {
  id: string;
  context_type: string | null;
  context_id: string | null;
  last_message_at: string | null;
  other: Co | null;
  mineId: string; // công ty của tôi trong hội thoại
  last?: string;
  lastAt?: string;
  unread: number;
}
interface Msg {
  id: string;
  conversation_id: string;
  sender_company_id: string | null;
  sender_user_id: string | null;
  body: string | null;
  kind: string;
  attachment_url: string | null;
  meta: { amount?: number; currency?: string; title?: string; name?: string; size?: number; type?: string } | null;
  read_by: string[] | null;
  created_at: string;
}

const CO_FIELDS = 'id, name, slug, logo_url, verified_tier, trust_score';

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
function dayLabel(iso: string) {
  const d = new Date(iso);
  const t = new Date();
  if (d.toDateString() === t.toDateString()) return 'Hôm nay';
  const y = new Date(t.getTime() - 86400000);
  if (d.toDateString() === y.toDateString()) return 'Hôm qua';
  return d.toLocaleDateString('vi-VN');
}
function listTime(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? hhmm(iso)
    : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}
function preview(m: { body: string | null; kind: string; meta?: Msg['meta'] }) {
  if (m.kind === 'quote') return `Báo giá ${fmtMoney(m.meta?.amount)} ₫`;
  if (m.kind === 'file') return `📎 ${m.meta?.name ?? 'Tệp đính kèm'}`;
  return m.body ?? '';
}

const MAX_FILE = 20 * 1024 * 1024;

/** Tệp đính kèm lưu ở bucket riêng tư → tạo signed URL khi hiển thị (RLS: thành viên các bên trong hội thoại). */
function Attachment({ path, meta }: { path: string; meta: Msg['meta'] }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const isImg = (meta?.type ?? '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(path);
  useEffect(() => {
    let alive = true;
    createSupabaseBrowser().storage.from('message-attachments').createSignedUrl(path, 3600).then(({ data, error }) => {
      if (!alive) return;
      if (error || !data) setFailed(true);
      else setUrl(data.signedUrl);
    });
    return () => {
      alive = false;
    };
  }, [path]);
  const name = meta?.name ?? path.split('/').pop() ?? 'Tệp';
  if (failed) return <div className="qline">📎 {name} (không mở được)</div>;
  if (isImg && url) {
    return (
      <a href={url} target="_blank" rel="noopener" className="att-img">
        <img src={url} alt={name} />
      </a>
    );
  }
  return (
    <a className="att-file" href={url ?? undefined} target="_blank" rel="noopener" aria-disabled={!url}>
      <svg className="ic"><use href="#ic-file-text" /></svg>
      <span>
        <b>{name}</b>
        {meta?.size ? <small>{(meta.size / 1048576).toFixed(1)} MB</small> : null}
      </span>
      <svg className="ic"><use href="#ic-download" /></svg>
    </a>
  );
}

function Ava({ co, cls = '', size }: { co: Co | null; cls?: string; size?: number }) {
  const name = co?.name ?? '?';
  const st = size ? { width: size, height: size } : {};
  if (co?.logo_url) {
    return <img src={co.logo_url} alt={name} className={cls} style={{ ...st, objectFit: 'cover', borderRadius: 11, flex: 'none' }} />;
  }
  return (
    <span className={cls} style={{ background: colorFor(co?.id ?? name), ...st }}>
      {initials(name)}
    </span>
  );
}

export default function ChatClient() {
  const me = useMe();
  const params = useSearchParams();
  const supa = useMemo(() => createSupabaseBrowser(), []);

  const [convs, setConvs] = useState<Conv[]>([]);
  const [loading, setLoading] = useState(true);
  const [selId, setSelId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [listingTitle, setListingTitle] = useState<string | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [rtOk, setRtOk] = useState(false); // kênh realtime đang hoạt động
  const [find, setFind] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const selRef = useRef<string | null>(null);
  const startedRef = useRef(false);

  const myIds = useMemo(() => me.companies.map((c) => c.id), [me.companies]);
  const uid = me.userId;

  useEffect(() => {
    selRef.current = selId;
  }, [selId]);

  // ---------- Tải danh sách hội thoại ----------
  const loadConvs = useCallback(async () => {
    if (!uid) return [] as Conv[];
    const { data, error } = await supa
      .from('conversations')
      .select(`id, context_type, context_id, last_message_at,
               conversation_participants ( company_id, companies ( ${CO_FIELDS} ) )`)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(100);
    if (error) {
      setErr(error.message);
      return [] as Conv[];
    }
    type Row = {
      id: string; context_type: string | null; context_id: string | null; last_message_at: string | null;
      conversation_participants: { company_id: string; companies: Co | null }[];
    };
    const rows = (data ?? []) as unknown as Row[];
    const list: Conv[] = rows.map((r) => {
      const mine = r.conversation_participants.find((p) => myIds.includes(p.company_id));
      const other = r.conversation_participants.find((p) => !myIds.includes(p.company_id)) ?? mine;
      return {
        id: r.id,
        context_type: r.context_type,
        context_id: r.context_id,
        last_message_at: r.last_message_at,
        other: other?.companies ?? null,
        mineId: mine?.company_id ?? myIds[0],
        unread: 0,
      };
    });

    if (list.length) {
      const { data: ms } = await supa
        .from('messages')
        .select('conversation_id, body, kind, meta, created_at, read_by, sender_user_id')
        .in('conversation_id', list.map((c) => c.id))
        .order('created_at', { ascending: false })
        .limit(300);
      const seen = new Set<string>();
      for (const m of (ms ?? []) as unknown as Msg[]) {
        const c = list.find((x) => x.id === m.conversation_id)!;
        if (!seen.has(c.id)) {
          seen.add(c.id);
          c.last = preview(m);
          c.lastAt = m.created_at;
        }
        if (m.sender_user_id !== uid && !(m.read_by ?? []).includes(uid)) c.unread += 1;
      }
    }
    setConvs(list);
    return list;
  }, [supa, uid, myIds]);

  // ---------- Mở hội thoại: tải tin nhắn + đánh dấu đã đọc ----------
  const markRead = useCallback(
    async (convId: string, mineId: string) => {
      await supa.rpc('mark_read', { _conversation: convId, _as_company: mineId });
      setConvs((cs) => cs.map((c) => (c.id === convId ? { ...c, unread: 0 } : c)));
    },
    [supa],
  );

  // Thêm tin vào khung đang mở (bỏ trùng theo id) và cập nhật dòng xem trước của hội thoại
  const upsertMsgs = useCallback((convId: string, list: Msg[]) => {
    if (!list.length) return;
    if (convId === selRef.current) {
      setMsgs((cur) => {
        const ids = new Set(cur.map((x) => x.id));
        const add = list.filter((m) => !ids.has(m.id));
        return add.length ? [...cur, ...add].sort((a, b) => a.created_at.localeCompare(b.created_at)) : cur;
      });
    }
    const last = list[list.length - 1];
    setConvs((cs) => {
      const idx = cs.findIndex((x) => x.id === convId);
      if (idx === -1) return cs;
      const upd: Conv = { ...cs[idx], last: preview(last), lastAt: last.created_at, last_message_at: last.created_at };
      return [upd, ...cs.filter((_, i) => i !== idx)];
    });
  }, []);

  const openConv = useCallback(
    async (c: Conv) => {
      setSelId(c.id);
      setMsgs([]);
      setErr(null);
      const { data, error } = await supa
        .from('messages')
        .select('*')
        .eq('conversation_id', c.id)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) setErr(error.message);
      setMsgs((data ?? []) as Msg[]);
      markRead(c.id, c.mineId);
    },
    [supa, markRead],
  );

  // Khởi tạo: tải list, rồi mở theo ?c= hoặc tạo/tìm theo ?to=
  useEffect(() => {
    if (!me.ready) return;
    if (!uid) {
      setLoading(false);
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const list = await loadConvs();
      setLoading(false);
      const cParam = params.get('c');
      const to = params.get('to');
      const listing = params.get('listing');
      if (cParam) {
        const c = list.find((x) => x.id === cParam);
        if (c) openConv(c);
      } else if (to && myIds.length) {
        const existing = list.find(
          (x) => x.other?.id === to && (!listing || (x.context_type === 'listing' && x.context_id === listing)),
        );
        if (existing) return openConv(existing);
        const mine = myIds[0];
        const { data, error } = await supa.rpc('start_conversation', {
          _as_company: mine,
          _target: to,
          _context_type: listing ? 'listing' : 'company',
          _context_id: listing ?? to,
        });
        if (error) {
          setErr(`Chưa tạo được hội thoại: ${error.message}`);
          return;
        }
        const fresh = await loadConvs();
        const c = fresh.find((x) => x.id === (data as string));
        if (c) openConv(c);
      } else if (list[0] && window.matchMedia('(min-width: 761px)').matches) {
        openConv(list[0]);
      }
    })();
  }, [me.ready, uid, myIds, params, loadConvs, openConv, supa]);

  // ---------- Realtime ----------
  useEffect(() => {
    if (!uid) return;
    const ch = supa
      .channel('chat-inbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new as Msg;
        const mine = m.sender_user_id === uid;
        if (m.conversation_id === selRef.current) {
          setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
          if (!mine) {
            setConvs((cs) => {
              const c = cs.find((x) => x.id === m.conversation_id);
              if (c) markRead(c.id, c.mineId);
              return cs;
            });
          }
        }
        setConvs((cs) => {
          const idx = cs.findIndex((x) => x.id === m.conversation_id);
          if (idx === -1) {
            loadConvs(); // hội thoại mới do đối tác khởi tạo
            return cs;
          }
          const c = cs[idx];
          const upd: Conv = {
            ...c,
            last: preview(m),
            lastAt: m.created_at,
            last_message_at: m.created_at,
            unread: m.conversation_id === selRef.current || mine ? c.unread : c.unread + 1,
          };
          return [upd, ...cs.filter((_, i) => i !== idx)];
        });
      })
      .subscribe((status) => setRtOk(status === 'SUBSCRIBED'));
    return () => {
      setRtOk(false);
      supa.removeChannel(ch);
    };
  }, [supa, uid, loadConvs, markRead]);

  // Dự phòng khi realtime chập chờn: hỏi tin mới của hội thoại đang mở (4s nếu mất realtime, 20s nếu đang có),
  // và tải lại ngay khi người dùng quay lại tab.
  const msgsRef = useRef<Msg[]>([]);
  useEffect(() => {
    msgsRef.current = msgs;
  }, [msgs]);
  useEffect(() => {
    if (!uid || !selId) return;
    let stop = false;
    const poll = async () => {
      if (stop || document.visibilityState !== 'visible') return;
      const convId = selId;
      const after = msgsRef.current[msgsRef.current.length - 1]?.created_at;
      let q = supa.from('messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: true }).limit(100);
      if (after) q = q.gt('created_at', after);
      const { data } = await q;
      if (!stop && data?.length) upsertMsgs(convId, data as Msg[]);
    };
    const t = setInterval(poll, rtOk ? 20000 : 4000);
    const onVis = () => document.visibilityState === 'visible' && poll();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      stop = true;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [supa, uid, selId, rtOk, upsertMsgs]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [msgs]);

  const sel = convs.find((c) => c.id === selId) ?? null;

  // Tên tin đăng gắn với hội thoại
  useEffect(() => {
    setListingTitle(null);
    if (sel?.context_type === 'listing' && sel.context_id) {
      supa
        .from('marketplace_listings')
        .select('title')
        .eq('id', sel.context_id)
        .maybeSingle()
        .then(({ data }) => setListingTitle((data as { title: string } | null)?.title ?? null));
    }
  }, [supa, sel?.id, sel?.context_type, sel?.context_id]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !sel || !uid || sending) return;
    setSending(true);
    setErr(null);
    const { data, error } = await supa
      .from('messages')
      .insert({ conversation_id: sel.id, sender_company_id: sel.mineId, sender_user_id: uid, body, kind: 'text' })
      .select('*')
      .single();
    setSending(false);
    if (error) return setErr(`Không gửi được: ${error.message}`);
    setText('');
    upsertMsgs(sel.id, [data as Msg]); // hiện ngay, không chờ realtime
  }

  async function sendFile(f: File) {
    if (!sel || !uid || !sel.mineId) return;
    if (f.size > MAX_FILE) return setErr('Tệp tối đa 20MB.');
    setSending(true);
    setErr(null);
    const ext = (f.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${sel.mineId}/${sel.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const up = await supa.storage.from('message-attachments').upload(path, f, { contentType: f.type || undefined });
    if (up.error) {
      setSending(false);
      return setErr(`Không tải được tệp: ${up.error.message}`);
    }
    const { data, error } = await supa
      .from('messages')
      .insert({
        conversation_id: sel.id,
        sender_company_id: sel.mineId,
        sender_user_id: uid,
        body: text.trim() || null,
        kind: 'file',
        attachment_url: path,
        meta: { name: f.name.slice(0, 200), size: f.size, type: f.type },
      })
      .select('*')
      .single();
    setSending(false);
    if (error) return setErr(`Không gửi được: ${error.message}`);
    setText('');
    upsertMsgs(sel.id, [data as Msg]);
  }

  const findQ = find.trim().toLowerCase();
  const shownMsgs = findQ ? msgs.filter((m) => (m.body ?? '').toLowerCase().includes(findQ) || (m.meta?.name ?? '').toLowerCase().includes(findQ)) : msgs;

  const filtered = convs.filter((c) => !q.trim() || (c.other?.name ?? '').toLowerCase().includes(q.trim().toLowerCase()));

  // ---------- Trạng thái chưa đăng nhập / chưa có công ty ----------
  if (me.ready && !uid) {
    return (
      <div className="cempty" style={{ height: 'calc(100vh - 66px)' }}>
        <div>
          <h2 style={{ color: 'var(--navy)', marginBottom: 8 }}>Đăng nhập để nhắn tin</h2>
          <p style={{ marginBottom: 16 }}>Tin nhắn được gửi giữa các doanh nghiệp trên sàn.</p>
          <a className="btn btn-orange" href={`/login?redirect=${encodeURIComponent(`/chat${typeof window !== 'undefined' ? window.location.search : ''}`)}`}>Đăng nhập</a>
        </div>
      </div>
    );
  }
  if (me.ready && uid && me.companies.length === 0) {
    return (
      <div className="cempty" style={{ height: 'calc(100vh - 66px)' }}>
        <div>
          <h2 style={{ color: 'var(--navy)', marginBottom: 8 }}>Bạn chưa thuộc doanh nghiệp nào</h2>
          <p style={{ marginBottom: 16 }}>Hãy nhận hồ sơ doanh nghiệp (claim theo SĐT) hoặc tạo hồ sơ mới để bắt đầu nhắn tin.</p>
          <a className="btn btn-orange" href="/dashboard">Vào bảng điều khiển</a>
        </div>
      </div>
    );
  }

  let lastDay = '';
  return (
    <div className={`chat-wrap${sel ? ' has-conv' : ''}`}>
      {/* Danh sách hội thoại */}
      <div className="clist">
        <div className="csearch">
          <div style={{ position: 'relative' }}>
            <svg className="ic" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--muted)' }}>
              <use href="#ic-search" />
            </svg>
            <input className="input" placeholder="Tìm hội thoại…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && <p className="muted" style={{ padding: 16 }}>Đang tải…</p>}
          {!loading && filtered.length === 0 && (
            <p className="muted" style={{ padding: 16, fontSize: 13 }}>
              Chưa có hội thoại. Mở hồ sơ một doanh nghiệp hoặc một tin đăng rồi bấm “Nhắn tin”.
            </p>
          )}
          {filtered.map((c) => (
            <div key={c.id} className={`conv${c.id === selId ? ' active' : ''}`} onClick={() => openConv(c)}>
              <Ava co={c.other} cls="ava" size={46} />
              <div className="mid">
                <div className="r1">
                  <h4>{c.other?.name ?? 'Doanh nghiệp'}</h4>
                  <small>{listTime(c.lastAt ?? c.last_message_at)}</small>
                </div>
                <p style={c.unread ? { color: 'var(--navy)', fontWeight: 600 } : {}}>{c.last ?? 'Chưa có tin nhắn'}</p>
              </div>
              {c.unread > 0 && <span className="unread">{c.unread}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Khung tin nhắn */}
      {sel ? (
        <div className="cthread">
          <div className="cthead">
            <a className="btn btn-icon btn-outline back" style={{ border: 'none' }} onClick={() => setSelId(null)}>
              <svg className="ic"><use href="#ic-chevron-left" /></svg>
            </a>
            <Ava co={sel.other} cls="ava" size={42} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3>
                {sel.other?.name}
                {sel.other && sel.other.verified_tier !== 'none' && (
                  <svg className="ic" style={{ width: 15, height: 15, color: 'var(--green)' }}><use href="#ic-shield-check" /></svg>
                )}
              </h3>
            </div>
            <button
              type="button"
              className="btn btn-icon btn-outline"
              style={{ border: 'none' }}
              title="Tìm trong hội thoại"
              aria-label="Tìm trong hội thoại"
              aria-pressed={findOpen}
              onClick={() => { setFindOpen((v) => !v); setFind(''); }}
            >
              <svg className="ic"><use href="#ic-search" /></svg>
            </button>
            {sel.other && (
              <a className="btn btn-icon btn-outline" style={{ border: 'none' }} href={`/cong-ty/${sel.other.slug}`} title="Xem hồ sơ">
                <svg className="ic"><use href="#ic-eye" /></svg>
              </a>
            )}
          </div>
          {sel.context_type === 'listing' && sel.context_id && (
            <div className="ctx-bar">
              <svg className="ic"><use href="#ic-briefcase" /></svg>
              Hội thoại gắn với tin: <b style={{ color: 'var(--navy)' }}>&nbsp;{listingTitle ?? '…'}</b>
              &nbsp;·&nbsp;
              <a href={`/marketplace/${sel.context_id}`} style={{ color: 'var(--orange)', fontWeight: 600 }}>Xem tin</a>
            </div>
          )}

          {findOpen && (
            <div className="ctx-bar">
              <input className="input" autoFocus placeholder="Tìm tin nhắn, tên tệp…" value={find} onChange={(e) => setFind(e.target.value)} style={{ flex: 1, padding: '6px 10px' }} />
              {findQ && <small className="muted" style={{ marginLeft: 8, whiteSpace: 'nowrap' }}>{shownMsgs.length} kết quả</small>}
            </div>
          )}

          <div className="msgs">
            {msgs.length === 0 && <div className="day">Hãy gửi lời chào đầu tiên 👋</div>}
            {findQ && shownMsgs.length === 0 && <div className="day">Không tìm thấy tin nhắn phù hợp</div>}
            {shownMsgs.map((m) => {
              const d = dayLabel(m.created_at);
              const showDay = d !== lastDay;
              lastDay = d;
              const mine = m.sender_user_id === uid || (m.sender_company_id != null && myIds.includes(m.sender_company_id));
              return (
                <div key={m.id} style={{ display: 'contents' }}>
                  {showDay && <div className="day">{d}</div>}
                  {m.kind === 'quote' ? (
                    <div className="quote-msg" style={mine ? { alignSelf: 'flex-end' } : {}}>
                      <div className="qh">
                        <svg className="ic"><use href="#ic-file-text" /></svg> Báo giá {mine ? 'đã gửi' : 'nhận được'}
                      </div>
                      <div className="qb">
                        {m.meta?.title && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{m.meta.title}</div>}
                        <div className="amt">{(m.meta?.amount ?? 0).toLocaleString('vi-VN')} ₫</div>
                        {m.body && <div style={{ fontSize: 13, marginTop: 6 }}>{m.body}</div>}
                      </div>
                    </div>
                  ) : (
                    <div className={`msg ${mine ? 'me' : 'them'}`}>
                      {m.body}
                      {m.attachment_url && <Attachment path={m.attachment_url} meta={m.meta} />}
                      <div className="t">
                        {hhmm(m.created_at)}
                        {mine && (m.read_by ?? []).some((u) => u !== uid) ? ' · Đã xem' : ''}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          {err && <div className="notice" style={{ margin: '0 16px 8px', background: '#fdecea', color: '#a12622' }}>{err}</div>}
          <form className="composer2" onSubmit={send}>
            <div className="tools">
              <a role="button" tabIndex={0} title="Đính kèm tệp" aria-label="Đính kèm tệp" onClick={() => !sending && fileRef.current?.click()} onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}>
                <svg className="ic"><use href="#ic-link" /></svg>
              </a>
            </div>
            <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) sendFile(f); e.target.value = ''; }} />
            <input placeholder="Nhập tin nhắn…" value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} />
            <button className="btn btn-orange btn-icon" type="submit" disabled={sending || !text.trim()} aria-label="Gửi">
              <svg className="ic"><use href="#ic-send" /></svg>
            </button>
          </form>
        </div>
      ) : (
        <div className="cthread">
          <div className="cempty">
            <div>
              <svg className="ic" style={{ width: 48, height: 48, opacity: 0.3, marginBottom: 10 }}><use href="#ic-chat" /></svg>
              <p>{err ?? 'Chọn một hội thoại để bắt đầu'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Thông tin đối tác */}
      <aside className="cinfo">
        {sel?.other ? (
          <>
            <div style={{ textAlign: 'center' }}>
              <Ava co={sel.other} cls="ava-lg" size={64} />
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--navy)' }}>{sel.other.name}</h3>
              {sel.other.verified_tier !== 'none' && (
                <div className="verify legal" style={{ margin: '8px auto', display: 'inline-flex' }}>
                  <svg className="ic"><use href="#ic-shield-check" /></svg> Đã xác minh
                </div>
              )}
              <a className="btn btn-outline btn-block btn-sm mt-8" href={`/cong-ty/${sel.other.slug}`}>Xem hồ sơ</a>
            </div>
            <div className="divider" />
            <div className="kv">
              <span className="k">Trust Score</span>
              <span className="v" style={{ color: 'var(--green)' }}>{Math.round(sel.other.trust_score ?? 0)}</span>
            </div>
          </>
        ) : (
          <p className="muted" style={{ fontSize: 13 }}>Chọn hội thoại để xem thông tin đối tác.</p>
        )}
      </aside>
    </div>
  );
}
