'use client';

import type { EventTableRow } from '@/lib/seating';
import { DayOfModeBanner } from './banner';
import { WhatsHappeningCard } from './whats-happening-card';
import { YourTableCard } from './your-table-card';
import { LivePhotoWallCard } from './live-photo-wall-card';
import { VideoGuestbookCard } from './video-guestbook-card';
import { LiveScheduleCard } from './live-schedule-card';
import { CoordinatorBroadcastCard } from './coordinator-broadcast-card';

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
};

export function DayOfModeGrid({
  eventId,
  blocks,
  headTable,
  nearbyTables,
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
        <VideoGuestbookCard />
        <LiveScheduleCard eventId={eventId} blocks={blocks} />
        <CoordinatorBroadcastCard />
      </div>
    </section>
  );
}
