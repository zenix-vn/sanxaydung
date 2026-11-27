'use client';
import { useState } from 'react';
import { supa as loadSupa } from '@/lib/supabase/lazy';

export default function LikeButton({ postId, initialLiked, initialCount }: { postId: string; initialLiked: boolean; initialCount: number }) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const supa = await loadSupa();
    const { data: { user } } = await supa.auth.getUser();
    if (!user) {
      window.location.href = `/login?redirect=${encodeURIComponent('/feed')}`;
      return;
    }
    const next = !liked;
    setLiked(next); // lạc quan
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    const { data, error } = await supa.rpc('toggle_like', { _post: postId });
    if (error) {
      setLiked(!next);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
    } else if (typeof data === 'boolean' && data !== next) {
      setLiked(data); // máy chủ là nguồn đúng
      setCount((c) => Math.max(0, c + (data ? 1 : -1)));
    }
    setBusy(false);
  }

  return (
    <a onClick={toggle} style={liked ? { color: 'var(--orange)' } : undefined} aria-pressed={liked}>
      <svg className={`ic${liked ? ' fill' : ''}`}><use href="#ic-thumb" /></svg> Thích{count > 0 ? ` · ${count}` : ''}
    </a>
  );
}
