'use client';

import { UserPlus } from 'lucide-react';
import { Notice } from '@/app/_components/notices/notices';
import { markNotificationRead } from '@/lib/notification-actions';

/**
 * 🔔 Inventory #19 — News (one notice system, owner approved 14 Nov 2026: "the sheet becomes a line, and Confirm becomes
 * Got it"). "Got it" closes it in the notice memory AND marks the `cohost_added` notification read, which is what the
 * layout reads — so it never comes back on another phone either.
 */
export function CohostWelcomeNotice({ notificationId, title, body }: { notificationId: string; title: string; body: string | null }) {
  return (
    <Notice
      kind="news"
      noticeKey={`cohost-welcome:${notificationId}`}
      mark={<UserPlus aria-hidden className="h-4 w-4 shrink-0 text-terracotta-700" strokeWidth={1.8} />}
      title={title}
      detail={body ?? undefined}
      onClose={() => {
        const fd = new FormData();
        fd.set('notification_id', notificationId);
        void markNotificationRead(fd).catch(() => undefined);
      }}
    />
  );
}
