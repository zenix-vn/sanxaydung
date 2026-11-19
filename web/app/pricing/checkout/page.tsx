import type { Metadata } from 'next';
import { requireUserCompany } from '@/lib/supabase/company';

export const metadata: Metadata = { title: 'Thanh toán gói dịch vụ' };
export const dynamic = 'force-dynamic';

const PLANS: Record<string, { name: string; month?: number; year?: number; note?: string }> = {
  professional: { name: 'Gói Professional', month: 990000, year: 9504000 },
  verified: { name: 'Gói Verified năng lực', month: 500000, note: 'Phí duyệt hồ sơ theo lần.' },
  'featured-listing': { name: 'Tin đăng ưu tiên (7 ngày)', month: 200000, note: 'Tính theo từng tin.' },
  enterprise: { name: 'Gói Enterprise', note: 'Báo giá theo nhu cầu — đội ngũ sẽ liên hệ.' },
  banner: { name: 'Banner & gian hàng tài trợ', note: 'Báo giá theo lượt hiển thị.' },
};

// Cấu hình tài khoản nhận tiền qua biến môi trường (không hard-code)
const BANK = {
  bank: process.env.NEXT_PUBLIC_PAY_BANK ?? 'Liên hệ để nhận thông tin chuyển khoản',
  account: process.env.NEXT_PUBLIC_PAY_ACCOUNT ?? '',
  holder: process.env.NEXT_PUBLIC_PAY_HOLDER ?? '',
  contact: process.env.NEXT_PUBLIC_PAY_CONTACT ?? 'hotro@sanxaydung.vn',
};

const vnd = (n: number) => `${n.toLocaleString('vi-VN')}₫`;

export default async function CheckoutPage({ searchParams }: { searchParams: { plan?: string; billing?: string } }) {
  const planKey = searchParams.plan && PLANS[searchParams.plan] ? searchParams.plan : 'professional';
  const yearly = searchParams.billing === 'year';
  const { company } = await requireUserCompany(`/pricing/checkout?plan=${planKey}&billing=${yearly ? 'year' : 'month'}`);
  const plan = PLANS[planKey];
  const amount = yearly && plan.year ? plan.year : plan.month;
  const code = company ? `SXD ${(company.slug as string).toUpperCase().slice(0, 20)} ${planKey.toUpperCase()}` : null;

  return (
    <div style={{ maxWidth: 640, margin: '48px auto', padding: '0 20px' }}>
      <div className="crumb"><a href="/pricing">Bảng giá</a><svg className="ic"><use href="#ic-chevron-right" /></svg> Thanh toán</div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--navy)', margin: '10px 0 16px' }}>{plan.name}</h1>

      {!company ? (
        <div className="card-block">
          <p>Bạn cần có hồ sơ doanh nghiệp để đăng ký gói dịch vụ.</p>
          <a className="btn btn-orange mt-16" href="/dashboard">Tạo / nhận hồ sơ doanh nghiệp</a>
        </div>
      ) : (
        <div className="card-block">
          <div className="kv" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}><span className="muted">Doanh nghiệp</span><b>{company.name}</b></div>
          <div className="kv" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
            <span className="muted">Số tiền{yearly && plan.year ? ' (theo năm, đã giảm 20%)' : ''}</span>
            <b>{amount ? vnd(amount) : 'Theo báo giá'}</b>
          </div>
          {plan.note && <p className="muted" style={{ fontSize: 13, margin: '8px 0' }}>{plan.note}</p>}

          {amount ? (
            <>
              <h2 style={{ marginTop: 20 }}>Chuyển khoản thủ công</h2>
              <p className="muted mb-16" style={{ fontSize: 13.5 }}>Cổng thanh toán trực tuyến đang được tích hợp. Trong thời gian này, vui lòng chuyển khoản theo thông tin sau — gói sẽ được kích hoạt trong 1 ngày làm việc sau khi nhận tiền.</p>
              <div className="lookup-result" style={{ background: '#f6f8fb', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
                <div style={{ padding: '4px 0' }}>Ngân hàng: <b>{BANK.bank}</b></div>
                {BANK.account && <div style={{ padding: '4px 0' }}>Số tài khoản: <b>{BANK.account}</b></div>}
                {BANK.holder && <div style={{ padding: '4px 0' }}>Chủ tài khoản: <b>{BANK.holder}</b></div>}
                <div style={{ padding: '4px 0' }}>Nội dung: <b>{code}</b></div>
              </div>
            </>
          ) : (
            <p style={{ marginTop: 16 }}>Đội ngũ sẽ liên hệ tư vấn qua email/điện thoại của doanh nghiệp.</p>
          )}
          <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>Cần hỗ trợ? Liên hệ <b>{BANK.contact}</b>.</p>
          {planKey === 'verified' && <a className="btn btn-orange mt-16" href="/dashboard/verify">Gửi hồ sơ xác minh ngay →</a>}
        </div>
      )}
    </div>
  );
}
