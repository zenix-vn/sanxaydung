'use client';

export type BoqItem = { name: string; unit: string; qty: number | null; note?: string };

const num = (s: string) => {
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return s.trim() && isFinite(n) ? n : null;
};

/** Soạn bảng khối lượng (BOQ) cho tin đăng. */
export function BoqEditor({ value, onChange }: { value: BoqItem[]; onChange: (v: BoqItem[]) => void }) {
  const set = (i: number, patch: Partial<BoqItem>) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div>
      {value.length > 0 && (
        <div className="table-wrap">
          <table className="table boq">
            <thead><tr><th style={{ width: 28 }}>#</th><th>Hạng mục</th><th style={{ width: 90 }}>Đơn vị</th><th style={{ width: 110 }}>Khối lượng</th><th style={{ width: 30 }} /></tr></thead>
            <tbody>
              {value.map((r, i) => (
                <tr key={i}>
                  <td className="muted">{i + 1}</td>
                  <td><input className="input" value={r.name} maxLength={200} onChange={(e) => set(i, { name: e.target.value })} placeholder="vd. Bê tông móng M300" aria-label={`Hạng mục ${i + 1}`} /></td>
                  <td><input className="input" value={r.unit} maxLength={20} onChange={(e) => set(i, { unit: e.target.value })} placeholder="m³" aria-label="Đơn vị" /></td>
                  <td><input className="input" inputMode="decimal" value={r.qty ?? ''} onChange={(e) => set(i, { qty: num(e.target.value) })} placeholder="120" aria-label="Khối lượng" /></td>
                  <td><button type="button" className="btn-link danger" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Xóa dòng">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {value.length < 100 && (
        <button type="button" className="btn btn-outline btn-sm mt-8" onClick={() => onChange([...value, { name: '', unit: '', qty: null }])}>
          <svg className="ic"><use href="#ic-plus" /></svg> Thêm hạng mục
        </button>
      )}
    </div>
  );
}

/** Bảng BOQ chỉ đọc; nếu có `prices` thì thêm cột đơn giá & thành tiền. */
export function BoqTable({ items, prices }: { items: BoqItem[]; prices?: (number | null)[] }) {
  const total = prices ? items.reduce((a, r, i) => a + (r.qty ?? 0) * (prices[i] ?? 0), 0) : 0;
  return (
    <div className="table-wrap">
      <table className="table boq">
        <thead>
          <tr>
            <th style={{ width: 28 }}>#</th><th>Hạng mục</th><th>Đơn vị</th><th style={{ textAlign: 'right' }}>Khối lượng</th>
            {prices && <><th style={{ textAlign: 'right' }}>Đơn giá</th><th style={{ textAlign: 'right' }}>Thành tiền</th></>}
          </tr>
        </thead>
        <tbody>
          {items.map((r, i) => (
            <tr key={i}>
              <td className="muted">{i + 1}</td>
              <td>{r.name}{r.note && <div className="muted" style={{ fontSize: 12 }}>{r.note}</div>}</td>
              <td>{r.unit || '—'}</td>
              <td style={{ textAlign: 'right' }}>{r.qty != null ? r.qty.toLocaleString('vi-VN') : '—'}</td>
              {prices && (
                <>
                  <td style={{ textAlign: 'right' }}>{prices[i] != null ? prices[i]!.toLocaleString('vi-VN') : '—'}</td>
                  <td style={{ textAlign: 'right' }}>{prices[i] != null && r.qty != null ? (prices[i]! * r.qty).toLocaleString('vi-VN') : '—'}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
        {prices && (
          <tfoot>
            <tr><td colSpan={5} style={{ textAlign: 'right', fontWeight: 700 }}>Tổng</td><td style={{ textAlign: 'right', fontWeight: 800 }}>{total.toLocaleString('vi-VN')} ₫</td></tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/** Chuẩn hóa BOQ từ JSON trong DB (bỏ dòng rỗng / sai kiểu). */
export function cleanBoq(v: unknown): BoqItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r) => ({ name: String(r.name ?? '').trim(), unit: String(r.unit ?? '').trim(), qty: typeof r.qty === 'number' ? r.qty : null, note: r.note ? String(r.note) : undefined }))
    .filter((r) => r.name);
}
