'use client';
import { useEffect, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';

/** Nút lưu / bỏ lưu doanh nghiệp hoặc tin đăng vào danh sách cá nhân. */
export default function SaveButton({ kind, itemId, className = 'btn btn-outline', compact }: { kind: 'company' | 'listing'; itemId: string; className?: string; compact?: boolean }) {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supa = createSupabaseBrowser();
    supa.auth.getUser().then(async ({ data: { user } }) => {
      setUid(user?.id ?? null);
      if (!user) return;
      const { data } = await supa.from('saved_items').select('item_id').eq('user_id', user.id).eq('kind', kind).eq('item_id', itemId).maybeSingle();
      setSaved(!!data);
    });
  }, [kind, itemId]);

  async function toggle() {
    if (uid === null) {
      window.location.assign(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (!uid || busy) return;
    setBusy(true);
    const supa = createSupabaseBrowser();
    const { error } = saved
      ? await supa.from('saved_items').delete().eq('user_id', uid).eq('kind', kind).eq('item_id', itemId)
      : await supa.from('saved_items').insert({ user_id: uid, kind, item_id: itemId });
    setBusy(false);
    if (error) return alert(error.message);
    setSaved(!saved);
  }

  const label = saved ? 'Đã lưu' : 'Lưu';
  return (
    <button type="button" className={className} onClick={toggle} disabled={busy || uid === undefined} aria-pressed={saved} aria-label={saved ? 'Bỏ lưu' : 'Lưu để xem lại'} title={saved ? 'Đã lưu — bấm để bỏ lưu' : 'Lưu để xem lại'}>
      <svg className="ic" style={saved ? { color: 'var(--orange)', fill: 'currentColor' } : undefined}><use href="#ic-heart" /></svg>
      {!compact && <> {label}</>}
    </button>
  );
}
