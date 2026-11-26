'use client';
import {
  BRAND_PRESETS, LINK_KINDS, LINK_META, MAX_HIGHLIGHTS, MAX_HL_LABEL, MAX_HL_VALUE, MAX_TAGLINE,
  cssUrl, normalizeLink, parseProfileSettings, readableBrand, sectionOrder,
  type CtaKind, type Highlight, type LinkKind, type ProfileSettings, type SectionKey,
} from '@/lib/profile';

/** Trạng thái form (cho phép giá trị đang gõ dở), lưu cùng nút "Lưu" của trang. */
export type ProfileForm = {
  brand_color: string; // '' = mặc định
  tagline: string;
  focus: { x: number; y: number };
  highlights: Highlight[];
  links: Record<LinkKind, string>;
  vision: string;
  mission: string;
  values: string; // mỗi dòng một giá trị
  order: SectionKey[];
  hidden: SectionKey[];
  cta: CtaKind;
  hours: string;
  response: string;
  bannerImages: string[];
  bannerVideo: string;
};

export function toProfileForm(raw: unknown): ProfileForm {
  const s = parseProfileSettings(raw);
  return {
    brand_color: s.brand_color ?? '',
    tagline: s.tagline ?? '',
    focus: s.cover_focus ?? { x: 50, y: 50 },
    highlights: Array.from({ length: MAX_HIGHLIGHTS }, (_, i) => s.highlights?.[i] ?? { value: '', label: '' }),
    links: Object.fromEntries(LINK_KINDS.map((k) => [k, s.links?.[k] ?? ''])) as Record<LinkKind, string>,
    vision: s.about?.vision ?? '',
    mission: s.about?.mission ?? '',
    values: s.about?.values?.join('\n') ?? '',
    order: sectionOrder(s.sections?.order),
    hidden: s.sections?.hidden ?? [],
    cta: s.cta ?? 'message',
    hours: s.hours ?? '',
    response: s.response ?? '',
    bannerImages: s.banner?.images ?? [],
    bannerVideo: s.banner?.video ?? '',
  };
}

/** Kiểm tra & đóng gói để ghi vào companies.profile_settings. */
export function buildProfileSettings(f: ProfileForm): { settings: ProfileSettings } | { error: string } {
  for (const h of f.highlights) {
    if (!h.value.trim() !== !h.label.trim()) return { error: 'Số liệu nổi bật cần nhập đủ cả con số và chú thích.' };
  }
  for (const k of LINK_KINDS) {
    const v = f.links[k].trim();
    if (v && !normalizeLink(k, v)) return { error: `Liên kết ${LINK_META[k].label} không hợp lệ. Ví dụ: ${LINK_META[k].placeholder}` };
  }
  return {
    settings: parseProfileSettings({
      brand_color: f.brand_color, tagline: f.tagline,
      cover_focus: f.focus.x === 50 && f.focus.y === 50 ? undefined : f.focus,
      highlights: f.highlights, links: f.links,
      about: { vision: f.vision, mission: f.mission, values: f.values.split('\n') },
      sections: { order: f.order, hidden: f.hidden },
      cta: f.cta, hours: f.hours, response: f.response,
      banner: { images: f.bannerImages, video: f.bannerVideo },
    }),
  };
}

type Props = { value: ProfileForm; onChange: (v: ProfileForm) => void; disabled: boolean };

export function AppearanceEditor({ value, onChange, disabled, cover, canBrand, children }: Props & { cover: string | null; canBrand: boolean; children?: React.ReactNode }) {
  const set = (patch: Partial<ProfileForm>) => onChange({ ...value, ...patch });
  const shown = value.brand_color ? readableBrand(value.brand_color) : null;
  const pos = `${value.focus.x}% ${value.focus.y}%`;

  function pick(e: React.MouseEvent<HTMLButtonElement>) {
    if (disabled || e.detail === 0) return; // bỏ qua kích hoạt bằng bàn phím (đã có thanh trượt)
    const r = e.currentTarget.getBoundingClientRect();
    const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));
    set({ focus: { x: clamp(((e.clientX - r.left) / r.width) * 100), y: clamp(((e.clientY - r.top) / r.height) * 100) } });
  }

  return (
    <div className="card-block" id="appearance">
      <h2>Giao diện trang hồ sơ</h2>
      <p className="muted mb-16">Màu thương hiệu, khẩu hiệu và cách hiển thị ảnh bìa. Bấm “Lưu” ở cuối trang để áp dụng.</p>
      {!canBrand && <p className="hint mb-8">Chỉ chủ sở hữu hoặc quản trị viên đổi được màu thương hiệu.</p>}

      <div className="field-group">
        <label>Màu thương hiệu</label>
        <div className="swatches">
          <button type="button" className={`sw auto ${!value.brand_color ? 'on' : ''}`} disabled={disabled || !canBrand} onClick={() => set({ brand_color: '' })}>Mặc định</button>
          {BRAND_PRESETS.map((c) => (
            <button key={c} type="button" className={`sw ${value.brand_color === c ? 'on' : ''}`} style={{ background: c }} disabled={disabled || !canBrand} onClick={() => set({ brand_color: c })} aria-label={`Màu ${c}`} aria-pressed={value.brand_color === c} />
          ))}
          <label className="sw-custom">
            <input type="color" value={value.brand_color || '#f18a1c'} disabled={disabled || !canBrand} onChange={(e) => set({ brand_color: e.target.value })} />
            Màu khác
          </label>
        </div>
        {shown && (
          <div className="hint">
            Xem thử: <span className="sw-demo" style={{ background: shown }}>Nút liên hệ</span>
            {shown !== value.brand_color && ' (màu bạn chọn hơi sáng nên được làm đậm để chữ dễ đọc)'}
          </div>
        )}
      </div>

      <div className="field-group">
        <label>Khẩu hiệu trên ảnh bìa</label>
        <input className="input" maxLength={MAX_TAGLINE} value={value.tagline} disabled={disabled} placeholder="vd. Kiến tạo công trình bền vững từ 2010" onChange={(e) => set({ tagline: e.target.value })} />
        <div className="hint">{value.tagline.length}/{MAX_TAGLINE} ký tự. Để trống nếu ảnh bìa đã có chữ.</div>
      </div>

      <div className="field-group">
        <label>Điểm lấy nét của ảnh bìa</label>
        {cover ? (
          <>
            <div className="hint mb-8">Bấm vào phần quan trọng nhất của ảnh. Phần đó luôn được giữ lại khi ảnh bị cắt trên các màn hình.</div>
            <button type="button" className="focus-pick" onClick={pick} disabled={disabled}>
              <img src={cover} alt="Ảnh bìa hiện tại" />
              <span style={{ left: `${value.focus.x}%`, top: `${value.focus.y}%` }} />
            </button>
            <div className="focus-sliders">
              <label>Ngang <input type="range" min={0} max={100} value={value.focus.x} disabled={disabled} onChange={(e) => set({ focus: { ...value.focus, x: +e.target.value } })} /></label>
              <label>Dọc <input type="range" min={0} max={100} value={value.focus.y} disabled={disabled} onChange={(e) => set({ focus: { ...value.focus, y: +e.target.value } })} /></label>
            </div>
            <div className="focus-previews">
              <figure className="desk"><div style={{ backgroundImage: cssUrl(cover), backgroundPosition: pos }} /><figcaption>Máy tính</figcaption></figure>
              <figure className="mob"><div style={{ backgroundImage: cssUrl(cover), backgroundPosition: pos }} /><figcaption>Điện thoại</figcaption></figure>
            </div>
          </>
        ) : (
          <div className="hint">Hãy tải ảnh bìa ở mục “Logo &amp; ảnh bìa” trước.</div>
        )}
      </div>
      {children}
    </div>
  );
}

export function HighlightsEditor({ value, onChange, disabled }: Props) {
  const set = (i: number, patch: Partial<Highlight>) =>
    onChange({ ...value, highlights: value.highlights.map((h, j) => (j === i ? { ...h, ...patch } : h)) });
  return (
    <div className="card-block" id="highlights">
      <h2>Số liệu nổi bật</h2>
      <p className="muted mb-16">Tối đa {MAX_HIGHLIGHTS} con số, hiển thị ngay dưới phần giới thiệu. Để trống toàn bộ thì trang dùng số liệu mặc định.</p>
      {value.highlights.map((h, i) => (
        <div className="hl-row" key={i}>
          <input className="input" maxLength={MAX_HL_VALUE} value={h.value} disabled={disabled} aria-label={`Con số ${i + 1}`} placeholder={['250+', '15', '120', '500.000 m²'][i]} onChange={(e) => set(i, { value: e.target.value })} />
          <input className="input" maxLength={MAX_HL_LABEL} value={h.label} disabled={disabled} aria-label={`Chú thích ${i + 1}`} placeholder={['Công trình đã thi công', 'Năm kinh nghiệm', 'Kỹ sư & công nhân', 'Tổng diện tích sàn'][i]} onChange={(e) => set(i, { label: e.target.value })} />
        </div>
      ))}
    </div>
  );
}

export function LinksEditor({ value, onChange, disabled }: Props) {
  return (
    <>
      <h3 className="sub-h">Zalo &amp; mạng xã hội</h3>
      <p className="muted mb-16" style={{ fontSize: 13 }}>Hiển thị công khai trên hồ sơ. Lưu ý: liên kết Zalo bằng số điện thoại sẽ để lộ số đó.</p>
      <div className="form-row">
        {LINK_KINDS.map((k) => (
          <div className="field-group" key={k}>
            <label>{LINK_META[k].label}</label>
            <input className="input" value={value.links[k]} disabled={disabled} placeholder={LINK_META[k].placeholder} onChange={(e) => onChange({ ...value, links: { ...value.links, [k]: e.target.value } })} />
          </div>
        ))}
      </div>
    </>
  );
}
