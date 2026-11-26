'use client';
import { useMemo, useRef, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import RichText from '@/components/RichText';
import { uploadCompanyImage } from '@/lib/upload';
import { normalizeWebsite } from '@/lib/profile';

export const MAX_BODY = 10000;

/** Soạn phần giới thiệu chi tiết: thanh nút chèn định dạng + xem trước. Lưu cùng nút "Lưu" của trang. */
export default function RichTextEditor({
  companyId, value, onChange, disabled, onMsg,
}: {
  companyId: string; value: string; onChange: (v: string) => void; disabled: boolean;
  onMsg: (m: { ok: boolean; text: string }) => void;
}) {
  const supa = useMemo(() => createSupabaseBrowser(), []);
  const area = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Giá trị mới nhất, vì tải ảnh xong thì người dùng có thể đã gõ thêm
  const latest = useRef(value);
  latest.current = value;
  const locked = disabled || preview;

  /** Thay vùng chọn bằng chuỗi mới rồi đặt lại con trỏ/vùng chọn. */
  function splice(start: number, end: number, text: string, selFrom = text.length, selTo = selFrom) {
    const v = latest.current;
    onChange(v.slice(0, start) + text + v.slice(end));
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(start + selFrom, start + selTo);
    });
  }
  const sel = () => {
    const el = area.current!;
    return { start: el.selectionStart, end: el.selectionEnd, text: value.slice(el.selectionStart, el.selectionEnd) };
  };

  function bold() {
    const s = sel();
    const t = s.text.replace(/\n/g, ' ') || 'chữ in đậm';
    splice(s.start, s.end, `**${t}**`, 2, 2 + t.length);
  }
  /** Thêm tiền tố vào đầu mỗi dòng đang chọn. */
  function prefix(make: (i: number) => string) {
    const s = sel();
    const from = value.lastIndexOf('\n', s.start - 1) + 1;
    const nl = value.indexOf('\n', s.end);
    const to = nl < 0 ? value.length : nl;
    const out = value.slice(from, to).split('\n').map((l, i) => make(i) + l.replace(/^\s*(#{1,3}|[-*•]|\d{1,2}[.)])\s+/, '')).join('\n');
    splice(from, to, out);
  }
  function link() {
    const s = sel();
    const input = window.prompt('Địa chỉ liên kết (vd. https://tencongty.vn)');
    if (input === null) return;
    const url = normalizeWebsite(input)?.replace(/\(/g, '%28').replace(/\)/g, '%29');
    if (!url) return onMsg({ ok: false, text: 'Địa chỉ liên kết không hợp lệ.' });
    const t = s.text.replace(/[[\]\n]/g, ' ') || 'xem thêm';
    splice(s.start, s.end, `[${t}](${url})`, 1, 1 + t.length);
  }
  async function image(f: File) {
    setUploading(true);
    try {
      const url = await uploadCompanyImage(supa, companyId, 'about', f);
      const v = latest.current;
      const at = Math.min(area.current?.selectionEnd ?? v.length, v.length);
      const nl = v.indexOf('\n', at);
      const pos = nl < 0 ? v.length : nl; // chèn sau dòng đang đứng
      splice(pos, pos, `${pos ? '\n\n' : ''}![](${url})\n`);
      onMsg({ ok: true, text: 'Đã chèn ảnh. Gõ chú thích vào giữa cặp [ ] nếu muốn, rồi bấm Lưu.' });
    } catch (e) {
      onMsg({ ok: false, text: 'Tải ảnh thất bại: ' + (e as Error).message });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rte">
      <div className="rte-bar" role="toolbar" aria-label="Định dạng">
        <button type="button" onClick={bold} disabled={locked}><b>B</b> Đậm</button>
        <button type="button" onClick={() => prefix(() => '## ')} disabled={locked}>Tiêu đề</button>
        <button type="button" onClick={() => prefix(() => '- ')} disabled={locked}>• Danh sách</button>
        <button type="button" onClick={() => prefix((i) => `${i + 1}. `)} disabled={locked}>1. Đánh số</button>
        <button type="button" onClick={link} disabled={locked}><svg className="ic"><use href="#ic-link" /></svg> Liên kết</button>
        <button type="button" onClick={() => file.current?.click()} disabled={locked || uploading}><svg className="ic"><use href="#ic-image" /></svg> {uploading ? 'Đang tải…' : 'Ảnh'}</button>
        <button type="button" className={`rte-eye ${preview ? 'on' : ''}`} onClick={() => setPreview(!preview)} aria-pressed={preview}><svg className="ic"><use href="#ic-eye" /></svg> Xem trước</button>
      </div>
      {preview ? (
        <div className="rte-preview">{value.trim() ? <RichText text={value} /> : <p className="muted">Chưa có nội dung.</p>}</div>
      ) : (
        <textarea ref={area} className="textarea" aria-label="Giới thiệu chi tiết" style={{ minHeight: 220 }} maxLength={Math.max(MAX_BODY, value.length)} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder={'## Về chúng tôi\nViết vài đoạn về công ty…\n\n## Thế mạnh\n- Thi công đúng tiến độ\n- Đội ngũ kỹ sư giàu kinh nghiệm'} />
      )}
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) image(f); e.target.value = ''; }} />
    </div>
  );
}
