'use client';
import { useEffect, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AdminProvider } from '@/components/admin/ui';
import GlobalSearch from '@/components/admin/GlobalSearch';
import { hasRole, ROLE_LABEL, type PlatformRole } from '@/lib/admin-roles';

type Badge = 'verifications_pending' | 'claims_pending' | 'reports_open' | 'registrations_pending';
type Item = { href: string; label: string; icon: string; badge?: Badge; min?: PlatformRole };

const NAV: { h?: string; items: Item[] }[] = [
  { items: [{ href: '/admin', label: 'Tổng quan', icon: 'ic-grid' }] },
  {
    h: 'Cần xử lý',
    items: [
      { href: '/admin/verifications', label: 'Xác minh pháp lý', icon: 'ic-shield-check', badge: 'verifications_pending' },
      { href: '/admin/claims', label: 'Nhận hồ sơ', icon: 'ic-link', badge: 'claims_pending' },
      { href: '/admin/registrations', label: 'Đăng ký đối tác', icon: 'ic-clipboard', badge: 'registrations_pending' },
      { href: '/admin/moderation', label: 'Kiểm duyệt nội dung', icon: 'ic-eye', badge: 'reports_open' },
      { href: '/admin/reviews', label: 'Đánh giá', icon: 'ic-star' },
    ],
  },
  {
    h: 'Dữ liệu',
    items: [
      { href: '/admin/companies', label: 'Doanh nghiệp', icon: 'ic-building', min: 'admin' },
      { href: '/admin/import', label: 'Nhập dữ liệu', icon: 'ic-upload', min: 'admin' },
      { href: '/admin/quality', label: 'Chất lượng dữ liệu', icon: 'ic-check', min: 'admin' },
      { href: '/admin/categories', label: 'Danh mục & tỉnh thành', icon: 'ic-layers', min: 'admin' },
    ],
  },
  {
    h: 'Kinh doanh',
    items: [
      { href: '/admin/demand', label: 'Nhu cầu & báo giá', icon: 'ic-briefcase', min: 'admin' },
      { href: '/admin/subscriptions', label: 'Gói & thanh toán', icon: 'ic-coin', min: 'admin' },
      { href: '/admin/plans', label: 'Bảng giá', icon: 'ic-tag', min: 'admin' },
      { href: '/admin/ads', label: 'Quảng cáo', icon: 'ic-image', min: 'admin' },
    ],
  },
  {
    h: 'Hệ thống',
    items: [
      { href: '/admin/users', label: 'Người dùng & phân quyền', icon: 'ic-users', min: 'admin' },
      { href: '/admin/broadcast', label: 'Gửi thông báo', icon: 'ic-bell', min: 'admin' },
      { href: '/admin/audit', label: 'Nhật ký hoạt động', icon: 'ic-file-text', min: 'admin' },
    ],
  },
];

const COLLAPSE_KEY = 'sxd_adm_collapsed';

export default function AdminShell({ counts: initial, name, email, role, children }: { counts: Record<string, number>; name: string; email: string; role: PlatformRole; children: React.ReactNode }) {
  const nav = NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.min || hasRole(role, i.min)) })).filter((g) => g.items.length);
  const path = usePathname();
  const [open, setOpen] = useState(false); // ngăn kéo trên điện thoại
  const [mini, setMini] = useState(false); // thu gọn còn icon trên desktop (ghi nhớ)
  useEffect(() => {
    try { setMini(localStorage.getItem(COLLAPSE_KEY) === '1'); } catch { /* bỏ qua */ }
  }, []);
  const toggleMini = () => setMini((v) => {
    try { localStorage.setItem(COLLAPSE_KEY, v ? '0' : '1'); } catch { /* bỏ qua */ }
    return !v;
  });
  useEffect(() => setOpen(false), [path]);

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
  const flat = nav.flatMap((g) => g.items.map((i) => ({ ...i, group: g.h })));
  const current = flat.find((i) => on(i.href));
  const ini = name.split(' ').filter(Boolean).slice(-2).map((w) => w[0].toUpperCase()).join('') || 'A';

  return (
    <AdminProvider>
      <div className={`adm${open ? ' open' : ''}${mini ? ' mini' : ''}`}>
        <aside className="adm-side" aria-label="Điều hướng quản trị">
          <div className="adm-side-top">
            <Link href="/admin" className="adm-brand" title="Sàn Xây Dựng — Quản trị">
              <span className="logo"><img src="/logo.png" alt="" /></span>
              <span className="txt"><b>Sàn Xây Dựng</b><small>Quản trị hệ thống</small></span>
            </Link>
            <button type="button" className="adm-collapse" onClick={toggleMini} aria-label={mini ? 'Mở rộng menu' : 'Thu gọn menu'} title={mini ? 'Mở rộng menu' : 'Thu gọn menu'}>
              <svg className="ic"><use href="#ic-sidebar" /></svg>
            </button>
          </div>

          <nav className="adm-nav">
            {nav.map((g, i) => (
              <div key={i} className="adm-nav-g">
                {g.h && <div className="adm-nav-h">{g.h}</div>}
                {g.items.map((it) => {
                  const n = it.badge ? counts[it.badge] ?? 0 : 0;
                  const active = on(it.href);
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      className={active ? 'on' : ''}
                      aria-current={active ? 'page' : undefined}
                      title={mini ? `${it.label}${n ? ` (${n})` : ''}` : undefined}
                    >
                      <span className="ico"><svg className="ic"><use href={`#${it.icon}`} /></svg></span>
                      <span className="lb">{it.label}</span>
                      {n > 0 && <span className="cnt" aria-label={`${n} mục chờ`}>{n > 99 ? '99+' : n}</span>}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="adm-side-foot">
            <div className="adm-me" title={mini ? `${name} · ${ROLE_LABEL[role]}` : undefined}>
              <span className="av">{ini}</span>
              <span className="who"><b>{name}</b><small>{ROLE_LABEL[role]}</small></span>
            </div>
            <div className="adm-foot-acts">
              <Link href="/" title="Về trang chủ" aria-label="Về trang chủ"><svg className="ic"><use href="#ic-home" /></svg><span>Trang chủ</span></Link>
              <form action="/login/signout" method="post">
                <button type="submit" title="Đăng xuất" aria-label="Đăng xuất"><svg className="ic"><use href="#ic-logout" /></svg><span>Đăng xuất</span></button>
              </form>
            </div>
          </div>
        </aside>
        <div className="adm-scrim" onClick={() => setOpen(false)} />

        <div className="adm-main">
          <header className="adm-top">
            <button className="adm-burger" onClick={() => setOpen(true)} aria-label="Mở menu"><svg className="ic"><use href="#ic-menu" /></svg></button>
            <div className="adm-crumb">
              <span className="g">{current?.group ?? 'Quản trị'}</span>
              <svg className="ic"><use href="#ic-chevron-right" /></svg>
              <b>{current?.label ?? 'Tổng quan'}</b>
            </div>
            <GlobalSearch />
            {todo > 0 && (
              <Link href="/admin" className="adm-todo" title={`${todo} mục đang chờ xử lý`}>
                <svg className="ic"><use href="#ic-bell" /></svg>
                <span>{todo > 99 ? '99+' : todo}</span>
              </Link>
            )}
            <div className="adm-user" title={`${name} · ${email}`}>
              <div className="av">{ini}</div>
            </div>
          </header>
          <main className="adm-content">{children}</main>
        </div>
      </div>
    </AdminProvider>
  );
}
