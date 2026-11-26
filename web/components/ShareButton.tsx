'use client';
import { useState } from 'react';

/** Chia sẻ trang: Web Share API (điện thoại), không có thì sao chép link. `className` để dùng như nút. */
export default function ShareButton({ path, title, className, label = 'Chia sẻ' }: { path: string; title: string; className?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = `${window.location.origin}${path}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return; // người dùng tự đóng hộp chia sẻ
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Sao chép link:', url);
    }
  }
  const body = (
    <>
      <svg className="ic"><use href={copied ? '#ic-check' : '#ic-link'} /></svg> {copied ? 'Đã sao chép link' : label}
    </>
  );
  // Trong Feed, hàng hành động định dạng theo thẻ <a>; nơi khác dùng <button> kiểu .btn
  if (!className) {
    return <a role="button" tabIndex={0} onClick={share} onKeyDown={(e) => e.key === 'Enter' && share()} aria-live="polite">{body}</a>;
  }
  return <button type="button" className={className} onClick={share} aria-live="polite">{body}</button>;
}
