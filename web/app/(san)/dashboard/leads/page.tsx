import type { Metadata } from 'next';
import { requireUserCompany } from '@/lib/supabase/company';
import { timeAgo } from '@/lib/ui';
import { siteUrl } from '@/lib/site';
import Pagination from '@/components/Pagination';
import LeadStatus from './LeadStatus';

export const metadata: Metadata = { title: 'Yêu cầu từ website' };
export const dynamic = 'force-dynamic';

const PAGE = 30;
const NEED: Record<string, string> = { quote: 'Báo giá', consult: 'Tư vấn', other: 'Khác' };
const TABS = [
  { key: '', label: 'Tất cả' },
  { key: 'new', label: 'Mới' },
  { key: 'contacted', label: 'Đã liên hệ' },
  { key: 'done', label: 'Hoàn tất' },
  { key: 'spam', label: 'Rác' },
];

export type Lead = {
  id: string; name: string; phone: string; email: string | null; need: string; message: string | null;
  source_path: string | null; status: string; note: string | null; created_at: string;
};

export default async function LeadsPage({ searchParams }: { searchParams: { page?: string; status?: string } }) {
  const { supa, company } = await requireUserCompany('/dashboard/leads');
  if (!company) return null;
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const status = TABS.some((t) => t.key === searchParams.status) ? searchParams.status! : '';

  let q = supa.from('site_leads').select('*', { count: 'exact' }).eq('company_id', company.id);
  q = status ? q.eq('status', status) : q.neq('status', 'spam');
  const [{ data, count, error }, { count: fresh }] = await Promise.all([
    q.order('created_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1),
    supa.from('site_leads').select('id', { count: 'exact', head: true }).eq('company_id', company.id).eq('status', 'new'),
  ]);
  const leads = (data ?? []) as Lead[];
  const url = siteUrl(company as { slug: string; site_subdomain?: string | null });

  return (
    <div>
      <style>{`
        .lead{border-bottom:1px solid var(--line-2);padding:16px 4px;display:grid;grid-template-columns:1fr auto;gap:8px 16px}
        .lead:last-child{border-bottom:0}
        .lead.new{background:#fff8f1;border-radius:10px;padding:16px 12px}
        .lead b{font-size:15px;color:var(--navy)}
        .lead .meta{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13px;color:var(--muted);margin-top:4px;align-items:center}
        .lead .meta a{color:var(--orange);font-weight:600}
        .lead p{grid-column:1/-1;font-size:13.5px;color:#31414f;white-space:pre-line;background:#f8fafc;border-radius:8px;padding:10px 12px}
        @media (max-width:640px){.lead{grid-template-columns:1fr}}
      `}</style>
      <div className="dpage-head">
        <div>
          <h1>Yêu cầu từ website</h1>
          <p>Khách để lại thông tin qua form “Gửi yêu cầu báo giá” trên website{url ? <> <a href={url} target="_blank" rel="noopener" style={{ color: 'var(--orange)', fontWeight: 600 }}>{url.replace('https://', '')}</a></> : ''}.</p>
        </div>
      </div>

      <div className="dcard">
        <div className="dtabs">
          {TABS.map((t) => (
            <a key={t.key} className={status === t.key ? 'active' : ''} href={t.key ? `/dashboard/leads?status=${t.key}` : '/dashboard/leads'}>
              {t.label}{t.key === 'new' && fresh ? <span className="n">{fresh}</span> : null}
            </a>
          ))}
        </div>
        {error ? (
          <div className="empty">Chưa tải được danh sách yêu cầu. Vui lòng thử lại sau.</div>
        ) : leads.length === 0 ? (
          <div className="empty"><svg className="ic"><use href="#ic-clipboard" /></svg>Chưa có yêu cầu nào{status ? ' ở mục này' : ''}. Chia sẻ địa chỉ website để khách hàng gửi yêu cầu cho bạn.</div>
        ) : (
          leads.map((l) => (
            <div key={l.id} className={`lead${l.status === 'new' ? ' new' : ''}`}>
              <div>
                <b>{l.name}</b> <span className="badge gray">{NEED[l.need] ?? l.need}</span>
                <div className="meta">
                  <a href={`tel:${l.phone}`}><svg className="ic" style={{ width: 14, height: 14 }}><use href="#ic-phone" /></svg> {l.phone}</a>
                  {l.email && <a href={`mailto:${l.email}`}>{l.email}</a>}
                  <span>{timeAgo(l.created_at)}</span>
                  {l.source_path && <span>từ trang {l.source_path.replace(/^\/site\/[^/]+/, '') || '/'}</span>}
                </div>
              </div>
              <LeadStatus id={l.id} status={l.status} />
              {l.message && <p>{l.message}</p>}
            </div>
          ))
        )}
        <Pagination base="/dashboard/leads" qs={status ? `status=${status}` : ''} page={page} pages={Math.ceil((count ?? 0) / PAGE)} />
      </div>
    </div>
  );
}
