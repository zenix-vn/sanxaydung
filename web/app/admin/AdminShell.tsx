'use client';
import { useEffect, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AdminProvider } from '@/components/admin/ui';
import GlobalSearch from '@/components/admin/GlobalSearch';
import { hasRole, ROLE_LABEL, type PlatformRole } from '@/lib/admin-roles';

const NAV: { h?: string; items: { href: string; label: string; icon: string; badge?: 'verifications_pending' | 'claims_pending' | 'reports_open' | 'registrations_pending'; min?: PlatformRole }[] }[] = [
  { items: [{ href: '/admin', label: 'Tổng quan', icon: 'ic-grid' }] },
  {
    h: 'Cần xử lý',
    items: [
      { href: '/admin/verifications', label: 'Xác minh pháp lý', icon: 'ic-shield-check', badge: 'verifications_pending' },
      { href: '/admin/claims', label: 'Nhận hồ sơ (claim)', icon: 'ic-link', badge: 'claims_pending' },
      { href: '/admin/registrations', label: 'Đăng ký đối tác', icon: 'ic-clipboard', badge: 'registrations_pending' },
      { href: '/admin/moderation', label: 'Kiểm duyệt nội dung', icon: 'ic-eye', badge: 'reports_open' },
      { href: '/admin/reviews', label: 'Đánh giá', icon: 'ic-star' },
    ],
  },
  {
    h: 'Quản lý',
    items: [
      { href: '/admin/companies', label: 'Doanh nghiệp', icon: 'ic-building', min: 'admin' },
      { href: '/admin/import', label: 'Nhập dữ liệu', icon: 'ic-upload', min: 'admin' },
      { href: '/admin/quality', label: 'Chất lượng dữ liệu', icon: 'ic-check', min: 'admin' },
      { href: '/admin/categories', label: 'Danh mục & tỉnh thành', icon: 'ic-layers', min: 'admin' },
      { href: '/admin/users', label: 'Người dùng & phân quyền', icon: 'ic-users', min: 'admin' },
      { href: '/admin/demand', label: 'Nhu cầu & báo giá', icon: 'ic-briefcase', min: 'admin' },
      { href: '/admin/subscriptions', label: 'Gói & thanh toán', icon: 'ic-coin', min: 'admin' },
      { href: '/admin/plans', label: 'Bảng giá', icon: 'ic-tag', min: 'admin' },
      { href: '/admin/ads', label: 'Quảng cáo', icon: 'ic-image', min: 'admin' },
      { href: '/admin/broadcast', label: 'Gửi thông báo', icon: 'ic-bell', min: 'admin' },
      { href: '/admin/audit', label: 'Nhật ký hoạt động', icon: 'ic-file-text', min: 'admin' },
    ],
  },
];

export default function AdminShell({ counts: initial, name, email, role, children }: { counts: Record<string, number>; name: string; email: string; role: PlatformRole; children: React.ReactNode }) {
  const nav = NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.min || hasRole(role, i.min)) })).filter((g) => g.items.length);
  const path = usePathname();
  const [open, setOpen] = useState(false);
  // số việc đang chờ: tự làm mới mỗi phút khi tab đang mở, hiện cả trên tiêu đề tab
  const [counts, setCounts] = useState(initial);
  useEffect(() => setCounts(initial), [initial]);
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      const { data } = await createSupabaseBrowser().rpc('admin_stats');
      if (data) setCounts(data as Record<string, number>);
    }, 60000);
    return () => clearInterval(t);
  }, []);
  const todo = ['verifications_pending', 'claims_pending', 'reports_open', 'registrations_pending'].reduce((a, k) => a + (counts[k] ?? 0), 0);
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(/^\(\d+\) /, '');
      const next = todo ? `(${todo}) ${base}` : base;
      if (document.title !== next) document.title = next;
    };
    apply();
    // Next đổi <title> sau khi chuyển trang → gắn lại
    const watch = new MutationObserver(apply);
    watch.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => watch.disconnect();
  }, [todo]);
  const on = (href: string) => (href === '/admin' ? path === '/admin' : path === href || path.startsWith(`${href}/`));
  const current = nav.flatMap((g) => g.items).find((i) => on(i.href));
  const ini = name.split(' ').filter(Boolean).slice(-2).map((w) => w[0].toUpperCase()).join('');

  return (
    <AdminProvider>
      <div className={`adm${open ? ' open' : ''}`}>
        <aside className="adm-side" aria-label="Điều hướng quản trị">
          <Link href="/admin" className="adm-brand">
            <img src="/logo.png" alt="" />
            <div><b>SÀN XÂY DỰNG</b><small>Trang quản trị</small></div>
          </Link>
          <nav className="adm-nav">
            {nav.map((g, i) => (
              <div key={i}>
                {g.h && <div className="adm-nav-h">{g.h}</div>}
                {g.items.map((it) => {
                  const n = it.badge ? counts[it.badge] ?? 0 : 0;
                  return (
                    <Link key={it.href} href={it.href} className={on(it.href) ? 'on' : ''} onClick={() => setOpen(false)} aria-current={on(it.href) ? 'page' : undefined}>
                      <svg className="ic"><use href={`#${it.icon}`} /></svg>
                      {it.label}
                      {n > 0 && <span className="cnt">{n > 99 ? '99+' : n}</span>}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="adm-side-foot">
            <Link href="/">← Về trang chủ</Link>
            <form action="/login/signout" method="post"><button type="submit" style={{ background: 'none', border: 'none', color: '#9db3cd', cursor: 'pointer', padding: '5px 0', font: 'inherit' }}>Đăng xuất</button></form>
          </div>
        </aside>
        <div className="adm-scrim" onClick={() => setOpen(false)} />
        <div className="adm-main">
          <header className="adm-top">
            <button className="adm-burger" onClick={() => setOpen(true)} aria-label="Mở menu"><svg className="ic" style={{ width: 20, height: 20 }}><use href="#ic-dots" /></svg></button>
            <div className="crumb">Quản trị / <b>{current?.label ?? 'Tổng quan'}</b></div>
            <GlobalSearch />
            <div className="adm-user">
              <div className="nm">{name}<small>{ROLE_LABEL[role]} · {email}</small></div>
              <div className="av">{ini || 'A'}</div>
            </div>
          </header>
          <main className="adm-content">{children}</main>
        </div>
      </div>
    </AdminProvider>
  );
}
