/**
 * Edge Function: payment-webhook  (KHUNG — chưa gắn cổng thanh toán cụ thể)
 * Nhận webhook thanh toán gói Verified / Nổi bật → ghi `subscriptions`.
 *
 * Xác thực: HMAC-SHA256 của RAW body với PAYMENT_WEBHOOK_SECRET,
 *           gửi ở header `x-signature` (hex). Sai chữ ký → 401, không đụng DB.
 * Idempotent: `provider_ref` (mã giao dịch) duy nhất → gọi lại cùng giao dịch không nhân đôi gói.
 *
 * Body: { provider_ref, company_id, plan_id, status: 'paid'|'failed'|'refunded', months?: number }
 * Khi gắn cổng thật (VNPay/PayOS/Momo…): sửa `parseEvent` cho đúng định dạng của họ.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET = Deno.env.get('PAYMENT_WEBHOOK_SECRET') ?? '';

interface PaymentEvent {
  provider_ref: string;
  company_id: string;
  plan_id: string;
  status: 'paid' | 'failed' | 'refunded';
  months?: number;
}

async function validSignature(raw: string, signature: string): Promise<boolean> {
  if (!SECRET || !signature) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)));
  const expected = Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

function parseEvent(raw: string): PaymentEvent | null {
  try {
    const e = JSON.parse(raw) as PaymentEvent;
    if (!e.provider_ref || !e.company_id || !e.plan_id || !e.status) return null;
    return e;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const raw = await req.text();
  if (!(await validSignature(raw, req.headers.get('x-signature') ?? ''))) {
    return Response.json({ error: 'Chữ ký không hợp lệ' }, { status: 401 });
  }
  const ev = parseEvent(raw);
  if (!ev) return Response.json({ error: 'Payload không hợp lệ' }, { status: 400 });

  const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: plan } = await supa.from('plans').select('id').eq('id', ev.plan_id).maybeSingle();
  if (!plan) return Response.json({ error: 'Gói không tồn tại' }, { status: 422 });

  if (ev.status === 'paid') {
    const months = Math.min(Math.max(ev.months ?? 1, 1), 36);
    const expires = new Date();
    expires.setMonth(expires.getMonth() + months);
    // upsert theo provider_ref → webhook gửi lặp không tạo thêm gói
    const { error } = await supa.from('subscriptions').upsert({
      company_id: ev.company_id,
      plan_id: ev.plan_id,
      status: 'active',
      expires_at: expires.toISOString(),
      provider_ref: ev.provider_ref,
    }, { onConflict: 'provider_ref', ignoreDuplicates: true });
    if (error) return Response.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supa.from('subscriptions')
      .update({ status: ev.status === 'refunded' ? 'cancelled' : 'past_due' })
      .eq('provider_ref', ev.provider_ref);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
});
