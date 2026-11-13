'use client';

import { CloudUpload } from 'lucide-react';
import { DriveSafetyPanel } from '@/app/_components/drive-connect-card';
import type { CloseRecord } from '@/lib/notices';
import { Notice } from '@/app/_components/notices/notices';
import { NOTICE_ACTION } from '@/app/_components/notices/notice-action';

/**
 * 🔔 Inventory #17 — a To-do (one notice system, owner approved 14 Nov 2026): "Maybe later" and × became one "Not now"
 * (back after 7 days). The Drive safety panel is behind the ⓘ.
 */
export function RecapDriveNudge({ eventId, connectHref }: { eventId: string; connectHref: string }) {
  return (
    <Notice
      kind="todo"
      noticeKey={`save-originals:${eventId}`}
      title="Love this? Save the originals to your Drive"
      detail={
        <>
          <span className="block">
            Your recap lives beautifully here in Setnayan and stays for years. If you&rsquo;d also like the
            full-resolution photos and clips in a folder you own, connect your Google Drive and we&rsquo;ll tuck them
            away for keeps.
          </span>
          <DriveSafetyPanel variant="condensed" />
        </>
      }
      actions={
        <a href={connectHref} className={NOTICE_ACTION}>
          <CloudUpload aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Save originals to my Drive
        </a>
      }
      legacy={(): CloseRecord | null => {
        try {
          return localStorage.getItem(`sn-drive-recap-nudge-dismissed:${eventId}`) === '1' ? { closedAt: Date.now(), count: 1 } : null;
        } catch {
          return null;
        }
      }}
    />
  );
}
