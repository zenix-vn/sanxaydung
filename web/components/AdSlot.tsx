'use client';
import { useEffect, useRef, useState } from 'react';
import { supa as loadSupa } from '@/lib/supabase/lazy';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';

type Ad = { id: string; title: string | null; creative_url: string; target_url: string; company: string | null };

/** Đếm lượt; keepalive để không mất lượt nhấp khi trang chuyển đi. */
function track(id: string, event: 'view' | 'click') {
  fetch(`${SUPABASE_URL}/rest/v1/rpc/ad_track`, {
    method: 'POST', keepalive: true,
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ _id: id, _event: event }),
  }).catch(() => {});
}

/** Vị trí quảng cáo: không có quảng cáo đang chạy thì không chiếm chỗ. Quản lý tại /admin/ads. */
export default function AdSlot({ slot, wrap }: { slot: 'home_banner' | 'directory_top' | 'marketplace_top'; wrap?: boolean }) {
  const [ad, setAd] = useState<Ad | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!SUPABASE_URL) return;
    let gone = false;
    loadSupa().then((s) => s.rpc('ad_serve', { _slot: slot })).then(({ data }) => { if (!gone && data) setAd(data as Ad); }).catch(() => undefined);
    return () => { gone = true; };
  }, [slot]);

  // chỉ tính hiển thị khi ít nhất một nửa banner thực sự lọt vào màn hình
  useEffect(() => {
    if (!ad || !box.current) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { track(ad.id, 'view'); io.disconnect(); }
    }, { threshold: 0.5 });
    io.observe(box.current);
    return () => io.disconnect();
  }, [ad]);

  if (!ad) return null;
  const external = /^https:/i.test(ad.target_url);
  const banner = (
    <div className="adslot" ref={box}>
      <a href={ad.target_url} onClick={() => track(ad.id, 'click')} rel="sponsored noopener noreferrer" target={external ? '_blank' : undefined}>
        <img src={ad.creative_url} alt={ad.title ?? ad.company ?? 'Quảng cáo'} />
      </a>
      <span>Quảng cáo</span>
    </div>
  );
  return wrap ? <div className="container" style={{ marginTop: 24 }}>{banner}</div> : banner;
}
