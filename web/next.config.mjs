/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
  async headers() {
    const day = 'public, max-age=86400, stale-while-revalidate=604800';
    return [
      { source: '/logo.png', headers: [{ key: 'Cache-Control', value: day }] },
      { source: '/icon.png', headers: [{ key: 'Cache-Control', value: day }] },
      { source: '/apple-icon.png', headers: [{ key: 'Cache-Control', value: day }] },
      { source: '/favicon.ico', headers: [{ key: 'Cache-Control', value: day }] },
    ];
  },
  // Cho phép ảnh từ Supabase Storage & nguồn demo
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};
export default nextConfig;
