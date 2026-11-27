'use client';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import { PROVINCE_GEO } from '@/lib/province-geo';

export type ProvStat = { code: string; name: string; total: number; verified: number };

/** Bản đồ điểm tròn theo tỉnh: diện tích ~ số doanh nghiệp. Bấm điểm → danh bạ lọc theo tỉnh. */
export default function MapView({ stats, group }: { stats: ProvStat[]; group?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import('leaflet').Map | null = null;
    let alive = true;
    import('leaflet').then((L) => {
      if (!alive || !ref.current) return;
      map = L.map(ref.current, { scrollWheelZoom: false, minZoom: 5, maxZoom: 11 }).setView([16.0, 106.5], 5.6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);
      const max = Math.max(1, ...stats.map((s) => s.total));
      for (const s of stats) {
        const ll = PROVINCE_GEO[s.code];
        if (!ll) continue;
        const r = 6 + 22 * Math.sqrt(s.total / max);
        const href = `/directory?province=${encodeURIComponent(s.code)}${group ? `&group=${encodeURIComponent(group)}` : ''}`;
        const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
        L.circleMarker(ll, { radius: r, color: '#ffffff', weight: 2, fillColor: '#021e48', fillOpacity: 0.78 })
          .addTo(map)
          .bindTooltip(`<b>${esc(s.name)}</b><br>${s.total} doanh nghiệp · ${s.verified} đã xác minh`, { direction: 'top' })
          .on('click', () => window.location.assign(href));
      }
    });
    return () => {
      alive = false;
      map?.remove();
    };
  }, [stats, group]);

  return <div ref={ref} style={{ height: 560, borderRadius: 14, border: '1px solid var(--line)', zIndex: 0 }} role="region" aria-label="Bản đồ doanh nghiệp theo tỉnh" />;
}
