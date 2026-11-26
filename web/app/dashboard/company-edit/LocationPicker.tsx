'use client';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { parseLatLng } from '@/lib/profile';
import { PROVINCE_GEO } from '@/lib/province-geo';

type Pos = { lat: number; lng: number } | null;

/** Chọn vị trí: bấm lên bản đồ, kéo ghim, hoặc dán tọa độ sao chép từ Google Maps. */
export default function LocationPicker({ value, onChange, province }: { value: Pos; onChange: (p: Pos) => void; province: string }) {
  const box = useRef<HTMLDivElement>(null);
  const api = useRef<{ show: (p: Pos, province: string) => void } | null>(null);
  const latest = useRef({ value, province, onChange });
  latest.current = { value, province, onChange };
  const [text, setText] = useState(value ? `${value.lat}, ${value.lng}` : '');
  const key = value ? `${value.lat},${value.lng}` : '';

  useEffect(() => {
    let map: import('leaflet').Map | null = null;
    let gone = false;
    import('leaflet').then((L) => {
      if (gone || !box.current) return;
      map = L.map(box.current, { scrollWheelZoom: false }).setView([16.0, 106.5], 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map);
      let pin: import('leaflet').CircleMarker | null = null;
      let lastProvince = '';
      api.current = {
        show(p, prov) {
          pin?.remove();
          pin = null;
          if (p) {
            pin = L.circleMarker([p.lat, p.lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#f18a1c', fillOpacity: 1 }).addTo(map!);
            map!.setView([p.lat, p.lng], Math.max(map!.getZoom(), 15));
          } else if (prov !== lastProvince && PROVINCE_GEO[prov]) {
            map!.setView(PROVINCE_GEO[prov], 11);
          }
          lastProvince = prov;
        },
      };
      map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        latest.current.onChange({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.wrap().lng.toFixed(6) });
      });
      api.current.show(latest.current.value, latest.current.province);
    });
    return () => { gone = true; api.current = null; map?.remove(); };
  }, []);

  useEffect(() => {
    api.current?.show(latest.current.value, province);
    const v = latest.current.value;
    // đừng ghi đè khi người dùng đang gõ đúng giá trị đó
    setText((t) => { const typed = parseLatLng(t); return v ? (typed?.lat === v.lat && typed.lng === v.lng ? t : `${v.lat}, ${v.lng}`) : typed ? '' : t; });
  }, [key, province]);

  const bad = !!text.trim() && !parseLatLng(text);
  return (
    <div>
      <div ref={box} className="loc-map" />
      <div className="row" style={{ gap: 10, marginTop: 8 }}>
        <input
          className="input" value={text} aria-label="Tọa độ" placeholder="Bấm lên bản đồ, hoặc dán tọa độ (vd. 21.028511, 105.804817)"
          onChange={(e) => { setText(e.target.value); const p = parseLatLng(e.target.value); if (p || !e.target.value.trim()) onChange(p); }}
        />
        {value && <button type="button" className="btn-link danger" onClick={() => { setText(''); onChange(null); }}>Bỏ ghim</button>}
      </div>
      {bad && <div className="hint" style={{ color: 'var(--red)' }}>Tọa độ chưa đúng định dạng “vĩ độ, kinh độ”.</div>}
    </div>
  );
}
