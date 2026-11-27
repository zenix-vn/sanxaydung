'use client';
import { useMemo, useRef, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { uploadCompanyImage, uploadCompanyVideo } from '@/lib/upload';
import { CTA_LABELS, MAX_BANNERS, MAX_HOURS, MAX_VIDEO_BYTES, RESPONSE_LABELS, cssUrl, type CtaKind } from '@/lib/profile';
import type { ProfileForm } from './AppearanceEditor';

type Props = { value: ProfileForm; onChange: (v: ProfileForm) => void; disabled: boolean };
type Msg = (m: { ok: boolean; text: string }) => void;

/** Ảnh chạy tiếp sau ảnh bìa hoặc video ngắn. Tải lên ngay, áp dụng khi bấm Lưu của trang. */
export function BannerFields({ value, onChange, disabled, companyId, onMsg }: Props & { companyId: string; onMsg: Msg }) {
  const supa = useMemo(() => createSupabaseBrowser(), []);
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'image' | 'video' | null>(null);
  // Giá trị mới nhất: tải lên mất vài giây, người dùng có thể đã sửa mục khác
  const latest = useRef(value);
  latest.current = value;
  const patch = (p: Partial<ProfileForm>) => onChange({ ...latest.current, ...p });
  const room = MAX_BANNERS - value.bannerImages.length;
  const locked = disabled || !!busy;

  async function addImages(files: FileList) {
    setBusy('image');
    const added: string[] = [];
    try {
      for (const f of Array.from(files).slice(0, room)) added.push(await uploadCompanyImage(supa, companyId, 'banner', f, 2400));
      onMsg({ ok: true, text: 'Đã tải ảnh. Bấm “Lưu” ở cuối trang để áp dụng.' });
    } catch (e) {
      onMsg({ ok: false, text: 'Tải ảnh thất bại: ' + (e as Error).message });
    } finally {
      if (added.length) patch({ bannerImages: [...latest.current.bannerImages, ...added].slice(0, MAX_BANNERS) });
      setBusy(null);
    }
  }
  async function addVideo(f: File) {
    setBusy('video');
    try {
      patch({ bannerVideo: await uploadCompanyVideo(supa, companyId, f) });
      onMsg({ ok: true, text: 'Đã tải video. Bấm “Lưu” ở cuối trang để áp dụng.' });
    } catch (e) {
      onMsg({ ok: false, text: 'Tải video thất bại: ' + (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="field-group">
        <label>Ảnh bìa chạy luân phiên</label>
        <div className="hint mb-8">Thêm tối đa {MAX_BANNERS} ảnh ngang, tự chuyển sau ảnh bìa chính.</div>
        <div className="bn-list">
          {value.bannerImages.map((u, i) => (
            <div key={u} className="bn" style={{ backgroundImage: cssUrl(u) }}>
              {!disabled && <button type="button" onClick={() => patch({ bannerImages: value.bannerImages.filter((x) => x !== u) })} aria-label={`Gỡ ảnh ${i + 1}`}><svg className="ic"><use href="#ic-x" /></svg></button>}
            </div>
          ))}
          {!disabled && room > 0 && (
            <button type="button" className="bn add" disabled={locked} onClick={() => imgRef.current?.click()}>
              <svg className="ic"><use href="#ic-camera" /></svg> {busy === 'image' ? 'Đang tải…' : 'Thêm ảnh'}
            </button>
          )}
        </div>
        <input ref={imgRef} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files?.length) addImages(e.target.files); e.target.value = ''; }} />
      </div>

      <div className="field-group">
        <label>Video ảnh bìa</label>
        <div className="hint mb-8">MP4 hoặc WebM, tối đa {MAX_VIDEO_BYTES / 1048576}MB, nên dài 10–20 giây. Video tự phát không tiếng và thay cho các ảnh bìa; ảnh bìa chính hiện trong lúc video đang tải.</div>
        {value.bannerVideo ? (
          <div>
            <video src={value.bannerVideo} muted playsInline controls preload="metadata" className="bn-video" />
            {!disabled && <div><button type="button" className="btn-link danger" onClick={() => patch({ bannerVideo: '' })}>Gỡ video</button></div>}
          </div>
        ) : (
          !disabled && (
            <button type="button" className="btn btn-outline btn-sm" disabled={locked} onClick={() => vidRef.current?.click()}>
              <svg className="ic"><use href="#ic-video" /></svg> {busy === 'video' ? 'Đang tải…' : 'Tải video'}
            </button>
          )
        )}
        <input ref={vidRef} type="file" accept="video/mp4,video/webm" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) addVideo(f); e.target.value = ''; }} />
      </div>
    </>
  );
}

/** Nút liên hệ chính, giờ làm việc, thời gian phản hồi. */
export function ContactFields({ value, onChange, disabled, hasPhone }: Props & { hasPhone: boolean }) {
  const set = (p: Partial<ProfileForm>) => onChange({ ...value, ...p });
  const warn =
    value.cta === 'call' ? (hasPhone ? 'Số điện thoại của công ty sẽ hiển thị công khai đầy đủ.' : 'Chưa có số điện thoại — trang sẽ dùng nút “Nhắn tin”.')
    : value.cta === 'zalo' && !value.links.zalo.trim() ? 'Chưa nhập Zalo ở dưới — trang sẽ dùng nút “Nhắn tin”.'
    : null;
  return (
    <>
      <h3 className="sub-h">Cách khách liên hệ</h3>
      <div className="form-row">
        <div className="field-group">
          <label htmlFor="cta">Nút chính ở đầu trang</label>
          <select id="cta" className="select" value={value.cta} disabled={disabled} onChange={(e) => set({ cta: e.target.value as CtaKind })}>
            {Object.entries(CTA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {warn && <div className="hint">{warn}</div>}
        </div>
        <div className="field-group">
          <label htmlFor="response">Thời gian phản hồi dự kiến</label>
          <select id="response" className="select" value={value.response} disabled={disabled} onChange={(e) => set({ response: e.target.value })}>
            <option value="">— Không hiển thị —</option>
            {Object.entries(RESPONSE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="field-group">
        <label htmlFor="hours">Giờ làm việc</label>
        <textarea id="hours" className="textarea" style={{ minHeight: 70 }} maxLength={MAX_HOURS} value={value.hours} disabled={disabled} placeholder={'Thứ 2 – Thứ 6: 8:00 – 17:30\nThứ 7: 8:00 – 12:00'} onChange={(e) => set({ hours: e.target.value })} />
      </div>
    </>
  );
}
