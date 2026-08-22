import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Images } from 'lucide-react';
import { DoorShell } from '@/app/_components/door/door-shell';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { papicPoolGalleryActive } from '@/lib/papic-pool-gate';
import { getPoolGalleryPage } from '@/lib/papic-pool-gallery';
import { PoolGrid } from './_components/pool-grid';

// Papic · Shared Pool Gallery — "Everyone's photos" (OnTheDay build ⑥).
//
// A session guest browses the WHOLE event capture pool (photos + clips, web
// copies only, clean-screened) and taps "I'm in this" on photos of themselves —
// a manual_pick tag that automatically joins their "Photos of you" gallery, the
// ZIP download, and the Story-reel picker (all three read photo_tags
// source-agnostically; zero reader changes).
//
// Session-gated: reached only through the setnayan_guest_session cookie (the
// /papic/me/[token]/session bridge) — no guest token ever appears in this URL.
// Triple-gated: NEXT_PUBLIC_PAPIC_POOL_GALLERY env AND the 'papic_pool_gallery'
// DPO control (/admin/data-privacy, fail-closed — env short-circuits first) AND
// the per-event couple toggle (events.pool_gallery_open, DEFAULT FALSE). When
// any is off the page 404s — no dead door.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Everyone’s photos · Papic',
  robots: { index: false, follow: false },
};

export default async function PapicPoolPage() {
  if (!(await papicPoolGalleryActive())) notFound();

  const session = await readGuestSession();
  if (!session) {
    return (
            <DoorShell
        tone="dead_end"
        eyebrow={
          <>
            <Images aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Shared photos
          </>
        }
        title="Open your invitation first."
        sub="Scan your personal QR or open your invite link, then come back here to browse everyone's photos."
      />
    );
  }

  // Per-event couple toggle — when OFF this page simply doesn't exist (the
  // owner's "no dead door" rule). The RPC re-checks the same gate on every
  // read, so closing is retroactive even mid-session.
  const admin = createAdminClient();
  const { data: ev } = await admin
    .from('events')
    .select('display_name, pool_gallery_open, event_date, event_type, papic_window_start')
    .eq('event_id', session.event_id)
    .maybeSingle();
  if (!ev?.pool_gallery_open) notFound();

  const firstPage = await getPoolGalleryPage(session.guest_id);

  return (
    <main className="min-h-screen bg-cream px-4 py-8 text-ink">
      <div className="mx-auto w-full max-w-2xl">
        {/* The eyebrow said "Everyone's photos" directly above a title ending
            "— the whole gallery". One of the two was the other one, and this is
            a page a guest meets once, on a phone, at a party. */}
        <h1 className="text-2xl font-semibold tracking-tight">
          {(ev.display_name as string | null) ?? 'The event'} — the whole gallery
        </h1>
        <p className="mt-2 text-sm text-ink/65">
          Every photo and clip the crew and guests have captured so far. Spot
          yourself? Tap <span className="font-medium text-ink/80">I&rsquo;m in this</span>{' '}
          and the photo joins <span className="font-medium text-ink/80">your</span> gallery
          and download.
        </p>
        {/* Chapters (owner 2026-08-02: "split by x months away. to x days away").
            The gallery reads as a journey rather than one flat feed. Derived from
            each capture's own timestamp — nothing is stored and nobody files a
            photo, so it works on everything already taken and re-chapters itself
            if the date moves. A trip counts its days instead. */}
        <PoolGrid
          initialTiles={firstPage.tiles}
          initialCursor={firstPage.nextCursor}
          chapters={{
            eventDateIso: (ev.event_date as string | null) ?? null,
            mode: (ev.event_type as string | null) === 'travel' ? 'trip' : 'countdown',
            tripStartIso: (ev.papic_window_start as string | null) ?? null,
          }}
        />
      </div>
    </main>
  );
}
