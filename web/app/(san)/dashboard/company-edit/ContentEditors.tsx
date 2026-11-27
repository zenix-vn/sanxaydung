'use client';
import {
  LOCKED_SECTIONS, MAX_VALUES, MAX_VALUE_LEN, MAX_VISION, SECTION_LABELS,
} from '@/lib/profile';
import type { ProfileForm } from './AppearanceEditor';

type Props = { value: ProfileForm; onChange: (v: ProfileForm) => void; disabled: boolean };

export function AboutFields({ value, onChange, disabled }: Props) {
  const set = (patch: Partial<ProfileForm>) => onChange({ ...value, ...patch });
  return (
    <>
      <h3 className="sub-h">Tầm nhìn, sứ mệnh &amp; giá trị cốt lõi</h3>
      <p className="muted mb-16" style={{ fontSize: 13 }}>Mục nào để trống sẽ không hiển thị.</p>
      <div className="form-row">
        <div className="field-group"><label>Tầm nhìn</label><textarea className="textarea" style={{ minHeight: 90 }} maxLength={MAX_VISION} value={value.vision} disabled={disabled} onChange={(e) => set({ vision: e.target.value })} /></div>
        <div className="field-group"><label>Sứ mệnh</label><textarea className="textarea" style={{ minHeight: 90 }} maxLength={MAX_VISION} value={value.mission} disabled={disabled} onChange={(e) => set({ mission: e.target.value })} /></div>
      </div>
      <div className="field-group">
        <label>Giá trị cốt lõi</label>
        <textarea className="textarea" style={{ minHeight: 90 }} value={value.values} disabled={disabled} maxLength={MAX_VALUES * (MAX_VALUE_LEN + 1)} placeholder={'Chất lượng là uy tín\nAn toàn lao động\nĐúng tiến độ'} onChange={(e) => set({ values: e.target.value })} />
        <div className="hint">Mỗi dòng một giá trị, tối đa {MAX_VALUES} dòng, mỗi dòng {MAX_VALUE_LEN} ký tự.</div>
      </div>
    </>
  );
}

export function SectionsEditor({ value, onChange, disabled }: Props) {
  const { order, hidden } = value;
  function move(i: number, d: number) {
    const next = [...order];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange({ ...value, order: next });
  }
  return (
    <div className="card-block" id="layout">
      <h2>Bố cục trang</h2>
      <p className="muted mb-16">Sắp xếp thứ tự và ẩn/hiện các mục trên hồ sơ công khai. Mục chưa có nội dung tự động không hiển thị. Bấm “Lưu” ở cuối trang để áp dụng.</p>
      <ol className="sec-order">
        {order.map((k, i) => {
          const locked = LOCKED_SECTIONS.includes(k);
          const off = hidden.includes(k);
          return (
            <li key={k} className={off ? 'off' : ''}>
              <span className="n">{i + 1}</span>
              <span className="t">{SECTION_LABELS[k]}</span>
              <label title={locked ? 'Mục này luôn hiển thị' : undefined}>
                <input type="checkbox" checked={!off} disabled={disabled || locked} onChange={() => onChange({ ...value, hidden: off ? hidden.filter((x) => x !== k) : [...hidden, k] })} />
                {locked ? 'Luôn hiện' : 'Hiện'}
              </label>
              <button type="button" onClick={() => move(i, -1)} disabled={disabled || i === 0} aria-label={`Đưa ${SECTION_LABELS[k]} lên`}><svg className="ic" style={{ transform: 'rotate(90deg)' }}><use href="#ic-chevron-left" /></svg></button>
              <button type="button" onClick={() => move(i, 1)} disabled={disabled || i === order.length - 1} aria-label={`Đưa ${SECTION_LABELS[k]} xuống`}><svg className="ic"><use href="#ic-chevron-down" /></svg></button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
