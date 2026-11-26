/**
 * Biểu đồ nhỏ gọn cho trang quản trị (render phía server, không cần JS):
 * một chuỗi dữ liệu = một màu, tooltip khi rê chuột hoặc focus, luôn kèm bảng số liệu.
 */
const nf = new Intl.NumberFormat('vi-VN');

/** Mốc trục tung tròn số, chia hết cho 2 để có vạch giữa. */
function niceMax(v: number) {
  if (v <= 4) return 4;
  const unit = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 4, 6, 8, 10].map((m) => m * unit).find((m) => m >= v)!;
}

function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="viz-table">
      <summary>Xem bảng số liệu</summary>
      <table>
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{typeof c === 'number' ? nf.format(c) : c}</td>)}</tr>)}</tbody>
      </table>
    </details>
  );
}

/** Cột theo tuần. Tuần cuối cùng là tuần hiện tại (chưa kết thúc). */
export function WeeklyColumns({ title, data, note }: { title: string; data: { label: string; value: number }[]; note?: string }) {
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const total = data.reduce((a, d) => a + d.value, 0);
  const now = data[data.length - 1]?.value ?? 0;
  const prev = data[data.length - 2]?.value ?? 0;
  const peak = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);
  const every = Math.ceil(data.length / 6);
  return (
    <section className="adm-card viz">
      <div className="viz-hd">
        <h2>{title}</h2>
        <div><b>{nf.format(now)}</b><small>tuần này · tuần trước {nf.format(prev)}</small></div>
      </div>
      {total === 0 ? <div className="viz-none">Chưa có dữ liệu trong {data.length} tuần qua.{note && <><br />{note}</>}</div> : (
        <>
          <div className="viz-plot" role="group" aria-label={`${title} theo tuần`}>
            <div className="viz-grid" aria-hidden>{[max, max / 2, 0].map((t) => <span key={t}><i>{nf.format(t)}</i></span>)}</div>
            <div className="viz-cols">
              {data.map((d, i) => (
                <div className={`viz-col${i > data.length / 2 ? ' end' : ''}`} key={d.label} tabIndex={0} aria-label={`Tuần từ ${d.label}: ${d.value}`}>
                  <div className="viz-bar" style={{ height: `${(d.value / max) * 100}%` }}>
                    {d.value > 0 && (i === peak || i === data.length - 1) && <em>{nf.format(d.value)}</em>}
                  </div>
                  <span className="viz-tip" aria-hidden><b>{nf.format(d.value)}</b>Tuần từ {d.label}{i === data.length - 1 && ' (chưa hết)'}</span>
                  <small aria-hidden>{(data.length - 1 - i) % every === 0 ? d.label : ''}</small>
                </div>
              ))}
            </div>
          </div>
          <p className="viz-note">Tổng {data.length} tuần: {nf.format(total)}.{note && ` ${note}`}</p>
          <DataTable head={['Tuần từ', 'Số lượng']} rows={[...data].reverse().map((d) => [d.label, d.value])} />
        </>
      )}
    </section>
  );
}

/** Thanh ngang xếp hạng; `of` (nếu có) là mẫu số để hiện tỉ lệ %. */
export function RankBars({ title, hint, data, of, empty = 'Chưa có dữ liệu.', footer }: {
  title: string; hint?: string; data: { label: string; value: number }[]; of?: number; empty?: string; footer?: React.ReactNode;
}) {
  const max = of ?? Math.max(1, ...data.map((d) => d.value));
  const pct = (v: number) => (max ? Math.round((v / max) * 100) : 0);
  return (
    <section className="adm-card viz">
      <div className="viz-hd"><h2>{title}</h2>{hint && <small>{hint}</small>}</div>
      {data.length === 0 ? <div className="viz-none">{empty}</div> : (
        <>
          <ul className="viz-bars">
            {data.map((d) => (
              <li key={d.label} tabIndex={0}>
                <span className="l">{d.label}</span>
                <span className="t"><i style={{ width: `${max ? (d.value / max) * 100 : 0}%` }} /></span>
                <span className="v"><b>{nf.format(d.value)}</b>{of != null && <small>{pct(d.value)}%</small>}</span>
              </li>
            ))}
          </ul>
          {footer && <p className="viz-note">{footer}</p>}
        </>
      )}
    </section>
  );
}
