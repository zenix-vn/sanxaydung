import type { Metadata } from 'next';
import { getPlans } from '@/lib/plans-server';
import { limitText, shortVnd, yearlyPrice, type Plan } from '@/lib/plans';

export const metadata: Metadata = { title: 'Bảng giá gói thành viên' };

export const dynamic = 'force-dynamic';

const LOOK: Record<string, { icon: string; bg: string; fg: string }> = {
  free: { icon: 'ic-building', bg: '#eef2f6', fg: 'var(--muted)' },
  professional: { icon: 'ic-trending', bg: 'var(--orange-soft)', fg: 'var(--orange)' },
  enterprise: { icon: 'ic-award', bg: 'var(--blue-soft)', fg: 'var(--blue)' },
};

function PlanCard({ plan: p, yearly }: { plan: Plan; yearly: boolean }) {
  const look = LOOK[p.id] ?? LOOK.free;
  const pop = p.id === 'professional';
  const paid = p.price_month > 0 && !p.features.contact;
  const checkout = `/pricing/checkout?plan=${p.id}&billing=${yearly ? 'year' : 'month'}`;
  return (
    <div className={`plan${pop ? ' pop' : ''}`}>
      {pop && <div className="tagpop">Phổ biến nhất</div>}
      <div className="pico" style={{ background: look.bg, color: look.fg }}><svg className="ic"><use href={`#${look.icon}`} /></svg></div>
      <div className="pname">{p.name}</div>
      {p.features.contact ? <div className="price">Liên hệ</div>
        : !paid ? <div className="price">0₫ <small>/tháng</small></div>
        : <div className="price">{shortVnd(yearly ? yearlyPrice(p.price_month) / 12 : p.price_month)} <small>/tháng{yearly ? ` · ${shortVnd(yearlyPrice(p.price_month))}/năm` : ''}</small></div>}
      <p className="pdesc">{p.features.desc}</p>
      <ul>
        {(p.features.bullets ?? []).map((b) => <li key={b}><svg className="ic"><use href="#ic-check" /></svg> {b.startsWith('Toàn bộ') ? <b>{b}</b> : b}</li>)}
        {(p.features.excluded ?? []).map((b) => <li key={b} className="off"><svg className="ic"><use href="#ic-x" /></svg> {b}</li>)}
      </ul>
      {p.features.contact ? <a className="btn btn-navy btn-block" href={checkout}>Liên hệ tư vấn</a>
        : paid ? <a className={`btn ${pop ? 'btn-orange' : 'btn-navy'} btn-block`} href={checkout}>Chọn {p.name}</a>
        : <a className="btn btn-outline btn-block" href="/login#register">Bắt đầu miễn phí</a>}
    </div>
  );
}

export default async function PricingPage({ searchParams }: { searchParams: { billing?: string } }) {
  const plans = await getPlans();
  const limit = (id: string, k: 'listings' | 'members') => limitText(plans.find((p) => p.id === id)?.features[k]);
  const yearly = searchParams.billing === 'year';
  const q = (plan: string) => `/pricing/checkout?plan=${plan}&billing=${yearly ? 'year' : 'month'}`;
  return (
    <>
      <style>{`
        .price-hero{background:linear-gradient(150deg,#021e48,#062a5a);color:#fff;padding:48px 0 70px;text-align:center}
        .price-hero .eyebrow{color:var(--orange-2);font-weight:700;font-size:13px;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px}
        .price-hero h1{font-size:clamp(26px,4vw,38px);font-weight:800;margin-bottom:12px}
        .price-hero p{color:#c6d3e2;max-width:560px;margin:0 auto}
        .toggle{display:inline-flex;background:rgba(255,255,255,.08);border-radius:30px;padding:5px;margin-top:20px}
        .toggle a{padding:9px 20px;border-radius:24px;font-size:13.5px;font-weight:600;color:#c6d3e2;cursor:pointer}
        .toggle a.active{background:#fff;color:var(--navy)}
        .toggle .save{font-size:11px;color:var(--green);font-weight:700;margin-left:4px}
        .plans{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:-40px}
        .plan{background:#fff;border:1px solid var(--line);border-radius:18px;padding:28px 24px;box-shadow:var(--shadow-sm);position:relative;display:flex;flex-direction:column}
        .plan.pop{border:2px solid var(--orange);box-shadow:var(--shadow);transform:scale(1.02)}
        .plan .tagpop{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:var(--orange);color:#fff;font-size:12px;font-weight:700;padding:5px 16px;border-radius:20px}
        .plan .pname{font-size:14px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px}
        .plan .pico{width:48px;height:48px;border-radius:13px;display:grid;place-items:center;margin-bottom:14px}
        .plan .price{font-size:36px;font-weight:800;color:var(--navy);margin:14px 0 2px;line-height:1}
        .plan .price small{font-size:14px;font-weight:500;color:var(--muted)}
        .plan .pdesc{font-size:13px;color:var(--muted);margin:8px 0 18px;min-height:38px}
        .plan ul{list-style:none;margin-bottom:22px;flex:1}
        .plan li{font-size:13.5px;color:var(--text);display:flex;align-items:flex-start;gap:9px;padding:7px 0}
        .plan li svg{width:16px;height:16px;color:var(--green);flex:none;margin-top:2px}
        .plan li.off{color:var(--muted)}
        .plan li.off svg{color:var(--line)}
        .addon{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:6px}
        .addon .a{background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px;box-shadow:var(--shadow-sm)}
        .addon .a .ic-b{width:44px;height:44px;border-radius:11px;background:var(--orange-soft);color:var(--orange);display:grid;place-items:center;margin-bottom:12px}
        .addon .a h3{font-size:15px;font-weight:700;color:var(--navy)}
        .addon .a p{font-size:13px;color:var(--muted);margin:6px 0 10px}
        .addon .a b{color:var(--navy);font-size:15px}
        .section-title{font-size:22px;font-weight:800;color:var(--navy)}
        .cmp{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;margin-top:26px}
        .cmp th,.cmp td{padding:14px 18px;text-align:center;font-size:13.5px;border-bottom:1px solid var(--line-2)}
        .cmp th{background:#fafbfc;font-weight:700;color:var(--navy)}
        .cmp td:first-child,.cmp th:first-child{text-align:left;color:var(--text)}
        .cmp td svg{width:17px;height:17px;color:var(--green)}
        .faq{max-width:760px;margin:0 auto}
        .faq details{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin-bottom:12px}
        .faq summary{font-size:14.5px;font-weight:700;color:var(--navy);cursor:pointer;list-style:none;display:flex;justify-content:space-between}
        .faq summary::-webkit-details-marker{display:none}
        .faq p{font-size:13.5px;color:var(--muted);margin-top:10px;line-height:1.6}
        @media(max-width:900px){.plans{grid-template-columns:1fr}.plan.pop{transform:none}.addon{grid-template-columns:1fr}}
      `}</style>

      <section className="price-hero">
        <div className="container">
          <div className="eyebrow">Gói thành viên</div>
          <h1>Chọn gói phù hợp với doanh nghiệp</h1>
          <p>Bắt đầu miễn phí, nâng cấp khi cần hồ sơ nổi bật, analytics và công cụ tăng trưởng. Không ràng buộc — hủy bất cứ lúc nào.</p>
          <div className="toggle">
            <a href="/pricing" className={yearly ? '' : 'active'}>Theo tháng</a>
            <a href="/pricing?billing=year" className={yearly ? 'active' : ''}>Theo năm <span className="save">−20%</span></a>
          </div>
        </div>
      </section>

      <section className="block" style={{ paddingTop: 0 }}>
        <div className="container">
          {plans.length === 0
            ? <div className="card-block" style={{ marginTop: 20, textAlign: 'center' }}>Chưa tải được bảng giá. Vui lòng thử lại sau ít phút.</div>
            : <div className="plans">{plans.map((p) => <PlanCard key={p.id} plan={p} yearly={yearly} />)}</div>}

          {/* Add-ons */}
          <h2 className="section-title" style={{ margin: '44px 0 4px' }}>Dịch vụ mua thêm</h2>
          <p className="muted mb-16">Tạo doanh thu ngay từ MVP — không cần chờ đủ quy mô.</p>
          <div className="addon">
            <div className="a">
              <div className="ic-b"><svg className="ic"><use href="#ic-shield-check" /></svg></div>
              <h3>Gói Verified năng lực</h3>
              <p>Xác minh chứng chỉ năng lực + huy hiệu, ưu tiên duyệt nhanh.</p>
              <b>Từ 500K</b> <span className="muted">/lần</span>
              <div className="mt-8"><a className="btn btn-outline btn-sm" href={q('verified')}>Mua gói</a></div>
            </div>
            <div className="a">
              <div className="ic-b"><svg className="ic"><use href="#ic-star-f" /></svg></div>
              <h3>Tin đăng ưu tiên</h3>
              <p>Ghim đầu danh sách Marketplace, gắn nhãn &ldquo;Nổi bật&rdquo; 7 ngày.</p>
              <b>Từ 200K</b> <span className="muted">/tin</span>
              <div className="mt-8"><a className="btn btn-outline btn-sm" href={q('featured-listing')}>Mua gói</a></div>
            </div>
            <div className="a">
              <div className="ic-b"><svg className="ic"><use href="#ic-layers" /></svg></div>
              <h3>Banner &amp; gian hàng tài trợ</h3>
              <p>Hiển thị banner trang chủ / top danh mục theo lượt hiển thị.</p>
              <b>Liên hệ</b>
              <div className="mt-8"><a className="btn btn-outline btn-sm" href={q('banner')}>Liên hệ</a></div>
            </div>
          </div>

          {/* Compare */}
          <h2 className="section-title" style={{ margin: '44px 0 0' }}>So sánh chi tiết</h2>
          <table className="cmp">
            <thead>
              <tr>
                <th>Tính năng</th>
                <th>Free</th>
                <th>Professional</th>
                <th>Enterprise</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Company Page &amp; hồ sơ năng lực</td><td><svg className="ic"><use href="#ic-check" /></svg></td><td><svg className="ic"><use href="#ic-check" /></svg></td><td><svg className="ic"><use href="#ic-check" /></svg></td></tr>
              <tr><td>Tin đăng nhu cầu / tháng</td><td>{limit('free', 'listings')}</td><td>{limit('professional', 'listings')}</td><td>{limit('enterprise', 'listings')}</td></tr>
              <tr><td>Hồ sơ &amp; tin nổi bật</td><td>—</td><td><svg className="ic"><use href="#ic-check" /></svg></td><td><svg className="ic"><use href="#ic-check" /></svg></td></tr>
              <tr><td>Analytics doanh nghiệp</td><td>Cơ bản</td><td>Nâng cao</td><td>Nâng cao + benchmark</td></tr>
              <tr><td>Số thành viên</td><td>{limit('free', 'members')}</td><td>{limit('professional', 'members')}</td><td>{limit('enterprise', 'members')}</td></tr>
              <tr><td>Báo cáo thị trường</td><td>—</td><td>—</td><td><svg className="ic"><use href="#ic-check" /></svg></td></tr>
              <tr><td>API tích hợp</td><td>—</td><td>—</td><td><svg className="ic"><use href="#ic-check" /></svg></td></tr>
              <tr><td>Hỗ trợ</td><td>Email</td><td>Ưu tiên</td><td>Account manager</td></tr>
            </tbody>
          </table>

          {/* FAQ */}
          <h2 className="section-title" style={{ margin: '44px 0 18px', textAlign: 'center' }}>Câu hỏi thường gặp</h2>
          <div className="faq">
            <details open>
              <summary>Tôi có thể dùng miễn phí mãi không? <svg className="ic"><use href="#ic-chevron-down" /></svg></summary>
              <p>Có. Gói Free đầy đủ để tạo hồ sơ, xác minh pháp lý, đăng tin và nhận báo giá. Bạn chỉ nâng cấp khi cần nổi bật hơn hoặc dùng analytics nâng cao.</p>
            </details>
            <details>
              <summary>Xác minh doanh nghiệp có tính phí không? <svg className="ic"><use href="#ic-chevron-down" /></svg></summary>
              <p>Xác minh pháp lý (MST/GPKD) miễn phí ở mọi gói. Xác minh năng lực (chứng chỉ hạng I/II/III) là dịch vụ mua thêm với phí duyệt hồ sơ.</p>
            </details>
            <details>
              <summary>Thanh toán theo năm tiết kiệm bao nhiêu? <svg className="ic"><use href="#ic-chevron-down" /></svg></summary>
              <p>Thanh toán theo năm được giảm 20% so với theo tháng, áp dụng cho gói Professional.</p>
            </details>
            <details>
              <summary>Dữ liệu của tôi được bảo vệ thế nào? <svg className="ic"><use href="#ic-chevron-down" /></svg></summary>
              <p>Nền tảng tuân thủ Nghị định 13/2023/NĐ-CP: thu thập có đồng ý, quyền truy cập/chỉnh sửa/xóa dữ liệu và nhật ký truy cập cho các hành động nhạy cảm.</p>
            </details>
          </div>

          <div className="pill-note mt-24" style={{ maxWidth: 760, marginLeft: 'auto', marginRight: 'auto' }}>
            <svg className="ic"><use href="#ic-gift" /></svg>
            <span>
              <b>Ưu đãi cold-start:</b> 500 doanh nghiệp đầu tiên claim hồ sơ được tặng 3 tháng Professional.{' '}
              <a href="/login#register" style={{ color: 'var(--orange)', fontWeight: 600 }}>Đăng ký ngay →</a>
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
