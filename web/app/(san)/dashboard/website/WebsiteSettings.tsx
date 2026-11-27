'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supa as loadSupa } from '@/lib/supabase/lazy';
import { isValidSubdomain, RESERVED_SUBDOMAINS, SUBDOMAIN_RE } from '@/lib/site';

type Props = {
  companyId: string; slug: string; subdomain: string; current: string | null; enabled: boolean;
  rawSettings: Record<string, unknown>; canAdmin: boolean; root: string;
};

function check(v: string): string | null {
  if (!v) return null;
  if (v.length < 3 || v.length > 40) return 'Tên miền con dài 3–40 ký tự.';
  if (!SUBDOMAIN_RE.test(v)) return 'Chỉ dùng chữ thường không dấu, số và gạch nối; không bắt đầu hay kết thúc bằng gạch nối.';
  if (RESERVED_SUBDOMAINS.has(v)) return 'Tên này được dành riêng, vui lòng chọn tên khác.';
  return null;
}

export default function WebsiteSettings(p: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(p.enabled);
  const [sub, setSub] = useState(p.subdomain);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const clean = sub.trim().toLowerCase();
  const invalid = check(clean);
  const fallback = isValidSubdomain(p.slug) ? p.slug : null;
  const shown = clean && !invalid ? clean : fallback;
  const dirty = enabled !== p.enabled || clean !== p.subdomain;
  const locked = !p.canAdmin || busy;

  async function save() {
    if (invalid) return setMsg({ ok: false, text: invalid });
    setBusy(true); setMsg(null);
    const db = await loadSupa();
    const { error } = await db.from('companies')
      .update({ site_subdomain: clean || null, site_settings: { ...p.rawSettings, enabled } })
      .eq('id', p.companyId);
    setBusy(false);
    if (error) {
      // Thông báo tiếng Việt từ trigger (trùng, dành riêng, quyền); trùng chỉ mục duy nhất thì báo chung
      const vi = /[à-ỹ]/i.test(error.message);
      return setMsg({ ok: false, text: vi ? error.message : error.code === '23505' ? 'Tên miền con này đã có doanh nghiệp khác dùng.' : 'Chưa lưu được, vui lòng thử lại.' });
    }
    setMsg({ ok: true, text: 'Đã lưu. Website cập nhật sau khoảng 1 phút.' });
    router.refresh();
  }

  return (
    <div>
      {!p.canAdmin && <p className="muted" style={{ marginBottom: 12 }}>Chỉ chủ sở hữu hoặc quản trị viên được bật/tắt website và đổi tên miền con.</p>}

      <label className="row" style={{ gap: 10, alignItems: 'flex-start', cursor: locked ? 'default' : 'pointer' }}>
        <input type="checkbox" checked={enabled} disabled={locked} onChange={(e) => setEnabled(e.target.checked)} style={{ marginTop: 3 }} />
        <span>
          <b style={{ color: 'var(--navy)' }}>Bật website</b>
          <small className="muted" style={{ display: 'block' }}>Tắt thì địa chỉ website báo “không tìm thấy”; hồ sơ trên sàn vẫn hiện bình thường.</small>
        </span>
      </label>

      <div className="field-group" style={{ marginTop: 18 }}>
        <label htmlFor="ws-sub">Tên miền con</label>
        <div className="row" style={{ gap: 0, alignItems: 'stretch', maxWidth: 520 }}>
          <span className="input" style={{ width: 'auto', borderRadius: '10px 0 0 10px', background: '#f4f6f9', color: 'var(--muted)', borderRight: 0 }}>https://</span>
          <input id="ws-sub" className="input" style={{ borderRadius: 0, minWidth: 0 }} value={sub} disabled={locked} maxLength={40}
            placeholder={fallback ?? 'ten-cong-ty'} onChange={(e) => setSub(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
          <span className="input" style={{ width: 'auto', borderRadius: '0 10px 10px 0', background: '#f4f6f9', color: 'var(--muted)', borderLeft: 0, whiteSpace: 'nowrap' }}>.{p.root}</span>
        </div>
        <small className={invalid ? '' : 'muted'} style={{ display: 'block', marginTop: 6, color: invalid ? 'var(--red)' : undefined }}>
          {invalid ?? (clean
            ? 'Địa chỉ cũ theo đường dẫn hồ sơ sẽ tự chuyển sang địa chỉ mới.'
            : fallback ? `Để trống: dùng đường dẫn hồ sơ (${fallback}.${p.root}). Nên chọn tên ngắn, dễ nhớ, ví dụ tên viết liền của công ty.` : 'Đường dẫn hồ sơ quá dài để làm tên miền con — hãy chọn một tên ngắn.')}
        </small>
        {shown && !invalid && <small className="muted" style={{ display: 'block', marginTop: 2 }}>Website sẽ ở: <b style={{ color: 'var(--navy)' }}>https://{shown}.{p.root}</b></small>}
      </div>

      {msg && <p role="status" style={{ margin: '0 0 10px', fontSize: 13.5, fontWeight: 600, color: msg.ok ? 'var(--green)' : 'var(--red)' }}>{msg.text}</p>}
      <button type="button" className="btn btn-orange" disabled={locked || !dirty || !!invalid} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu cài đặt'}</button>
    </div>
  );
}

export function CopyUrl({ url }: { url: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="btn btn-outline" onClick={() => navigator.clipboard?.writeText(url).then(() => { setOk(true); setTimeout(() => setOk(false), 1800); })}>
      <svg className="ic"><use href="#ic-link" /></svg> {ok ? 'Đã sao chép' : 'Sao chép địa chỉ'}
    </button>
  );
}
