/** Ghép cột và làm sạch dữ liệu đối tác nhập từ CSV (cùng quy tắc với scripts/import-registrations.mjs). */

export const FIELDS = [
  // thứ tự = thứ tự ưu tiên khi tự ghép cột: email đứng đầu để "Địa chỉ email" không bị nhận là địa chỉ
  { key: 'email_google', label: 'Email', keys: ['email'] },
  { key: 'company_name', label: 'Tên doanh nghiệp', keys: ['ten doanh nghiep', 'ten cong ty', 'ten don vi', 'company name'], required: true },
  { key: 'phone', label: 'Số điện thoại', keys: ['dien thoai', 'sdt', 'so dt', 'phone', 'zalo'], required: true },
  { key: 'tax_code', label: 'Mã số thuế', keys: ['ma so thue', 'mst', 'tax code'] },
  { key: 'legal_name', label: 'Tên pháp lý', keys: ['phap ly'] },
  { key: 'contact_name', label: 'Người liên hệ', keys: ['nguoi lien he', 'ho ten', 'ho va ten'] },
  { key: 'contact_role', label: 'Chức vụ', keys: ['chuc vu'] },
  { key: 'group', label: 'Nhóm lĩnh vực', keys: ['nhom linh vuc', 'nhom'] },
  { key: 'categories', label: 'Lĩnh vực chi tiết', keys: ['linh vuc chi tiet', 'linh vuc', 'nganh nghe'] },
  { key: 'provinces', label: 'Tỉnh/thành hoạt động', keys: ['tinh thanh', 'tinh', 'khu vuc'] },
  { key: 'address', label: 'Địa chỉ', keys: ['dia chi'] },
  { key: 'website', label: 'Website', keys: ['website', 'fanpage'] },
  { key: 'founded_year', label: 'Năm thành lập', keys: ['nam thanh lap'] },
  { key: 'size_range', label: 'Quy mô', keys: ['quy mo'] },
  { key: 'capability_class', label: 'Chứng chỉ năng lực', keys: ['chung chi'] },
  { key: 'intro', label: 'Giới thiệu', keys: ['gioi thieu', 'mo ta'] },
  { key: 'logo', label: 'Logo (link)', keys: ['logo'] },
] as const;
export type FieldKey = (typeof FIELDS)[number]['key'];
export type Mapping = Partial<Record<FieldKey, number>>;

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const normProv = (s: string) => norm(s).replace(/\b(tp|thanh pho|tinh)\b/g, '').replace(/\s+/g, ' ').trim();

export function autoMap(headers: string[]): Mapping {
  const hs = headers.map(norm);
  const used = new Set<number>();
  const out: Mapping = {};
  const take = (k: FieldKey, i: number) => { if (i >= 0) { out[k] = i; used.add(i); } };
  // lượt 1: tiêu đề trùng hẳn nhãn (file mẫu / file xuất từ trang quản trị)
  for (const f of FIELDS) take(f.key, hs.findIndex((h, i) => !used.has(i) && h === norm(f.label)));
  // lượt 2: tiêu đề chứa từ khóa
  for (const f of FIELDS) {
    if (out[f.key] != null) continue;
    for (const kw of f.keys) {
      const i = hs.findIndex((h, j) => !used.has(j) && ` ${h} `.includes(` ${kw} `));
      if (i >= 0) { take(f.key, i); break; }
    }
  }
  return out;
}

const GROUP: Record<string, string> = { 'nha thau': 'contractor', 'doi thi cong': 'crew', 'nha cung cap': 'supplier', 'don vi dich vu': 'service', 'dich vu': 'service' };
const PROV_ALIAS: Record<string, string> = { hcm: '79', 'ho chi minh': '79', 'sai gon': '79', hn: '01' };

export function cleanPhone(s: string) {
  let p = s.replace(/\D/g, '');
  if (p.startsWith('84') && p.length >= 11) p = `0${p.slice(2)}`;
  else if (p.length === 9 && /^[35789]/.test(p)) p = `0${p}`; // bảng tính làm mất số 0 đầu
  return p;
}
function cleanWebsite(v: string) {
  if (/^https?:\/\/\S+$/i.test(v)) return v;
  return /^[^\s@/]+\.[a-z]{2,}(\/\S*)?$/i.test(v) ? `https://${v}` : '';
}
function cleanYear(v: string) {
  const m = v.match(/\b(19|20)\d{2}\b/);
  return m && Number(m[0]) <= new Date().getFullYear() ? m[0] : '';
}
/** Link Google Drive → ảnh công khai; link ảnh trực tiếp giữ nguyên; còn lại bỏ. */
function logoCandidate(v: string) {
  if (!/^https?:\/\//i.test(v)) return '';
  const m = v.match(/drive\.google\.com\/.*?\/d\/([\w-]+)|[?&]id=([\w-]+)/);
  if (m) return `https://lh3.googleusercontent.com/d/${m[1] || m[2]}`;
  return /^https:.*\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(v) ? v : '';
}

export interface ImportRow {
  company_name: string; phone: string; tax_code: string; legal_name: string; contact_name: string; contact_role: string;
  group_key: string; category_slugs: string[]; province_codes: string[]; address: string; website: string;
  founded_year: string; size_range: string; capability_class: string; intro: string; logo_url: string; email_google: string;
  raw: Record<string, string>;
}

export function buildRows(
  data: string[][], map: Mapping,
  categories: { slug: string; name: string }[], provinces: { code: string; name: string }[],
): { row: ImportRow; warnings: string[] }[] {
  const catBy = new Map<string, string>();
  categories.forEach((c) => { catBy.set(norm(c.name), c.slug); catBy.set(norm(c.slug), c.slug); });
  const provBy = new Map<string, string>(Object.entries(PROV_ALIAS));
  provinces.forEach((p) => { provBy.set(normProv(p.name), p.code); provBy.set(p.code, p.code); });
  const split = (s: string) => s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);

  return data.map((cells) => {
    const get = (k: FieldKey) => (map[k] == null ? '' : (cells[map[k]!] ?? '').trim());
    const warnings: string[] = [];
    const lookup = (value: string, table: Map<string, string>, key: (s: string) => string, what: string) => {
      const found: string[] = [];
      const missed: string[] = [];
      for (const label of split(value)) {
        const hit = table.get(key(label));
        if (hit) found.push(hit); else missed.push(label);
      }
      if (missed.length) warnings.push(`Không nhận ra ${what}: ${missed.join(', ')}`);
      return Array.from(new Set(found));
    };
    const website = cleanWebsite(get('website'));
    const year = cleanYear(get('founded_year'));
    const logo = logoCandidate(get('logo'));
    if (get('website') && !website) warnings.push('Bỏ website không hợp lệ');
    if (get('founded_year') && !year) warnings.push('Bỏ năm thành lập không hợp lệ');
    const cap = get('capability_class');

    return {
      warnings,
      row: {
        company_name: get('company_name'),
        phone: cleanPhone(get('phone')),
        tax_code: get('tax_code').replace(/[\s']/g, ''),
        legal_name: get('legal_name'),
        contact_name: get('contact_name'),
        contact_role: get('contact_role'),
        group_key: GROUP[norm(get('group'))] ?? '',
        category_slugs: lookup(get('categories'), catBy, norm, 'lĩnh vực'),
        province_codes: lookup(get('provinces'), provBy, normProv, 'tỉnh/thành'),
        address: get('address'),
        website,
        founded_year: year,
        size_range: get('size_range'),
        capability_class: ['', 'khong', 'khong co', 'none', 'k'].includes(norm(cap)) ? '' : cap,
        intro: get('intro'),
        logo_url: logo,
        email_google: /^\S+@\S+\.\S+$/.test(get('email_google')) ? get('email_google') : '',
        raw: { founded: get('founded_year'), website: get('website'), logo: get('logo'), phone: get('phone') },
      },
    };
  });
}
