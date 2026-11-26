'use client';
import Script from 'next/script';
import { useReportWebVitals } from 'next/web-vitals';

// Đo truy cập không cookie (Plausible). Chỉ bật khi đặt NEXT_PUBLIC_PLAUSIBLE_DOMAIN.
const DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
const SRC = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC ?? 'https://plausible.io/js/script.js';

type Plausible = (event: string, opts?: { props?: Record<string, string | number> }) => void;

export default function Analytics() {
  // Core Web Vitals → sự kiện tùy chỉnh "Web Vitals" (LCP, INP, CLS, FCP, TTFB)
  useReportWebVitals((m) => {
    const p = (window as unknown as { plausible?: Plausible }).plausible;
    if (!DOMAIN || !p) return;
    p('Web Vitals', { props: { metric: m.name, value: Math.round(m.name === 'CLS' ? m.value * 1000 : m.value), rating: (m as { rating?: string }).rating ?? '' } });
  });
  if (!DOMAIN) return null;
  return <Script defer data-domain={DOMAIN} src={SRC} strategy="afterInteractive" />;
}
