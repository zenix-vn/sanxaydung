#!/usr/bin/env bash
#
# Deploy trang mockup lên demo.sanxaydung.vn
#
#   ./deploy.sh          -> đồng bộ file site lên server
#   ./deploy.sh --setup  -> cài đặt nginx vhost lần đầu (cần đã trỏ DNS)
#
# Server đã khai báo sẵn trong ~/.ssh/config:
#   Host 42.96.17.167  User root  Port 8430
#
set -euo pipefail

# ------- Cấu hình (chỉnh nếu cần) -------
SSH_HOST="42.96.17.167"
SSH_PORT="8430"
SSH_USER="root"
DOMAIN="demo.sanxaydung.vn"
REMOTE_DIR="/var/www/${DOMAIN}/html"
# ----------------------------------------

SSH_OPTS="-p ${SSH_PORT}"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

remote() { ssh ${SSH_OPTS} "${SSH_USER}@${SSH_HOST}" "$@"; }

setup_nginx() {
  echo "==> Cài đặt nginx vhost cho ${DOMAIN}"
  scp ${SSH_OPTS/-p/-P} "${SRC_DIR}/deploy/nginx-demo.conf" \
      "${SSH_USER}@${SSH_HOST}:/etc/nginx/sites-available/${DOMAIN}.conf"
  remote "
    set -e
    mkdir -p ${REMOTE_DIR}
    ln -sf /etc/nginx/sites-available/${DOMAIN}.conf /etc/nginx/sites-enabled/${DOMAIN}.conf
    nginx -t && systemctl reload nginx
    echo 'nginx OK'
  "
  echo "==> Xong. Nếu cần HTTPS: ssh vào server chạy 'certbot --nginx -d ${DOMAIN}'"
}

deploy_files() {
  echo "==> Đảm bảo thư mục ${REMOTE_DIR} tồn tại"
  remote "mkdir -p ${REMOTE_DIR}"

  echo "==> Đồng bộ file lên ${SSH_HOST}:${REMOTE_DIR}"
  rsync -avz --delete \
    -e "ssh ${SSH_OPTS}" \
    --include="index.html" \
    --include="assets/***" \
    --exclude="*" \
    "${SRC_DIR}/" "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/"

  echo "==> Xong! Truy cập: http://${DOMAIN}/"
}

case "${1:-}" in
  --setup) setup_nginx ;;
  "")      deploy_files ;;
  *)       echo "Dùng: $0 [--setup]"; exit 1 ;;
esac
