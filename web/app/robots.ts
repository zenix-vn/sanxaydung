import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/ui';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/dashboard', '/chat', '/login', '/marketplace/new'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
