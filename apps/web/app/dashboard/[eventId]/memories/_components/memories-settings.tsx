import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { LiveWallCard } from '@/app/dashboard/[eventId]/studio/papic/_components/live-wall-card';
import { PoolGalleryCard } from '@/app/dashboard/[eventId]/studio/papic/_components/pool-gallery-card';
import { MagazineCard } from '@/app/dashboard/[eventId]/studio/papic/_components/magazine-card';
import { RecapCard } from '@/app/dashboard/[eventId]/studio/papic/_components/recap-card';
import { LifeFlashCard } from '@/app/dashboard/[eventId]/studio/papic/_components/life-flash-card';
import { DriveCopyForEvent } from '@/app/dashboard/[eventId]/studio/papic/_components/drive-copy-card';
import { KeepFullResRow } from '@/app/dashboard/[eventId]/studio/papic/_components/keep-full-res-row';
import { ServiceParts } from '@/app/dashboard/[eventId]/studio/_components/service-parts';
import { UploadsOpenChoice } from '@/app/dashboard/[eventId]/studio/papic/_components/uploads-open-choice';

/**
 * ⚙ MEMORIES SETTINGS — the files' settings, in the owner's list (2026-10-23: *"Gallery holds: follow moments in
 * order, photowall, thank you, guest see photos, google drive, keep full res"*). Every control is the SHIPPED one,
 * moved whole off the Papic page (which is the camera only now) — never redrawn: Photo wall (`LiveWallCard`) ·
 * Thank-you (`ServiceParts`, the Thank-You Video) · Add photos by hand (`UploadsOpenChoice`) · Guests see all
 * (`PoolGalleryCard`) · Google Drive
 * (`DriveCopyForEvent`) · Keep full-res (`KeepFullResRow`). What is made FROM the photos (the magazine, the recap,
 * Life Flash) sits after them. "Follow moments in order" is the sheet's own first row (the gallery draws it).
 *
 * The couple's only. 🍎 In the iPhone app the web-only offers (Keep full-res) are not drawn.
 */
export function MemoriesSettings({
  eventId,
  apple,
  loginEmail,
  uploadsOpen,
}: {
  eventId: string;
  apple: boolean;
  loginEmail: string | null;
  /** The couple's "add photos by hand" switch, as the page read it (absent = open). */
  uploadsOpen: boolean;
}) {
  return (
    <div className="flex flex-col divide-y divide-ink/10" data-memories-settings="">
      <section className="pb-5" data-memories-setting="wall">
        <LiveWallCard eventId={eventId} appleIap={apple} />
      </section>
      <section className="py-5" data-memories-setting="thank-you">
        <ServiceParts eventId={eventId} service="papic" />
      </section>
      {/* + Add photos' own switch — whether photos may be added by hand at all (each one uses a credit). */}
      <section className="py-5" data-memories-setting="uploads">
        <UploadsOpenChoice eventId={eventId} open={uploadsOpen} variant="row" />
      </section>
      <section className="py-5" data-memories-setting="guests-see-all">
        <PoolGalleryCard eventId={eventId} />
      </section>
      <section className="py-5" data-memories-setting="drive">
        <DriveCopyForEvent eventId={eventId} loginEmail={loginEmail} />
      </section>
      {apple ? null : (
        <section className="py-5" data-memories-setting="full-res">
          <KeepFullResRow eventId={eventId} />
        </section>
      )}
      <section className="flex flex-col gap-4 py-5" data-memories-setting="made">
        <MagazineCard eventId={eventId} />
        <RecapCard eventId={eventId} />
        <LifeFlashCard eventId={eventId} />
      </section>
      <p className="pt-4 text-[13px] text-ink/60">
        <Link
          href={`/dashboard/${eventId}/studio/papic/moderation`}
          className="inline-flex items-center gap-0.5 hover:text-ink"
          data-memories-held=""
        >
          Photos the safety screen held back, and blocked cameras
          <ChevronRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </p>
    </div>
  );
}
