import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin, fmtDate, hasRole } from '@/lib/admin';
import { colorFor } from '@/lib/ui';
import { AUDIT_LABEL, MEMBER_ROLE, REJECT_REASONS, TIER, VERIFY_KIND } from '@/lib/admin-labels';
import { Card, None } from '@/components/admin/card';
import { Act, SignedLink, Status, Who } from '@/components/admin/ui';
import CompanyActions from '../CompanyActions';
import EditCompany from './EditCompany';

export const metadata: Metadata = { title: 'Chi tiết doanh nghiệp' };

const METHOD: Record<string, string> = { phone: 'Khớp SĐT', email: 'Khớp email', manual: 'Duyệt tay' };
const TRUST: [string, string, number][] = [['verification', 'Xác minh', 20], ['reviews', 'Đánh giá', 30], ['projects', 'Dự án', 15], ['completeness', 'Độ đầy đủ hồ sơ', 10]];
const COUNTS: [string, string][] = [['projects', 'Dự án'], ['documents', 'Tài liệu'], ['services', 'Dịch vụ'], ['equipment', 'Thiết bị'], ['staff', 'Nhân sự'], ['posts', 'Bài viết'], ['listings', 'Tin đăng'], ['quotes', 'Báo giá đã gửi'], ['connections', 'Kết nối']];

type Company = {
  id: string; slug: string; name: string; legal_name: string | null; tax_code: string | null; phone: string | null; email: string | null;
  website: string | null; address: string | null; province_code: string | null; founded_year: number | null; size_range: string | null;
  intro: string | null; description: string | null; logo_url: string | null; status: string; verified_tier: string; trust_score: number | null;
  profile_completeness: number | null; owner_id: string | null; created_at: string; updated_at: string; deleted_at: string | null;
};
type Detail = {
  company: Company; category_ids: string[]; province_codes: string[];
  members: { user_id: string; name: string | null; email: string | null; role: string; status: string; created_at: string }[];
  verifications: { id: string; kind: string; status: string; reference: string | null; cert_class: string | null; evidence_url: string | null; meta: { admin_note?: string } | null; created_at: string }[];
  claims: { id: string; name: string | null; email: string | null; method: string; status: string; phone: string | null; note: string | null; created_at: string }[];
  registrations: { id: string; company_name: string; contact_name: string | null; contact_role: string | null; phone: string; email: string | null; source: string | null; status: string; created_at: string }[];
  reviews: { id: string; overall: number | null; comment: string | null; status: string; created_at: string; reviewer: string | null }[];
  reports: { id: string; entity_type: string | null; reason: string | null; status: string; created_at: string }[];
  trust: { score: number; breakdown: Record<string, number> } | null;
  trust_history: { score: number; created_at: string }[];
  counts: Record<string, number>;
  duplicates: { id: string; name: string; phone: string | null; tax_code: string | null; has_owner: boolean; status: string; same_phone: boolean | null; same_tax: boolean | null; similarity: number }[];
  /* chỉ quản trị viên trở lên */
  subscriptions?: { id: string; plan: string | null; status: string; started_at: string | null; expires_at: string | null }[];
  audit?: { id: string; action: string; actor: string | null; diff: Record<string, unknown> | null; created_at: string }[];
};

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const { supa, role } = await requireAdmin(`/admin/companies/${params.id}`);
  const isAdmin = hasRole(role, 'admin');
  const [{ data, error }, { data: cats }, { data: provs }, { data: plans }] = await Promise.all([
    supa.rpc('admin_company_detail', { _company: params.id }),
    supa.from('categories').select('id, name, group_key').order('sort_order'),
    supa.from('provinces').select('code, name').order('name'),
    supa.from('plans').select('id, name').order('price_month'),
  ]);
  if (error) throw new Error(error.message);
  const d = data as Detail | null;
  if (!d) notFound();
  const c = d.company;
  const categories = (cats ?? []) as { id: string; name: string; group_key: string }[];
  const provinces = (provs ?? []) as { code: string; name: string }[];
  const prov = (code: string | null) => provinces.find((p) => p.code === code)?.name ?? code;
  const planOpts = ((plans ?? []) as { id: string; name: string | null }[]).map((p) => ({ value: p.id, label: p.name ?? p.id }));
  const live = !c.deleted_at;
  const members = d.members.filter((m) => m.status !== 'removed');
  const owner = members.find((m) => m.user_id === c.owner_id);

  const info: [string, React.ReactNode][] = [
    ['Tên pháp lý', c.legal_name],
    ['Số điện thoại', c.phone],
    ['Mã số thuế', c.tax_code],
    ['Email', c.email],
    ['Website', c.website && <a href={/^https?:/i.test(c.website) ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer nofollow">{c.website}</a>],
    ['Địa chỉ', c.address],
    ['Tỉnh/thành trụ sở', prov(c.province_code)],
    ['Khu vực hoạt động', d.province_codes.map(prov).join(', ')],
    ['Lĩnh vực', categories.filter((x) => d.category_ids.includes(x.id)).map((x) => x.name).join(', ')],
    ['Năm thành lập', c.founded_year],
    ['Quy mô', c.size_range],
    ['Giới thiệu', c.intro],
    ['Mô tả', c.description && <span style={{ whiteSpace: 'pre-line' }}>{c.description}</span>],
    ['Tạo lúc', `${fmtDate(c.created_at, true)} · cập nhật ${fmtDate(c.updated_at, true)}`],
  ];

  return (
    <>
      {isAdmin && <Link href="/admin/companies" className="adm-back">← Danh sách doanh nghiệp</Link>}
      <div className="adm-h adm-co">
        <div className="who">
          <span className="a" style={{ background: colorFor(c.id) }}>{c.logo_url ? <img src={c.logo_url} alt="" /> : c.name.trim().slice(0, 1).toUpperCase()}</span>
          <div>
            <h1>{c.name}</h1>
            <p className="badges">
              {live ? <Status s={c.status} /> : <span className="bdg r">Đã gộp / xóa</span>}
              <span className={`bdg ${TIER[c.verified_tier]?.c ?? ''}`}>{TIER[c.verified_tier]?.l ?? c.verified_tier}</span>
              {c.owner_id ? <span className="bdg g">Đã có chủ</span> : <span className="bdg o">Chưa có chủ</span>}
            </p>
          </div>
        </div>
        <div className="acts">
          {live && c.status === 'published' && <a className="ab" href={`/cong-ty/${c.slug}`} target="_blank" rel="noopener noreferrer"><svg className="ic"><use href="#ic-eye" /></svg> Trang công khai</a>}
          {live && isAdmin && <CompanyActions company={c} plans={planOpts} />}
        </div>
      </div>

      {live && d.duplicates.length > 0 && (
        <div className="adm-warn">
          <b>Có {d.duplicates.length} hồ sơ nghi trùng</b>
          <ul>{d.duplicates.map((x) => (
            <li key={x.id}>
              <div>
                <Link href={`/admin/companies/${x.id}`}>{x.name}</Link>
                <small>{[x.same_phone && `trùng SĐT ${x.phone}`, x.same_tax && `trùng MST ${x.tax_code}`, x.similarity > 0.6 && `tên giống ${Math.round(x.similarity * 100)}%`, x.has_owner ? 'đã có chủ' : 'chưa có chủ'].filter(Boolean).join(' · ')}</small>
              </div>
              {isAdmin && (
                <Act label="Gộp vào hồ sơ này" icon="ic-layers" tone="d" fn="admin_merge_companies" args={{ _source: x.id, _target: c.id }}
                  confirm={{ title: `Gộp “${x.name}” vào “${c.name}”?`, message: `Thành viên, xác minh, dự án, tin đăng, đánh giá và gói của “${x.name}” chuyển sang “${c.name}”. Thông tin còn trống được lấy từ hồ sơ kia. “${x.name}” bị xóa khỏi sàn. Thao tác này không hoàn tác được từ giao diện.`, confirmLabel: 'Gộp hồ sơ' }} success="Đã gộp hồ sơ" />
              )}
            </li>
          ))}</ul>
        </div>
      )}

      <div className="adm-grid2">
        <div className="adm-stack">
          <Card title="Thông tin hồ sơ" extra={live && isAdmin && <EditCompany company={c} categories={categories} provinces={provinces} categoryIds={d.category_ids} provinceCodes={d.province_codes} />}>
            <dl className="adm-dl">{info.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || <span className="muted">Chưa có</span>}</dd></div>)}</dl>
          </Card>

          <Card title="Xác minh pháp lý">
            {d.verifications.length === 0 ? <None>Chưa gửi giấy tờ xác minh nào.</None> : (
              <div className="adm-tw"><table className="adm-t">
                <thead><tr><th>Loại</th><th>Thông tin khai</th><th>Trạng thái</th><th /></tr></thead>
                <tbody>{d.verifications.map((v) => {
                  const ev = v.evidence_url;
                  const external = ev && /^https?:/.test(ev) && !ev.includes('/verification-docs/');
                  return (
                    <tr key={v.id}>
                      <td>{VERIFY_KIND[v.kind] ?? v.kind}<br /><small className="muted">{fmtDate(v.created_at)}</small></td>
                      <td>{v.reference ?? '—'}{v.cert_class && <small className="muted"> · hạng {v.cert_class}</small>}{v.meta?.admin_note && <><br /><small className="muted">Ghi chú: {v.meta.admin_note}</small></>}</td>
                      <td><Status s={v.status} /></td>
                      <td><div className="acts">
                        {ev && (external ? <a className="ab" href={ev} target="_blank" rel="noopener noreferrer">Mở liên kết</a> : <SignedLink bucket="verification-docs" path={ev} />)}
                        {live && v.status === 'pending' && (<>
                          <Act label="Từ chối" tone="d" fn="admin_review_verification" args={{ _id: v.id, _approve: false }} fieldArgs={{ note: '_note' }}
                            confirm={{ title: 'Từ chối xác minh', message: 'Lý do được gửi cho doanh nghiệp qua thông báo.', confirmLabel: 'Từ chối', fields: [{ key: 'note', label: 'Lý do', type: 'textarea', required: true, suggestions: REJECT_REASONS.verification }] }} success="Đã từ chối yêu cầu" />
                          <Act label="Duyệt" icon="ic-check" tone="p" fn="admin_review_verification" args={{ _id: v.id, _approve: true }}
                            confirm={{ title: 'Duyệt xác minh?', message: 'Hạng xác minh và Trust Score được cập nhật ngay.', confirmLabel: 'Duyệt' }} success="Đã duyệt xác minh" />
                        </>)}
                      </div></td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            )}
          </Card>

          <Card title="Thành viên" extra={live && isAdmin && (
            <div className="adm-hd-acts">
              <Act label={owner ? 'Đổi chủ sở hữu' : 'Gán chủ sở hữu'} icon="ic-shield-check" fn="admin_set_company_owner" args={{ _company: c.id }} fieldArgs={{ email: '_email', keep: '_keep_previous' }}
                confirm={{ title: owner ? 'Đổi chủ sở hữu' : 'Gán chủ sở hữu', message: 'Người nhận phải đã đăng nhập sàn ít nhất một lần. Yêu cầu claim đang chờ của người khác sẽ bị từ chối.', confirmLabel: 'Lưu', fields: [
                  { key: 'email', label: 'Email tài khoản chủ mới', required: true, placeholder: 'ten@gmail.com' },
                  { key: 'keep', label: 'Chủ cũ (nếu có)', type: 'select', defaultValue: 'false', options: [{ value: 'false', label: 'Gỡ khỏi công ty' }, { value: 'true', label: 'Giữ lại làm quản trị công ty' }] },
                ] }} success="Đã cập nhật chủ sở hữu" />
              {c.owner_id && <Act label="Gỡ chủ" tone="d" fn="admin_set_company_owner" args={{ _company: c.id, _email: null }}
                confirm={{ title: 'Gỡ chủ sở hữu?', message: 'Hồ sơ trở về trạng thái chưa có chủ và người này bị gỡ khỏi công ty.', confirmLabel: 'Gỡ chủ' }} success="Đã gỡ chủ sở hữu" />}
            </div>
          )}>
            {members.length === 0 ? <None>Chưa có thành viên — hồ sơ đang chờ chủ doanh nghiệp nhận.</None> : (
              <div className="adm-tw"><table className="adm-t">
                <tbody>{members.map((m) => (
                  <tr key={m.user_id}>
                    <td><Who name={m.name || m.email || 'Chưa đặt tên'} sub={m.email} color={colorFor(m.user_id)} href={isAdmin ? `/admin/users/${m.user_id}` : undefined} /></td>
                    <td><span className={`bdg ${m.role === 'owner' ? 'o' : ''}`}>{MEMBER_ROLE[m.role] ?? m.role}</span>{m.status === 'invited' && <small className="muted"> đang mời</small>}</td>
                    <td><div className="acts">{live && isAdmin && m.user_id !== c.owner_id && (
                      <Act label="Gỡ" tone="d" fn="admin_remove_member" args={{ _company: c.id, _user: m.user_id }} confirm={{ title: 'Gỡ thành viên?', message: `${m.name || m.email || 'Người này'} sẽ không còn quyền với hồ sơ.`, confirmLabel: 'Gỡ' }} success="Đã gỡ thành viên" />
                    )}</div></td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </Card>

          {d.reviews.length > 0 && (
            <Card title="Đánh giá nhận được">
              <div className="adm-tw"><table className="adm-t">
                <tbody>{d.reviews.map((r) => (
                  <tr key={r.id}>
                    <td className="num" style={{ width: 70 }}><b>{r.overall ?? '—'}</b> ★</td>
                    <td><b style={{ color: 'var(--navy)' }}>{r.reviewer ?? '—'}</b> <small className="muted">{fmtDate(r.created_at)}</small><div>{r.comment || <span className="muted">Không lời bình</span>}</div></td>
                    <td><Status s={r.status} /></td>
                    <td><div className="acts">{live && (r.status === 'hidden'
                      ? <Act label="Khôi phục" fn="admin_moderate" args={{ _entity: 'review', _id: r.id, _hide: false }} success="Đã khôi phục" />
                      : <Act label="Ẩn" tone="d" fn="admin_moderate" args={{ _entity: 'review', _id: r.id, _hide: true }} fieldArgs={{ reason: '_reason' }} confirm={{ title: 'Ẩn đánh giá?', confirmLabel: 'Ẩn', fields: [{ key: 'reason', label: 'Lý do', type: 'textarea', required: true }] }} success="Đã ẩn đánh giá" />)}</div></td>
                  </tr>
                ))}</tbody>
              </table></div>
            </Card>
          )}

          {d.audit && (
            <Card title="Nhật ký của hồ sơ">
              {d.audit.length === 0 ? <None>Chưa có hoạt động nào.</None> : (
                <ul className="adm-log">{d.audit.map((a) => {
                  const diff = a.diff ? Object.entries(a.diff).filter(([, v]) => v !== null && v !== '').map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ') : '';
                  return (
                    <li key={a.id}>
                      <span className="grow"><b style={{ color: 'var(--navy)' }}>{AUDIT_LABEL[a.action] ?? a.action}</b><br /><small>{a.actor ?? 'Hệ thống'}</small>{diff && <span className="diff" title={diff}>{diff}</span>}</span>
                      <small>{fmtDate(a.created_at, true)}</small>
                    </li>
                  );
                })}</ul>
              )}
            </Card>
          )}
        </div>

        <div className="adm-stack">
          <Card title="Trust Score" extra={<b className="adm-score">{Math.round(c.trust_score ?? 0)}</b>}>
            <div className="bd">
              {TRUST.map(([k, label, max]) => {
                const v = Number(d.trust?.breakdown?.[k] ?? 0);
                return <div key={k} className="adm-meter"><span>{label}<b>{v}/{max}</b></span><i><em style={{ width: `${Math.min(100, (v / max) * 100)}%` }} /></i></div>;
              })}
              <div className="adm-meter"><span>Hồ sơ đã điền<b>{c.profile_completeness ?? 0}%</b></span></div>
              {d.trust_history.length > 1 && <p className="muted">Gần đây: {[...d.trust_history].reverse().map((h) => Math.round(h.score)).join(' → ')}</p>}
            </div>
          </Card>

          <Card title="Nội dung">
            <div className="adm-counts">{COUNTS.map(([k, label]) => <div key={k}><b>{d.counts[k] ?? 0}</b><small>{label}</small></div>)}</div>
          </Card>

          {d.subscriptions && (
            <Card title="Gói dịch vụ">
              {d.subscriptions.length === 0 ? <None>Đang dùng gói miễn phí.</None> : (
                <ul className="adm-log">{d.subscriptions.map((s) => (
                  <li key={s.id}>
                    <span><b style={{ color: 'var(--navy)' }}>{s.plan}</b><br /><small>{fmtDate(s.started_at)} → {fmtDate(s.expires_at)}</small></span>
                    <span className="adm-hd-acts"><Status s={s.status} />{s.status === 'active' && <Act label="Hủy" tone="d" fn="admin_cancel_subscription" args={{ _id: s.id }} confirm={{ title: 'Hủy thuê bao?', message: 'Doanh nghiệp mất quyền lợi của gói ngay lập tức.', confirmLabel: 'Hủy gói' }} success="Đã hủy gói" />}</span>
                  </li>
                ))}</ul>
              )}
            </Card>
          )}

          {d.claims.length > 0 && (
            <Card title="Yêu cầu nhận hồ sơ">
              <ul className="adm-log">{d.claims.map((x) => (
                <li key={x.id}>
                  <span><b style={{ color: 'var(--navy)' }}>{x.name || x.email || 'Chưa đặt tên'}</b><br /><small>{[x.email, x.phone, METHOD[x.method] ?? x.method].filter(Boolean).join(' · ')}</small>{x.note && <><br /><small>“{x.note}”</small></>}</span>
                  <span className="adm-hd-acts">
                    <Status s={x.status} />
                    {live && x.status === 'pending' && (<>
                      <Act label="Từ chối" tone="d" fn="admin_review_claim" args={{ _claim: x.id, _approve: false }} fieldArgs={{ note: '_note' }} confirm={{ title: 'Từ chối yêu cầu?', message: 'Lý do được gửi cho người yêu cầu qua thông báo.', confirmLabel: 'Từ chối', fields: [{ key: 'note', label: 'Lý do', type: 'textarea', required: true, suggestions: REJECT_REASONS.claim }] }} success="Đã từ chối" />
                      <Act label="Duyệt" tone="p" fn="admin_review_claim" args={{ _claim: x.id, _approve: true }} confirm={{ title: 'Duyệt yêu cầu?', message: 'Người này trở thành chủ sở hữu hồ sơ.', confirmLabel: 'Duyệt' }} success="Đã cấp quyền quản lý" />
                    </>)}
                  </span>
                </li>
              ))}</ul>
            </Card>
          )}

          {d.registrations.length > 0 && (
            <Card title="Nguồn đăng ký">
              <ul className="adm-log">{d.registrations.map((g) => (
                <li key={g.id}>
                  <span><b style={{ color: 'var(--navy)' }}>{g.contact_name || g.company_name}</b>{g.contact_role && <small> · {g.contact_role}</small>}<br /><small>{[g.phone, g.email].filter(Boolean).join(' · ')}</small></span>
                  <span style={{ textAlign: 'right' }}><Status s={g.status} /><br /><small>{fmtDate(g.created_at)}</small></span>
                </li>
              ))}</ul>
            </Card>
          )}

          {d.reports.length > 0 && (
            <Card title="Báo cáo vi phạm" extra={<Link href="/admin/moderation" className="adm-more">Xử lý</Link>}>
              <ul className="adm-log">{d.reports.map((r) => (
                <li key={r.id}><span>{r.reason ?? 'Không nêu lý do'}<br /><small>{fmtDate(r.created_at, true)}</small></span><Status s={r.status} /></li>
              ))}</ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
