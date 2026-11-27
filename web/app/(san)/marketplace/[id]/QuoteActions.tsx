'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';

const LABEL: Record<string, string> = { sent: 'Mới', shortlisted: 'Đã shortlist', accepted: 'Đã chọn', rejected: 'Đã từ chối', withdrawn: 'Đã rút' };

// Chủ tin đổi trạng thái báo giá. RLS không cho chủ tin UPDATE bảng quotes → dùng RPC set_quote_status (AI-1).
export default function QuoteActions({ quoteId, status, chatHref }: { quoteId: string; status: string; chatHref: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function set(next: string) {
    setBusy(true);
    setErr(null);
    const { error } = await createSupabaseBrowser().rpc('set_quote_status', { _quote: quoteId, _status: next });
    setBusy(false);
    if (error) return setErr(error.message);
    router.refresh();
  }

  return (
    <>
      <div className="qactions">
        <a className="btn btn-navy btn-sm" href={chatHref}>
          <svg className="ic"><use href="#ic-chat" /></svg> Nhắn tin
        </a>
        {status === 'sent' && (
          <a className="btn btn-outline btn-sm" onClick={() => !busy && set('shortlisted')}>
            <svg className="ic"><use href="#ic-check" /></svg> Shortlist
          </a>
        )}
        {(status === 'sent' || status === 'shortlisted') && (
          <>
            <a className="btn btn-orange btn-sm" onClick={() => !busy && set('accepted')}>Chọn báo giá này</a>
            <a className="btn btn-outline btn-sm" onClick={() => !busy && set('rejected')}>Từ chối</a>
          </>
        )}
        {status !== 'sent' && <span className="badge gray">{LABEL[status] ?? status}</span>}
      </div>
      {err && <p style={{ color: '#a12622', fontSize: 12.5, marginTop: 6 }}>{err}</p>}
    </>
  );
}
