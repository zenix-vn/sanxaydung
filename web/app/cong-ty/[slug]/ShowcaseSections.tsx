import {
  AWARD_KINDS, PARTNER_KINDS, safeHttpUrl, type About, type Award, type Branch, type Faq, type Milestone, type Partner,
} from '@/lib/profile';
import BranchMap from './BranchMap';
import { LISTING_TYPE_LABEL, POST_TYPES, fmtDate, fmtRange } from '@/lib/format';
import { initials, thumb, timeAgo } from '@/lib/ui';
import { plainText } from '@/lib/richtext';

export type CoPost = { id: string; type: string; title: string | null; body: string | null; like_count: number | null; comment_count: number | null; created_at: string };
export type CoListing = { id: string; type: string; title: string; budget_from: number | null; budget_to: number | null; deadline: string | null; created_at: string };

export function AboutBlocks({ about }: { about: About }) {
  return (
    <>
      {(about.vision || about.mission) && (
        <div className="co-vm">
          {about.vision && <div><h3><svg className="ic"><use href="#ic-eye" /></svg> Tầm nhìn</h3><p>{about.vision}</p></div>}
          {about.mission && <div><h3><svg className="ic"><use href="#ic-trending" /></svg> Sứ mệnh</h3><p>{about.mission}</p></div>}
        </div>
      )}
      {about.values && (
        <>
          <h3 className="co-sub">Giá trị cốt lõi</h3>
          <ul className="co-values">
            {about.values.map((v, i) => <li key={i}><svg className="ic"><use href="#ic-check" /></svg> {v}</li>)}
          </ul>
        </>
      )}
    </>
  );
}

export function PartnersSection({ items, selfId }: { items: Partner[]; selfId: string }) {
  return (
    <div className="card-block" id="doitac">
      <h2>Khách hàng &amp; đối tác</h2>
      <p className="muted co-note">Do doanh nghiệp tự giới thiệu.</p>
      {(['client', 'partner'] as const).map((kind) => {
        const list = items.filter((p) => p.kind === kind);
        if (!list.length) return null;
        return (
          <div key={kind}>
            <h3 className="co-sub">{PARTNER_KINDS[kind]}</h3>
            <div className="co-partners">
              {list.map((p) => {
                // Chỉ dẫn link nội bộ khi hồ sơ được liên kết đang công khai
                const linked = p.linked && p.linked.status === 'published' && p.linked_company_id !== selfId ? p.linked : null;
                const logo = safeHttpUrl(p.logo_url) ?? safeHttpUrl(linked?.logo_url);
                const href = linked ? `/cong-ty/${linked.slug}` : safeHttpUrl(p.website);
                const body = (
                  <>
                    <span className="lg">{logo ? <img src={thumb(logo, 200)} alt="" loading="lazy" /> : initials(p.name)}</span>
                    <span className="nm">{p.name}</span>
                    {linked && <small>Xem hồ sơ trên sàn</small>}
                  </>
                );
                return href ? (
                  <a key={p.id} href={href} {...(linked ? {} : { target: '_blank', rel: 'nofollow ugc noopener noreferrer' })}>{body}</a>
                ) : (
                  <div key={p.id}>{body}</div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AwardsSection({ items }: { items: Award[] }) {
  return (
    <div className="card-block" id="giaithuong">
      <h2>Giải thưởng &amp; chứng nhận</h2>
      <p className="co-note"><span className="badge gray">Doanh nghiệp tự công bố · Sàn Xây Dựng chưa xác minh</span></p>
      <div className="co-awards">
        {items.map((a) => {
          const img = safeHttpUrl(a.image_url);
          return (
            <div key={a.id}>
              {img ? (
                <a className="im" href={img} target="_blank" rel="noopener noreferrer" aria-label={`Xem ảnh ${a.title}`}><img src={img} alt={a.title} loading="lazy" /></a>
              ) : (
                <span className="im"><svg className="ic"><use href="#ic-award" /></svg></span>
              )}
              <h4>{a.title}</h4>
              <small>{[AWARD_KINDS[a.kind], a.issuer, a.year].filter(Boolean).join(' · ')}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const POST_PREVIEW = 5;

export function PostsSection({ items, showAll }: { items: CoPost[]; showAll: boolean }) {
  return (
    <div className="card-block" id="baidang">
      <h2>Bài đăng</h2>
      {(showAll ? items : items.slice(0, POST_PREVIEW)).map((p) => {
        const type = POST_TYPES[p.type] ?? POST_TYPES.news;
        const text = plainText(p.body ?? '');
        return (
          <a className="co-row" key={p.id} href={`/feed/${p.id}`}>
            <span className={`badge ${type.cls}`}>{type.label}</span>
            <h4>{p.title || text.slice(0, 90) || 'Bài đăng'}</h4>
            {p.title && text && <p>{text.length > 160 ? `${text.slice(0, 160)}…` : text}</p>}
            <small>{timeAgo(p.created_at)} · {p.like_count ?? 0} thích · {p.comment_count ?? 0} bình luận</small>
          </a>
        );
      })}
      {items.length > POST_PREVIEW && !showAll && (
        <a className="btn btn-outline btn-block mt-16" href="?all=1#baidang">Xem thêm bài đăng</a>
      )}
    </div>
  );
}

export function ListingsSection({ items }: { items: CoListing[] }) {
  return (
    <div className="card-block" id="tindang">
      <h2>Tin đang đăng</h2>
      {items.map((l) => (
        <a className="co-row" key={l.id} href={`/marketplace/${l.id}`}>
          <span className="badge">{LISTING_TYPE_LABEL[l.type] ?? l.type}</span>
          <h4>{l.title}</h4>
          <small>
            {[fmtRange(l.budget_from, l.budget_to) ?? 'Thương lượng', l.deadline ? `Hạn ${fmtDate(l.deadline)}` : null, `Đăng ${timeAgo(l.created_at).toLowerCase()}`].filter(Boolean).join(' · ')}
          </small>
        </a>
      ))}
    </div>
  );
}

export function MilestonesSection({ items }: { items: Milestone[] }) {
  return (
    <div className="card-block" id="moc">
      <h2>Mốc phát triển</h2>
      <ol className="co-timeline">
        {[...items].sort((a, b) => a.year - b.year).map((m) => {
          const img = safeHttpUrl(m.image_url);
          return (
            <li key={m.id}>
              <span className="yr">{m.year}</span>
              <div>
                <h4>{m.title}</h4>
                {m.description && <p>{m.description}</p>}
                {img && <a href={img} target="_blank" rel="noopener noreferrer"><img src={img} alt={m.title} loading="lazy" /></a>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function BranchesSection({ items, provinces }: { items: Branch[]; provinces: Map<string, string> }) {
  const pins = items.filter((b) => b.lat != null && b.lng != null).map((b) => ({ name: b.name, lat: Number(b.lat), lng: Number(b.lng) }));
  return (
    <div className="card-block" id="chinhanh">
      <h2>Chi nhánh &amp; văn phòng</h2>
      <div className="co-branches">
        {items.map((b) => {
          const province = b.province_code ? provinces.get(b.province_code) : null;
          const where = [b.address, province].filter(Boolean).join(', ');
          const query = b.lat != null && b.lng != null ? `${b.lat},${b.lng}` : where;
          const tel = b.phone?.replace(/[^\d+]/g, '');
          return (
            <div key={b.id}>
              <h4>{b.name}</h4>
              {where && <p><svg className="ic"><use href="#ic-pin" /></svg> {where}</p>}
              {b.phone && <p><svg className="ic"><use href="#ic-phone" /></svg> {tel ? <a href={`tel:${tel}`}>{b.phone}</a> : b.phone}</p>}
              {query && <a className="dir" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`} target="_blank" rel="nofollow noopener noreferrer">Chỉ đường →</a>}
            </div>
          );
        })}
      </div>
      {pins.length > 0 && <BranchMap pins={pins} />}
    </div>
  );
}

export function FaqSection({ items }: { items: Faq[] }) {
  return (
    <div className="card-block" id="faq">
      <h2>Câu hỏi thường gặp</h2>
      {items.map((f) => (
        <details className="co-faq" key={f.id}>
          <summary>{f.question}</summary>
          <p>{f.answer}</p>
        </details>
      ))}
    </div>
  );
}
