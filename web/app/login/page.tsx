'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toE164VN, toLocalVN, safeRedirect } from '@/lib/phone';
import { createSupabaseBrowser } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [method, setMethod] = useState<'phone' | 'email'>('phone');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [redirectTo, setRedirectTo] = useState('/dashboard');

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setRedirectTo(safeRedirect(q.get('redirect')));
    if (q.get('error')) setError('Liên kết đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.');
    if (window.location.hash === '#register') setTab('register');
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function switchMethod(m: 'phone' | 'email') {
    setMethod(m);
    setSent(false);
    setError(null);
  }

  async function oauth(provider: 'google') {
    setError(null);
    const supa = createSupabaseBrowser();
    const { error } = await supa.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/login/callback?redirect=${encodeURIComponent(redirectTo)}` },
    });
    if (error) setError('Đăng nhập Google chưa được bật: ' + error.message);
  }

  async function sendEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supa = createSupabaseBrowser();
      const { error } = await supa.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/login/callback?redirect=${encodeURIComponent(redirectTo)}` },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function sendPhone() {
    setError(null);
    const e164 = toE164VN(phone);
    if (!e164) return setError('Số điện thoại không hợp lệ (ví dụ 0912345678).');
    setLoading(true);
    try {
      const supa = createSupabaseBrowser();
      const { error } = await supa.auth.signInWithOtp({ phone: e164 });
      if (error) throw error;
      setSent(true);
      setCooldown(60);
      setOtp(['', '', '', '', '', '']);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyPhone() {
    const token = otp.join('');
    const e164 = toE164VN(phone);
    if (token.length !== 6 || !e164) return setError('Nhập đủ 6 số của mã OTP.');
    setLoading(true);
    setError(null);
    try {
      const supa = createSupabaseBrowser();
      const { data, error } = await supa.auth.verifyOtp({ phone: e164, token, type: 'sms' });
      if (error) throw error;
      if (data.user) {
        // Bảo đảm có profile (trigger đã tạo; upsert chỉ phòng hờ)
        await supa.from('profiles').upsert({ id: data.user.id, phone: toLocalVN(phone) }, { onConflict: 'id', ignoreDuplicates: true });
      }
      router.replace(redirectTo);
      router.refresh();
    } catch (err) {
      setError('Mã OTP không đúng hoặc đã hết hạn.');
    } finally {
      setLoading(false);
    }
  }

  function handleOtpInput(idx: number, val: string) {
    const digits = val.replace(/\D/g, '');
    if (digits.length > 2) {
      // dán cả mã
      const next = digits.slice(0, 6).split('');
      setOtp([...next, ...Array(6 - next.length).fill('')]);
      document.getElementById(`otp-${Math.min(next.length, 5)}`)?.focus();
      return;
    }
    const next = [...otp];
    next[idx] = digits.slice(-1);
    setOtp(next);
    if (digits && idx < 5) document.getElementById(`otp-${idx + 1}`)?.focus();
  }

  return (
    <>
      <style>{`
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
        .method{display:flex;gap:8px;margin-bottom:18px}
        .method button{flex:1;text-align:center;padding:9px;border:1px solid var(--line);border-radius:9px;font-size:13px;font-weight:600;color:var(--text);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;background:#fff}
        .method button.active{border-color:var(--orange);color:var(--orange);background:var(--orange-soft)}
        .method button svg{width:16px;height:16px}
        .oauth{display:flex;gap:10px;margin:18px 0}
        .oauth a{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:11px;border:1px solid var(--line);border-radius:9px;font-size:13.5px;font-weight:600;color:var(--text);text-decoration:none}
        .oauth a:hover{background:#f6f8fb}
        .divider-or{display:flex;align-items:center;gap:12px;color:var(--muted);font-size:12.5px;margin:6px 0 18px}
        .divider-or::before,.divider-or::after{content:"";flex:1;height:1px;background:var(--line)}
        .otp-boxes{display:flex;gap:8px;justify-content:space-between}
        .otp-boxes input{width:100%;aspect-ratio:1;text-align:center;font-size:22px;font-weight:700;border:1px solid var(--line);border-radius:10px;outline:none}
        .otp-boxes input:focus{border-color:var(--orange);box-shadow:0 0 0 3px rgba(241,138,28,.12)}
        .fineprint{font-size:12px;color:var(--muted);margin-top:16px;text-align:center;line-height:1.6}
        .fineprint a{color:var(--orange);font-weight:600}
        .hint{font-size:12px;color:var(--muted);margin-top:5px}
        @media(max-width:900px){.auth-wrap{grid-template-columns:1fr}.auth-left{display:none}.auth-right{min-height:calc(100vh - 70px)}}
      `}</style>

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

            {/* OAuth */}
            <div className="oauth">
              <a href="#" onClick={(e) => { e.preventDefault(); oauth('google'); }}>
                <svg viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
                  <path fill="#4285F4" d="M22.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-2 3.3-4.9 3.3-7.8z"/>
                  <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.3 1.1-3.7 1.1-2.8 0-5.2-1.9-6-4.5H2.3v2.8A11 11 0 0 0 12 23z"/>
                  <path fill="#FBBC05" d="M6 14.2a6.6 6.6 0 0 1 0-4.2V7.2H2.3a11 11 0 0 0 0 9.8L6 14.2z"/>
                  <path fill="#EA4335" d="M12 5.4c1.6 0 3 .5 4.1 1.6l3.1-3.1A11 11 0 0 0 2.3 7.2L6 10c.8-2.6 3.2-4.6 6-4.6z"/>
                </svg>
                Google
              </a>
            </div>
            <div className="divider-or">hoặc dùng</div>

            {/* Method switcher */}
            <div className="method">
              <button className={method === 'phone' ? 'active' : ''} onClick={() => switchMethod('phone')}>
                <svg className="ic"><use href="#ic-phone" /></svg> Số điện thoại (OTP)
              </button>
              <button className={method === 'email' ? 'active' : ''} onClick={() => switchMethod('email')}>
                <svg className="ic"><use href="#ic-mail" /></svg> Email
              </button>
            </div>

            {/* Phone OTP flow */}
            {method === 'phone' && (
              <div>
                <div className="field-group">
                  <label>Số điện thoại</label>
                  <input
                    className="input"
                    placeholder="09xx xxx xxx"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <div className="hint">Chúng tôi sẽ gửi mã OTP gồm 6 số qua SMS/Zalo.</div>
                </div>
                <button className="btn btn-orange btn-block btn-lg" disabled={loading || cooldown > 0} onClick={sendPhone}>
                  {loading && !sent ? 'Đang gửi…' : sent ? 'Gửi lại mã OTP' : 'Gửi mã OTP'}
                </button>
                {error && method === 'phone' && <p style={{ color: '#c0392b', fontSize: 13, marginTop: 10 }}>{error}</p>}
                {sent && (
                  <div style={{ marginTop: 22 }}>
                    <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--navy)', marginBottom: 8 }}>
                      Nhập mã OTP đã gửi đến {phone || '09xx xxx xxx'}
                    </label>
                    <div className="otp-boxes">
                      {otp.map((v, i) => (
                        <input
                          key={i}
                          id={`otp-${i}`}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          value={v}
                          onChange={(e) => handleOtpInput(i, e.target.value)}
                        />
                      ))}
                    </div>
                    <div className="between mt-16">
                      <span className="hint" style={{ margin: 0 }}>
                        {cooldown > 0 ? <>Gửi lại mã sau <b style={{ color: 'var(--navy)' }}>{cooldown}s</b></> : 'Chưa nhận được mã? Bấm “Gửi lại mã OTP”.'}
                      </span>
                      <button className="btn btn-navy btn-sm" disabled={loading} onClick={verifyPhone}>Xác nhận</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Email magic link flow */}
            {method === 'email' && (
              sent ? (
                <div className="notice">
                  Đã gửi liên kết đăng nhập tới <b>{email}</b>. Kiểm tra hộp thư của bạn.
                </div>
              ) : (
                <form onSubmit={sendEmail} style={{ display: 'grid', gap: 14 }}>
                  <div className="field-group" style={{ marginBottom: 0 }}>
                    <label>Email doanh nghiệp</label>
                    <input
                      className="input"
                      type="email"
                      required
                      placeholder="tenban@congty.vn"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <button className="btn btn-orange btn-block btn-lg" disabled={loading} type="submit">
                    {loading ? 'Đang gửi…' : 'Gửi liên kết đăng nhập'}
                  </button>
                  {error && <p style={{ color: '#c0392b', fontSize: 13 }}>{error}</p>}
                </form>
              )
            )}

            <p className="fineprint">
              Bằng việc tiếp tục, bạn đồng ý với <a href="#">Điều khoản</a> &amp; <a href="#">Chính sách bảo mật</a> (Nghị định 13/2023/NĐ-CP).
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
