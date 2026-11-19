/**
 * Edge Function: verify-company
 * Tra cứu MST/GPKD qua API ngoài, cập nhật company_verifications,
 * nâng verified_tier (trigger DB sẽ tự xử lý sau UPDATE).
 *
 * Body: { verification_id: string }
 * Auth: service_role (gọi từ dashboard sau khi admin duyệt hoặc user submit)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { forbidden, isServiceRole } from '../_shared/auth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Placeholder: URL tra cứu MST (thay bằng API chính thức khi có)
// Ví dụ: https://api.vietqr.io/v2/business/{tax_code}
const MST_API_URL = Deno.env.get('MST_LOOKUP_API_URL') ?? '';
const MST_API_KEY = Deno.env.get('MST_LOOKUP_API_KEY') ?? '';

interface VerificationRow {
  id: string;
  company_id: string;
  kind: 'tax' | 'business_license' | 'capability_cert';
  reference: string | null;
  status: string;
}

async function lookupTaxCode(taxCode: string): Promise<Record<string, unknown> | null> {
  if (!MST_API_URL || !taxCode) return null;
  try {
    const res = await fetch(`${MST_API_URL}/${encodeURIComponent(taxCode)}`, {
      headers: { Authorization: `Bearer ${MST_API_KEY}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  if (!isServiceRole(req)) return forbidden();

  try {
    const { verification_id } = await req.json() as { verification_id: string };
    if (!verification_id) {
      return Response.json({ error: 'verification_id bắt buộc' }, { status: 400 });
    }

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Lấy bản ghi xác minh
    const { data: ver, error: fetchErr } = await supa
      .from('company_verifications')
      .select('*')
      .eq('id', verification_id)
      .maybeSingle<VerificationRow>();

    if (fetchErr || !ver) {
      return Response.json({ error: 'Không tìm thấy yêu cầu xác minh' }, { status: 404 });
    }

    if (ver.status !== 'pending') {
      return Response.json({ error: `Trạng thái không hợp lệ: ${ver.status}` }, { status: 409 });
    }

    let meta: Record<string, unknown> = {};
    let newStatus: 'verified' | 'rejected' = 'pending' as never;

    if (ver.kind === 'tax' && ver.reference) {
      // MST khai xác minh phải trùng MST trên hồ sơ (nếu hồ sơ có) — tránh mượn MST của công ty khác
      const { data: co } = await supa
        .from('companies').select('tax_code').eq('id', ver.company_id).maybeSingle();
      const norm = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '');
      if (co?.tax_code && norm(co.tax_code) !== norm(ver.reference)) {
        await supa.from('company_verifications').update({
          status: 'rejected',
          meta: { reason: 'MST khai báo không trùng MST trên hồ sơ công ty' },
          verified_at: new Date().toISOString(),
        }).eq('id', verification_id);
        return Response.json({ verification_id, status: 'rejected', reason: 'tax_code_mismatch' });
      }

      // Tra cứu MST
      const apiResult = await lookupTaxCode(ver.reference);
      if (apiResult) {
        meta = apiResult;
        // Kiểm tra kết quả: nếu API trả về thông tin hợp lệ → verified
        newStatus = (apiResult as Record<string, unknown>).tin ? 'verified' : 'rejected';
      } else {
        // Không có API → pending (chờ admin duyệt thủ công)
        return Response.json({
          message: 'API tra cứu MST chưa cấu hình — yêu cầu chờ admin duyệt thủ công',
          verification_id,
          status: 'pending',
        });
      }
    } else if (ver.kind === 'capability_cert') {
      // Chứng chỉ năng lực: chỉ có thể xác minh thủ công (admin duyệt file)
      return Response.json({
        message: 'Chứng chỉ năng lực cần admin kiểm tra file — dùng dashboard admin để duyệt',
        verification_id,
        status: 'pending',
      });
    } else {
      // business_license: tương tự capability_cert, admin duyệt thủ công
      return Response.json({
        message: 'GPKD cần admin kiểm tra file — dùng dashboard admin để duyệt',
        verification_id,
        status: 'pending',
      });
    }

    // Cập nhật trạng thái
    const { error: updErr } = await supa
      .from('company_verifications')
      .update({ status: newStatus, meta, verified_at: new Date().toISOString() })
      .eq('id', verification_id);

    if (updErr) throw updErr;

    // Trigger DB (update_verified_tier) sẽ tự nâng verified_tier và recompute trust score

    return Response.json({ verification_id, status: newStatus, meta });
  } catch (err) {
    console.error('verify-company error:', err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
});
