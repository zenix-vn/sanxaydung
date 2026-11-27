'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { ROLE_LABELS } from '@/lib/format';

const ROLES = ['admin', 'editor', 'member'] as const;
const ROLE_HELP: Record<string, string> = {
  admin: 'Toàn quyền như chủ sở hữu, trừ gỡ chủ sở hữu',
  editor: 'Sửa hồ sơ, đăng tin, gửi báo giá, đăng bài',
  member: 'Xem nội bộ, nhắn tin',
};

/** Form mời thành viên theo email → hiện link mời để sao chép. */
export function InviteForm({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('editor');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLink(null);
    setBusy(true);
    const { data, error } = await createSupabaseBrowser().rpc('invite_member', { _company: companyId, _email: email.trim(), _role: role });
    setBusy(false);
    if (error) return setErr(error.message);
    setLink(`${window.location.origin}/moi/${data as string}`);
    setEmail('');
    router.refresh();
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <div>
          <label htmlFor="inv-email">Email người được mời</label>
          <input id="inv-email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ten@congty.vn" />
        </div>
        <div>
          <label htmlFor="inv-role">Vai trò</label>
          <select id="inv-role" className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <small className="muted" style={{ fontSize: 12 }}>{ROLE_HELP[role]}</small>
        </div>
      </div>
      {err && <div className="notice" style={{ background: '#fdecea', color: '#a12622', margin: '12px 0 0' }}>{err}</div>}
      {link && (
        <div className="notice" style={{ margin: '12px 0 0' }}>
          Đã tạo lời mời (hiệu lực 7 ngày). Nếu người này đã có tài khoản, họ sẽ nhận thông báo. Bạn cũng có thể gửi link qua Zalo/email:
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <input className="input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} style={{ flex: 1 }} />
            <button type="button" className="btn btn-outline btn-sm" onClick={copy}>{copied ? 'Đã chép' : 'Sao chép'}</button>
          </div>
        </div>
      )}
      <button className="btn btn-orange mt-16" type="submit" disabled={busy}>{busy ? 'Đang tạo…' : 'Tạo lời mời'}</button>
    </form>
  );
}

async function call(fn: string, args: Record<string, unknown>) {
  const { error } = await createSupabaseBrowser().rpc(fn, args);
  if (error) {
    alert(error.message);
    return false;
  }
  return true;
}

/** Đổi vai trò / gỡ một thành viên (không áp dụng cho chủ sở hữu và chính mình). */
export function MemberRow({ id, role, self, canManage }: { id: string; role: string; self: boolean; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (role === 'owner') return <span className="badge orange">{ROLE_LABELS.owner}</span>;
  if (self) {
    return (
      <div className="row" style={{ gap: 10, justifyContent: 'flex-end' }}>
        <span className="badge">{ROLE_LABELS[role] ?? role}</span>
        <button
          className="btn-link danger"
          disabled={busy}
          onClick={async () => {
            if (!confirm('Rời khỏi doanh nghiệp này? Bạn sẽ mất quyền truy cập bảng điều khiển của công ty.')) return;
            setBusy(true);
            if (await call('remove_member', { _member: id })) window.location.assign('/dashboard');
            setBusy(false);
          }}
        >
          Rời công ty
        </button>
      </div>
    );
  }
  if (!canManage) return <span className="badge">{ROLE_LABELS[role] ?? role}</span>;

  return (
    <div className="row" style={{ gap: 10, justifyContent: 'flex-end' }}>
      <select
        className="input"
        style={{ width: 'auto', padding: '6px 10px' }}
        defaultValue={role}
        disabled={busy}
        aria-label="Vai trò"
        onChange={async (e) => {
          setBusy(true);
          if (await call('set_member_role', { _member: id, _role: e.target.value })) router.refresh();
          setBusy(false);
        }}
      >
        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
      </select>
      <button
        className="btn-link danger"
        disabled={busy}
        onClick={async () => {
          if (!confirm('Gỡ thành viên này khỏi doanh nghiệp?')) return;
          setBusy(true);
          if (await call('remove_member', { _member: id })) router.refresh();
          setBusy(false);
        }}
      >
        Gỡ
      </button>
    </div>
  );
}

export function RevokeInvite({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-link danger"
      disabled={busy}
      onClick={async () => {
        if (!confirm('Thu hồi lời mời này?')) return;
        setBusy(true);
        if (await call('revoke_invitation', { _id: id })) router.refresh();
        setBusy(false);
      }}
    >
      Thu hồi
    </button>
  );
}
