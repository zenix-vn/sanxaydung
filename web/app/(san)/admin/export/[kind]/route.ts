import { notFound } from 'next/navigation';
import { requireAdmin, fmtDate, ROLE_LABEL, type PlatformRole } from '@/lib/admin';
import { AUDIT_LABEL, TIER } from '@/lib/admin-labels';
import { toCsv, asText, type Cell } from '@/lib/csv';

export const dynamic = 'force-dynamic';

type Supa = Awaited<ReturnType<typeof requireAdmin>>['supa'];
type Sheet = { header: string[]; rows: Cell[][] };
type Any = Record<string, any>;
const PAGE = 1000;
const LIMIT = 20000;

/** Đọc hết bảng theo từng trang (PostgREST giới hạn số dòng mỗi lượt). */
async function all(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>, size = PAGE) {
  const out: Any[] = [];
  for (let from = 0; from < LIMIT; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Any[];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

const BUILD: Record<string, (s: Supa) => Promise<Sheet>> = {
  async companies(s) {
    const [rows, { data: provs }] = await Promise.all([
      all((a, b) => s.from('companies')
        .select('*, company_categories ( categories ( name ) ), company_locations ( provinces ( name ) )')
        .is('deleted_at', null).order('created_at').order('id').range(a, b)),
      s.from('provinces').select('code, name'),
    ]);
    const prov = new Map(((provs ?? []) as Any[]).map((p) => [p.code, p.name]));
    return {
      header: ['Tên doanh nghiệp', 'Tên pháp lý', 'Số điện thoại', 'Mã số thuế', 'Email', 'Website', 'Địa chỉ', 'Tỉnh trụ sở', 'Lĩnh vực chi tiết', 'Tỉnh/thành hoạt động', 'Năm thành lập', 'Quy mô', 'Trạng thái', 'Hạng xác minh', 'Trust Score', 'Đã có chủ', 'Ngày tạo', 'Đường dẫn'],
      rows: rows.map((c) => [c.name, c.legal_name, asText(c.phone), asText(c.tax_code), c.email, c.website, c.address, prov.get(c.province_code) ?? c.province_code,
        c.company_categories?.map((x: Any) => x.categories?.name).join(', '), c.company_locations?.map((x: Any) => x.provinces?.name).join(', '),
        c.founded_year, c.size_range, c.status, TIER[c.verified_tier]?.l ?? c.verified_tier, Number(c.trust_score ?? 0), c.owner_id ? 'Có' : 'Chưa', fmtDate(c.created_at), `/cong-ty/${c.slug}`]),
    };
  },
  async registrations(s) {
    const rows = await all((a, b) => s.from('partner_registrations').select('*').order('created_at').order('id').range(a, b));
    return {
      header: ['Tên doanh nghiệp', 'Số điện thoại', 'Mã số thuế', 'Người liên hệ', 'Chức vụ', 'Email', 'Địa chỉ', 'Website', 'Nguồn', 'Trạng thái', 'Gửi lúc'],
      rows: rows.map((r) => [r.company_name, asText(r.phone), asText(r.tax_code), r.contact_name, r.contact_role, r.payload?.email_google, r.address, r.website, r.source, r.status, fmtDate(r.created_at, true)]),
    };
  },
  async users(s) {
    const rows = await all((a) => s.rpc('admin_list_users', { _q: null, _limit: 100, _offset: a, _filter: null }), 100);
    return {
      header: ['Họ tên', 'Email', 'Số điện thoại', 'Vai trò', 'Số doanh nghiệp', 'Bị khóa', 'Đã xóa', 'Đăng ký', 'Đăng nhập gần nhất'],
      rows: rows.map((u) => [u.full_name, u.email, asText(u.phone), ROLE_LABEL[(u.role as PlatformRole) ?? 'member'], u.companies, u.banned ? 'Có' : '', u.deleted ? 'Có' : '', fmtDate(u.created_at, true), fmtDate(u.last_sign_in_at, true)]),
    };
  },
  async subscriptions(s) {
    const rows = await all((a, b) => s.from('subscriptions').select('*, companies ( name, phone ), plans ( name )').order('started_at').order('id').range(a, b));
    return {
      header: ['Doanh nghiệp', 'Số điện thoại', 'Gói', 'Trạng thái', 'Bắt đầu', 'Hết hạn'],
      rows: rows.map((r) => [r.companies?.name, asText(r.companies?.phone), r.plans?.name ?? r.plan_id, r.status, fmtDate(r.started_at), fmtDate(r.expires_at)]),
    };
  },
  async payments(s) {
    const rows = await all((a, b) => s.from('payments').select('*, companies ( name, phone ), plans ( name )').order('paid_at').order('id').range(a, b));
    return {
      header: ['Ngày nhận', 'Doanh nghiệp', 'Số điện thoại', 'Số tiền', 'Gói', 'Số tháng', 'Hình thức', 'Số hóa đơn', 'Mã giao dịch', 'Ghi chú', 'Đã hủy', 'Lý do hủy'],
      rows: rows.map((r) => [fmtDate(r.paid_at), r.companies?.name, asText(r.companies?.phone), Number(r.amount), r.plans?.name, r.months, r.method, asText(r.invoice_no), asText(r.reference), r.note, r.voided_at ? 'Có' : '', r.void_reason]),
    };
  },
  async audit(s) {
    const rows = await all((a, b) => s.from('audit_log').select('*, profiles:actor_id ( full_name )').order('created_at', { ascending: false }).order('id').range(a, b));
    return {
      header: ['Thời gian', 'Người thực hiện', 'Hành động', 'Mã doanh nghiệp', 'Chi tiết'],
      rows: rows.map((r) => [fmtDate(r.created_at, true), r.profiles?.full_name ?? 'Hệ thống', AUDIT_LABEL[r.action] ?? r.action, r.company_id, r.diff ? JSON.stringify(r.diff) : '']),
    };
  },
};

export async function GET(_req: Request, { params }: { params: { kind: string } }) {
  const build = Object.prototype.hasOwnProperty.call(BUILD, params.kind) ? BUILD[params.kind] : null;
  if (!build) notFound();
  const { supa } = await requireAdmin('/admin', 'admin');
  const sheet = await build(supa);
  // ghi vết trước khi trả dữ liệu; không ghi được thì không xuất
  const { error } = await supa.rpc('admin_log_export', { _kind: params.kind, _count: sheet.rows.length });
  if (error) return new Response('Không ghi được nhật ký xuất dữ liệu', { status: 500 });
  const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
  return new Response(toCsv(sheet.header, sheet.rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="sanxaydung-${params.kind}-${day}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
