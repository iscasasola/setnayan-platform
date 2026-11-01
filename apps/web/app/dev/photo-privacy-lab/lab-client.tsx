'use client';

/**
 * /dev/photo-privacy-lab — the client half: the REAL `SupplierPageNoticeLine` and `PutOnMyPageButton`, each handed a
 * stand-in for its server door (a fixture has no guest session and no supplier session). Nothing here reaches a
 * database or R2.
 */
import { SupplierPageNoticeLine } from '@/app/[slug]/_components/supplier-page-notice-line';
import { PutOnMyPageButton } from '@/app/vendor-dashboard/collections/_components/put-on-my-page-button';
import type { PutOnPageResult } from '@/app/vendor-dashboard/collections/actions';
import { putOnPageQueuedText, type GuestNoticeGroup } from '@/lib/supplier-page-notice';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function GuestLineLab({ groups }: { groups: GuestNoticeGroup[] }) {
  return (
    <SupplierPageNoticeLine
      eventId="lab-event"
      groups={groups}
      remove={async () => {
        await wait(400);
        return { ok: true };
      }}
    />
  );
}

export function PutButtonLab({ photoId, publicFrom }: { photoId: string; publicFrom: string }) {
  return (
    <PutOnMyPageButton
      photoId={photoId}
      action={async (): Promise<PutOnPageResult> => {
        await wait(400);
        return { ok: true, text: putOnPageQueuedText(publicFrom), state: 'waiting', publicFrom };
      }}
    />
  );
}
