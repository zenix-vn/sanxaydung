/**
 * Edge Function: recompute-trust
 * Kích hoạt tính lại Trust Score cho 1 hoặc nhiều công ty.
 * Gọi từ DB webhook (sau review/verification) hoặc từ admin.
 *
 * Body:
 *   { company_id: string }                  — tính lại 1 công ty
 *   { company_ids: string[] }               — tính lại nhiều công ty
 *   { all: true }                           — tính lại toàn bộ (cron)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { forbidden, isServiceRole } from '../_shared/auth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  // Xác thực: chỉ service_role hoặc DB webhook mới được gọi
  if (!isServiceRole(req)) return forbidden();

  try {
    const body = await req.json() as {
      company_id?: string;
      company_ids?: string[];
      all?: boolean;
    };

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    let companyIds: string[] = [];

    if (body.all) {
      const { data } = await supa
        .from('companies')
        .select('id')
        .is('deleted_at', null);
      companyIds = (data ?? []).map((r: { id: string }) => r.id);
    } else if (body.company_ids?.length) {
      companyIds = body.company_ids;
    } else if (body.company_id) {
      companyIds = [body.company_id];
    }

    if (companyIds.length === 0) {
      return Response.json({ error: 'Không có company_id' }, { status: 400 });
    }

    const results: Array<{ id: string; score?: number; error?: string }> = [];

    for (const id of companyIds) {
      const { data, error } = await supa.rpc('compute_trust_score', { _company: id });
      if (error) {
        results.push({ id, error: error.message });
      } else {
        results.push({ id, score: data as number });
      }
    }

    const ok = results.filter((r) => !r.error).length;
    const failed = results.filter((r) => r.error).length;

    return Response.json({ processed: ok, failed, results });
  } catch (err) {
    console.error('recompute-trust error:', err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
});
