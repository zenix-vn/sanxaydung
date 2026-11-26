'use client';
import { useState } from 'react';

/** Chọn tối đa 3 doanh nghiệp đã lưu để so sánh. */
export default function CompareForm({ children }: { children: React.ReactNode }) {
  const [n, setN] = useState(0);
  return (
    <form
      method="GET"
      action="/so-sanh"
      onChange={(e) => {
        const f = e.currentTarget;
        const boxes = Array.from(f.querySelectorAll<HTMLInputElement>('input[name="c"]'));
        const on = boxes.filter((b) => b.checked);
        boxes.forEach((b) => { b.disabled = !b.checked && on.length >= 3; });
        setN(on.length);
      }}
    >
      {children}
      <div className="row mt-16" style={{ gap: 10, alignItems: 'center' }}>
        <button className="btn btn-navy btn-sm" type="submit" disabled={n < 2}>So sánh {n ? `(${n})` : ''}</button>
        <small className="muted">Chọn 2–3 doanh nghiệp để so sánh năng lực.</small>
      </div>
    </form>
  );
}
