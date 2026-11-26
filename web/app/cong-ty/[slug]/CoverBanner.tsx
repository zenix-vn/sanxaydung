'use client';
import { useEffect, useState } from 'react';
import { cssUrl } from '@/lib/profile';

const SHADE = 'linear-gradient(rgba(2,30,72,.3),rgba(2,30,72,.1))';

/**
 * Lớp phủ động trên ảnh bìa: video không tiếng, hoặc các ảnh luân phiên sau ảnh bìa chính.
 * Chỉ chạy sau khi trang đã tải và khi người xem không bật giảm chuyển động / tiết kiệm dữ liệu.
 */
export default function CoverBanner({ images, video, position }: { images: string[]; video: string | null; position: string }) {
  const [motion, setMotion] = useState(false);
  const [i, setI] = useState(0); // 0 = ảnh bìa chính
  const [paused, setPaused] = useState(false);
  const total = images.length + 1;

  useEffect(() => {
    const save = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    setMotion(!save && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => {
    if (!motion || paused || video || total < 2) return;
    const t = setTimeout(() => setI((n) => (n + 1) % total), 6000);
    return () => clearTimeout(t);
  }, [i, motion, paused, video, total]);

  if (video) {
    return motion ? <video className="cv-layer" src={video} style={{ objectPosition: position }} autoPlay muted loop playsInline aria-hidden /> : null;
  }
  if (!images.length) return null;
  return (
    <>
      {images.map((u, k) => (
        // chỉ tải ảnh khi sắp đến lượt
        <div key={u} className="cv-layer" aria-hidden style={{ opacity: i === k + 1 ? 1 : 0, backgroundImage: motion && i >= k ? `${SHADE},${cssUrl(u)}` : i === k + 1 ? `${SHADE},${cssUrl(u)}` : undefined }} />
      ))}
      <div className="cv-nav">
        {Array.from({ length: total }, (_, k) => (
          <button type="button" key={k} className={k === i ? 'on' : ''} aria-label={`Ảnh bìa ${k + 1}`} aria-current={k === i} onClick={() => { setI(k); setPaused(true); }} />
        ))}
        {motion && (
          <button type="button" className="pp" onClick={() => setPaused(!paused)} aria-label={paused ? 'Tiếp tục chạy ảnh' : 'Dừng chạy ảnh'}>{paused ? '▶' : '❚❚'}</button>
        )}
      </div>
    </>
  );
}
