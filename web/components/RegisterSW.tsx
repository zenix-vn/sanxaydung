'use client';
import { useEffect } from 'react';

/** Đăng ký service worker (chỉ production, để không cache nhầm khi dev). */
export default function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  }, []);
  return null;
}
