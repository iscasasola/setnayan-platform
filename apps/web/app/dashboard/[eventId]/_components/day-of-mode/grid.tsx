'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { EventTableRow } from '@/lib/seating';
import { DayOfModeBanner } from './banner';
import { WhatsHappeningCard } from './whats-happening-card';
import { YourTableCard } from './your-table-card';
import { LivePhotoWallCard } from './live-photo-wall-card';
import { VideoGuestbookCard, type PabatiClipThumb } from './video-guestbook-card';
import { LiveScheduleCard } from './live-schedule-card';
import { CoordinatorBroadcastCard } from './coordinator-broadcast-card';
import type { BroadcastCardData } from '@/lib/coordinator-broadcasts';
import { GetHelpCard } from './get-help-card';
import type { SameDayVendor } from '@/lib/same-day-vendors';

type Block = {
  block_id: string;
  label: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
};

type Props = {
  eventId: string;
  blocks: Block[];
  headTable: EventTableRow | null;
  nearbyTables: EventTableRow[];
  sameDayVendors?: SameDayVendor[];
  /** PABATI video guestbook — resolved server-side. When false the card hides. */
  pabatiActive?: boolean;
  pabatiClips?: PabatiClipThumb[];
  pabatiUsed?: number;
  pabatiTotal?: number;
  /** Coordinator P3 — resolved server-side when NEXT_PUBLIC_COORDINATOR_P3_ENABLED
   *  is on. Absent (flag off) = the card renders its pre-P3 stub exactly. */
  broadcast?: BroadcastCardData;
};

export function DayOfModeGrid({
  eventId,
  blocks,
  headTable,
  nearbyTables,
  sameDayVendors = [],
  pabatiActive = false,
  pabatiClips = [],
  pabatiUsed = 0,
  pabatiTotal = 0,
  broadcast,
}: Props) {
  return (
    <section
      aria-label="Day-of event mode"
      className="space-y-4 rounded-2xl border border-terracotta/20 bg-terracotta/[0.03] p-4 sm:p-5"
    >
      <DayOfModeBanner eventId={eventId} blocks={blocks} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <WhatsHappeningCard blocks={blocks} />
        <YourTableCard
          eventId={eventId}
          headTable={headTable}
          nearbyTables={nearbyTables}
        />
        <LivePhotoWallCard />
        {pabatiActive ? (
          <VideoGuestbookCard
            pabatiActive
            eventId={eventId}
            clips={pabatiClips}
            used={pabatiUsed}
            total={pabatiTotal}
            shareUrl={`/pabati/${eventId}`}
          />
        ) : (
          <VideoGuestbookCard pabatiActive={false} />
        )}
        <LiveScheduleCard eventId={eventId} blocks={blocks} />
        <CoordinatorBroadcastCard eventId={eventId} broadcast={broadcast} />
        <GetHelpCard sameDayVendors={sameDayVendors} />
      </div>

      {/* Wrap-up entry point (Event Lifecycle Menu PR3) — when the celebration
          winds down, close out the day to move the app into After mode. */}
      <Link
        href={`/dashboard/${eventId}/clearance`}
        className="group flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-terracotta/30 bg-terracotta/[0.04] px-4 py-2.5 text-sm font-medium text-terracotta-700 transition-colors hover:border-terracotta/50 hover:bg-terracotta/10"
      >
        When the day winds down, close it out
        <ArrowRight
          aria-hidden
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          strokeWidth={1.75}
        />
      </Link>
    </section>
  );
}
