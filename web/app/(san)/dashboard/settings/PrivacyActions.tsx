'use client';
import { useMemo, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';

export default function PrivacyActions({ isOwner }: { isOwner: boolean }) {
  const supa = useMemo(() => createSupabaseBrowser(), []);
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmText, setConfirmText] = useState('');

  async function exportData() {
    setBusy('export'); setMsg(null);
    const { data, error } = await supa.rpc('export_my_data');
    setBusy(null);
    if (error) return setMsg({ ok: false, text: error.message });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `du-lieu-cua-toi-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg({ ok: true, text: 'Đã tải xuống dữ liệu cá nhân của bạn.' });
  }

  async function deleteAccount() {
    if (confirmText !== 'XOA') return setMsg({ ok: false, text: 'Gõ chính xác "XOA" để xác nhận.' });
    if (!confirm('Tài khoản sẽ bị xóa và ẩn danh hóa. Không thể hoàn tác. Tiếp tục?')) return;
    setBusy('delete'); setMsg(null);
    const { error } = await supa.rpc('delete_my_account');
    if (error) { setBusy(null); return setMsg({ ok: false, text: error.message }); }
    await supa.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <>
      {msg && <p style={{ color: msg.ok ? 'var(--green)' : '#c0392b', fontSize: 13, margin: '12px 0' }}>{msg.text}</p>}
      <div className="card-block">
        <h2>Quyền riêng tư dữ liệu</h2>
        <p className="muted mb-16" style={{ fontSize: 13.5 }}>Theo Nghị định 13/2023/NĐ-CP, bạn có quyền truy cập và xóa dữ liệu cá nhân của mình.</p>
        <button className="btn btn-outline" disabled={busy !== null} onClick={exportData}>
          <svg className="ic"><use href="#ic-upload" /></svg> {busy === 'export' ? 'Đang xuất…' : 'Tải dữ liệu của tôi (JSON)'}
        </button>
      </div>
      <div className="card-block" style={{ borderColor: '#f3c6bf' }}>
        <h2 style={{ color: '#c0392b' }}>Xóa tài khoản</h2>
        <p className="muted mb-16" style={{ fontSize: 13.5 }}>
          Hồ sơ cá nhân được ẩn danh hóa, bạn bị gỡ khỏi mọi công ty và thông báo bị xóa. Bài viết/đánh giá đã đăng được giữ lại ở dạng ẩn danh.
          {isOwner && <b> Bạn đang là Owner: công ty sẽ không còn chủ sở hữu — hãy chuyển quyền trước nếu cần.</b>}
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="input" style={{ maxWidth: 200 }} placeholder='Gõ "XOA" để xác nhận' value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          <button className="btn" style={{ background: '#c0392b', color: '#fff' }} disabled={busy !== null} onClick={deleteAccount}>
            {busy === 'delete' ? 'Đang xóa…' : 'Xóa tài khoản'}
          </button>
        </div>
      </div>
    </>
  );
}
