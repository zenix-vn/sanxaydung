'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';

export interface MyCo { id: string; name: string; role: string }
export interface ExistingConn { id: string; status: string; mineId: string; iAmTarget: boolean }

// Gửi yêu cầu kết nối (create_connection) hoặc xác nhận hoàn tất (complete_connection) để mở khóa đánh giá.
export default function ConnectButton({ targetId, mine, existing }: { targetId: string; mine: MyCo[]; existing: ExistingConn | null }) {
  const router = useRouter();
  const [as, setAs] = useState(mine[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const editors = mine.filter((c) => ['owner', 'admin', 'editor'].includes(c.role));
  const admin = existing ? mine.find((c) => c.id === existing.mineId && ['owner', 'admin'].includes(c.role)) : null;

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    setErr(null);
    const { error } = await fn();
    setBusy(false);
    if (error) return setErr(error.message);
    router.refresh();
  }

  if (existing && existing.status !== 'cancelled') {
    if (existing.status === 'completed') return <span className="badge green">Đã hợp tác</span>;
    const rpc = (fn: string, args: Record<string, unknown>) => () => createSupabaseBrowser().rpc(fn, args);
    return (
      <>
        {existing.status === 'pending' && existing.iAmTarget && admin && (
          <>
            <a className="btn btn-orange" onClick={() => !busy && run(rpc('respond_connection', { _connection: existing.id, _as_company: admin.id, _accept: true }))}>
              <svg className="ic"><use href="#ic-check" /></svg> {busy ? 'Đang lưu…' : 'Chấp nhận kết nối'}
            </a>
            <a className="btn btn-outline" onClick={() => !busy && run(rpc('respond_connection', { _connection: existing.id, _as_company: admin.id, _accept: false }))}>Từ chối</a>
          </>
        )}
        {existing.status === 'pending' && !existing.iAmTarget && <span className="badge gray" style={{ alignSelf: 'center' }}>Đã gửi kết nối · chờ phản hồi</span>}
        {existing.status === 'pending' && existing.iAmTarget && !admin && <span className="badge gray" style={{ alignSelf: 'center' }}>Có yêu cầu kết nối · chờ admin phản hồi</span>}
        {existing.status === 'accepted' && (
          <>
            <span className="badge green" style={{ alignSelf: 'center' }}>Đã kết nối</span>
            {admin && (
              <a
                className="btn btn-outline"
                title="Xác nhận hai bên đã hợp tác xong để mở đánh giá"
                onClick={() => !busy && run(rpc('complete_connection', { _connection: existing.id, _as_company: admin.id }))}
              >
                <svg className="ic"><use href="#ic-check" /></svg> {busy ? 'Đang lưu…' : 'Xác nhận hoàn tất hợp tác'}
              </a>
            )}
          </>
        )}
        {err && <small style={{ color: '#a12622', width: '100%' }}>{err}</small>}
      </>
    );
  }

  if (editors.length === 0) {
    return (
      <a className="btn btn-orange" href="/login?redirect=/directory">
        <svg className="ic"><use href="#ic-plus" /></svg> Kết nối
      </a>
    );
  }

  return (
    <>
      {editors.length > 1 && (
        <select className="input" style={{ width: 'auto' }} value={as} onChange={(e) => setAs(e.target.value)}>
          {editors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      <a
        className="btn btn-orange"
        onClick={() => !busy && run(() => createSupabaseBrowser().rpc('create_connection', { _target: targetId, _as_company: as || editors[0].id }))}
      >
        <svg className="ic"><use href="#ic-plus" /></svg> {busy ? 'Đang gửi…' : 'Kết nối'}
      </a>
      {err && <small style={{ color: '#a12622', width: '100%' }}>{err}</small>}
    </>
  );
}
