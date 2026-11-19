#!/usr/bin/env node
/**
 * Import phản hồi Google Form (CSV) -> bảng partner_registrations (Supabase).
 *
 *   export SUPABASE_URL=...            (Project Settings -> API)
 *   export SUPABASE_SERVICE_ROLE_KEY=...   (chỉ chạy ở máy/CI, KHÔNG lộ client)
 *   node import-registrations.mjs responses.csv [--dry-run]
 *
 * Bản trùng MST/SĐT bị ràng buộc UNIQUE ở DB chặn -> đếm là "duplicate".
 */
import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

// ---------- Bảng ánh xạ nhãn -> mã ----------
const GROUP_MAP = {
  'nha thau': 'contractor',
  'doi thi cong': 'crew',
  'nha cung cap': 'supplier',
  'don vi dich vu': 'service',
};

const CATEGORY_MAP = {
  'tong thau': 'tong-thau', 'nha thau phu': 'nha-thau-phu', 'nha thau chuyen nganh': 'nha-thau-chuyen',
  'doi xay': 'doi-xay', 'doi dien': 'doi-dien', 'doi nuoc': 'doi-nuoc', 'doi son': 'doi-son',
  'doi hoan thien': 'doi-hoan-thien', 'doi nhom kinh': 'doi-nhom-kinh', 'doi noi that': 'doi-noi-that',
  'vat lieu xay dung': 'vat-lieu', 'may moc': 'may-moc', 'thiet bi': 'thiet-bi', 'noi that': 'noi-that',
  'thiet ke': 'thiet-ke', 'giam sat': 'giam-sat', 'khao sat': 'khao-sat',
  'xin phep xay dung': 'xin-phep', 'kiem dinh': 'kiem-dinh', 'cho thue thiet bi': 'cho-thue-thiet-bi',
};

// 34 đơn vị hành chính (khớp seed.sql)
const PROVINCE_ENTRIES = [
  ['01','Hà Nội'],['79','TP. Hồ Chí Minh'],['31','Hải Phòng'],['48','Đà Nẵng'],['92','Cần Thơ'],
  ['46','Huế'],['22','Quảng Ninh'],['04','Cao Bằng'],['20','Lạng Sơn'],['12','Lai Châu'],
  ['11','Điện Biên'],['14','Sơn La'],['19','Thái Nguyên'],['25','Phú Thọ'],['27','Bắc Ninh'],
  ['33','Hưng Yên'],['37','Ninh Bình'],['10','Lào Cai'],['08','Tuyên Quang'],['38','Thanh Hóa'],
  ['40','Nghệ An'],['42','Hà Tĩnh'],['45','Quảng Trị'],['51','Quảng Ngãi'],['64','Gia Lai'],
  ['56','Khánh Hòa'],['68','Lâm Đồng'],['66','Đắk Lắk'],['75','Đồng Nai'],['72','Tây Ninh'],
  ['86','Vĩnh Long'],['87','Đồng Tháp'],['89','An Giang'],['96','Cà Mau'],
];

// ---------- Tiện ích ----------
// chuẩn hóa chung: bỏ dấu, đ->d, hạ thường, thay ký tự đặc biệt bằng khoảng trắng
const norm = (s) => (s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/gi, 'd')
  .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

// chuẩn hóa riêng cho TÊN TỈNH: bỏ tiền tố 'tp' / 'thanh pho' / 'tinh'
const normProv = (s) => norm(s).replace(/\b(tp|thanh pho|tinh)\b/g, '').replace(/\s+/g, ' ').trim();

const PROVINCE_MAP = Object.fromEntries(PROVINCE_ENTRIES.map(([code, name]) => [normProv(name), code]));

const normPhone = (s) => {
  let p = (s || '').replace(/[^\d+]/g, '');
  if (p.startsWith('+84')) p = '0' + p.slice(3);
  else if (p.startsWith('84') && p.length === 11) p = '0' + p.slice(2);
  return p;
};
const splitMulti = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);
const toInt = (s) => { const n = parseInt((s || '').replace(/\D/g, ''), 10); return Number.isFinite(n) ? n : null; };

// ---------- Làm sạch dữ liệu nhập tay ----------
// Năm thành lập: lấy năm 4 chữ số hợp lệ ("25/10/2024" -> 2024); "14 năm", "14" -> null
const cleanYear = (s) => {
  const m = (s || '').match(/\b(19|20)\d{2}\b/);
  const y = m ? Number(m[0]) : null;
  return y && y <= new Date().getFullYear() ? y : null;
};
// Website/Fanpage: giữ URL http(s); "abc.vn" -> https://abc.vn; chữ tự do ("Nội thất X - 09...") -> null
const cleanWebsite = (s) => {
  const v = (s || '').trim();
  if (!v) return null;
  if (/^https?:\/\/\S+$/i.test(v)) return v;
  return /^[^\s@\/]+\.[a-z]{2,}(\/\S*)?$/i.test(v) ? 'https://' + v : null;
};
// Chứng chỉ: "Không có", "không" -> null
const cleanCapability = (s) => {
  const v = (s || '').trim();
  return !v || ['khong', 'khong co', 'none', 'k'].includes(norm(v)) ? null : v;
};
// Logo: link Google Drive -> URL ảnh công khai (lh3); URL ảnh trực tiếp giữ nguyên; còn lại null.
// Sau đó main() kiểm tra HEAD thật sự trả về image/* mới giữ (file Drive không công khai sẽ bị bỏ).
function logoCandidate(s) {
  const v = (s || '').trim();
  if (!/^https?:\/\//i.test(v)) return null;
  const m = v.match(/drive\.google\.com\/.*?\/d\/([\w-]+)|[?&]id=([\w-]+)/);
  if (m) return `https://lh3.googleusercontent.com/d/${m[1] || m[2]}`;
  return /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(v) ? v : null;
}
async function isImage(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(15000) });
    return r.ok && (r.headers.get('content-type') || '').startsWith('image/');
  } catch { return false; }
}

// tìm giá trị theo từ khóa trong tiêu đề cột (không phân biệt dấu/hoa thường)
function pick(row, keyword) {
  const k = norm(keyword);
  const hit = Object.keys(row).find((h) => norm(h).includes(k));
  return hit ? row[hit] : undefined;
}

function mapRow(row) {
  const groupLabel = pick(row, 'nhom linh vuc');
  const catCell    = pick(row, 'linh vuc chi tiet');
  const provCell   = pick(row, 'tinh');

  const category_slugs = splitMulti(catCell).map((l) => CATEGORY_MAP[norm(l)]).filter(Boolean);
  const provinceMatched = [], provinceRaw = [];
  for (const l of splitMulti(provCell)) {
    const code = PROVINCE_MAP[normProv(l)];
    if (code) provinceMatched.push(code); else provinceRaw.push(l);
  }

  return {
    phone: normPhone(pick(row, 'dien thoai')),
    // MST có thể để trống -> ép '' thành null (nhiều null không xung đột UNIQUE)
    tax_code: (pick(row, 'ma so thue') || '').replace(/\s/g, '') || null,
    company_name: (pick(row, 'ten doanh nghiep') || '').trim(),
    legal_name: (pick(row, 'phap ly') || '').trim() || null,
    contact_name: (pick(row, 'nguoi lien he') || '').trim() || null,
    contact_role: (pick(row, 'chuc vu') || '').trim() || null,
    group_key: GROUP_MAP[norm(groupLabel)] || null,
    category_slugs: category_slugs.length ? category_slugs : null,
    province_codes: provinceMatched.length ? provinceMatched : null,
    address: (pick(row, 'dia chi') || '').trim() || null,
    website: cleanWebsite(pick(row, 'website')),
    intro: (pick(row, 'gioi thieu') || '').trim() || null,
    logo_url: logoCandidate(pick(row, 'logo')),   // main() sẽ xác minh là ảnh thật
    founded_year: cleanYear(pick(row, 'nam thanh lap')),
    size_range: (pick(row, 'quy mo') || '').trim() || null,
    capability_class: cleanCapability(pick(row, 'chung chi')),
    source: 'google_form',
    payload: {
      email_google: pick(row, 'email') || null,
      experience_years: toInt(pick(row, 'kinh nghiem')),
      project_photos: pick(row, 'anh cong trinh') || null,
      // giá trị gốc khách nhập (đã làm sạch ở các cột chính)
      raw: { founded: pick(row, 'nam thanh lap') || null, website: pick(row, 'website') || null, logo: pick(row, 'logo') || null, capability: pick(row, 'chung chi') || null },
      province_raw: provinceRaw.length ? provinceRaw : undefined,
    },
  };
}

// ---------- Main ----------
const [, , file, ...flags] = process.argv;
const dryRun = flags.includes('--dry-run');
if (!file) { console.error('Cách dùng: node import-registrations.mjs <responses.csv> [--dry-run]'); process.exit(1); }

const rows = parse(readFileSync(file), { columns: true, skip_empty_lines: true, trim: true });
console.log(`Đọc ${rows.length} dòng từ ${file}${dryRun ? '  [DRY-RUN]' : ''}`);

const mapped = rows.map(mapRow);

// kiểm tra tối thiểu (MST KHÔNG bắt buộc; chỉ cần tên + SĐT)
const invalid = mapped.filter((r) => !r.company_name || !r.phone);
if (invalid.length) console.warn(`⚠️  ${invalid.length} dòng thiếu tên/SĐT — sẽ bỏ qua.`);
const valid = mapped.filter((r) => r.company_name && r.phone);

// Chỉ giữ logo thực sự là ảnh truy cập công khai (Drive không public trả HTML → bỏ)
let logoKept = 0, logoDropped = 0;
for (const r of valid) {
  if (!r.logo_url) continue;
  if (await isImage(r.logo_url)) logoKept++; else { r.logo_url = null; logoDropped++; }
}
if (logoKept || logoDropped) console.log(`Logo: giữ ${logoKept}, bỏ ${logoDropped} (không phải ảnh công khai)`);

if (dryRun) {
  for (const r of valid.slice(0, 5)) console.dir(r, { depth: null });
  console.log(`\n(DRY-RUN) ${valid.length} dòng hợp lệ sẽ được import. Không ghi DB.`);
  process.exit(0);
}

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const supa = createClient(url, key, { auth: { persistSession: false } });

// SỐ ĐIỆN THOẠI là khóa chống trùng: gộp theo phone, giữ bản MỚI NHẤT (dòng cuối cùng)
const byPhone = new Map();
for (const r of valid) byPhone.set(r.phone, r);
const uniqueRows = [...byPhone.values()];

let upserted = 0, error = 0;
for (const r of uniqueRows) {
  // upsert theo phone: SĐT đã có -> cập nhật; chưa có -> thêm mới
  const { error: e } = await supa
    .from('partner_registrations')
    .upsert(r, { onConflict: 'phone' });
  if (!e) upserted++;
  else { error++; console.error(`  Lỗi [${r.phone}]: ${e.message}`); }
}
console.log(`\nKẾT QUẢ:  upserted=${upserted}  error=${error}  (từ ${valid.length} dòng hợp lệ → ${uniqueRows.length} SĐT duy nhất)`);

// Đồng bộ sang companies (tạo mới + cập nhật hồ sơ chưa claim)
const { data: synced, error: se } = await supa.rpc('sync_all_registrations');
if (se) console.error(`  Lỗi sync: ${se.message}`);
else console.log(`ĐỒNG BỘ:  ${synced} hồ sơ đã sync sang companies.`);
