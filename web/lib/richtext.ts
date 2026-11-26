// Định dạng tối giản cho phần giới thiệu doanh nghiệp:
//   ## Tiêu đề · - gạch đầu dòng · 1. đánh số · **in đậm** · [chữ](https://...) · ![chú thích](ảnh đã tải lên sàn)
// Chỉ phân tích thành cấu trúc dữ liệu, KHÔNG bao giờ sinh HTML thô.
import { SUPABASE_URL } from '@/lib/env';

export type Inline = { t: 'text' | 'bold'; v: string } | { t: 'link'; v: string; href: string };
export type Block =
  | { t: 'h'; level: 3 | 4; c: Inline[] }
  | { t: 'p'; lines: Inline[][] }
  | { t: 'ul'; items: Inline[][] }
  | { t: 'ol'; start: number; items: Inline[][] }
  | { t: 'img'; src: string; alt: string };

/** Ảnh trong bài chỉ được lấy từ kho ảnh công khai của sàn (tránh ảnh theo dõi từ bên ngoài). */
export const isOwnImage = (src: string) => !!SUPABASE_URL && src.startsWith(`${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/company-gallery/`);

const IMG = /^!\[([^\]]*)\]\(([^()\s]+)\)$/;
const TOKEN = /(\*\*[^*\n]+\*\*|\[[^\]\n]+\]\(https?:\/\/[^()\s]+\))/g;

export function parseInline(s: string): Inline[] {
  return s.split(TOKEN).filter(Boolean).map((part): Inline => {
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**') && !part.slice(2, -2).includes('*')) return { t: 'bold', v: part.slice(2, -2) };
    const link = part.match(/^\[([^\]\n]+)\]\((https?:\/\/[^()\s]+)\)$/);
    return link ? { t: 'link', v: link[1], href: link[2] } : { t: 'text', v: part };
  });
}

export function parseRichText(src: string): Block[] {
  const out: Block[] = [];
  let open: Block | null = null; // đoạn/danh sách đang gom dòng
  for (const raw of src.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) { open = null; continue; }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{1,3})\s+(.+)$/))) {
      out.push({ t: 'h', level: m[1].length === 3 ? 4 : 3, c: parseInline(m[2]) });
      open = null;
    } else if ((m = line.match(IMG))) {
      if (isOwnImage(m[2])) out.push({ t: 'img', src: m[2], alt: m[1] });
      open = null;
    } else if ((m = line.match(/^[-*•]\s+(.+)$/))) {
      if (open?.t !== 'ul') out.push((open = { t: 'ul', items: [] }));
      open.items.push(parseInline(m[1]));
    } else if ((m = line.match(/^(\d{1,2})[.)]\s+(.+)$/))) {
      if (open?.t !== 'ol') out.push((open = { t: 'ol', start: Number(m[1]), items: [] }));
      open.items.push(parseInline(m[2]));
    } else {
      if (open?.t !== 'p') out.push((open = { t: 'p', lines: [] }));
      open.lines.push(parseInline(line));
    }
  }
  return out;
}

/** Bỏ ký hiệu định dạng — dùng cho thẻ meta, JSON-LD. */
export function plainText(src: string): string {
  return src
    .replace(/^\s*!\[[^\]]*\]\([^)]*\)\s*$/gm, '')
    .replace(/^\s*(#{1,3}|[-*•])\s+/gm, '')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\[([^\]\n]+)\]\(https?:\/\/[^()\s]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
