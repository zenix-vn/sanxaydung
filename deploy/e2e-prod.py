#!/usr/bin/env python3
"""Smoke test đầu-cuối cho sanxaydung.vn (35 kiểm tra), chạy TRÊN SERVER production.

Dùng GoTrue admin tạo 2 user thử → chạy các luồng chính qua domain thật (OpenLiteSpeed → Kong →
GoTrue/PostgREST/Storage) → tự dọn dữ liệu thử. Khóa đọc từ /opt/sxd-supabase/.env, không in ra.

  scp deploy/e2e-prod.py zenix-server:/tmp/ && ssh zenix-server 'python3 /tmp/e2e-prod.py; rm /tmp/e2e-prod.py'
"""
import json, os, subprocess, urllib.request, urllib.error, secrets, struct, zlib
B = "https://sanxaydung.vn"
env = dict(l.strip().split("=", 1) for l in open("/opt/sxd-supabase/.env") if "=" in l)
ANON, SERVICE = env["ANON_KEY"], env["SERVICE_ROLE_KEY"]
res = []
def check(name, ok, info=""):
    res.append(ok); print(("PASS " if ok else "FAIL ") + name + (f"   [{info}]" if info and not ok else ""))
def call(method, path, body=None, token=None, key=ANON, raw=None, ctype="application/json", extra=None):
    h = {"apikey": key, "Authorization": "Bearer " + (token or key)}
    if raw is None and body is not None: h["Content-Type"] = ctype
    if raw is not None: h["Content-Type"] = ctype
    h.update(extra or {})
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(B + path, data=data, method=method, headers=h)
    try:
        r = urllib.request.urlopen(req, timeout=30); t = r.read().decode()
        try: return r.status, json.loads(t)
        except Exception: return r.status, t
    except urllib.error.HTTPError as e:
        t = e.read().decode()
        try: return e.code, json.loads(t)
        except Exception: return e.code, t
def sql(q):
    return subprocess.run(["docker","exec","-i","sxd-db","psql","-U","postgres","-d","postgres","-At","-v","ON_ERROR_STOP=1"], input=q, capture_output=True, text=True)
tag = secrets.token_hex(3); pw = secrets.token_hex(12)
users, companies = {}, {}
def mkuser(n):
    st, u = call("POST", "/auth/v1/admin/users", {"email": f"e2e-{n}-{tag}@example.com", "password": pw, "email_confirm": True}, key=SERVICE)
    check(f"tạo user {n} (GoTrue admin)", st == 200, f"{st} {u}")
    st, t = call("POST", "/auth/v1/token?grant_type=password", {"email": f"e2e-{n}-{tag}@example.com", "password": pw})
    check(f"đăng nhập user {n} lấy JWT", st == 200 and "access_token" in t, f"{st} {t}")
    users[n] = (u["id"], t["access_token"])
try:
    mkuser("a"); mkuser("b")
    (ua, ta), (ub, tb) = users["a"], users["b"]
    check("profile tự tạo khi đăng ký (trigger auth.users)", sql(f"select count(*) from profiles where id in ('{ua}','{ub}')").stdout.strip() == "2")
    for n, (uid, tok) in users.items():
        st, c = call("POST", "/rest/v1/companies", {"slug": f"zz-e2e-{n}-{tag}", "name": f"E2E {n.upper()} {tag}", "status": "published", "owner_id": uid}, token=tok, extra={"Prefer": "return=representation"})
        check(f"user {n} tạo công ty", st == 201, f"{st} {c}")
        cid = c[0]["id"]; companies[n] = cid
        st, m = call("POST", "/rest/v1/company_members", {"company_id": cid, "user_id": uid, "role": "owner"}, token=tok)
        check(f"user {n} thành owner (RLS bootstrap)", st == 201, f"{st} {m}")
    A, Bc = companies["a"], companies["b"]
    # Chat
    st, conv = call("POST", "/rest/v1/rpc/start_conversation", {"_as_company": A, "_target": Bc, "_context_type": "company", "_context_id": Bc}, token=ta)
    check("RPC start_conversation", st == 200 and isinstance(conv, str), f"{st} {conv}")
    st, conv2 = call("POST", "/rest/v1/rpc/start_conversation", {"_as_company": A, "_target": Bc, "_context_type": "company", "_context_id": Bc}, token=ta)
    check("start_conversation idempotent", conv2 == conv)
    st, r = call("POST", "/rest/v1/messages", {"conversation_id": conv, "sender_company_id": A, "sender_user_id": ua, "body": "xin chào từ A"}, token=ta)
    check("A gửi tin nhắn (RLS msg_send)", st == 201, f"{st} {r}")
    st, lc = call("POST", "/rest/v1/rpc/list_conversations", {"_as_company": Bc}, token=tb)
    check("B thấy hội thoại + 1 tin chưa đọc", st == 200 and len(lc) == 1 and lc[0]["unread_count"] == 1, f"{st} {lc}")
    st, msgs = call("GET", f"/rest/v1/messages?conversation_id=eq.{conv}&select=body", token=tb)
    check("B đọc được tin (RLS không đệ quy)", st == 200 and len(msgs) == 1, f"{st} {msgs}")
    st, bad = call("GET", f"/rest/v1/messages?conversation_id=eq.{conv}&select=body", token=ta, key=ANON)
    st2, anon_m = call("GET", f"/rest/v1/messages?select=body&limit=5")
    check("anon KHÔNG đọc được tin nhắn", st2 == 200 and anon_m == [], f"{st2} {anon_m}")
    st, nt = call("GET", "/rest/v1/notifications?type=eq.new_message&select=title,link", token=tb)
    check("B nhận thông báo new_message tự sinh", st == 200 and len(nt) == 1 and nt[0]["link"].startswith("/chat?c="), f"{st} {nt}")
    st, r = call("POST", "/rest/v1/rpc/mark_read", {"_conversation": conv, "_as_company": Bc}, token=tb)
    st, lc = call("POST", "/rest/v1/rpc/list_conversations", {"_as_company": Bc}, token=tb)
    check("mark_read → 0 chưa đọc", st == 200 and lc[0]["unread_count"] == 0, f"{st} {lc}")
    # Like
    st, p = call("POST", "/rest/v1/posts", {"company_id": A, "author_id": ua, "type": "news", "body": "bài e2e"}, token=ta, extra={"Prefer": "return=representation"})
    check("A đăng bài", st == 201, f"{st} {p}")
    pid = p[0]["id"]
    st, lk = call("POST", "/rest/v1/rpc/toggle_like", {"_post": pid}, token=tb)
    st2, pc = call("GET", f"/rest/v1/posts?id=eq.{pid}&select=like_count", token=tb)
    check("B thích bài của A → like_count=1", lk is True and pc[0]["like_count"] == 1, f"{lk} {pc}")
    st, _ = call("POST", "/rest/v1/rpc/toggle_like", {"_post": pid})
    check("anon KHÔNG gọi được toggle_like", st in (401, 403), st)
    # Kết nối → review
    st, cn = call("POST", "/rest/v1/rpc/create_connection", {"_target": Bc, "_as_company": A}, token=ta)
    check("A tạo kết nối tới B", st == 200 and isinstance(cn, str), f"{st} {cn}")
    st, _ = call("POST", "/rest/v1/rpc/respond_connection", {"_connection": cn, "_as_company": Bc, "_accept": True}, token=tb)
    check("B chấp nhận kết nối", st in (200, 204), st)
    st, _ = call("POST", "/rest/v1/rpc/complete_connection", {"_connection": cn, "_as_company": A}, token=ta)
    check("A xác nhận hoàn tất", st in (200, 204), st)
    st, rv = call("POST", "/rest/v1/rpc/submit_review", {"_connection": cn, "_reviewer": A, "_target": Bc, "_quality": 5, "_progress": 4, "_cost": 5, "_cooperation": 5, "_safety": 4, "_warranty": 5, "_comment": "e2e"}, token=ta)
    check("A đánh giá B (submit_review)", st == 200 and isinstance(rv, str), f"{st} {rv}")
    st, ts = call("GET", f"/rest/v1/companies?id=eq.{Bc}&select=trust_score", token=tb)
    check("Trust Score của B được tính lại > 0", st == 200 and float(ts[0]["trust_score"]) > 0, f"{ts}")
    st, nt = call("GET", "/rest/v1/notifications?type=eq.new_review&select=link", token=tb)
    check("B nhận thông báo new_review (#danhgia)", st == 200 and len(nt) == 1 and nt[0]["link"].endswith("#danhgia"), f"{nt}")
    st, rv2 = call("POST", "/rest/v1/rpc/submit_review", {"_connection": cn, "_reviewer": A, "_target": A, "_quality": 5, "_progress": 5, "_cost": 5, "_cooperation": 5, "_safety": 5, "_warranty": 5}, token=ta)
    check("KHÔNG tự đánh giá chính mình", st >= 400, f"{st}")
    # Claim (seed company chưa có chủ)
    seed = sql("select id from companies where owner_id is null and slug not like 'zz-e2e-%' limit 1").stdout.strip()
    st, cl = call("POST", "/rest/v1/rpc/claim_company", {"_company": seed, "_note": "e2e"}, token=tb)
    check("claim công ty → 'pending' (email không khớp)", st == 200 and cl == "pending", f"{st} {cl}")
    # Gói/Quyền hàm nội bộ
    st, _ = call("POST", "/rest/v1/rpc/compute_trust_score", {"_company": Bc}, token=tb)
    check("authenticated KHÔNG gọi được compute_trust_score", st in (401, 403), st)
    # Storage
    def png():
        raw = b"\x00\xff\x00\xff"; 
        def ch(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
        return b"\x89PNG\r\n\x1a\n" + ch(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)) + ch(b"IDAT", zlib.compress(b"\x00\xff\x00\x00")) + ch(b"IEND", b"")
    st, up = call("POST", f"/storage/v1/object/company-logos/{A}/logo.png", raw=png(), ctype="image/png", token=ta)
    check("A upload logo vào folder công ty mình", st == 200, f"{st} {up}")
    st, up2 = call("POST", f"/storage/v1/object/company-logos/{A}/hack.png", raw=png(), ctype="image/png", token=tb)
    check("B KHÔNG upload được vào folder công ty A", st in (400, 401, 403), f"{st} {up2}")
    st, up3 = call("POST", f"/storage/v1/object/company-logos/{A}/bad.txt", raw=b"hello", ctype="text/plain", token=ta)
    check("Storage chặn MIME không phải ảnh", st >= 400, f"{st} {up3}")
    req = urllib.request.Request(B + f"/storage/v1/object/public/company-logos/{A}/logo.png")
    try: pst = urllib.request.urlopen(req, timeout=20).status
    except urllib.error.HTTPError as e: pst = e.code
    check("Logo công khai đọc được (public bucket)", pst == 200, pst)
    # Xóa tài khoản
    st, _ = call("POST", "/rest/v1/rpc/delete_my_account", {}, token=tb)
    check("delete_my_account chạy được", st in (200, 204), st)
    st, t = call("POST", "/auth/v1/token?grant_type=password", {"email": f"e2e-b-{tag}@example.com", "password": pw})
    check("sau khi xóa: KHÔNG đăng nhập lại được", st >= 400, f"{st}")
finally:
    ids = ",".join(f"'{c}'" for c in companies.values()) or "NULL"
    uids = ",".join(f"'{u[0]}'" for u in users.values()) or "NULL"
    for c in companies.values():
        for o in sql(f"select bucket_id||'/'||name from storage.objects where name like '{c}/%'").stdout.split():
            call("DELETE", "/storage/v1/object/" + o, key=SERVICE)
    for u in users.values():
        sql(f"delete from audit_log where actor_id='{u[0]}'")
    out = sql(f"""
      delete from reviews where reviewer_company_id in ({ids}) or target_company_id in ({ids});
      delete from notifications where user_id in ({uids});
      delete from company_claims where user_id in ({uids});
      delete from audit_log where actor_id in ({uids});
      delete from conversations where id in (select conversation_id from conversation_participants where company_id in ({ids}));
      delete from companies where id in ({ids});
      select (select count(*) from companies where slug like 'zz-e2e-%') || ' công ty thử còn lại, ' || (select count(*) from auth.users where email like 'e2e-%@example.com') || ' user thử còn lại';
    """)
    for u in users.values(): print("xóa user", call("DELETE", "/auth/v1/admin/users/" + u[0], key=SERVICE)[0])
    out = sql("select (select count(*) from companies where slug like 'zz-e2e-%') || ' công ty thử, ' || (select count(*) from auth.users where email like 'e2e-%@example.com' or email like 'deleted-%@deleted.invalid') || ' user thử, ' || (select count(*) from storage.objects where bucket_id='company-logos') || ' file thử còn lại'")
    print("DỌN DẸP:", out.stdout.strip().splitlines()[-1] if out.stdout.strip() else out.stderr[:300])
print(f"\nKẾT QUẢ: {sum(res)}/{len(res)} đạt")
