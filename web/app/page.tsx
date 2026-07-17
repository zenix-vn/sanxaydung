import { createSupabaseServer } from '@/lib/supabase/server';
import { SUPABASE_URL } from '@/lib/env';
import CompanyCard from '@/components/CompanyCard';

export const dynamic = 'force-dynamic';

const CATEGORIES = [
  { icon: 'ic-building', name: 'Nhà thầu xây dựng', href: '/directory?group=contractor' },
  { icon: 'ic-worker', name: 'Đội thi công', href: '/directory?group=crew' },
  { icon: 'ic-water', name: 'Điện nước', href: '/directory?q=điện nước' },
  { icon: 'ic-paint', name: 'Sơn - Hoàn thiện', href: '/directory?q=sơn' },
  { icon: 'ic-gear', name: 'Cơ khí - Kết cấu', href: '/directory?q=kết cấu' },
  { icon: 'ic-bricks', name: 'Vật liệu xây dựng', href: '/directory?group=supplier' },
  { icon: 'ic-ruler', name: 'Thiết kế - Kiến trúc', href: '/directory?q=thiết kế' },
  { icon: 'ic-grid', name: 'Dịch vụ khác', href: '/directory?group=service' },
];

async function getTopCompanies() {
  if (!SUPABASE_URL) return [];
  try {
    const supa = createSupabaseServer();
    const { data } = await supa
      .from('companies')
      .select('*, company_categories ( categories (name) ), company_locations ( provinces (name) )')
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('trust_score', { ascending: false })
      .limit(4);
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const companies = await getTopCompanies();

  return (
    <main>
      {/* ===== HERO ===== */}
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <div className="eyebrow">Nền tảng kết nối</div>
            <h1>
              HỆ SINH THÁI<br />
              <span className="hl">XÂY DỰNG</span> TOÀN DIỆN
            </h1>
            <p className="lead">
              Kết nối nhà thầu, đội thi công, nhà cung cấp và chủ đầu tư nhanh chóng — uy tín — hiệu quả trên một
              nền tảng duy nhất.
            </p>
            <div className="hero-cta">
              <a className="btn btn-orange" href="/directory">
                <svg className="ic" style={{ width: 18, height: 18 }}><use href="#ic-search" /></svg> Tìm nhà thầu / Đội thi công
              </a>
              <a className="btn btn-ghost" href="/marketplace">
                <svg className="ic" style={{ width: 18, height: 18 }}><use href="#ic-plus" /></svg> Đăng nhu cầu tìm đối tác
              </a>
            </div>

            <form className="searchbar" action="/directory">
              <div className="field">
                <select defaultValue="" name="type">
                  <option value="">Chọn loại nhu cầu</option>
                  <option>Tìm nhà thầu</option>
                  <option>Tìm nhà cung cấp</option>
                </select>
              </div>
              <div className="field">
                <select defaultValue="" name="_province_label">
                  <option value="">Chọn tỉnh / thành</option>
                  <option>Hà Nội</option>
                  <option>TP. Hồ Chí Minh</option>
                  <option>Đà Nẵng</option>
                </select>
              </div>
              <div className="field">
                <select defaultValue="" name="_field_label">
                  <option value="">Chọn lĩnh vực</option>
                  <option>Xây dựng dân dụng</option>
                  <option>Điện nước</option>
                  <option>Kết cấu</option>
                </select>
              </div>
              <div className="field input">
                <input type="text" name="q" placeholder="Nhập từ khóa: vd. xây trọn gói, điện nước..." />
              </div>
              <button className="btn btn-orange" style={{ justifyContent: 'center' }} type="submit">
                Tìm kiếm
              </button>
            </form>

            <div className="tags">
              <span>Tìm kiếm nhiều:</span>
              <a href="/directory?q=nhà thầu xây dựng">Nhà thầu xây dựng</a>
              <a href="/directory?q=điện nước">Điện nước</a>
              <a href="/directory?q=sơn">Sơn</a>
              <a href="/directory?q=nhôm kính">Nhôm kính</a>
              <a href="/directory?q=thiết kế kiến trúc">Thiết kế kiến trúc</a>
              <a href="/directory?q=vật liệu xây dựng">Vật liệu xây dựng</a>
            </div>
          </div>

          <div className="hero-stats">
            <div className="hstat">
              <div className="ico"><svg className="ic fill" style={{ color: '#f7941d' }}><use href="#ic-building-f" /></svg></div>
              <div>
                <div className="lbl">Doanh nghiệp uy tín</div>
                <div className="num">8.945+</div>
                <div className="sub">Đã xác minh <span className="check"><svg className="ic"><use href="#ic-check" /></svg></span></div>
              </div>
            </div>
            <div className="hstat">
              <div className="ico"><svg className="ic fill" style={{ color: '#3f8fd6' }}><use href="#ic-clipboard-f" /></svg></div>
              <div>
                <div className="lbl">Dự án đã hoàn thành</div>
                <div className="num">12.458+</div>
                <div className="sub">Trên toàn quốc</div>
              </div>
            </div>
            <div className="hstat">
              <div className="ico"><svg className="ic fill" style={{ color: '#f7941d' }}><use href="#ic-people-f" /></svg></div>
              <div>
                <div className="lbl">Cơ hội kết nối</div>
                <div className="num">23.786+</div>
                <div className="sub">Mỗi tháng</div>
              </div>
            </div>
            <div className="hstat">
              <div className="ico"><svg className="ic fill" style={{ color: '#3f8fd6' }}><use href="#ic-star-f" /></svg></div>
              <div>
                <div className="lbl">Đánh giá từ khách hàng</div>
                <div className="num">4.8/5</div>
                <div className="sub"><span className="ministars">★★★★★</span> Rất hài lòng</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== STAT STRIP ===== */}
      <div className="strip">
        <div className="container">
          <div className="sitem"><span className="ico"><svg className="ic"><use href="#ic-building" /></svg></span><div><b>8.945+</b><span>Doanh nghiệp</span></div></div>
          <div className="sitem"><span className="ico"><svg className="ic"><use href="#ic-clipboard" /></svg></span><div><b>12.458+</b><span>Dự án</span></div></div>
          <div className="sitem"><span className="ico"><svg className="ic"><use href="#ic-people" /></svg></span><div><b>23.786+</b><span>Cơ hội kết nối</span></div></div>
          <div className="sitem"><span className="ico"><svg className="ic"><use href="#ic-doc" /></svg></span><div><b>45.678+</b><span>Tin đăng</span></div></div>
          <div className="sitem"><span className="ico"><svg className="ic fill"><use href="#ic-star" /></svg></span><div><b>4.8/5</b><span>Đánh giá trung bình</span></div></div>
        </div>
      </div>

      {/* ===== CATEGORIES ===== */}
      <section className="block">
        <div className="container">
          <div className="sec-head">
            <h2>Danh mục phổ biến</h2>
            <a href="/directory">Xem tất cả →</a>
          </div>
          <div className="cat-grid">
            {CATEGORIES.map((c) => (
              <a className="cat" href={c.href} key={c.name}>
                <div className="ico"><svg className="ic"><use href={`#${c.icon}`} /></svg></div>
                <span>{c.name}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TOP COMPANIES ===== */}
      <section className="block company-block">
        <div className="container">
          <div className="sec-head">
            <h2>Top doanh nghiệp uy tín</h2>
            <a href="/directory">Xem tất cả →</a>
          </div>
          <div className="comp-grid">
            {companies.map((c) => (
              <CompanyCard key={c.id} c={c as never} />
            ))}
            <div className="cta-card">
              <h3>Đăng ký doanh nghiệp ngay</h3>
              <p>Tạo hồ sơ doanh nghiệp để kết nối và mở rộng cơ hội kinh doanh của bạn.</p>
              <a className="btn btn-orange" href="/login" style={{ alignSelf: 'flex-start' }}>
                Đăng ký miễn phí →
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
