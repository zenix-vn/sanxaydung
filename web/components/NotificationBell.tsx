'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supa as loadSupa } from '@/lib/supabase/lazy';
import { timeAgo } from '@/lib/ui';

interface Noti {
  id: string;
  type: string;
  title: string | null;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

// Chuông thông báo: tải 15 thông báo gần nhất, đếm chưa đọc, cập nhật tức thì qua Realtime.
// Chưa đăng nhập → không hiển thị gì.
export default function NotificationBell() {
  const [supa, setSupa] = useState<SupabaseClient | null>(null);
  useEffect(() => {
    let alive = true;
    loadSupa().then((c) => alive && setSupa(c));
    return () => {
      alive = false;
    };
  }, []);
  const [uid, setUid] = useState<string | null>(null);
  const [items, setItems] = useState<Noti[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (id: string) => {
      if (!supa) return;
      const [list, cnt] = await Promise.all([
        supa.from('notifications').select('id, type, title, body, link, is_read, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(15),
        supa.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', id).eq('is_read', false),
      ]);
      setItems((list.data ?? []) as Noti[]);
      setUnread(cnt.count ?? 0);
    },
    [supa],
  );

  useEffect(() => {
    if (!supa) return;
    // INITIAL_SESSION (phát ngay khi đăng ký) + đăng nhập/đăng xuất về sau → một nguồn duy nhất, không tải trùng
    const { data: sub } = supa.auth.onAuthStateChange((_e, session) => {
      const id = session?.user?.id ?? null;
      setUid(id);
      if (id) load(id);
      else {
        setItems([]);
        setUnread(0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [supa, load]);

  useEffect(() => {
    if (!uid || !supa) return;
    const ch = supa
      .channel(`noti-${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, (p) => {
        const n = p.new as Noti;
        setItems((cur) => [n, ...cur.filter((x) => x.id !== n.id)].slice(0, 15));
        if (!n.is_read) setUnread((u) => u + 1);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, () => load(uid))
      .subscribe();
    return () => {
      supa.removeChannel(ch);
    };
  }, [supa, uid, load]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  async function markAll() {
    if (!uid || !unread || !supa) return;
    setItems((cur) => cur.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
    await supa.from('notifications').update({ is_read: true }).eq('user_id', uid).eq('is_read', false);
  }

  async function openItem(n: Noti) {
    if (!n.is_read && supa) {
      setItems((cur) => cur.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      await supa.from('notifications').update({ is_read: true }).eq('id', n.id);
    }
    if (n.link) window.location.href = n.link;
  }

  if (!uid) return null;

  return (
    <div ref={box} className="noti-bell" style={{ position: 'relative' }}>
      <style>{`
        .noti-bell .bell-btn{position:relative;width:40px;height:40px;border-radius:10px;display:grid;place-items:center;border:none;background:transparent;color:inherit;cursor:pointer}
        .noti-bell .bell-btn:hover{background:rgba(127,127,127,.12)}
        .noti-bell .bell-btn svg{width:20px;height:20px}
        .noti-bell .dot{position:absolute;top:3px;right:3px;min-width:17px;height:17px;padding:0 4px;border-radius:9px;background:var(--orange);color:#fff;font-size:10.5px;font-weight:700;display:grid;place-items:center}
        .noti-pop{position:absolute;right:0;top:46px;width:340px;max-width:92vw;background:#fff;color:var(--text);border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 32px rgba(2,30,72,.18);z-index:60;overflow:hidden}
        .noti-pop .hd{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid var(--line)}
        .noti-pop .hd b{color:var(--navy);font-size:14px}
        .noti-pop .hd a{font-size:12px;color:var(--orange);font-weight:600;cursor:pointer}
        .noti-pop .list{max-height:380px;overflow-y:auto}
        .noti-pop .it{display:block;width:100%;text-align:left;padding:11px 14px;border:none;border-bottom:1px solid var(--line-2);background:#fff;cursor:pointer}
        .noti-pop .it.un{background:var(--orange-soft)}
        .noti-pop .it:hover{background:#f6f8fb}
        .noti-pop .it b{display:block;font-size:13px;color:var(--navy)}
        .noti-pop .it span{display:block;font-size:12.5px;color:#31414f;margin-top:2px}
        .noti-pop .it small{font-size:11px;color:var(--muted)}
        .noti-pop .ft{display:block;text-align:center;padding:10px;border-top:1px solid var(--line-2);font-size:12.5px;font-weight:600;color:var(--orange);text-decoration:none}
        .noti-pop .empty{padding:28px 14px;text-align:center;color:var(--muted);font-size:13px}
      `}</style>
      <button className="bell-btn" aria-label={`Thông báo${unread ? ` (${unread} chưa đọc)` : ''}`} onClick={() => setOpen((o) => !o)}>
        <svg className="ic"><use href="#ic-bell" /></svg>
        {unread > 0 && <span className="dot">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="noti-pop" role="dialog" aria-label="Thông báo">
          <div className="hd">
            <b>Thông báo</b>
            {unread > 0 && <a onClick={markAll}>Đánh dấu đã đọc</a>}
          </div>
          <div className="list">
            {items.length === 0 ? (
              <div className="empty">Chưa có thông báo nào.</div>
            ) : (
              items.map((n) => (
                <button key={n.id} className={`it${n.is_read ? '' : ' un'}`} onClick={() => openItem(n)}>
                  <b>{n.title ?? 'Thông báo'}</b>
                  {n.body && <span>{n.body}</span>}
                  <small>{timeAgo(n.created_at)}</small>
                </button>
              ))
            )}
          </div>
          <a className="ft" href="/dashboard/notifications">Xem tất cả &amp; cài đặt thông báo</a>
        </div>
      )}
    </div>
  );
}
