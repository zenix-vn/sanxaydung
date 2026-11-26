'use client';
/** Công cụ dùng chung cho các hàng chờ: chọn nhiều dòng, người đang xử lý, ghi chú nội bộ. */
import { createContext, useContext, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/components/admin/ui';
import { createSupabaseBrowser } from '@/lib/supabase/client';

export type QueueKind = 'verification' | 'claim' | 'registration' | 'report' | 'listing';
export type QueueMeta = Record<string, {
  assignee: string | null; assignee_name: string | null;
  notes: { id: string; body: string; author: string; created_at: string }[];
}>;
export interface BulkAction {
  action: string; label: string; tone?: 'p' | 'd'; message: string;
  reason?: { required?: boolean; suggestions: string[] };
}

interface Ctx {
  kind: QueueKind; meId: string; meta: QueueMeta; ids: string[]; labels: Record<string, string>;
  sel: string[]; setSel: (s: string[]) => void;
}
const QueueCtx = createContext<Ctx | null>(null);
const useQueue = () => {
  const c = useContext(QueueCtx);
  if (!c) throw new Error('thiếu <Queue>');
  return c;
};

const when = (iso: string) => new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function Queue({ kind, meId, meta, labels, actions, children }: {
  kind: QueueKind; meId: string; meta: QueueMeta; labels: Record<string, string>; actions: BulkAction[]; children: React.ReactNode;
}) {
  const [picked, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const { ask, toast } = useAdmin();
  const router = useRouter();
  const ids = Object.keys(labels);
  const sel = picked.filter((id) => ids.includes(id)); // bỏ dòng đã rời trang

  async function assign() {
    setBusy(true);
    const { data, error } = await createSupabaseBrowser().rpc('admin_assign', { _kind: kind, _ids: sel, _take: true });
    setBusy(false);
    if (error) return toast('err', error.message);
    const skipped = sel.length - Number(data);
    toast('ok', `Đã nhận ${data} mục${skipped ? ` · ${skipped} mục đang có người xử lý` : ''}`);
    setSel([]);
    router.refresh();
  }

  async function run(a: BulkAction) {
    const v = await ask({
      title: `${a.label} ${sel.length} mục?`, message: a.message, confirmLabel: a.label, danger: a.tone === 'd',
      fields: a.reason ? [{ key: 'note', label: a.reason.required ? 'Lý do' : 'Lý do (không bắt buộc)', type: 'textarea', required: a.reason.required, suggestions: a.reason.suggestions }] : [],
    });
    if (!v) return;
    setBusy(true);
    const { data, error } = await createSupabaseBrowser().rpc('admin_bulk_review', { _kind: kind, _ids: sel, _action: a.action, _note: v.note?.trim() || null });
    setBusy(false);
    if (error) return toast('err', error.message);
    const res = data as { id: string; ok: boolean; message?: string }[];
    const failed = res.filter((r) => !r.ok);
    if (res.length > failed.length) toast('ok', `Đã xử lý ${res.length - failed.length}/${res.length} mục`);
    setSel(failed.map((f) => f.id));
    router.refresh();
    if (failed.length) {
      await ask({ title: `${failed.length} mục chưa xử lý được`, message: failed.map((f) => `• ${labels[f.id] ?? f.id}: ${f.message}`).join('\n'), confirmLabel: 'Đã hiểu', infoOnly: true });
    }
  }

  return (
    <QueueCtx.Provider value={{ kind, meId, meta, ids, labels, sel, setSel }}>
      {sel.length > 0 && (
        <div className="adm-bulk" role="region" aria-label="Thao tác hàng loạt">
          <b>Đã chọn {sel.length}</b>
          <button type="button" className="ab" onClick={assign} disabled={busy}>Nhận xử lý</button>
          {actions.map((a) => <button type="button" key={a.action} className={`ab ${a.tone ?? ''}`} onClick={() => run(a)} disabled={busy}>{a.label}</button>)}
          <button type="button" className="ab" onClick={() => setSel([])}>Bỏ chọn</button>
        </div>
      )}
      {children}
    </QueueCtx.Provider>
  );
}

export function CheckAll() {
  const { ids, sel, setSel } = useQueue();
  const all = ids.length > 0 && sel.length === ids.length;
  return <input type="checkbox" className="adm-check" aria-label="Chọn tất cả trên trang" checked={all}
    ref={(el) => { if (el) el.indeterminate = !all && sel.length > 0; }} onChange={() => setSel(all ? [] : ids)} />;
}

export function Check({ id }: { id: string }) {
  const { sel, setSel, labels } = useQueue();
  const on = sel.includes(id);
  return <input type="checkbox" className="adm-check" aria-label={`Chọn ${labels[id] ?? ''}`} checked={on} onChange={() => setSel(on ? sel.filter((x) => x !== id) : [...sel, id])} />;
}

/** Cột "Phụ trách": người đang xử lý + ghi chú nội bộ. */
export function WorkCell({ id }: { id: string }) {
  const { kind, meId, meta, labels } = useQueue();
  const { ask, toast } = useAdmin();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const m = meta[id];
  const holder = m?.assignee ?? null;
  const notes = m?.notes ?? [];

  async function call(fn: string, args: Record<string, unknown>) {
    setBusy(true);
    const { data, error } = await createSupabaseBrowser().rpc(fn, args);
    setBusy(false);
    if (error) { toast('err', error.message); return false; }
    if (fn === 'admin_assign' && data === 0) toast('err', 'Mục này vừa có người khác nhận');
    router.refresh();
    return true;
  }
  const take = (force = false) => call('admin_assign', { _kind: kind, _ids: [id], _take: true, _force: force });
  async function takeOver() {
    if (await ask({ title: 'Chuyển sang bạn xử lý?', message: `${m?.assignee_name} đang xử lý mục này.`, confirmLabel: 'Chuyển' })) await take(true);
  }
  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim() && (await call('admin_add_note', { _kind: kind, _id: id, _body: text }))) setText('');
  }

  return (
    <div className="adm-work">
      {holder === null ? <button type="button" className="ab" onClick={() => take()} disabled={busy}>Nhận</button>
        : holder === meId ? <><span className="bdg b">Bạn</span><button type="button" className="link" onClick={() => call('admin_assign', { _kind: kind, _ids: [id], _take: false })} disabled={busy}>Bỏ nhận</button></>
        : <><span className="bdg o">{m?.assignee_name}</span><button type="button" className="link" onClick={takeOver} disabled={busy}>Chuyển cho tôi</button></>}
      <button type="button" className={`link${notes.length ? ' has' : ''}`} onClick={() => setOpen(true)}>
        {notes.length ? `${notes.length} ghi chú` : '+ Ghi chú'}
      </button>
      {open && (
        <div className="adm-modal-bg" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
          <form className="adm-modal" role="dialog" aria-modal="true" aria-label="Ghi chú nội bộ" onSubmit={addNote}>
            <h3>Ghi chú nội bộ</h3>
            <p>{labels[id]} — chỉ nhân sự quản trị đọc được.</p>
            {notes.length > 0 && (
              <ul className="adm-notes">{notes.map((n) => <li key={n.id}><small>{n.author} · {when(n.created_at)}</small>{n.body}</li>)}</ul>
            )}
            <textarea rows={3} autoFocus maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="vd. Đã gọi, hẹn gửi lại giấy phép vào thứ Sáu" aria-label="Ghi chú mới" />
            <div className="ft">
              <button type="button" className="ab" onClick={() => setOpen(false)}>Đóng</button>
              <button type="submit" className="ab p" disabled={busy || !text.trim()}>Thêm ghi chú</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
