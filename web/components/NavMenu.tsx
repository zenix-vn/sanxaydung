'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import NotificationBell from './NotificationBell';

const LINKS = [
  { href: '/', label: 'Trang chủ', exact: true },
  { href: '/directory', label: 'Tìm nhà thầu' },
  { href: '/marketplace', label: 'Nhu cầu / Báo giá' },
  { href: '/feed', label: 'Tin tức' },
  { href: '/pricing', label: 'Bảng giá' },
];

export default function NavMenu() {
  const pathname = usePathname();
  // undefined = chưa biết (tránh nháy nút Đăng nhập khi đã đăng nhập)
  const [loggedIn, setLoggedIn] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const supa = createSupabaseBrowser();
    supa.auth.getUser().then(({ data: { user } }) => setLoggedIn(!!user));
    const { data } = supa.auth.onAuthStateChange((_e, session) => setLoggedIn(!!session?.user));
    return () => data.subscription.unsubscribe();
  }, []);

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <div className="nav-menu-wrap">
      <nav className="menu">
        {LINKS.map((l) => (
          <a key={l.href} href={l.href} className={isActive(l.href, l.exact) ? 'active' : ''}>
            {l.label}
          </a>
        ))}
      </nav>
      <div className="nav-actions">
        <a className="btn btn-ghost" href="/chat" title="Tin nhắn" aria-label="Tin nhắn" style={{ padding: '0 10px' }}>
          <svg className="ic"><use href="#ic-chat" /></svg>
        </a>
        <NotificationBell />
        {loggedIn === true && (
          <>
            <a className="btn btn-ghost" href="/dashboard">Bảng điều khiển</a>
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
