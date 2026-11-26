'use client';
import type { SupabaseClient } from '@supabase/supabase-js';

// supabase-js (~180 KB) chỉ được tải khi cần, tách khỏi gói JS chung của mọi trang.
// Dùng cho component có mặt trên trang công khai (menu, chuông thông báo, nút lưu, theo dõi lượt xem…)
// để trang hiển thị & tương tác được trước, client nạp sau. createBrowserClient dùng chung một phiên.
let p: Promise<SupabaseClient> | null = null;
export function supa(): Promise<SupabaseClient> {
  return (p ??= import('./client').then((m) => m.createSupabaseBrowser()));
}
