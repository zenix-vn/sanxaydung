'use client';
import { useMemo, useRef, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { uploadCompanyImage, removeCompanyImage } from '@/lib/upload';
import { MAX_GALLERY, parseVideo, type GalleryItem } from '@/lib/profile';


/** Thư viện ảnh & video chung của công ty (media owner_type='company'). Mọi thao tác lưu ngay. */
export default function GalleryEditor({
  companyId, initial, disabled, onMsg,
}: {
  companyId: string; initial: GalleryItem[]; disabled: boolean; onMsg: (m: { ok: boolean; text: string }) => void;
}) {
  const supa = useMemo(() => createSupabaseBrowser(), []);
  const [items, setItems] = useState<GalleryItem[]>(initial);
  const [busy, setBusy] = useState<string | null>(null); // nhãn tiến trình
  const [video, setVideo] = useState('');
  const [drag, setDrag] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const locked = disabled || !!busy;
  const room = MAX_GALLERY - items.length;

  // Mục mới luôn nằm cuối, kể cả khi sort_order cũ có khoảng trống do đã xóa
  const nextOrder = useRef(Math.max(-1, ...initial.map((m) => m.sort_order ?? 0)) + 1);
  async function insert(kind: GalleryItem['kind'], url: string) {
    const { data, error } = await supa
      .from('media')
      .insert({ company_id: companyId, owner_type: 'company', owner_id: companyId, kind, url, sort_order: nextOrder.current++ })
      .select('id, kind, url, caption')
      .single();
    if (error) throw error;
    setItems((x) => [...x, data as GalleryItem]);
  }

  async function addImages(files: FileList) {
    const list = Array.from(files).slice(0, room);
    if (!list.length) return onMsg({ ok: false, text: `Thư viện tối đa ${MAX_GALLERY} mục.` });
    const failed: string[] = [];
    let done = 0;
    for (const [i, original] of list.entries()) {
      setBusy(`Đang tải ${i + 1}/${list.length}…`);
      try {
        const url = await uploadCompanyImage(supa, companyId, 'gallery', original);
        try {
          await insert('image', url);
        } catch (e) {
          await removeCompanyImage(supa, companyId, 'gallery', url);
          throw e;
        }
        done++;
      } catch (e) {
        failed.push(`${original.name}: ${(e as Error).message}`);
      }
    }
    setBusy(null);
    const skipped = files.length - list.length;
    onMsg(
      failed.length
        ? { ok: false, text: `Đã tải ${done} ảnh. Lỗi: ${failed.join('; ')}` }
        : { ok: true, text: `Đã tải ${done} ảnh.${skipped ? ` Bỏ qua ${skipped} ảnh vì thư viện tối đa ${MAX_GALLERY} mục.` : ''}` },
    );
  }

  async function addVideo() {
    const v = parseVideo(video);
    if (!v) return onMsg({ ok: false, text: 'Chỉ nhận link video YouTube hoặc Facebook.' });
    if (room <= 0) return onMsg({ ok: false, text: `Thư viện tối đa ${MAX_GALLERY} mục.` });
    setBusy('Đang thêm video…');
    try {
      await insert('video', v.url);
      setVideo('');
      onMsg({ ok: true, text: 'Đã thêm video.' });
    } catch (e) {
      onMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function remove(item: GalleryItem) {
    if (!confirm(item.kind === 'video' ? 'Gỡ video này?' : 'Xóa ảnh này?')) return;
    setBusy('Đang xóa…');
    const { error } = await supa.from('media').delete().eq('id', item.id);
    if (!error) {
      setItems((x) => x.filter((y) => y.id !== item.id));
      if (item.kind === 'image') await removeCompanyImage(supa, companyId, 'gallery', item.url);
    }
    setBusy(null);
    if (error) onMsg({ ok: false, text: error.message });
  }

  async function saveCaption(item: GalleryItem, caption: string) {
    const value = caption.trim() || null;
    if (value === item.caption) return;
    const { error } = await supa.from('media').update({ caption: value }).eq('id', item.id);
    if (error) return onMsg({ ok: false, text: error.message });
    setItems((x) => x.map((y) => (y.id === item.id ? { ...y, caption: value } : y)));
  }

  async function move(from: number, to: number) {
    if (locked || to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    next.splice(to, 0, ...next.splice(from, 1));
    const prev = items;
    setItems(next);
    setBusy('Đang lưu thứ tự…');
    // Ghi lại toàn bộ thứ tự (≤ 60 dòng) để không lệch khi sort_order cũ trùng nhau
    const res = await Promise.all(next.map((m, i) => supa.from('media').update({ sort_order: i }).eq('id', m.id)));
    nextOrder.current = next.length;
    setBusy(null);
    const err = res.find((r) => r.error)?.error;
    if (err) {
      setItems(prev);
      onMsg({ ok: false, text: 'Không lưu được thứ tự: ' + err.message });
    }
  }

  return (
    <div className="card-block" id="gallery">
      <h2 className="between">
        <span>Thư viện ảnh &amp; video</span>
        <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>{items.length}/{MAX_GALLERY}</span>
      </h2>
      <p className="muted mb-16">Văn phòng, nhà xưởng, đội thi công, sự kiện… Thay đổi ở mục này được lưu ngay. Kéo thả hoặc dùng mũi tên để sắp xếp.</p>

      {items.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Chưa có ảnh hoặc video nào.</p>}
      <div className="gal-edit">
        {items.map((m, i) => {
          const v = m.kind === 'video' ? parseVideo(m.url) : null;
          const src = m.kind === 'image' ? m.url : v?.thumb;
          return (
            <div
              key={m.id}
              className={`ge ${drag === m.id ? 'dragging' : ''}`}
              onDragOver={(e) => drag && e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const from = items.findIndex((x) => x.id === drag); setDrag(null); if (from >= 0) move(from, i); }}
            >
              <div className="ge-img" draggable={!locked} onDragStart={(e) => { e.dataTransfer.setData('text/plain', m.id); setDrag(m.id); }} onDragEnd={() => setDrag(null)}>
                {src ? <img src={src} alt={m.caption ?? ''} loading="lazy" draggable={false} /> : <span>{v ? 'Video Facebook' : 'Link lỗi, nên xóa'}</span>}
                {m.kind === 'video' && <i><svg className="ic"><use href="#ic-video" /></svg> Video</i>}
                {m.hidden_at && <em title="Quản trị sàn đã ẩn mục này vì bị báo cáo. Khách không còn thấy.">Đã bị sàn ẩn</em>}
              </div>
              <input className="input" key={m.caption ?? ''} defaultValue={m.caption ?? ''} maxLength={140} placeholder="Chú thích" disabled={disabled} aria-label="Chú thích" onBlur={(e) => saveCaption(m, e.target.value)} />
              {!disabled && (
                <div className="ge-bar">
                  <button type="button" onClick={() => move(i, i - 1)} disabled={locked || i === 0} aria-label="Chuyển lên trước"><svg className="ic"><use href="#ic-chevron-left" /></svg></button>
                  <button type="button" onClick={() => move(i, i + 1)} disabled={locked || i === items.length - 1} aria-label="Chuyển ra sau"><svg className="ic"><use href="#ic-chevron-right" /></svg></button>
                  <button type="button" className="del" onClick={() => remove(m)} disabled={locked} aria-label="Xóa"><svg className="ic"><use href="#ic-trash" /></svg></button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!disabled && (
        <div className="gal-add">
          <button type="button" className="btn btn-outline btn-sm" disabled={locked || room <= 0} onClick={() => fileRef.current?.click()}>
            <svg className="ic"><use href="#ic-camera" /></svg> {busy ?? 'Thêm ảnh'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files?.length) addImages(e.target.files); e.target.value = ''; }} />
          <input className="input" value={video} disabled={locked} placeholder="Dán link video YouTube hoặc Facebook" aria-label="Link video" onChange={(e) => setVideo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addVideo(); }} />
          <button type="button" className="btn btn-outline btn-sm" disabled={locked || !video.trim()} onClick={addVideo}>
            <svg className="ic"><use href="#ic-plus" /></svg> Thêm video
          </button>
        </div>
      )}
    </div>
  );
}
