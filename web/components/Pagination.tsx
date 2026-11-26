/** Phân trang dạng link (giữ nguyên các tham số lọc trong `qs`). */
export default function Pagination({ base, qs, page, pages }: { base: string; qs: string; page: number; pages: number }) {
  if (pages <= 1) return null;
  const href = (p: number) => `${base}?${qs ? `${qs}&` : ''}page=${p}`;
  return (
    <nav className="pagination" aria-label="Phân trang">
      {page > 1 && (
        <a href={href(page - 1)} aria-label="Trang trước">
          <svg className="ic"><use href="#ic-chevron-left" /></svg>
        </a>
      )}
      {[page - 2, page - 1, page, page + 1, page + 2]
        .filter((p) => p >= 1 && p <= pages)
        .map((p) => (
          <a key={p} className={p === page ? 'active' : ''} href={href(p)} aria-current={p === page ? 'page' : undefined}>
            {p}
          </a>
        ))}
      {page < pages && (
        <a href={href(page + 1)} aria-label="Trang sau">
          <svg className="ic"><use href="#ic-chevron-right" /></svg>
        </a>
      )}
    </nav>
  );
}
