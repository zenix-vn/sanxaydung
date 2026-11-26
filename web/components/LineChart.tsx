'use client';
import { useState } from 'react';

export type Point = { date: string; value: number };

const W = 640;
const H = 220;
const PAD = { l: 34, r: 44, t: 14, b: 26 };

/** Biểu đồ đường một chuỗi theo ngày (trục y 0..max). Hover hiện tooltip. */
export default function LineChart({ points, max: maxIn, label, unit = '', empty }: { points: Point[]; max?: number; label: string; unit?: string; empty?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) {
    return <p className="muted" style={{ fontSize: 13 }}>{empty ?? 'Chưa đủ dữ liệu để vẽ biểu đồ.'}</p>;
  }
  // trục y "đẹp": làm tròn lên bội số của 3 để có 4 vạch nguyên
  const max = maxIn ?? Math.max(3, Math.ceil(Math.max(...points.map((p) => p.value)) / 3) * 3);
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (i / (points.length - 1)) * iw;
  const y = (v: number) => PAD.t + ih - (Math.min(v, max) / max) * ih;
  const ticks = [0, max / 3, (2 * max) / 3, max].map((v) => Math.round(v));
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const fmt = (d: string) => new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  const labelIdx = [0, Math.floor((points.length - 1) / 2), points.length - 1];
  const h = hover != null ? points[hover] : null;

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${label}, giá trị mới nhất ${last.value}${unit}`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--line-2)" strokeWidth={1} />
            <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">{t}</text>
          </g>
        ))}
        {labelIdx.map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} fontSize={11} fill="var(--muted)">{fmt(points[i].date)}</text>
        ))}
        <path d={path} fill="none" stroke="var(--navy)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {/* nhãn trực tiếp cho giá trị mới nhất */}
        <circle cx={x(points.length - 1)} cy={y(last.value)} r={4} fill="var(--navy)" stroke="#fff" strokeWidth={2} />
        <text x={x(points.length - 1) + 8} y={y(last.value) + 4} fontSize={12} fontWeight={700} fill="var(--text)">{last.value}</text>
        {h && hover != null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--muted)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(h.value)} r={5} fill="var(--navy)" stroke="#fff" strokeWidth={2} />
          </>
        )}
        {/* vùng bắt chuột rộng hơn điểm */}
        {points.map((p, i) => {
          const half = iw / (points.length - 1) / 2;
          return <rect key={i} x={x(i) - half} y={PAD.t} width={half * 2} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={-1} />;
        })}
      </svg>
      {h && hover != null && (
        <div
          role="tooltip"
          style={{
            position: 'absolute', top: 4, left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > points.length / 2 ? '-105%' : '5%'})`,
            background: '#fff', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px', fontSize: 12, boxShadow: 'var(--shadow-sm)', pointerEvents: 'none', whiteSpace: 'nowrap',
          }}
        >
          <div className="muted">{new Date(h.date).toLocaleDateString('vi-VN')}</div>
          <b style={{ color: 'var(--text)' }}>{h.value}{unit}</b>
        </div>
      )}
    </div>
  );
}
