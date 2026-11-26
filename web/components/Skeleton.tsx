/** Khung chờ tải dùng chung cho loading.tsx. */
export function Sk({ h = 14, w = '100%', r, mb = 10 }: { h?: number; w?: number | string; r?: number; mb?: number }) {
  return <div className="skel" style={{ height: h, width: w, borderRadius: r, marginBottom: mb }} />;
}

/** Trang danh sách: tiêu đề + cột lọc + các thẻ. */
export function ListPageSkeleton({ cards = 5 }: { cards?: number }) {
  return (
    <div aria-busy="true" aria-label="Đang tải">
      <div className="pagehead">
        <div className="container">
          <div className="skel" style={{ height: 12, width: 160, marginBottom: 12, opacity: 0.25 }} />
          <div className="skel" style={{ height: 26, width: 320, marginBottom: 8, opacity: 0.25 }} />
          <div className="skel" style={{ height: 14, width: 460, maxWidth: '100%', opacity: 0.25 }} />
        </div>
      </div>
      <section className="block" style={{ paddingTop: 26, background: 'var(--bg)' }}>
        <div className="container grid-side">
          <div className="card-block"><Sk h={16} w="60%" /><Sk h={38} /><Sk h={38} /><Sk h={38} mb={0} /></div>
          <div>
            {Array.from({ length: cards }, (_, i) => (
              <div key={i} className="card-block" style={{ marginBottom: 14 }}>
                <Sk h={18} w="55%" /><Sk h={13} /><Sk h={13} w="80%" mb={0} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
