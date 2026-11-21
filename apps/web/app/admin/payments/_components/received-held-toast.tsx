'use client';

/**
 * The on-screen toast for ruling (6): "N matched by themselves" — the only
 * notice besides the Focus list (no email). Shown once per drop: the drop's
 * holds share one `matched_at`, which keys a per-tab memory so a refresh does
 * not repeat it. Storage can be refused (private window); then it may show
 * again, which is harmless.
 */
import { useEffect } from 'react';
import { useToast } from '@/app/_components/toast/toast-provider';
import { formatCount } from '@/lib/format-number';

export function HeldToast({ count, stamp }: { count: number; stamp: string }) {
  const toast = useToast();
  useEffect(() => {
    const key = `received-held-toast:${stamp}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // No storage — show it anyway.
    }
    toast.success(count === 1 ? '1 matched by itself. It confirms in 30 minutes.' : `${formatCount(count)} matched by themselves. They confirm in 30 minutes.`);
  }, [count, stamp, toast]);
  return null;
}
