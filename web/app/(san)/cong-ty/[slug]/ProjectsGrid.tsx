'use client';
import { useState } from 'react';
import { PROJECT_KINDS, cssUrl } from '@/lib/profile';

export type ProjectCard = {
  id: string; title: string; role: string | null; year: number | null; kind: string | null;
  featured: boolean; cover: string | null; photos: string[];
};
const PAGE = 6;

/** Lưới dự án: dự án ghim đứng đầu, lọc theo loại công trình / năm. `items` đã sắp xếp sẵn ở server. */
export default function ProjectsGrid({ items, expanded }: { items: ProjectCard[]; expanded: boolean }) {
  const [kind, setKind] = useState('');
  const [year, setYear] = useState('');
  const [all, setAll] = useState(expanded);

  const kinds = Object.keys(PROJECT_KINDS).filter((k) => items.some((p) => p.kind === k));
  const years = Array.from(new Set(items.map((p) => p.year).filter((y): y is number => !!y))).sort((a, b) => b - a);
  // Chỉ hiện bộ lọc khi đủ nhiều để cần lọc
  const showKinds = items.length > 3 && (kinds.length > 1 || (kinds.length === 1 && items.some((p) => !p.kind)));
  const showYears = items.length > 3 && years.length > 1;

  const found = items.filter((p) => (!kind || p.kind === kind) && (!year || String(p.year) === year));
  const list = all ? found : found.slice(0, PAGE);

  return (
    <>
      {(showKinds || showYears) && (
        <div className="proj-filter">
          {showKinds && (
            <div role="group" aria-label="Lọc theo loại công trình">
              {['', ...kinds].map((k) => (
                <button type="button" key={k} className={`chip ${kind === k ? 'active' : ''}`} aria-pressed={kind === k} onClick={() => setKind(k)}>
                  {k ? PROJECT_KINDS[k] : 'Tất cả'}
                </button>
              ))}
            </div>
          )}
          {showYears && (
            <select className="select" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Lọc theo năm">
              <option value="">Mọi năm</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </div>
      )}
      {found.length === 0 && <p className="muted">Không có dự án phù hợp với bộ lọc.</p>}
      <div className="proj-grid">
        {list.map((p) => (
          <div className={`proj ${p.featured ? 'feat' : ''}`} key={p.id}>
            <div className="img" style={p.cover ? { backgroundImage: cssUrl(p.cover) } : { background: 'linear-gradient(135deg,#e6ebf1,#c8d6e5)' }}>
              {p.featured && <span className="proj-flag"><svg className="ic"><use href="#ic-star-f" /></svg> Nổi bật</span>}
            </div>
            <div className="b">
              <h4>{p.title}</h4>
              <div className="m">
                {p.kind && <span>{PROJECT_KINDS[p.kind]}</span>}
                {p.role && <span>{p.role}</span>}
                {p.year && <span>{p.year}</span>}
              </div>
              {p.photos.length > 0 && (
                <div className="proj-photos">
                  {p.photos.map((u) => (
                    <a key={u} href={u} target="_blank" rel="noopener" style={{ backgroundImage: cssUrl(u) }} aria-label={`Ảnh dự án ${p.title}`} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {found.length > PAGE && (
        <button type="button" className="btn btn-outline btn-block mt-16" onClick={() => setAll(!all)}>
          {all ? 'Thu gọn' : `Xem tất cả ${found.length} dự án`}
        </button>
      )}
    </>
  );
}
