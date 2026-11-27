'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';

export function MarkAllRead({ userId, disabled }: { userId: string; disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-outline btn-sm"
      disabled={disabled || busy}
      onClick={async () => {
        setBusy(true);
        await createSupabaseBrowser().from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
        setBusy(false);
        router.refresh();
      }}
    >
      <svg className="ic"><use href="#ic-check" /></svg> Đánh dấu tất cả đã đọc
    </button>
  );
}

/** Mở một thông báo: đánh dấu đã đọc rồi chuyển tới link (chỉ link nội bộ). */
export function NotifLink({ id, link, unread, children }: { id: string; link: string | null; unread: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const safe = link && link.startsWith('/') && !link.startsWith('//') ? link : null;
  return (
    <button
      type="button"
      className={`nrow${unread ? ' un' : ''}`}
      onClick={async () => {
        if (unread) await createSupabaseBrowser().from('notifications').update({ is_read: true }).eq('id', id);
        if (safe) window.location.assign(safe);
        else router.refresh();
      }}
    >
      {children}
    </button>
  );
}

type Prefs = { email: boolean; zalo: boolean; push: boolean; digest: 'instant' | 'daily' | 'off' };

export function PrefsForm({ userId, initial }: { userId: string; initial: Prefs }) {
  const [p, setP] = useState<Prefs>(initial);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function save(next: Prefs) {
    setP(next);
    setState('saving');
    const { error } = await createSupabaseBrowser().from('notification_prefs').upsert({ user_id: userId, ...next });
    setState(error ? 'error' : 'saved');
  }

  const toggle = (k: 'email' | 'zalo' | 'push', label: string, hint: string) => (
    <label className="pref">
      <input type="checkbox" checked={p[k]} onChange={(e) => save({ ...p, [k]: e.target.checked })} style={{ accentColor: 'var(--orange)' }} />
      <span><b>{label}</b><small>{hint}</small></span>
    </label>
  );

  return (
    <div>
      {toggle('email', 'Email', 'Gửi tới email đăng nhập của bạn')}
      {toggle('zalo', 'Zalo OA', 'Qua Zalo OA của Sàn Xây Dựng (cần SĐT đã xác thực)')}
      {toggle('push', 'Thông báo trình duyệt', 'Khi bật thông báo đẩy trên thiết bị')}
      <div className="field-group" style={{ marginTop: 12 }}>
        <label htmlFor="digest">Tần suất gửi ngoài ứng dụng</label>
        <select id="digest" className="select" value={p.digest} onChange={(e) => save({ ...p, digest: e.target.value as Prefs['digest'] })}>
          <option value="instant">Ngay khi có thông báo</option>
          <option value="daily">Gộp 1 email/ngày</option>
          <option value="off">Tắt — chỉ xem trong ứng dụng</option>
        </select>
      </div>
      <small className="muted" aria-live="polite">
        {state === 'saving' ? 'Đang lưu…' : state === 'saved' ? 'Đã lưu.' : state === 'error' ? 'Lưu thất bại, thử lại.' : 'Thay đổi được lưu tự động.'}
      </small>
    </div>
  );
}
