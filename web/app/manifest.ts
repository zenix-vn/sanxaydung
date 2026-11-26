import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sàn Xây Dựng — Hệ sinh thái xây dựng',
    short_name: 'Sàn Xây Dựng',
    description: 'Kết nối nhà thầu, đội thi công, nhà cung cấp và chủ đầu tư ngành xây dựng Việt Nam.',
    lang: 'vi',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#021e48',
    icons: [
      { src: '/logo.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
    shortcuts: [
      { name: 'Tìm nhà thầu', url: '/directory' },
      { name: 'Đăng nhu cầu', url: '/marketplace/new' },
      { name: 'Tin nhắn', url: '/chat' },
    ],
  };
}
