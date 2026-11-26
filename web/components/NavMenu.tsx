'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { supa as loadSupa } from '@/lib/supabase/lazy';
import NotificationBell from './NotificationBell';

const LINKS = [
  { href: '/', label: 'Trang chủ', exact: true },
  { href: '/directory', label: 'Tìm nhà thầu' },
  { href: '/marketplace', label: 'Nhu cầu / Báo giá' },
  { href: '/feed', label: 'Tin tức' },
];

export default function NavMenu() {
  const pathname = usePathname();
  // undefined = chưa biết (tránh nháy nút Đăng nhập khi đã đăng nhập)
  const [loggedIn, setLoggedIn] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    // Chỉ cần biết đã đăng nhập chưa → phiên lưu sẵn trong trình duyệt (INITIAL_SESSION), không gọi máy chủ
    let unsub: (() => void) | undefined;
    let alive = true;
    loadSupa().then((supa) => {
      if (!alive) return;
      const { data } = supa.auth.onAuthStateChange((_e, session) => setLoggedIn(!!session?.user));
      unsub = () => data.subscription.unsubscribe();
    });
    return () => {
      alive = false;
      unsub?.();
    };
  }, []);

  // Điều hướng phía client không tải lại trang → tự đóng menu di động (checkbox #navtoggle)
  useEffect(() => {
    const t = document.getElementById('navtoggle') as HTMLInputElement | null;
    if (t) t.checked = false;
  }, [pathname]);

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <div className="nav-menu-wrap">
      <nav className="menu">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={isActive(l.href, l.exact) ? 'active' : ''}>
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="nav-actions">
        <a className="btn btn-ghost" href="/chat" title="Tin nhắn" aria-label="Tin nhắn" style={{ padding: '0 10px' }}>
          <svg className="ic"><use href="#ic-chat" /></svg>
        </a>
        <NotificationBell />
        {loggedIn === true && (
          <>
            <Link className="btn btn-ghost" href="/dashboard">Bảng điều khiển</Link>
            <form action="/login/signout" method="post" style={{ display: 'inline' }}>
              <button className="btn btn-outline" type="submit">Đăng xuất</button>
            </form>
          </>
        )}
        {loggedIn === false && (
          <>
            <a className="btn btn-ghost" href="/login">Đăng nhập</a>
            <a className="btn btn-orange" href="/login">Đăng ký</a>
          </>
        )}
      </div>
    </div>
  );
}
