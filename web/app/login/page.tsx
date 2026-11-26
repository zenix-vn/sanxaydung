'use client';
import { useEffect, useState } from 'react';
import { safeRedirect } from '@/lib/phone';
import { createSupabaseBrowser } from '@/lib/supabase/client';

export default function LoginPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirectTo, setRedirectTo] = useState('/dashboard');

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setRedirectTo(safeRedirect(q.get('redirect')));
    if (q.get('error')) setError('Đăng nhập không thành công hoặc phiên đã hết hạn. Vui lòng thử lại.');
    if (window.location.hash === '#register') setTab('register');
  }, []);

  // Chỉ hỗ trợ đăng nhập bằng Google (đăng ký lần đầu cũng qua Google).
  async function oauth(provider: 'google') {
    setError(null);
    setLoading(true);
    const supa = createSupabaseBrowser();
    const { error } = await supa.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/login/callback?redirect=${encodeURIComponent(redirectTo)}` },
    });
    if (error) {
      setLoading(false);
      setError('Không thể bắt đầu đăng nhập Google: ' + error.message);
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        body{background:var(--navy)}
        .auth-wrap{min-height:calc(100vh - 70px);display:grid;grid-template-columns:1fr 480px}
        .auth-left{background:linear-gradient(150deg,rgba(2,30,72,.92),rgba(2,30,72,.72)),url("https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1200&q=80") center/cover;color:#fff;padding:48px;display:flex;flex-direction:column;justify-content:space-between}
        .auth-left h2{font-size:34px;font-weight:800;line-height:1.15;margin-bottom:16px}
        .auth-left h2 .hl{color:var(--orange-2)}
        .auth-left p{color:#c6d3e2;max-width:440px;font-size:15px}
        .auth-pts{margin-top:24px;display:flex;flex-direction:column;gap:14px}
        .auth-pts .pt{display:flex;gap:12px;align-items:flex-start}
        .auth-pts .ic-b{width:38px;height:38px;border-radius:10px;background:rgba(255,255,255,.08);display:grid;place-items:center;flex:none;color:var(--orange-2)}
        .auth-pts .pt b{font-size:14.5px}.auth-pts .pt small{color:#9db3cd;font-size:12.5px}
        .auth-right{background:#fff;padding:44px;display:flex;flex-direction:column;justify-content:center;overflow-y:auto}
        .auth-card{width:100%;max-width:380px;margin:0 auto}
        .auth-card h1{font-size:24px;font-weight:800;color:var(--navy);margin-bottom:6px}
        .auth-card .sub{color:var(--muted);font-size:14px;margin-bottom:22px}
        .seg{display:flex;background:#f1f4f7;border-radius:10px;padding:4px;margin-bottom:22px}
        .seg button{flex:1;text-align:center;padding:10px;font-size:14px;font-weight:600;color:var(--muted);border-radius:8px;cursor:pointer;border:none;background:transparent}
        .seg button.active{background:#fff;color:var(--navy);box-shadow:var(--shadow-sm)}
        .google-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;padding:14px;border:1px solid var(--line);border-radius:10px;background:#fff;font-size:15px;font-weight:700;color:var(--navy);cursor:pointer;box-shadow:var(--shadow-sm)}
        .google-btn:hover:not(:disabled){background:#f6f8fb;border-color:#cfd8e3}
        .google-btn:disabled{opacity:.7;cursor:wait}
        .fineprint{font-size:12px;color:var(--muted);margin-top:16px;text-align:center;line-height:1.6}
        .fineprint a{color:var(--orange);font-weight:600}
        @media(max-width:900px){.auth-wrap{grid-template-columns:1fr}.auth-left{display:none}.auth-right{min-height:calc(100vh - 70px)}}
      ` }} />

      <div className="auth-wrap">
        {/* LEFT panel */}
        <div className="auth-left">
          <div>
            <h2>Xây dựng <span className="hl">uy tín số</span><br />cho doanh nghiệp của bạn</h2>
            <p>Tham gia nền tảng B2B số 1 ngành xây dựng Việt Nam — kết nối đúng đối tác, quản lý hồ sơ năng lực và tích lũy Trust Score.</p>
            <div className="auth-pts">
              <div className="pt">
                <span className="ic-b"><svg className="ic"><use href="#ic-shield-check" /></svg></span>
                <div><b>Xác minh &amp; huy hiệu tin cậy</b><br /><small>MST/GPKD, chứng chỉ năng lực hạng I/II/III</small></div>
              </div>
              <div className="pt">
                <span className="ic-b"><svg className="ic"><use href="#ic-briefcase" /></svg></span>
                <div><b>Nhận nhu cầu &amp; báo giá</b><br /><small>Kết nối cung – cầu ngành xây dựng</small></div>
              </div>
              <div className="pt">
                <span className="ic-b"><svg className="ic"><use href="#ic-star-f" /></svg></span>
                <div><b>Đánh giá xác thực</b><br /><small>Chỉ từ giao dịch đã hoàn tất trên sàn</small></div>
              </div>
            </div>
          </div>
          <small style={{ color: '#7f97b3' }}>© 2026 Sàn Xây Dựng · Tuân thủ Nghị định 13/2023/NĐ-CP</small>
        </div>

        {/* RIGHT panel */}
        <div className="auth-right">
          <div className="auth-card">
            {/* Tab switcher */}
            <div className="seg">
              <button className={tab === 'login' ? 'active' : ''} onClick={() => setTab('login')}>Đăng nhập</button>
              <button className={tab === 'register' ? 'active' : ''} onClick={() => setTab('register')}>Đăng ký</button>
            </div>

            <h1>{tab === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản doanh nghiệp'}</h1>
            <p className="sub">
              {tab === 'login'
                ? 'Đăng nhập để quản lý hồ sơ & kết nối doanh nghiệp.'
                : 'Đăng ký miễn phí — bắt đầu xây dựng hồ sơ năng lực số.'}
            </p>

            {/* Đăng nhập Google */}
            <button
              type="button"
              className="google-btn"
              disabled={loading}
              onClick={() => oauth('google')}
            >
              <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }}>
                <path fill="#4285F4" d="M22.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-2 3.3-4.9 3.3-7.8z"/>
                <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.3 1.1-3.7 1.1-2.8 0-5.2-1.9-6-4.5H2.3v2.8A11 11 0 0 0 12 23z"/>
                <path fill="#FBBC05" d="M6 14.2a6.6 6.6 0 0 1 0-4.2V7.2H2.3a11 11 0 0 0 0 9.8L6 14.2z"/>
                <path fill="#EA4335" d="M12 5.4c1.6 0 3 .5 4.1 1.6l3.1-3.1A11 11 0 0 0 2.3 7.2L6 10c.8-2.6 3.2-4.6 6-4.6z"/>
              </svg>
              {loading ? 'Đang chuyển tới Google…' : 'Tiếp tục với Google'}
            </button>
            {error && <p style={{ color: '#c0392b', fontSize: 13, marginTop: 12, textAlign: 'center' }}>{error}</p>}

            <p className="fineprint">
              Bằng việc tiếp tục, bạn đồng ý với <a href="/dieu-khoan" target="_blank">Điều khoản</a> &amp; <a href="/chinh-sach-bao-mat" target="_blank">Chính sách bảo mật</a> (Nghị định 13/2023/NĐ-CP).
            </p>

            {tab === 'register' && (
              <div className="pill-note mt-24">
                <svg className="ic"><use href="#ic-building" /></svg>
                <span>
                  Doanh nghiệp của bạn có thể đã có sẵn hồ sơ trên sàn. Sau khi đăng ký, bạn có thể <b>claim hồ sơ theo số điện thoại/MST</b>.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
