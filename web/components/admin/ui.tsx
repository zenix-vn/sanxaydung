'use client';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';

/* ---------------- Toast + hộp thoại xác nhận ---------------- */
export interface Field {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'number' | 'select';
  options?: { value: string; label: string }[];
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
}
export interface ConfirmOpts {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  fields?: Field[];
}
type Toast = { id: number; kind: 'ok' | 'err' | 'info'; text: string };
interface Ctx {
  toast: (kind: Toast['kind'], text: string) => void;
  ask: (o: ConfirmOpts) => Promise<Record<string, string> | null>;
}
const AdminCtx = createContext<Ctx | null>(null);
export const useAdmin = () => {
  const c = useContext(AdminCtx);
  if (!c) throw new Error('useAdmin ngoài AdminProvider');
  return c;
};

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dlg, setDlg] = useState<{ o: ConfirmOpts; vals: Record<string, string>; err?: string } | null>(null);
  const resolver = useRef<((v: Record<string, string> | null) => void) | null>(null);
  const seq = useRef(0);

  const toast = useCallback((kind: Toast['kind'], text: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'err' ? 6000 : 3200);
  }, []);

  const ask = useCallback(
    (o: ConfirmOpts) =>
      new Promise<Record<string, string> | null>((resolve) => {
        resolver.current = resolve;
        const vals: Record<string, string> = {};
        (o.fields ?? []).forEach((f) => (vals[f.key] = f.defaultValue ?? f.options?.[0]?.value ?? ''));
        setDlg({ o, vals });
      }),
    [],
  );

  function close(v: Record<string, string> | null) {
    resolver.current?.(v);
    resolver.current = null;
    setDlg(null);
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dlg) return;
    const miss = (dlg.o.fields ?? []).find((f) => f.required && !dlg.vals[f.key]?.trim());
    if (miss) return setDlg({ ...dlg, err: `Vui lòng nhập: ${miss.label}` });
    close(dlg.vals);
  }

  return (
    <AdminCtx.Provider value={{ toast, ask }}>
      {children}
      {dlg && (
        <div className="adm-modal-bg" onMouseDown={(e) => e.target === e.currentTarget && close(null)} onKeyDown={(e) => e.key === 'Escape' && close(null)}>
          <form className="adm-modal" role="dialog" aria-modal="true" aria-label={dlg.o.title} onSubmit={submit}>
            <h3>{dlg.o.title}</h3>
            {dlg.o.message && <p>{dlg.o.message}</p>}
            {(dlg.o.fields ?? []).map((f, i) => (
              <div key={f.key}>
                <label htmlFor={`f-${f.key}`}>{f.label}{f.required && ' *'}</label>
                {f.type === 'select' ? (
                  <select id={`f-${f.key}`} value={dlg.vals[f.key]} onChange={(e) => setDlg({ ...dlg, vals: { ...dlg.vals, [f.key]: e.target.value } })}>
                    {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea id={`f-${f.key}`} rows={3} autoFocus={i === 0} placeholder={f.placeholder} value={dlg.vals[f.key]} onChange={(e) => setDlg({ ...dlg, vals: { ...dlg.vals, [f.key]: e.target.value } })} />
                ) : (
                  <input id={`f-${f.key}`} type={f.type ?? 'text'} autoFocus={i === 0} placeholder={f.placeholder} value={dlg.vals[f.key]} onChange={(e) => setDlg({ ...dlg, vals: { ...dlg.vals, [f.key]: e.target.value } })} />
                )}
              </div>
            ))}
            {dlg.err && <p style={{ color: 'var(--red)', margin: '8px 0 0' }}>{dlg.err}</p>}
            <div className="ft">
              <button type="button" className="ab" onClick={() => close(null)}>Hủy</button>
              <button type="submit" className={`ab ${dlg.o.danger ? 'd' : 'p'}`} autoFocus={!(dlg.o.fields ?? []).length} style={dlg.o.danger ? { background: 'var(--red)', color: '#fff', borderColor: 'var(--red)' } : undefined}>
                {dlg.o.confirmLabel ?? 'Xác nhận'}
              </button>
            </div>
          </form>
        </div>
      )}
      <div className="adm-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`adm-toast ${t.kind}`}>
            <svg className="ic" style={{ width: 18, height: 18 }}><use href={t.kind === 'err' ? '#ic-x' : '#ic-check'} /></svg>
            {t.text}
          </div>
        ))}
      </div>
    </AdminCtx.Provider>
  );
}

/* ---------------- Nút gọi RPC (xác nhận → gọi → toast → refresh) ---------------- */
export function Act({
  label, icon, tone, fn, args, fieldArgs, confirm, success, onDone, title, also,
}: {
  label: string;
  icon?: string;
  tone?: 'p' | 'd' | 'o';
  fn: string;
  args: Record<string, unknown>;
  /** ánh xạ giá trị ô nhập của hộp thoại → tên tham số RPC */
  fieldArgs?: Record<string, string>;
  confirm?: ConfirmOpts;
  success?: string;
  onDone?: () => void;
  title?: string;
  /** RPC thứ hai chạy ngay sau khi RPC chính thành công (vd. ẩn nội dung rồi đóng báo cáo) */
  also?: { fn: string; args: Record<string, unknown> };
}) {
  const { ask, toast } = useAdmin();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function click() {
    let extra: Record<string, unknown> = {};
    if (confirm) {
      const v = await ask({ danger: tone === 'd', ...confirm });
      if (!v) return;
      for (const [k, arg] of Object.entries(fieldArgs ?? {})) {
        const raw = v[k];
        extra[arg] = raw === '' ? null : /^\d+$/.test(raw) && arg.includes('months') ? Number(raw) : raw;
      }
    }
    setBusy(true);
    const supa = createSupabaseBrowser();
    let { error } = await supa.rpc(fn, { ...args, ...extra });
    if (!error && also) ({ error } = await supa.rpc(also.fn, also.args));
    setBusy(false);
    if (error) return toast('err', error.message);
    toast('ok', success ?? 'Đã cập nhật');
    onDone?.();
    router.refresh();
  }

  return (
    <button className={`ab${tone ? ` ${tone}` : ''}`} onClick={click} disabled={busy} title={title}>
      {icon && <svg className="ic"><use href={`#${icon}`} /></svg>}
      {busy ? 'Đang xử lý…' : label}
    </button>
  );
}

/* ---------------- Xem tài liệu riêng tư qua signed URL ---------------- */
export function SignedLink({ bucket, path, label = 'Xem tài liệu' }: { bucket: string; path: string; label?: string }) {
  const { toast } = useAdmin();
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    const clean = path.replace(new RegExp(`^.*/${bucket}/`), '');
    const { data, error } = await createSupabaseBrowser().storage.from(bucket).createSignedUrl(clean, 300);
    setBusy(false);
    if (error || !data) return toast('err', error?.message ?? 'Không tạo được liên kết');
    window.open(data.signedUrl, '_blank', 'noopener');
  }
  return (
    <button className="ab" onClick={open} disabled={busy}>
      <svg className="ic"><use href="#ic-file-text" /></svg> {busy ? '…' : label}
    </button>
  );
}

/* ---------------- Thành phần trình bày (server-safe) ---------------- */
const TONE: Record<string, string> = {
  pending: 'o', open: 'o', reviewing: 'b', verified: 'g', approved: 'g', resolved: 'g', published: 'g', active: 'g', open_listing: 'g',
  rejected: 'r', dismissed: '', suspended: 'r', hidden: 'r', cancelled: '', closed: '', draft: '', duplicate: '', past_due: 'r',
};
const LABEL: Record<string, string> = {
  pending: 'Chờ duyệt', open: 'Mới', reviewing: 'Đang xem', verified: 'Đã xác minh', approved: 'Đã duyệt', resolved: 'Đã xử lý',
  published: 'Công khai', active: 'Đang hoạt động', rejected: 'Từ chối', dismissed: 'Bỏ qua', suspended: 'Đình chỉ', hidden: 'Đã ẩn',
  cancelled: 'Đã hủy', closed: 'Đã đóng', draft: 'Nháp', duplicate: 'Trùng', past_due: 'Quá hạn', fulfilled: 'Hoàn tất', expired: 'Hết hạn',
};
export function Status({ s }: { s: string }) {
  return <span className={`bdg ${TONE[s] ?? ''}`}>{LABEL[s] ?? s}</span>;
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="adm-empty">
      <svg className="ic"><use href="#ic-clipboard" /></svg>
      <b>{title}</b>
      {hint}
    </div>
  );
}

export function Tabs({ base, param = 'status', items, current }: { base: string; param?: string; items: { key: string; label: string; count?: number }[]; current: string }) {
  return (
    <nav className="adm-tabs" aria-label="Bộ lọc">
      {items.map((t) => (
        <Link key={t.key} href={`${base}?${param}=${t.key}`} className={t.key === current ? 'on' : ''}>
          {t.label}
          {t.count != null && t.count > 0 && <span className="c">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function Pager({ base, params, page, total, size }: { base: string; params: Record<string, string | undefined>; page: number; total: number; size: number }) {
  const pages = Math.max(1, Math.ceil(total / size));
  const href = (p: number) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && q.set(k, v));
    q.set('page', String(p));
    return `${base}?${q}`;
  };
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  return (
    <div className="adm-pg">
      <span>{from}–{Math.min(page * size, total)} / {total}</span>
      <div>
        {page > 1 ? <Link className="ab" href={href(page - 1)}>← Trước</Link> : <span className="ab" style={{ opacity: .45 }}>← Trước</span>}
        <span style={{ padding: '7px 6px' }}>Trang {page}/{pages}</span>
        {page < pages ? <Link className="ab" href={href(page + 1)}>Sau →</Link> : <span className="ab" style={{ opacity: .45 }}>Sau →</span>}
      </div>
    </div>
  );
}

export function Who({ name, sub, logo, color }: { name: string; sub?: string | null; logo?: string | null; color: string }) {
  const ini = name.split(' ').filter((w) => w.length > 1).slice(-2).map((w) => w[0].toUpperCase()).join('') || '?';
  return (
    <div className="who">
      <span className="a" style={{ background: color }}>{logo ? <img src={logo} alt="" /> : ini}</span>
      <div><b>{name}</b>{sub && <small>{sub}</small>}</div>
    </div>
  );
}
