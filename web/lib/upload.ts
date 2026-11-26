// Tải ảnh công khai của doanh nghiệp lên bucket company-gallery (path bắt đầu bằng company_id — RLS dựa vào đó).
import type { SupabaseClient } from '@supabase/supabase-js';
import { shrinkImage } from '@/lib/image';
import { MAX_VIDEO_BYTES } from '@/lib/profile';

const MAX_IMG = 5 * 1024 * 1024;
const BUCKET = 'company-gallery';
const MARKER = `/${BUCKET}/`;

export async function uploadCompanyImage(supa: SupabaseClient, companyId: string, folder: string, original: File, maxSide = 1920): Promise<string> {
  if (!original.type.startsWith('image/')) throw new Error('chỉ nhận file ảnh');
  const file = await shrinkImage(original, maxSide);
  if (file.size > MAX_IMG) throw new Error('ảnh vẫn lớn hơn 5MB');
  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
  const path = `${companyId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const { error } = await supa.storage.from(BUCKET).upload(path, file, { contentType: file.type });
  if (error) throw error;
  return supa.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Video ngắn cho ảnh bìa (MP4/WebM) → bucket company-videos. */
export async function uploadCompanyVideo(supa: SupabaseClient, companyId: string, file: File): Promise<string> {
  if (!['video/mp4', 'video/webm'].includes(file.type)) throw new Error('chỉ nhận video MP4 hoặc WebM');
  if (file.size > MAX_VIDEO_BYTES) throw new Error(`video tối đa ${MAX_VIDEO_BYTES / 1048576}MB`);
  const path = `${companyId}/banner/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${file.type.split('/')[1]}`;
  const { error } = await supa.storage.from('company-videos').upload(path, file, { contentType: file.type, cacheControl: '31536000' });
  if (error) throw error;
  return supa.storage.from('company-videos').getPublicUrl(path).data.publicUrl;
}

/** Xóa file khỏi Storage nếu URL nằm đúng trong thư mục `folder` của công ty (ảnh ngoài thì bỏ qua). */
export async function removeCompanyImage(supa: SupabaseClient, companyId: string, folder: string, url: string | null) {
  const i = url?.indexOf(MARKER) ?? -1;
  if (!url || i < 0) return;
  const path = decodeURIComponent(url.slice(i + MARKER.length));
  if (path.startsWith(`${companyId}/${folder}/`)) await supa.storage.from(BUCKET).remove([path]);
}
