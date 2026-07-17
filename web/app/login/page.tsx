'use client';
import { useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supa = createSupabaseBrowser();
      const { error } = await supa.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="block">
      <div className="container" style={{ maxWidth: 420 }}>
        <h1 style={{ color: 'var(--navy)', fontSize: 24, marginBottom: 16 }}>Đăng nhập</h1>
        {sent ? (
          <div className="notice">Đã gửi liên kết đăng nhập tới <b>{email}</b>. Kiểm tra hộp thư của bạn.</div>
        ) : (
          <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
            <input
              className="searchbar"
              style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 8 }}
              type="email"
              required
              placeholder="Email doanh nghiệp"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn btn-orange" disabled={loading} type="submit">
              {loading ? 'Đang gửi…' : 'Gửi liên kết đăng nhập'}
            </button>
            {error ? <p style={{ color: '#c0392b', fontSize: 13 }}>{error}</p> : null}
          </form>
        )}
        <p className="muted" style={{ marginTop: 16 }}>
          Sau này sẽ bổ sung đăng nhập bằng số điện thoại (OTP) để đối tác nhận quản lý hồ sơ đã tạo sẵn.
        </p>
      </div>
    </main>
  );
}
