/**
 * Edge Function: notify-dispatch
 * Đẩy thông báo ra Zalo OA / Email tùy theo notification_prefs của user.
 * Kích hoạt bởi:
 *   - DB webhook khi INSERT vào bảng notifications
 *   - Cron daily-digest (body: { type: "daily_digest" })
 *
 * Body (webhook): { type: "INSERT", record: NotificationRow }
 * Body (cron):    { type: "daily_digest" }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { forbidden, isServiceRole } from '../_shared/auth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Cấu hình email (Resend)
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? 'no-reply@sanxaydung.vn';
const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://sanxaydung.vn').replace(/\/$/, '');

type Supa = ReturnType<typeof createClient<any>>;

// Nội dung thông báo chứa tên công ty/tiêu đề do người dùng nhập → phải escape trước khi đưa vào HTML email
function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
// Link nội bộ dạng "/dashboard" → tuyệt đối; chỉ chấp nhận đường dẫn nội bộ hoặc chính SITE_URL
function absLink(link?: string): string | null {
  if (!link) return null;
  if (link.startsWith('/') && !link.startsWith('//')) return SITE_URL + link;
  return link.startsWith(SITE_URL + '/') ? link : null;
}

// Cấu hình Zalo OA
const ZALO_OA_TOKEN = Deno.env.get('ZALO_OA_TOKEN') ?? '';
const ZALO_TEMPLATE_ID = Deno.env.get('ZALO_NOTIFICATION_TEMPLATE_ID') ?? '';

interface NotificationRow {
  id: string;
  user_id: string;
  company_id?: string;
  type: string;
  title?: string;
  body?: string;
  link?: string;
  data?: Record<string, unknown>;
}

interface NotifPrefs {
  user_id: string;
  email: boolean;
  zalo: boolean;
  push: boolean;
  digest: 'instant' | 'daily' | 'off';
}

interface Profile {
  id: string;
  full_name?: string;
  phone?: string;
  email?: string;  // lấy từ auth.users qua join nếu cần
}

async function sendEmail(to: string, name: string, notification: NotificationRow) {
  if (!RESEND_API_KEY) return;
  const body = {
    from: EMAIL_FROM,
    to,
    subject: notification.title ?? 'Thông báo từ Sàn Xây Dựng',
    html: `
      <p>Xin chào <b>${esc(name)}</b>,</p>
      <p>${esc(notification.body)}</p>
      ${absLink(notification.link) ? `<p><a href="${esc(absLink(notification.link))}">Xem chi tiết →</a></p>` : ''}
      <hr/>
      <small>Sàn Xây Dựng · Hủy đăng ký thông báo trong <a href="${SITE_URL}/dashboard">cài đặt</a>.</small>
    `,
  };
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function sendZalo(phone: string, notification: NotificationRow) {
  if (!ZALO_OA_TOKEN || !ZALO_TEMPLATE_ID) return;
  await fetch('https://business.openapi.zalo.me/message/template', {
    method: 'POST',
    headers: {
      access_token: ZALO_OA_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phone,
      template_id: ZALO_TEMPLATE_ID,
      template_data: {
        title: notification.title ?? 'Thông báo',
        content: notification.body ?? '',
        url: absLink(notification.link) ?? SITE_URL,
      },
    }),
  });
}

async function dispatchOne(
  supa: Supa,
  notification: NotificationRow,
) {
  // Lấy prefs của user
  const { data: prefs } = await supa
    .from('notification_prefs')
    .select('*')
    .eq('user_id', notification.user_id)
    .maybeSingle<NotifPrefs>();

  // Mặc định: gửi tất cả
  const doEmail = prefs?.email ?? true;
  const doZalo = prefs?.zalo ?? true;
  const digest = prefs?.digest ?? 'instant';

  if (digest === 'off') return;
  if (digest === 'daily') return; // digest được gom và gửi lúc 07:00

  // Lấy profile
  const { data: profile } = await supa
    .from('profiles')
    .select('*')
    .eq('id', notification.user_id)
    .maybeSingle<Profile>();

  if (!profile) return;

  // Lấy email từ auth.users (qua view auth.users service_role có thể đọc)
  const { data: authUser } = await supa.auth.admin.getUserById(notification.user_id);
  const email = authUser?.user?.email;

  if (doEmail && email) {
    await sendEmail(email, profile.full_name ?? 'Bạn', notification);
  }
  if (doZalo && profile.phone) {
    await sendZalo(profile.phone, notification);
  }
}

async function dispatchDailyDigest(supa: Supa) {
  // Gom thông báo chưa đọc trong 24h của các user có digest='daily'
  const { data: prefs } = await supa
    .from('notification_prefs')
    .select('user_id')
    .eq('digest', 'daily');

  if (!prefs?.length) return;

  const since = new Date(Date.now() - 86400_000).toISOString();

  for (const pref of prefs) {
    const { data: notifs } = await supa
      .from('notifications')
      .select('*')
      .eq('user_id', pref.user_id)
      .eq('is_read', false)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!notifs?.length) continue;

    const { data: authUser } = await supa.auth.admin.getUserById(pref.user_id);
    const email = authUser?.user?.email;
    const { data: profile } = await supa.from('profiles').select('*').eq('id', pref.user_id).maybeSingle<Profile>();

    if (email && RESEND_API_KEY) {
      const items = notifs.map((n: NotificationRow) =>
        `<li>${esc(n.title)}: ${esc(n.body)}</li>`
      ).join('');
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: email,
          subject: `Tóm tắt thông báo hôm nay từ Sàn Xây Dựng`,
          html: `<p>Xin chào <b>${esc(profile?.full_name ?? 'Bạn')}</b>,</p><ul>${items}</ul>`,
        }),
      });
    }
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
    const body = await req.json() as {
      type?: string;
      record?: NotificationRow;
    };

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    if (body.type === 'daily_digest') {
      await dispatchDailyDigest(supa);
      return Response.json({ ok: true, type: 'daily_digest' });
    }

    if (body.type === 'INSERT' && body.record) {
      await dispatchOne(supa, body.record);
      return Response.json({ ok: true, notification_id: body.record.id });
    }

    return Response.json({ error: 'Payload không hợp lệ' }, { status: 400 });
  } catch (err) {
    console.error('notify-dispatch error:', err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
});
