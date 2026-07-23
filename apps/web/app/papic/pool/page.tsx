import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Images } from 'lucide-react';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { papicPoolGalleryEnabled } from '@/lib/papic-pool-flag';
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
// Double-gated: NEXT_PUBLIC_PAPIC_POOL_GALLERY env AND the per-event couple
// toggle (events.pool_gallery_open, DEFAULT FALSE). When either is off the
// page 404s — the couple owns whether this door exists at all (no dead door).

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Everyone’s photos · Papic',
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4 py-12 text-ink">
      <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-surface p-7 text-center shadow-sm">
        <Images aria-hidden className="mx-auto h-7 w-7 text-terracotta" strokeWidth={1.75} />
        {children}
      </div>
    </main>
  );
}

export default async function PapicPoolPage() {
  if (!papicPoolGalleryEnabled()) notFound();

  const session = await readGuestSession();
  if (!session) {
    return (
      <Shell>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Open your invitation first</h1>
        <p className="mt-2 text-sm text-ink/65">
          Scan your personal QR or open your invite link, then come back here to
          browse everyone&rsquo;s photos.
        </p>
      </Shell>
    );
  }

  // Per-event couple toggle — when OFF this page simply doesn't exist (the
  // owner's "no dead door" rule). The RPC re-checks the same gate on every
  // read, so closing is retroactive even mid-session.
  const admin = createAdminClient();
  const { data: ev } = await admin
    .from('events')
    .select('display_name, pool_gallery_open')
    .eq('event_id', session.event_id)
    .maybeSingle();
  if (!ev?.pool_gallery_open) notFound();

  const firstPage = await getPoolGalleryPage(session.guest_id);

  return (
    <main className="min-h-screen bg-cream px-4 py-8 text-ink">
      <div className="mx-auto w-full max-w-2xl">
        <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          <Images aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Everyone&rsquo;s photos
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {(ev.display_name as string | null) ?? 'The event'} — the whole gallery
        </h1>
        <p className="mt-2 text-sm text-ink/65">
          Every photo and clip the crew and guests have captured so far. Spot
          yourself? Tap <span className="font-medium text-ink/80">I&rsquo;m in this</span>{' '}
          and the photo joins <span className="font-medium text-ink/80">your</span> gallery
          and download.
        </p>
        <PoolGrid initialTiles={firstPage.tiles} initialCursor={firstPage.nextCursor} />
      </div>
    </main>
  );
}
