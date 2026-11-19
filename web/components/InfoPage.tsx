import type { ReactNode } from 'react';

// Khung chung cho các trang nội dung tĩnh (điều khoản, hướng dẫn, FAQ...).
export default function InfoPage({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <>
      <style>{`
        .info{max-width:820px;margin:0 auto;padding:44px 20px 70px}
        .info h1{font-size:clamp(26px,4vw,34px);font-weight:800;color:var(--navy);margin-bottom:8px}
        .info .lead{color:var(--muted);font-size:15px;margin-bottom:28px}
        .info h2{font-size:19px;font-weight:700;color:var(--navy);margin:28px 0 8px}
        .info p,.info li{font-size:15px;color:#31414f;line-height:1.7}
        .info ul,.info ol{padding-left:22px;margin:8px 0}
        .info details{border:1px solid var(--line);border-radius:12px;padding:14px 18px;margin-bottom:10px;background:#fff}
        .info summary{font-weight:700;color:var(--navy);cursor:pointer}
        .info details p{margin-top:10px}
        .info a{color:var(--orange);font-weight:600}
      `}</style>
      <main className="info">
        <h1>{title}</h1>
        {intro && <p className="lead">{intro}</p>}
        {children}
      </main>
    </>
  );
}
