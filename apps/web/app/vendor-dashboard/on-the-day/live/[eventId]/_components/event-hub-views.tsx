import { ScanLine } from 'lucide-react';
import { AnnounceButton } from '@/app/dashboard/[eventId]/schedule/_components/announce-button';
import { CheckinDeskRows } from '../../../../_components/events-you-run-rows';
import { HubDoorRow, HubEyebrow } from '../../../_components/hub-screen';
import type { EventYouRun } from '@/lib/events-you-run';
import type { CoordinatorBroadcastItem } from '@/lib/coordinator-broadcasts';
import { eventHubViewHref } from '@/lib/event-hub-views';
import type { EventScanService } from '@/lib/supplier-scan.server';
import type { ScanAnswer } from '@/lib/supplier-scan';
import { SupplierClaimScanner } from './supplier-scan/supplier-scanner';

/**
 * 🧭 THE EVENT HUB'S OTHER TWO VIEWS (supplier dashboard v13, owner "Approved." 2026-10-29; prototype `hubScanner` ·
 * `hubAnnounce`) — each a door into a SHIPPED tool, never a second copy of it:
 *   · SCANNER — "Find a guest's seat" (the coordinator's `SeatScanner`, on The Day at `#seat-finder`, under its own
 *     gates) and the hosts' Check-in desk for an event this person runs — and, first, 🎟 THE CLAIM SCANNER for each of
 *     this shop's services booked here whose scanner is ON (set once per service under Shop › Services,
 *     `supplier_scan_settings`; prototype `supplier_scan_2026-10-03_fable.html`). A service with no scanner says so;
 *     a list that could not be read says THAT, never "no scanner".
 *   · ANNOUNCE — the couple's shipped composer (`AnnounceButton` → `sendCoordinatorBroadcast`, its own policies), for
 *     the coordinator the hosts let announce; everybody else is told who announces.
 */
export function EventHubScanner({
  eventId,
  run,
  floorIsYours,
  scan = [],
  scanAnswer = null,
}: {
  eventId: string;
  run: EventYouRun | null;
  floorIsYours: boolean;
  /** 🎟 This person's services booked here with the scanner ON, each with its count — or 'unreadable'. */
  scan?: EventScanService[] | 'unreadable';
  /** The dev lab's result line (its frames only). */
  scanAnswer?: ScanAnswer | null;
}) {
  const claims = scan !== 'unreadable' && scan.length > 0;
  const any = floorIsYours || run != null || claims;
  return (
    <div data-event-hub-scanner="">
      <HubEyebrow about="A guest's invitation QR, scanned at the door or on the floor. Each scan asks Setnayan for one answer — never the guest list.">
        Scanner
      </HubEyebrow>
      {claims ? <SupplierClaimScanner eventId={eventId} services={scan} initialAnswer={scanAnswer} /> : null}
      {scan === 'unreadable' ? (
        <p role="alert" className="py-3 text-[14px] text-ink/70" data-event-hub-scan-unread="">
          <strong className="text-ink">We couldn&rsquo;t load your scanner just now.</strong> Reload to try again.
        </p>
      ) : null}
      {floorIsYours ? (
        <HubDoorRow href={`${eventHubViewHref(eventId, 'day')}#seat-finder`} label="Find a guest’s seat" line="Scan their pass — their table shows" data="seat-finder" />
      ) : null}
      {run ? <CheckinDeskRows events={[run]} /> : null}
      {any || scan === 'unreadable' ? null : (
        <div className="flex items-start gap-3 py-3" data-event-hub-no-scanner="">
          <ScanLine aria-hidden className="mt-0.5 h-5 w-5 flex-none text-ink/50" strokeWidth={1.8} />
          <p className="text-[14px] text-ink/65">
            No scanner on your service for this event. A scanner is set once per service, under Shop › Services.
          </p>
        </div>
      )}
    </div>
  );
}

export function EventHubAnnounce({
  eventId,
  run,
  enabled,
  recent,
}: {
  eventId: string;
  run: EventYouRun | null;
  /** The broadcast feature's own switch (`isCoordinatorP3Enabled`). */
  enabled: boolean;
  /** The latest announcements, or 'unreadable' / null. */
  recent: CoordinatorBroadcastItem[] | 'unreadable' | null;
}) {
  const may = enabled && run?.canAnnounce === true;
  return (
    <div data-event-hub-announce={may ? 'open' : 'closed'}>
      <HubEyebrow about="One message to every guest who opened their invitation — it sits at the top of their Event Hub. The hosts and the coordinator they let announce can send.">
        Announce
      </HubEyebrow>
      {may ? (
        <div className="space-y-2 py-2">
          <p className="text-[14px] text-ink/70">Goes to every guest and the hosts, on their Event Hub.</p>
          <AnnounceButton eventId={eventId} isEventDay recent={recent === 'unreadable' ? null : recent} />
        </div>
      ) : (
        <p className="py-3 text-[14px] text-ink/65">
          {enabled
            ? 'The hosts and their coordinator announce. Ask them in this event’s chat.'
            : 'Announcements are not switched on yet.'}
        </p>
      )}
    </div>
  );
}
