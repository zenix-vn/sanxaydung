import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUserCompany } from '@/lib/supabase/company';
import RestoreButton from './RestoreButton';
import { ACTIONS, ENTITIES, canRestore, describeChanges, type Revision } from './labels';

export const metadata: Metadata = { title: 'Lịch sử chỉnh sửa' };
export const dynamic = 'force-dynamic';

const SIZE = 30;
const when = (iso: string) => new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' });

export default async function HistoryPage({ searchParams }: { searchParams: { before?: string } }) {
  const { supa, company, role } = await requireUserCompany('/dashboard/company-edit/history');
  if (!company || !['owner', 'admin', 'editor'].includes(role ?? '')) redirect('/dashboard');

  const cursor = Number(searchParams.before) || null;
  let q = supa
    .from('company_revisions')
    .select('id, entity, entity_id, action, label, before, after, created_at, profiles:actor_id ( full_name )')
    .eq('company_id', company.id)
    .order('id', { ascending: false })
    .limit(SIZE + 1);
  if (cursor) q = q.lt('id', cursor);
  const { data, error } = await q;
  const all = (data ?? []) as unknown as Revision[];
  const rows = all.slice(0, SIZE);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .rv{display:flex;gap:16px;align-items:flex-start;padding:14px 0;border-bottom:1px solid var(--line-2)}
        .rv:last-child{border-bottom:none}
        .rv .b{flex:1;min-width:0;overflow-wrap:anywhere}
        .rv h4{font-size:14px;font-weight:700;color:var(--navy)}
        .rv small{font-size:12px;color:var(--muted)}
        .rv dl{margin:8px 0 0;font-size:13px}
        .rv dt{font-weight:600;color:var(--navy);margin-top:6px}
        .rv dd{margin:0;color:#31414f}
        .rv del{color:var(--muted)}
        @media(max-width:600px){.rv{flex-direction:column;gap:8px}}
      ` }} />
      <section className="pagehead" style={{ padding: '22px 0' }}>
        <div className="container">
          <div className="crumb">
            <a href="/dashboard/company-edit">Chỉnh sửa hồ sơ</a>
            <svg className="ic"><use href="#ic-chevron-right" /></svg>
            Lịch sử
          </div>
          <h1>Lịch sử chỉnh sửa</h1>
        </div>
      </section>
      <section className="block" style={{ paddingTop: 26 }}>
        <div className="container" style={{ maxWidth: 860 }}>
          <div className="pill-note mb-16">
            <svg className="ic"><use href="#ic-refresh" /></svg>
            <span>
              Khôi phục được: thông tin &amp; giao diện hồ sơ, dự án, dịch vụ, thiết bị, chi nhánh, câu hỏi thường gặp. Mục có ảnh đã xóa
              (thư viện, nhân sự, đối tác, giải thưởng, mốc, tài liệu) chỉ xem được lịch sử. Lưu 300 thay đổi gần nhất.
            </span>
          </div>
          <div className="card-block">
            {error && <p className="muted">Chưa tải được lịch sử. Vui lòng thử lại.</p>}
            {!error && rows.length === 0 && <p className="muted">Chưa có thay đổi nào được ghi lại.</p>}
            {rows.map((r) => (
              <div className="rv" key={r.id}>
                <div className="b">
                  <h4>
                    {ACTIONS[r.action]} {ENTITIES[r.entity] ?? r.entity}
                    {r.label ? ` “${r.label}”` : ''}
                  </h4>
                  <small>{r.profiles?.full_name || 'Người dùng đã xóa'} · {when(r.created_at)}</small>
                  <dl>
                    {describeChanges(r).map((c) => (
                      <div key={c.field}>
                        <dt>{c.field}</dt>
                        <dd>{c.from !== null && <><del>{c.from}</del> → </>}{c.to}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                {canRestore(r) && <RestoreButton companyId={company.id as string} rev={r} />}
              </div>
            ))}
          </div>
          <div className="row" style={{ gap: 10 }}>
            {cursor && <a className="btn btn-outline" href="/dashboard/company-edit/history">← Mới nhất</a>}
            {all.length > SIZE && <a className="btn btn-outline" href={`/dashboard/company-edit/history?before=${rows[rows.length - 1].id}`}>Cũ hơn →</a>}
          </div>
        </div>
      </section>
    </>
  );
}
