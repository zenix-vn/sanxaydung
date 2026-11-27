'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { useAdmin } from '@/components/admin/ui';
import CompanyPicker, { type Picked } from '@/components/admin/CompanyPicker';
import { vnd } from '@/lib/plans';

type P = { id: string; name: string; price: number };
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
const blank = (plan: string) => ({ plan, months: '1', amount: '', method: 'bank_transfer', invoice: '', reference: '', paid: today(), note: '' });

/** Ghi nhận tiền đã nhận (kích hoạt / gia hạn gói), hoặc cấp gói tặng. */
export default function RecordPayment({ plans }: { plans: P[] }) {
  const { toast, ask } = useAdmin();
  const router = useRouter();
  const first = plans.find((p) => p.price > 0)?.id ?? plans[0]?.id ?? '';
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState<Picked | null>(null);
  const [free, setFree] = useState(false);
  const [f, setF] = useState(() => blank(first));
  const [busy, setBusy] = useState(false);

  const plan = plans.find((p) => p.id === f.plan);
  const suggested = plan ? plan.price * Number(f.months || 0) : 0;
  const amount = f.amount === '' ? suggested : Number(f.amount.replace(/\D/g, ''));
  const set = (k: keyof ReturnType<typeof blank>) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!company) return toast('err', 'Chọn doanh nghiệp');
    const months = Number(f.months || 0);
    if (!free && amount <= 0) return toast('err', 'Nhập số tiền đã nhận');
    const ok = await ask({
      title: free ? 'Cấp gói không thu tiền?' : `Ghi nhận ${vnd(amount)}?`,
      message: `${company.name}\n${f.plan ? `Gói ${plan?.name} · ${months} tháng` : 'Không kích hoạt gói'}${free ? '\nGói đang chạy (nếu có) sẽ bị thay thế.' : months > 0 ? '\nCùng loại đang chạy thì cộng nối tiếp, khác loại thì thay thế.' : ''}`,
      confirmLabel: free ? 'Cấp gói' : 'Ghi nhận',
    });
    if (!ok) return;
    setBusy(true);
    const supa = createSupabaseBrowser();
    const { error } = free
      ? await supa.rpc('admin_grant_plan', { _company: company.id, _plan: f.plan, _months: months })
      : await supa.rpc('admin_record_payment', {
          _company: company.id, _plan: f.plan || null, _months: f.plan ? months : 0, _amount: amount, _method: f.method,
          _invoice: f.invoice || null, _reference: f.reference || null, _paid_at: f.paid || null, _note: f.note || null,
        });
    setBusy(false);
    if (error) return toast('err', error.message);
    toast('ok', free ? 'Đã cấp gói' : 'Đã ghi nhận thanh toán');
    setCompany(null); setF(blank(first)); setFree(false); setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <div style={{ marginBottom: 14 }}>
        <button type="button" className="ab o" onClick={() => setOpen(true)}><svg className="ic"><use href="#ic-plus" /></svg> Ghi nhận thanh toán / cấp gói</button>
      </div>
    );
  }
  return (
    <form className="adm-card" onSubmit={submit} style={{ marginBottom: 16 }}>
      <div className="hd"><h2>Ghi nhận thanh toán / cấp gói</h2><button type="button" className="ab" onClick={() => setOpen(false)}>Đóng</button></div>
      <div className="bd">
        <div className="adm-fields">
          <div className="full"><span>Doanh nghiệp *</span><CompanyPicker value={company} onChange={setCompany} /></div>
          <label>Gói
            <select className="adm-in" value={f.plan} onChange={set('plan')}>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              {!free && <option value="">Không kích hoạt gói (dịch vụ khác)</option>}
            </select>
          </label>
          <label>Số tháng<input className="adm-in" type="number" min={free ? 1 : 0} max={36} value={f.plan ? f.months : '0'} disabled={!f.plan} onChange={set('months')} required /></label>
          {!free && (<>
            <label>Số tiền đã nhận (₫) *<input className="adm-in" inputMode="numeric" value={f.amount} onChange={set('amount')} placeholder={suggested ? suggested.toLocaleString('vi-VN') : '0'} /></label>
            <label>Hình thức<select className="adm-in" value={f.method} onChange={set('method')}><option value="bank_transfer">Chuyển khoản</option><option value="cash">Tiền mặt</option><option value="other">Khác</option></select></label>
            <label>Số hóa đơn<input className="adm-in" value={f.invoice} onChange={set('invoice')} /></label>
            <label>Mã giao dịch ngân hàng<input className="adm-in" value={f.reference} onChange={set('reference')} /></label>
            <label>Ngày nhận tiền<input className="adm-in" type="date" max={today()} value={f.paid} onChange={set('paid')} required /></label>
            <label>Ghi chú<input className="adm-in" value={f.note} onChange={set('note')} /></label>
          </>)}
        </div>
        <label className="adm-inline"><input type="checkbox" checked={free} onChange={(e) => { setFree(e.target.checked); if (e.target.checked && !f.plan) setF({ ...f, plan: first }); }} /> Cấp tặng, không thu tiền</label>
        <button className="ab p" type="submit" disabled={busy || !company}>{busy ? 'Đang lưu…' : free ? 'Cấp gói' : `Ghi nhận ${amount ? vnd(amount) : ''}`}</button>
      </div>
    </form>
  );
}
