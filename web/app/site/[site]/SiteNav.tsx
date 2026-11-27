'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';

type Item = { href: string; label: string };

export default function SiteNav({ items, cta }: { items: Item[]; cta: Item }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  // Trang chủ chỉ sáng khi đúng là trang chủ; trang khác sáng cả các trang con (vd. /du-an/...)
  const home = items[0]?.href;
  const active = (h: string) => (h === home ? path === h : path === h || path.startsWith(`${h}/`));
  return (
    <>
      <button className="ws-burger" aria-label={open ? 'Đóng menu' : 'Mở menu'} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg className="ic"><use href={open ? '#ic-x' : '#ic-menu'} /></svg>
      </button>
      <nav className={`ws-nav${open ? ' open' : ''}`}>
        {items.map((i) => (
          <a key={i.href} href={i.href} className={active(i.href) ? 'on' : undefined} onClick={() => setOpen(false)}>{i.label}</a>
        ))}
        <a className="ws-btn" href={cta.href} onClick={() => setOpen(false)}>{cta.label}</a>
      </nav>
    </>
  );
}
