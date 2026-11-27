'use client';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { TIER_COLORS, TIER_LABELS, ROLE_LABELS } from '@/lib/format';
import { initials, thumb } from '@/lib/ui';

export type NavCompany = { id: string; name: string; slug: string; logo_url: string | null; role: string };
type Item = { href: string; icon: string; label: string; badge?: number; exact?: boolean };

export default function DashNav({
  active, tier, companies, badges,
}: {
  active: NavCompany;
  tier: string;
  companies: NavCompany[];
  badges: { quotes: number; connections: number; messages: number; notifications: number };
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isAdmin = ['owner', 'admin'].includes(active.role);

  const groups: { title?: string; items: Item[] }[] = [
    {
      items: [
        { href: '/dashboard', icon: 'ic-chart', label: 'Tổng quan', exact: true },
        { href: '/dashboard/stats', icon: 'ic-eye', label: 'Thống kê hồ sơ' },
        { href: `/cong-ty/${active.slug}`, icon: 'ic-building', label: 'Hồ sơ công khai' },
        { href: '/dashboard/company-edit', icon: 'ic-edit', label: 'Chỉnh sửa hồ sơ' },
        { href: '/dashboard/leads', icon: 'ic-clipboard', label: 'Yêu cầu từ website' },
      ],
    },
    {
      title: 'Kinh doanh',
      items: [
        { href: '/dashboard/listings', icon: 'ic-briefcase', label: 'Tin đăng & báo giá', badge: badges.quotes },
        { href: '/dashboard/connections', icon: 'ic-people', label: 'Kết nối', badge: badges.connections },
        { href: '/chat', icon: 'ic-chat', label: 'Tin nhắn', badge: badges.messages },
        { href: '/dashboard/saved', icon: 'ic-heart', label: 'Đã lưu & so sánh' },
        { href: '/feed', icon: 'ic-layers', label: 'Bài viết' },
      ],
    },
    {
      title: 'Uy tín & tài khoản',
      items: [
        { href: '/dashboard/verify', icon: 'ic-shield', label: 'Xác minh' },
        { href: '/dashboard/trust', icon: 'ic-trending', label: 'Trust Score' },
        ...(isAdmin ? [{ href: '/dashboard/members', icon: 'ic-users', label: 'Thành viên & phân quyền' }] : []),
        { href: '/dashboard/notifications', icon: 'ic-bell', label: 'Thông báo', badge: badges.notifications },
        { href: '/dashboard/settings', icon: 'ic-settings', label: 'Cài đặt & quyền riêng tư' },
        { href: '/login/signout', icon: 'ic-logout', label: 'Đăng xuất' },
      ],
    },
  ];

  const on = (it: Item) => (it.exact ? path === it.href : path === it.href || path.startsWith(`${it.href}/`));
  const others = companies.filter((c) => c.id !== active.id);
  const here = encodeURIComponent(path.startsWith('/dashboard') ? path : '/dashboard');

  return (
    <aside className="dside">
      <div className="co-switch">
        <button type="button" className="co" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu">
          {active.logo_url ? (
            <img src={thumb(active.logo_url, 80)} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }} />
          ) : (
            <span className="a" style={{ background: TIER_COLORS[tier] ?? '#12439c' }}>{initials(active.name)}</span>
          )}
          <div style={{ minWidth: 0, textAlign: 'left' }}>
            <h4>{active.name}</h4>
            <small>
              <svg className="ic"><use href="#ic-shield-check" /></svg>
              {TIER_LABELS[tier] ?? 'Chưa xác minh'} · {ROLE_LABELS[active.role] ?? active.role}
            </small>
          </div>
          <svg className="ic chev"><use href="#ic-chevron-down" /></svg>
        </button>
        {open && (
          <div className="co-menu" role="menu">
            {others.length > 0 && <div className="grp">Chuyển doanh nghiệp</div>}
            {others.map((c) => (
              <a key={c.id} role="menuitem" href={`/dashboard/switch?to=${c.id}&next=${here}`}>
                <span className="mini" style={{ background: '#12439c' }}>{initials(c.name)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>{c.name}</span>
                <small>{ROLE_LABELS[c.role] ?? c.role}</small>
              </a>
            ))}
            <a role="menuitem" href="/dashboard/new"><svg className="ic"><use href="#ic-plus" /></svg> Tạo doanh nghiệp khác</a>
            <a role="menuitem" href="/dashboard/claim"><svg className="ic"><use href="#ic-search" /></svg> Nhận hồ sơ có sẵn</a>
          </div>
        )}
      </div>
      <nav className="dnav" aria-label="Bảng điều khiển">
        {groups.map((g, i) => (
          <div key={i} style={{ display: 'contents' }}>
            {g.title && <div className="grp">{g.title}</div>}
            {g.items.map((n) => (
              <NavLink key={n.href} href={n.href} className={on(n) ? 'active' : ''} aria-current={on(n) ? 'page' : undefined}>
                <svg className="ic"><use href={`#${n.icon}`} /></svg> {n.label}
                {n.badge ? <span className="dbadge">{n.badge > 99 ? '99+' : n.badge}</span> : null}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

// Route handler (đăng xuất) phải tải trang đầy đủ; còn lại điều hướng phía client.
function NavLink({ href, ...rest }: React.ComponentProps<'a'> & { href: string }) {
  if (href.startsWith('/login/')) return <a href={href} {...rest} />;
  return <Link href={href} {...rest} />;
}
