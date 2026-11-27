'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/components/admin/ui';
import { GROUP_LABEL } from '@/lib/admin-labels';
import { createSupabaseBrowser } from '@/lib/supabase/client';

type Cat = { id: string; name: string; group_key: string };
type Prov = { code: string; name: string };
const SIZES = ['1–10 người', '11–50 người', '51–200 người', 'Trên 200 người'];
const KEYS = ['name', 'legal_name', 'phone', 'tax_code', 'email', 'website', 'address', 'province_code', 'founded_year', 'size_range', 'intro', 'description'] as const;
type Key = (typeof KEYS)[number];

export default function EditCompany({ company, categories, provinces, categoryIds, provinceCodes }: {
  company: Record<string, unknown> & { id: string }; categories: Cat[]; provinces: Prov[]; categoryIds: string[]; provinceCodes: string[];
}) {
  const { toast } = useAdmin();
  const router = useRouter();
  const initial = () => Object.fromEntries(KEYS.map((k) => [k, company[k] == null ? '' : String(company[k])])) as Record<Key, string>;
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(initial);
  const [cats, setCats] = useState(categoryIds);
  const [locs, setLocs] = useState(provinceCodes);
  const [busy, setBusy] = useState(false);

  function start() { setF(initial()); setCats(categoryIds); setLocs(provinceCodes); setOpen(true); }
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    // chỉ gửi trường đã đổi, tránh ghi đè chỉnh sửa song song của chủ hồ sơ
    const base = initial();
    const patch = Object.fromEntries(KEYS.filter((k) => f[k] !== base[k]).map((k) => [k, f[k]]));
    const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
    setBusy(true);
    const { error } = await createSupabaseBrowser().rpc('admin_update_company', {
      _company: company.id, _patch: patch,
      _categories: same(cats, categoryIds) ? null : cats,
      _provinces: same(locs, provinceCodes) ? null : locs,
    });
    setBusy(false);
    if (error) return toast('err', error.message);
    toast('ok', 'Đã lưu hồ sơ');
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return <button type="button" className="ab" onClick={start}><svg className="ic"><use href="#ic-edit" /></svg> Sửa thông tin</button>;
  }

  const input = (k: Key, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label>{label}<input className="adm-in" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} /></label>
  );

  return (
    <div className="adm-modal-bg">
      <form className="adm-modal wide" role="dialog" aria-modal="true" aria-label="Sửa thông tin doanh nghiệp" onSubmit={save}>
        <h3>Sửa thông tin doanh nghiệp</h3>
        <p>Đường dẫn công khai giữ nguyên. Mọi thay đổi được ghi vào nhật ký.</p>
        <div className="adm-form">
          {input('name', 'Tên hiển thị *', { required: true })}
          {input('legal_name', 'Tên pháp lý')}
          {input('phone', 'Số điện thoại', { inputMode: 'tel' })}
          {input('tax_code', 'Mã số thuế (có thể để trống)')}
          {input('email', 'Email', { type: 'email' })}
          {input('website', 'Website')}
          {input('founded_year', 'Năm thành lập', { inputMode: 'numeric', maxLength: 4 })}
          <label>Quy mô
            <select className="adm-in" value={f.size_range} onChange={(e) => setF({ ...f, size_range: e.target.value })}>
              <option value="">—</option>
              {(f.size_range && !SIZES.includes(f.size_range) ? [f.size_range, ...SIZES] : SIZES).map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label>Tỉnh/thành trụ sở
            <select className="adm-in" value={f.province_code} onChange={(e) => setF({ ...f, province_code: e.target.value })}>
              <option value="">—</option>
              {provinces.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
            </select>
          </label>
          {input('address', 'Địa chỉ')}
          <label className="full">Giới thiệu ngắn<textarea className="adm-in" rows={2} value={f.intro} onChange={(e) => setF({ ...f, intro: e.target.value })} /></label>
          <label className="full">Mô tả chi tiết<textarea className="adm-in" rows={5} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        </div>

        <h4>Lĩnh vực <small>({cats.length})</small></h4>
        {Object.entries(GROUP_LABEL).map(([g, label]) => {
          const list = categories.filter((c) => c.group_key === g);
          return list.length === 0 ? null : (
            <div key={g} className="adm-chips"><span>{label}</span>
              {list.map((c) => <button type="button" key={c.id} aria-pressed={cats.includes(c.id)} onClick={() => setCats(toggle(cats, c.id))}>{c.name}</button>)}
            </div>
          );
        })}

        <h4>Khu vực hoạt động <small>({locs.length})</small></h4>
        <div className="adm-chips scroll">
          {provinces.map((p) => <button type="button" key={p.code} aria-pressed={locs.includes(p.code)} onClick={() => setLocs(toggle(locs, p.code))}>{p.name}</button>)}
        </div>

        <div className="ft">
          <button type="button" className="ab" onClick={() => setOpen(false)}>Hủy</button>
          <button type="submit" className="ab p" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
        </div>
      </form>
    </div>
  );
}
