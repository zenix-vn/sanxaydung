import { test, expect } from '@playwright/test';

// Các trang công khai phải hiển thị được (kể cả khi DB trống / không truy cập được)
const PUBLIC = [
  { path: '/', heading: /./ },
  { path: '/directory', heading: /nhà thầu|doanh nghiệp/i },
  { path: '/marketplace', heading: /Nhu cầu/i },
  { path: '/feed', heading: /./ },
  { path: '/ban-do', heading: /Bản đồ/i },
  { path: '/linh-vuc', heading: /lĩnh vực/i },
  { path: '/so-sanh', heading: /So sánh/i },
  { path: '/login', heading: /./ },
];

for (const p of PUBLIC) {
  test(`trang ${p.path} hiển thị`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const res = await page.goto(p.path);
    expect(res?.status(), `HTTP ${p.path}`).toBeLessThan(400);
    await expect(page.locator('h1, h2').first()).toHaveText(p.heading);
    expect(errors, 'lỗi JS phía client').toEqual([]);
  });
}

test('404 có trang riêng', async ({ page }) => {
  const res = await page.goto('/khong-ton-tai-abc');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Tìm doanh nghiệp/ })).toBeVisible();
});

test('dashboard yêu cầu đăng nhập', async ({ page }) => {
  await page.goto('/dashboard/listings');
  await expect(page).toHaveURL(/\/login\?redirect=/);
});

test('bộ lọc marketplace giữ tham số trên URL', async ({ page, isMobile }) => {
  await page.goto('/marketplace?type=need_crew');
  if (isMobile) await page.locator('label.filter-btn').click(); // bộ lọc thu gọn trên điện thoại
  await page.getByPlaceholder(/xây nhà xưởng/).fill('sơn epoxy');
  await page.getByLabel('Ngân sách từ (triệu đồng)').fill('100');
  await page.getByRole('button', { name: 'Áp dụng' }).click();
  await expect(page).toHaveURL(/type=need_crew/);
  await expect(page).toHaveURL(/q=s%C6%A1n\+epoxy|q=s%C6%A1n%20epoxy/);
  await expect(page).toHaveURL(/bmin=100/);
  if (isMobile) {
    await expect(page.locator('label.filter-btn .n')).toHaveText('2'); // số bộ lọc đang bật
    await page.locator('label.filter-btn').click();
  }
  await expect(page.getByRole('link', { name: 'Xóa bộ lọc' })).toBeVisible();
});

test('bảng giá đã gỡ: /pricing chuyển về trang chủ, menu không còn link', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('a[href^="/pricing"]')).toHaveCount(0);
});

test('Image Optimization API bị chặn', async ({ request }) => {
  const r = await request.get('/_next/image?url=%2Flogo.png&w=64&q=75');
  expect(r.status()).toBe(404);
});

test('manifest PWA hợp lệ', async ({ request }) => {
  const r = await request.get('/manifest.webmanifest');
  expect(r.ok()).toBeTruthy();
  const m = await r.json();
  expect(m.short_name).toBe('Sàn Xây Dựng');
  expect(m.icons.length).toBeGreaterThan(0);
});

test('menu di động mở được', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'chỉ cho màn hình nhỏ');
  await page.goto('/');
  await page.getByLabel('Mở menu').click();
  await expect(page.getByRole('link', { name: 'Tìm nhà thầu' }).first()).toBeVisible();
});
