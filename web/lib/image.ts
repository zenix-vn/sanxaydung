// Thu nhỏ ảnh trên trình duyệt trước khi tải lên (ảnh điện thoại thường 4–12MB).

/**
 * Trả về bản WebP/JPEG có cạnh dài ≤ maxSide. Nếu trình duyệt không giải mã được
 * hoặc bản nén không nhỏ hơn file gốc thì giữ nguyên file gốc.
 */
export async function shrinkImage(file: File, maxSide = 1920): Promise<File> {
  if (typeof createImageBitmap !== 'function') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size <= 600 * 1024) {
      bmp.close();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const encode = (type: string) => new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, 0.84));
    let blob = await encode('image/webp');
    // Safari cũ trả PNG khi không hỗ trợ WebP
    if (blob?.type !== 'image/webp') blob = file.type === 'image/png' ? null : await encode('image/jpeg');
    if (!blob || blob.size >= file.size) return file;
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.${ext}`, { type: blob.type });
  } catch {
    return file;
  }
}
