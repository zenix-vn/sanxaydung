'use client';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

export type Pin = { name: string; lat: number; lng: number };

/** Bản đồ các chi nhánh đã ghim vị trí. Thư viện bản đồ chỉ tải khi khối này sắp vào tầm nhìn. */
export default function BranchMap({ pins }: { pins: Pin[] }) {
  const box = useRef<HTMLDivElement>(null);
  const key = JSON.stringify(pins);

  useEffect(() => {
    let map: import('leaflet').Map | null = null;
    let gone = false;
    const start = () =>
      import('leaflet').then((L) => {
        if (gone || !box.current) return;
        const list = JSON.parse(key) as Pin[];
        map = L.map(box.current, { scrollWheelZoom: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map);
        for (const p of list) {
          const label = document.createElement('b');
          label.textContent = p.name; // textContent: tên do người dùng nhập
          L.circleMarker([p.lat, p.lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#021e48', fillOpacity: 0.9 }).addTo(map).bindPopup(label);
        }
        if (list.length === 1) map.setView([list[0].lat, list[0].lng], 15);
        else map.fitBounds(L.latLngBounds(list.map((p) => [p.lat, p.lng])), { padding: [32, 32], maxZoom: 15 });
      });
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: '300px' });
    if (box.current) io.observe(box.current);
    return () => { gone = true; io.disconnect(); map?.remove(); };
  }, [key]);

  return <div ref={box} className="br-map" role="region" aria-label="Bản đồ chi nhánh" />;
}
