import type { Metadata } from 'next';
import './globals.css';
import { Be_Vietnam_Pro } from 'next/font/google';
import { SITE_URL } from '@/lib/ui';
import IconSprite from '@/components/IconSprite';

const bvp = Be_Vietnam_Pro({ subsets: ['vietnamese', 'latin'], weight: ['400', '500', '600', '700', '800'], display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Sàn Xây Dựng — Hệ sinh thái xây dựng toàn diện',
    template: '%s | Sàn Xây Dựng',
  },
  description:
    'Nền tảng B2B kết nối nhà thầu, đội thi công, nhà cung cấp và chủ đầu tư ngành xây dựng Việt Nam.',
  applicationName: 'Sàn Xây Dựng',
  openGraph: { type: 'website', locale: 'vi_VN', siteName: 'Sàn Xây Dựng', url: '/' },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  formatDetection: { telephone: false },
  verification: { google: 'yFR4IvYkMYf4ZwuAhZhpcjV_6yqh-WZTnqcsa7MluUE' },
};

export const viewport = { themeColor: '#021e48' };

// Khung chung tối thiểu. Đầu/chân trang của sàn ở app/(san)/layout.tsx; website doanh nghiệp ở app/site/.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={bvp.className}>
        <IconSprite />
        {children}
      </body>
    </html>
  );
}
