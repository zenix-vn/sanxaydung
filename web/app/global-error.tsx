'use client';

// Lỗi ở root layout: phải tự render <html>/<body>, không dùng được CSS/sprite chung.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="vi">
      <body style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '80px 20px', color: '#021e48' }}>
        <h1 style={{ fontSize: 24 }}>Sàn Xây Dựng đang gặp sự cố</h1>
        <p style={{ color: '#5b6b7b' }}>Vui lòng thử lại sau ít phút.</p>
        <button onClick={() => reset()} style={{ marginTop: 16, padding: '10px 20px', borderRadius: 8, border: 'none', background: '#f47c20', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          Thử lại
        </button>
      </body>
    </html>
  );
}
