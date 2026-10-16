'use client';

import { useEffect, useState } from 'react';
import { takeLastSeenShown } from '@/app/_components/last-seen/last-seen-mark';
import type { GuestsCopyState } from './guest-list-copy';
import styles from './guests-screen.module.css';

/**
 * 📋 THE GUEST LIST'S COPY LINE — one slim line IN THE FLOW, just under List · Map · Setup (controller
 * 2026-10-16 from the owner's rules: "a frame only on something pressable, nothing covers content, phone
 * first"). The floating last-seen pill covered "Map" and, failed, wrapped into a six-line card over the counts.
 *
 *   copy, updating → "Your last copy · updating…"
 *   copy, failed   → "Couldn't update · showing your copy from 6:42 PM" + a small text "Try again"
 *   fresh, right after a copy was on screen → "Updated just now", which fades and folds away over its own
 *     space after 2.5 s (never a jump: the copy's line and this one sit in the same place, the same height).
 *
 * `fresh` is the page's own measured read — a REFUSED read is never "Updated just now" (it draws the copy as
 * failed instead, `GuestsScreen`). 🔒 guests/a-failed-refresh-shows-the-last-copy-as-old.test.ts
 */
export function GuestListStatus({ copy, fresh }: { copy: GuestsCopyState | null; fresh: boolean }) {
  const [updated, setUpdated] = useState<'shown' | 'leaving' | 'gone'>('gone');
  useEffect(() => {
    if (copy || !fresh) return;
    if (!takeLastSeenShown('guests')) return;
    setUpdated('shown');
    const a = window.setTimeout(() => setUpdated('leaving'), 2500);
    const b = window.setTimeout(() => setUpdated('gone'), 2900);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
    // Once, when the fresh list mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (copy?.freshness === 'failed') {
    return (
      <p role="status" aria-live="polite" className={`${styles.status} ${styles.statusFailed}`} data-guests-status="failed">
        <span>Couldn&rsquo;t update · showing your copy from {copyWhen(copy.savedAt)}</span>
        <button type="button" className={styles.statusTry} onClick={() => window.location.reload()}>
          Try again
        </button>
      </p>
    );
  }
  if (copy) {
    return (
      <p role="status" aria-live="polite" className={styles.status} data-guests-status="updating">
        <span aria-hidden className={`${styles.statusDot} animate-pulse`} />
        <span>Your last copy · updating…</span>
      </p>
    );
  }
  if (updated === 'gone') return null;
  return (
    <p
      role="status"
      aria-live="polite"
      className={`${styles.status} ${updated === 'leaving' ? styles.statusGone : ''}`}
      data-guests-status="updated"
    >
      <span aria-hidden className={`${styles.statusDot} ${styles.statusDotOk}`} />
      <span>Updated just now</span>
    </p>
  );
}

/** "6:42 PM" today; "Oct 15, 6:42 PM" before today (Manila). */
export function copyWhen(savedAt: number, now: number = Date.now()): string {
  const day = (t: number) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const time = new Date(savedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });
  if (day(savedAt) === day(now)) return time;
  const date = new Date(savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
  return `${date}, ${time}`;
}
