'use client';
import { useState } from 'react';

/** Chia sẻ bài viết: Web Share API trên điện thoại, còn lại sao chép link. */
export default function ShareButton({ path, title }: { path: string; title: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = `${window.location.origin}${path}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* người dùng hủy → thử sao chép */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Sao chép link bài viết:', url);
    }
  }
  return (
    <a role="button" tabIndex={0} onClick={share} onKeyDown={(e) => e.key === 'Enter' && share()} aria-live="polite">
      <svg className="ic"><use href={copied ? '#ic-check' : '#ic-link'} /></svg> {copied ? 'Đã sao chép link' : 'Chia sẻ'}
    </a>
  );
}
