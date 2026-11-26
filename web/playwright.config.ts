import { defineConfig, devices } from '@playwright/test';

// Smoke test giao diện: chạy được cả khi KHÔNG có Supabase (các trang phải hiển thị trạng thái rỗng,
// không vỡ). Đặt E2E_BASE_URL để chạy với một môi trường thật (vd. staging) thay vì server local.
const PORT = Number(process.env.E2E_PORT ?? 3010);
const external = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  // Không có DB, supabase-js tự thử lại ~7s mỗi truy vấn trước khi báo lỗi → nới thời gian chờ
  timeout: 120_000,
  expect: { timeout: 20_000 },
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: external ?? `http://127.0.0.1:${PORT}`, locale: 'vi-VN', trace: 'retain-on-failure', navigationTimeout: 60_000 },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: external
    ? undefined
    : { command: `npx next start -p ${PORT}`, url: `http://127.0.0.1:${PORT}/api/v1/health`, reuseExistingServer: !process.env.CI, timeout: 60_000 },
});
