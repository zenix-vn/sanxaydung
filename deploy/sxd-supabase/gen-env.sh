#!/usr/bin/env bash
# Sinh .env với khóa NGẪU NHIÊN cho stack sxd (chạy trên server, 1 lần). Không ghi đè nếu đã có.
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] && { echo ".env đã tồn tại — giữ nguyên"; exit 0; }
python3 - <<'PY'
import hmac, hashlib, base64, json, secrets, time
b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b'=').decode()
secret = secrets.token_hex(32)
def jwt(role):
    h = b64(json.dumps({"alg":"HS256","typ":"JWT"}).encode())
    now = int(time.time())
    p = b64(json.dumps({"role":role,"iss":"supabase","iat":now,"exp":now+10*365*86400}).encode())
    s = b64(hmac.new(secret.encode(), f"{h}.{p}".encode(), hashlib.sha256).digest())
    return f"{h}.{p}.{s}"
env = {
 "POSTGRES_PASSWORD": secrets.token_hex(24),
 "JWT_SECRET": secret, "JWT_EXPIRY": "3600",
 "ANON_KEY": jwt("anon"), "SERVICE_ROLE_KEY": jwt("service_role"),
 "SECRET_KEY_BASE": secrets.token_hex(48),
 "KONG_HTTP_PORT": "8110",
 "API_EXTERNAL_URL": "https://sanxaydung.vn",
 "SITE_URL": "https://sanxaydung.vn",
 "ADDITIONAL_REDIRECT_URLS": "https://sanxaydung.vn/**,https://www.sanxaydung.vn/**",
 "SMTP_ADMIN_EMAIL": "no-reply@sanxaydung.vn", "SMTP_HOST": "", "SMTP_PORT": "587", "SMTP_USER": "", "SMTP_PASS": "",
 "GOOGLE_ENABLED": "false", "GOOGLE_CLIENT_ID": "", "GOOGLE_SECRET": "",
}
open(".env","w").write("".join(f"{k}={v}\n" for k,v in env.items()))
PY
chmod 600 .env
echo "đã tạo .env (chmod 600)"
