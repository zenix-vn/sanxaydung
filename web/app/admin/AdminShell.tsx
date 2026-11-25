'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AdminProvider } from '@/components/admin/ui';

const NAV: { h?: string; items: { href: string; label: string; icon: string; badge?: 'verifications_pending' | 'claims_pending' | 'reports_open' | 'registrations_pending' }[] }[] = [
  { items: [{ href: '/admin', label: 'Tổng quan', icon: 'ic-grid' }] },
  {
    h: 'Cần xử lý',
    items: [
      { href: '/admin/verifications', label: 'Xác minh pháp lý', icon: 'ic-shield-check', badge: 'verifications_pending' },
      { href: '/admin/claims', label: 'Nhận hồ sơ (claim)', icon: 'ic-link', badge: 'claims_pending' },
      { href: '/admin/registrations', label: 'Đăng ký đối tác', icon: 'ic-clipboard', badge: 'registrations_pending' },
      { href: '/admin/moderation', label: 'Kiểm duyệt nội dung', icon: 'ic-eye', badge: 'reports_open' },
    ],
  },
  {
    h: 'Quản lý',
    items: [
      { href: '/admin/companies', label: 'Doanh nghiệp', icon: 'ic-building' },
      { href: '/admin/users', label: 'Người dùng', icon: 'ic-users' },
      { href: '/admin/subscriptions', label: 'Gói & thanh toán', icon: 'ic-coin' },
      { href: '/admin/audit', label: 'Nhật ký hoạt động', icon: 'ic-file-text' },
    ],
  },
];

export default function AdminShell({ counts, name, email, children }: { counts: Record<string, number>; name: string; email: string; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const on = (href: string) => (href === '/admin' ? path === '/admin' : path.startsWith(href));
  const current = NAV.flatMap((g) => g.items).find((i) => on(i.href));
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
            {NAV.map((g, i) => (
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
            <div className="adm-user">
              <div className="nm">{name}<small>{email}</small></div>
              <div className="av">{ini || 'A'}</div>
            </div>
          </header>
          <main className="adm-content">{children}</main>
        </div>
      </div>
    </AdminProvider>
  );
}
