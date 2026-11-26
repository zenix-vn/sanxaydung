/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
  // Sàn hiện miễn phí hoàn toàn: link cũ tới bảng giá / thanh toán chuyển về trang chủ
  async redirects() {
    return [
      { source: '/pricing', destination: '/', permanent: true },
      { source: '/pricing/:path*', destination: '/', permanent: true },
      { source: '/dashboard/billing', destination: '/dashboard', permanent: false },
    ];
  },
  async headers() {
    const day = 'public, max-age=86400, stale-while-revalidate=604800';
    return [
      { source: '/logo.png', headers: [{ key: 'Cache-Control', value: day }] },
      { source: '/icon.png', headers: [{ key: 'Cache-Control', value: day }] },
      { source: '/apple-icon.png', headers: [{ key: 'Cache-Control', value: day }] },
      { source: '/favicon.ico', headers: [{ key: 'Cache-Control', value: day }] },
      // Service worker phải luôn lấy bản mới để cập nhật kịp thời
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }, { key: 'Service-Worker-Allowed', value: '/' }] },
    ];
  },
  // Không dùng next/image → tắt Image Optimization API (/_next/image) để thu hẹp bề mặt tấn công
  // (Next 14 còn lỗ hổng RCE/DoS ở API này; middleware cũng chặn đường dẫn đó).
  images: { unoptimized: true, remotePatterns: [] },

};
export default nextConfig;
