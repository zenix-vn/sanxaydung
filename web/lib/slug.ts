/** "Hà Nội" → "ha-noi", "TP. Hồ Chí Minh" → "tp-ho-chi-minh" (dùng cho URL trang SEO). */
export function slugifyVi(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
