'use client';
import { useEffect, useRef, useState } from 'react';
import { parseVideo, type GalleryItem } from '@/lib/profile';

const PREVIEW = 8;

/** Lưới ảnh/video + xem toàn màn hình. `items` đã được lọc hợp lệ ở server. */
export default function Gallery({ items, companyName }: { items: GalleryItem[]; companyName: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);
  const n = items.length;
  const step = (d: number) => setOpen((i) => (i === null ? i : (i + d + n) % n));

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open !== null && !d.open) d.showModal();
    if (open === null && d.open) d.close();
    document.body.style.overflow = open === null ? '' : 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const cur = open === null ? null : items[open];
  const curVideo = cur?.kind === 'video' ? parseVideo(cur.url) : null;
  const label = (m: GalleryItem, i: number) => m.caption || `${m.kind === 'video' ? 'Video' : 'Ảnh'} ${i + 1} của ${companyName}`;

  return (
    <>
      <div className="co-gal">
        {items.slice(0, PREVIEW).map((m, i) => {
          const thumb = m.kind === 'image' ? m.url : parseVideo(m.url)?.thumb;
          const more = i === PREVIEW - 1 ? n - PREVIEW : 0;
          return (
            <button type="button" key={m.id} onClick={() => setOpen(i)} aria-label={`Xem: ${label(m, i)}`}>
              {thumb ? <img src={thumb} alt={label(m, i)} loading="lazy" /> : <span className="ph">Video Facebook</span>}
              {m.kind === 'video' && more === 0 && <span className="play" aria-hidden>▶</span>}
              {more > 0 ? <span className="more">+{more}</span> : m.caption && <span className="cap">{m.caption}</span>}
            </button>
          );
        })}
      </div>

      <dialog
        ref={ref}
        className="lightbox"
        aria-label={`Thư viện của ${companyName}`}
        onClose={() => setOpen(null)}
        onClick={(e) => { if ((e.target as HTMLElement).dataset.backdrop) setOpen(null); }}
        onKeyDown={(e) => { if (e.key === 'ArrowLeft') step(-1); if (e.key === 'ArrowRight') step(1); }}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const dx = touchX.current === null ? 0 : e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 50) step(dx > 0 ? -1 : 1);
        }}
      >
        {cur && open !== null && (
          <div className="lb-in" data-backdrop="1">
            <button type="button" className="lb-btn lb-close" onClick={() => setOpen(null)} aria-label="Đóng"><svg className="ic"><use href="#ic-x" /></svg></button>
            {n > 1 && <button type="button" className="lb-btn lb-prev" onClick={() => step(-1)} aria-label="Trước"><svg className="ic"><use href="#ic-chevron-left" /></svg></button>}
            <figure>
              {curVideo ? (
                <iframe key={cur.id} src={curVideo.embed} title={label(cur, open)} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
              ) : (
                <img src={cur.url} alt={label(cur, open)} />
              )}
              <figcaption>
                {cur.caption && <b>{cur.caption}</b>}
                <span>{open + 1} / {n}</span>
                {curVideo && <a href={curVideo.url} target="_blank" rel="noopener noreferrer">Mở trên {curVideo.provider === 'youtube' ? 'YouTube' : 'Facebook'}</a>}
              </figcaption>
            </figure>
            {n > 1 && <button type="button" className="lb-btn lb-next" onClick={() => step(1)} aria-label="Sau"><svg className="ic"><use href="#ic-chevron-right" /></svg></button>}
          </div>
        )}
      </dialog>
    </>
  );
}
