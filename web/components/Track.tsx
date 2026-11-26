'use client';
import { useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';

// Mỗi phiên trình duyệt chỉ đếm 1 lần / công ty / loại / ngày
function once(key: string) {
  try {
    const k = `sxd_t:${key}:${new Date().toISOString().slice(0, 10)}`;
    if (sessionStorage.getItem(k)) return false;
    sessionStorage.setItem(k, '1');
  } catch {
    /* chế độ riêng tư: vẫn đếm */
  }
  return true;
}

export function trackContact(companyId: string) {
  if (!once(`c:${companyId}`)) return;
  createSupabaseBrowser().rpc('track_company', { _company: companyId, _kind: 'contact' }).then(() => undefined);
}

export function TrackView({ companyId }: { companyId: string }) {
  useEffect(() => {
    if (once(`v:${companyId}`)) createSupabaseBrowser().rpc('track_company', { _company: companyId, _kind: 'view' }).then(() => undefined);
  }, [companyId]);
  return null;
}

export function TrackImpressions({ ids }: { ids: string[] }) {
  const key = ids.join(',');
  useEffect(() => {
    const fresh = ids.filter((id) => once(`i:${id}`));
    if (fresh.length) createSupabaseBrowser().rpc('track_impressions', { _ids: fresh.slice(0, 50) }).then(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

/** Link liên hệ có đếm lượt bấm. */
export function ContactLink({ companyId, ...a }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { companyId: string }) {
  return <a {...a} onClick={(e) => { trackContact(companyId); a.onClick?.(e); }} />;
}
