/**
 * Chỉ cho phép gọi bằng SERVICE_ROLE_KEY (DB webhook, pg_cron, admin script).
 * So khớp TOÀN BỘ token, thời gian hằng định. Không dùng includes/prefix:
 * mọi JWT HS256 đều chung ~36 ký tự header nên so tiền tố sẽ cho cả anon key qua.
 */
export function isServiceRole(req: Request): boolean {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!key || token.length !== key.length) return false;
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

export function forbidden(): Response {
  return Response.json({ error: 'Không có quyền' }, { status: 403 });
}
