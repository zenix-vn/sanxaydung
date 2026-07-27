'use client';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Trang chủ', exact: true },
  { href: '/directory', label: 'Tìm nhà thầu' },
  { href: '/marketplace', label: 'Nhu cầu / Báo giá' },
  { href: '/feed', label: 'Tin tức' },
  { href: '/pricing', label: 'Bảng giá' },
];

export default function NavMenu() {
  const pathname = usePathname();

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
        <a className="btn btn-ghost" href="/login">Đăng nhập</a>
        <a className="btn btn-orange" href="/login">Đăng ký</a>
      </div>
    </div>
  );
}
