'use client';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';

export interface MyCo { id: string; name: string; role: string }
export interface ExistingConn { id: string; status: string; mineId: string; iAmTarget: boolean }

const isEditor = (c: MyCo) => ['owner', 'admin', 'editor'].includes(c.role);
const isAdmin = (c: MyCo) => ['owner', 'admin'].includes(c.role);

// Kết nối hợp tác giữa hai doanh nghiệp: gửi → (bên nhận) chấp nhận/từ chối → hoàn tất → mở đánh giá.
export default function ConnectButton({ targetId, mine, existing, loggedIn }: { targetId: string; mine: MyCo[]; existing: ExistingConn | null; loggedIn: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const editors = mine.filter(isEditor);
  const [as, setAs] = useState(editors[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const myCo = existing ? mine.find((c) => c.id === existing.mineId) : undefined;
  const admin = myCo && isAdmin(myCo) ? myCo : null;
  const editor = myCo && isEditor(myCo) ? myCo : null;

  async function run(fn: string, args: Record<string, unknown>, ask?: string) {
    if (busy || (ask && !confirm(ask))) return;
    setBusy(true);
    setErr(null);
    const { error } = await createSupabaseBrowser().rpc(fn, args);
    setBusy(false);
    if (error) return setErr(error.message);
    router.refresh();
  }

  const error = err && <small role="alert" style={{ color: '#a12622', width: '100%' }}>{err}</small>;

  if (existing && existing.status !== 'cancelled') {
    if (existing.status === 'completed') return <span className="conn-state ok"><svg className="ic"><use href="#ic-check" /></svg> Đã hợp tác</span>;

    if (existing.status === 'pending' && existing.iAmTarget) {
      if (!admin) return <span className="conn-state">Có yêu cầu kết nối · chờ quản trị viên phản hồi</span>;
      return (
        <>
          <button type="button" className="btn btn-orange" disabled={busy} onClick={() => run('respond_connection', { _connection: existing.id, _as_company: admin.id, _accept: true })}>
            <svg className="ic"><use href="#ic-check" /></svg> {busy ? 'Đang lưu…' : 'Chấp nhận kết nối'}
          </button>
          <button type="button" className="btn btn-outline" disabled={busy} onClick={() => run('respond_connection', { _connection: existing.id, _as_company: admin.id, _accept: false }, 'Từ chối yêu cầu kết nối này?')}>
            Từ chối
          </button>
          {error}
        </>
      );
    }

    if (existing.status === 'pending') {
      return (
        <>
          <span className="conn-state">
            <svg className="ic"><use href="#ic-clock" /></svg> Đã gửi kết nối · chờ phản hồi
            {editor && (
              <button type="button" className="conn-cancel" disabled={busy} onClick={() => run('cancel_connection', { _connection: existing.id, _as_company: editor.id }, 'Hủy yêu cầu kết nối đã gửi?')}>
                {busy ? 'Đang hủy…' : 'Hủy'}
              </button>
            )}
          </span>
          {error}
        </>
      );
    }

    // accepted
    return (
      <>
        <span className="conn-state ok"><svg className="ic"><use href="#ic-people" /></svg> Đang hợp tác</span>
        {admin && (
          <button
            type="button"
            className="btn btn-outline"
            title="Xác nhận hai bên đã hợp tác xong để mở đánh giá"
            disabled={busy}
            onClick={() => run('complete_connection', { _connection: existing.id, _as_company: admin.id }, 'Xác nhận đã hoàn tất hợp tác? Sau đó hai bên có thể đánh giá lẫn nhau.')}
          >
            <svg className="ic"><use href="#ic-check" /></svg> {busy ? 'Đang lưu…' : 'Hoàn tất hợp tác'}
          </button>
        )}
        {error}
      </>
    );
  }

  if (!loggedIn) {
    return (
      <a className="btn btn-orange" href={`/login?redirect=${encodeURIComponent(path)}`}>
        <svg className="ic"><use href="#ic-plus" /></svg> Kết nối
      </a>
    );
  }

  if (editors.length === 0) {
    return (
      <a className="btn btn-orange" href="/dashboard" title={mine.length ? 'Cần vai trò Biên tập trở lên trong doanh nghiệp của bạn' : 'Tạo hoặc nhận hồ sơ doanh nghiệp để kết nối'}>
        <svg className="ic"><use href="#ic-plus" /></svg> Kết nối
      </a>
    );
  }

  return (
    <>
      {editors.length > 1 && (
        <select className="input" style={{ width: 'auto' }} value={as} onChange={(e) => setAs(e.target.value)} aria-label="Kết nối với tư cách">
          {editors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      <button type="button" className="btn btn-orange" disabled={busy} onClick={() => run('create_connection', { _target: targetId, _as_company: as || editors[0].id })}>
        <svg className="ic"><use href="#ic-plus" /></svg> {busy ? 'Đang gửi…' : 'Kết nối'}
      </button>
      {error}
    </>
  );
}
