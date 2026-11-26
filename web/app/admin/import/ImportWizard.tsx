'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/components/admin/ui';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { parseCsv, toCsv } from '@/lib/csv';
import { FIELDS, autoMap, buildRows, type FieldKey, type ImportRow, type Mapping } from '@/lib/import-map';

type Status = 'new' | 'dup_file' | 'dup_company' | 'dup_registration' | 'invalid' | 'error';
type Result = { row: number; status: Status; message: string | null; company_id: string | null };
const STATUS: Record<Status, { l: string; c: string }> = {
  new: { l: 'Hợp lệ', c: 'g' }, dup_company: { l: 'Đã có hồ sơ', c: 'o' }, dup_registration: { l: 'Đã đăng ký', c: 'o' },
  dup_file: { l: 'Lặp trong file', c: '' }, invalid: { l: 'Thiếu/sai dữ liệu', c: 'r' }, error: { l: 'Lỗi', c: 'r' },
};
const MAX = 500;

/** Chỉ giữ logo thật sự tải được như ảnh (file Drive không công khai sẽ bị bỏ). */
const loads = (url: string) => new Promise<boolean>((resolve) => {
  const img = new Image();
  const t = setTimeout(() => resolve(false), 8000);
  img.onload = () => { clearTimeout(t); resolve(true); };
  img.onerror = () => { clearTimeout(t); resolve(false); };
  img.referrerPolicy = 'no-referrer';
  img.src = url;
});

export default function ImportWizard({ categories, provinces }: { categories: { slug: string; name: string }[]; provinces: { code: string; name: string }[] }) {
  const { toast, ask } = useAdmin();
  const router = useRouter();
  const [file, setFile] = useState('');
  const [table, setTable] = useState<string[][]>([]);
  const [map, setMap] = useState<Mapping>({});
  const [paste, setPaste] = useState('');
  const [rows, setRows] = useState<{ row: ImportRow; warnings: string[] }[]>([]);
  const [results, setResults] = useState<Result[] | null>(null);
  const [done, setDone] = useState<'queue' | 'publish' | null>(null);
  const [filter, setFilter] = useState<Status | ''>('');
  const [busy, setBusy] = useState('');

  const headers = table[0] ?? [];
  const ready = map.company_name != null && map.phone != null;
  const tally = useMemo(() => {
    const t: Partial<Record<Status, number>> = {};
    (results ?? []).forEach((r) => (t[r.status] = (t[r.status] ?? 0) + 1));
    return t;
  }, [results]);

  function load(text: string, name: string) {
    const t = parseCsv(text);
    if (t.length < 2) return toast('err', 'File cần có dòng tiêu đề và ít nhất một dòng dữ liệu');
    if (t.length - 1 > MAX) return toast('err', `File có ${t.length - 1} dòng — tối đa ${MAX} dòng mỗi lần, hãy chia nhỏ`);
    setFile(name); setTable(t); setMap(autoMap(t[0])); setResults(null); setDone(null); setFilter('');
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (/\.xlsx?$/i.test(f.name)) return toast('err', 'Hãy lưu file Excel thành CSV UTF-8 rồi tải lên');
    if (f.size > 2 * 1024 * 1024) return toast('err', 'File tối đa 2MB');
    load(await f.text(), f.name);
  }

  function template() {
    const header = FIELDS.map((f) => f.label);
    const sample: Record<FieldKey, string> = {
      email_google: 'lienhe@example.com', company_name: 'Đội xây dựng Minh Phát', phone: '0901 234 567', tax_code: '', legal_name: '',
      contact_name: 'Nguyễn Văn A', contact_role: 'Đội trưởng', group: 'Đội thi công', categories: 'Đội xây, Đội điện', provinces: 'TP. Hồ Chí Minh, Đồng Nai',
      address: 'Phường Thủ Đức', website: '', founded_year: '2018', size_range: '11–50 người', capability_class: 'Không có', intro: 'Nhận thi công nhà phố trọn gói.', logo: '',
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([toCsv(header, [FIELDS.map((f) => sample[f.key])])], { type: 'text/csv;charset=utf-8' }));
    a.download = 'mau-nhap-doanh-nghiep.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function call(list: ImportRow[], mode: 'preview' | 'queue' | 'publish') {
    const { data, error } = await createSupabaseBrowser().rpc('admin_import_partners', { _rows: list, _mode: mode });
    if (error) { toast('err', error.message); return null; }
    return data as Result[];
  }

  async function preview() {
    setBusy('Đang kiểm tra…');
    const built = buildRows(table.slice(1), map, categories, provinces);
    for (let i = 0; i < built.length; i += 8) {
      await Promise.all(built.slice(i, i + 8).map(async (b) => {
        if (b.row.logo_url && !(await loads(b.row.logo_url))) { b.row.logo_url = ''; b.warnings.push('Bỏ logo (không phải ảnh công khai)'); }
        else if (b.row.raw.logo && !b.row.logo_url) b.warnings.push('Bỏ logo (không phải ảnh công khai)');
      }));
    }
    const res = await call(built.map((b) => b.row), 'preview');
    setBusy('');
    if (!res) return;
    setRows(built); setResults(res); setDone(null); setFilter('');
  }

  async function run(mode: 'queue' | 'publish') {
    const n = tally.new ?? 0;
    const ok = await ask(mode === 'publish'
      ? { title: `Tạo ${n} hồ sơ ngay?`, message: 'Hồ sơ được công khai trong danh bạ, ở trạng thái chưa có chủ. Chỉ chọn khi bạn đã rà soát dữ liệu.', confirmLabel: 'Tạo hồ sơ' }
      : { title: `Đưa ${n} dòng vào hàng chờ?`, message: 'Duyệt từng bản ở mục Đăng ký đối tác trước khi lên danh bạ.', confirmLabel: 'Đưa vào hàng chờ' });
    if (!ok) return;
    setBusy('Đang nhập…');
    const res = await call(rows.map((b) => b.row), mode);
    setBusy('');
    if (!res) return;
    setResults(res); setDone(mode); setFilter('');
    const imported = res.filter((r) => r.status === 'new').length;
    toast(imported ? 'ok' : 'err', imported ? `Đã nhập ${imported} dòng` : 'Không nhập được dòng nào');
    router.refresh();
  }

  const shown = (results ?? []).filter((r) => !filter || r.status === filter);

  return (
    <div className="adm-stack">
      <section className="adm-card">
        <div className="hd"><h2>1. Chọn dữ liệu</h2><button type="button" className="ab" onClick={template}><svg className="ic"><use href="#ic-download" /></svg> Tải file mẫu</button></div>
        <div className="bd adm-imp">
          <label className="ab o" style={{ alignSelf: 'flex-start' }}>
            <svg className="ic"><use href="#ic-upload" /></svg> Chọn file CSV
            <input type="file" accept=".csv,.tsv,.txt,text/csv" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          <details>
            <summary>Hoặc dán trực tiếp từ bảng tính</summary>
            <textarea className="adm-in" rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Bôi đen cả dòng tiêu đề và dữ liệu trong Google Sheets, sao chép rồi dán vào đây" />
            <button type="button" className="ab" onClick={() => load(paste, 'Dữ liệu dán')} disabled={!paste.trim()}>Đọc dữ liệu</button>
          </details>
        </div>
      </section>

      {table.length > 0 && (
        <section className="adm-card">
          <div className="hd"><h2>2. Ghép cột</h2><span className="muted">{file} · {table.length - 1} dòng</span></div>
          <div className="bd">
            <div className="adm-map">
              {FIELDS.map((f) => (
                <label key={f.key}>{f.label}{'required' in f && ' *'}
                  <select className="adm-in" value={map[f.key] ?? ''} onChange={(e) => { setMap({ ...map, [f.key]: e.target.value === '' ? undefined : Number(e.target.value) }); setResults(null); }}>
                    <option value="">— Không dùng —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `Cột ${i + 1}`}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <button type="button" className="ab o" onClick={preview} disabled={!ready || !!busy}>{busy || 'Kiểm tra dữ liệu'}</button>
            {!ready && <span className="muted" style={{ marginLeft: 10 }}>Cần chọn cột Tên doanh nghiệp và Số điện thoại.</span>}
          </div>
        </section>
      )}

      {results && (
        <section className="adm-card">
          <div className="hd">
            <h2>{done ? '3. Kết quả' : '3. Xem trước'}</h2>
            <div className="adm-hd-acts">
              {done ? (
                <Link className="ab o" href={done === 'queue' ? '/admin/registrations' : '/admin/companies'}>{done === 'queue' ? 'Mở hàng chờ duyệt' : 'Xem danh sách doanh nghiệp'}</Link>
              ) : (<>
                <button type="button" className="ab" onClick={() => run('queue')} disabled={!tally.new || !!busy}>Đưa {tally.new ?? 0} dòng vào hàng chờ</button>
                <button type="button" className="ab p" onClick={() => run('publish')} disabled={!tally.new || !!busy}>{busy || `Tạo ${tally.new ?? 0} hồ sơ ngay`}</button>
              </>)}
            </div>
          </div>
          <div className="adm-chips" style={{ padding: '12px 16px 4px' }}>
            <button type="button" aria-pressed={filter === ''} onClick={() => setFilter('')}>Tất cả ({results.length})</button>
            {(Object.keys(STATUS) as Status[]).filter((s) => tally[s]).map((s) => (
              <button type="button" key={s} aria-pressed={filter === s} onClick={() => setFilter(s)}>{done && s === 'new' ? 'Đã nhập' : STATUS[s].l} ({tally[s]})</button>
            ))}
          </div>
          <div className="adm-tw"><table className="adm-t">
            <thead><tr><th>Dòng</th><th>Doanh nghiệp</th><th>SĐT</th><th>Lĩnh vực / khu vực</th><th>Kết quả</th><th>Ghi chú</th></tr></thead>
            <tbody>{shown.map((r) => {
              const b = rows[r.row];
              return (
                <tr key={r.row}>
                  <td className="num">{r.row + 2}</td>
                  <td><b style={{ color: 'var(--navy)' }}>{b?.row.company_name || '—'}</b>{b?.row.tax_code && <><br /><small className="muted">MST {b.row.tax_code}</small></>}</td>
                  <td>{b?.row.phone || b?.row.raw.phone || '—'}</td>
                  <td><small>{b?.row.category_slugs.map((s) => categories.find((c) => c.slug === s)?.name).join(', ') || '—'}<br />
                    <span className="muted">{b?.row.province_codes.map((c) => provinces.find((p) => p.code === c)?.name).join(', ') || '—'}</span></small></td>
                  <td><span className={`bdg ${STATUS[r.status].c}`}>{done && r.status === 'new' ? 'Đã nhập' : STATUS[r.status].l}</span></td>
                  <td style={{ maxWidth: 340 }}>
                    {r.message && <div>{r.message.replace(/dòng (\d+) trong file/, (_, n) => `dòng ${Number(n) + 1} trong file`)}</div>}
                    {b?.warnings.map((w) => <small key={w} className="muted" style={{ display: 'block' }}>{w}</small>)}
                    {r.company_id && <Link href={`/admin/companies/${r.company_id}`} className="adm-more">Mở hồ sơ</Link>}
                  </td>
                </tr>
              );
            })}</tbody>
          </table></div>
        </section>
      )}
    </div>
  );
}
