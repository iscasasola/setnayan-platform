import Link from 'next/link';
import { Camera, Palette, ArrowRight, Sparkles } from 'lucide-react';
import { getSampleEvent, getSampleEventId } from '@/app/tour/_lib/sample-event';
import { createAdminClient } from '@/lib/supabase/admin';
import { getWallSnapshot } from '@/lib/live-wall';
import { sanitizeRolePalette, PALETTE_LIMITS, type PaletteKey } from '@/lib/mood-board';
import { TourLiveWall, type TourWallTile } from './_components/tour-live-wall';
import { TourPalettePreview, type TourSwatchGroup } from './_components/tour-palette-preview';

/**
 * STOP 5 — "See it come alive."
 *
 * A SERVER component (RSC). It resolves the pinned sample event through the ONE
 * trust boundary (getSampleEventId / getSampleEvent), never from params/
 * searchParams, and reads everything through the service-role admin client
 * (SELECTs only). It imports NO server actions — the ESLint
 * `no-restricted-imports` guard on app/tour/** enforces that — and never writes.
 *
 * What it shows:
 *   1. The Live Photo Wall — the same screened `wall_feed` mirror the venue
 *      projector renders, via getWallSnapshot(eventId, …). We render a
 *      CLIENT-ONLY FORK of <LiveWallBlock> (TourLiveWall): identical markup +
 *      the wall's own `animate-wall-enter` entrance, but with the 25s network
 *      poll REMOVED. The shipped block polls `/<slug>/live-wall` every 25s; for
 *      a future-dated sample that route would resolve nothing useful (the wall
 *      isn't "live"), so the tour drops the network entirely and instead drives
 *      a client-only timer that drips a few pre-seeded tiles in — same
 *      rise+fade — so the wall visibly "comes alive" with zero server round-trip.
 *   2. The mood-board palette — events.role_palette (already on the event) +
 *      the couple's event_inspiration_assets, shown as labelled swatch families
 *      and inspiration tiles. A client-only "preview a recolor" control lets the
 *      visitor nudge the dominant hue in LOCAL state only.
 *
 * READ-ONLY. Display-safe fields only — no contact, qr_token, meal, guest_id,
 * payment-method, or order reads. The wall feed is the gated/blurred derivative
 * (wall_safe_r2_key); we never touch papic_photos / papic_guest_captures here.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'The gallery · Maria & Jose · Setnayan',
  description:
    'See a wedding come alive on Setnayan — the live photo wall filling in as the day unfolds, and the couple’s mood-board palette. No sign-up, nothing saved.',
  alternates: { canonical: '/tour/gallery' },
  openGraph: {
    title: 'The gallery · Maria & Jose · Setnayan',
    description: 'The day, captured by everyone — explore a real wedding’s live photo wall and palette.',
    url: '/tour/gallery',
    type: 'website',
  },
};

type InspirationRow = {
  slot_key: string | null;
  slot_position: number | null;
  image_url: string | null;
  caption: string | null;
};

type InspirationItem = {
  slotKey: string;
  slotPosition: number;
  imageUrl: string;
  caption: string | null;
};

/** Friendly labels for the inspiration slot_keys the seed writes. */
const INSPIRATION_SLOT_LABEL: Record<string, string> = {
  overall: 'Overall vibe',
  venue: 'Venue',
  ceiling: 'Ceremony',
  stage: 'Stage',
  table: 'Tables',
  tunnel: 'Tunnel',
  palette: 'Palette source',
  bride: 'Bride',
  groom: 'Groom',
  entourage: 'Entourage',
  principal_sponsor: 'Sponsors',
  parents: 'Parents',
  guests: 'Guests',
};

/** Which palette families to surface on the tour, in display order. Venue +
 *  couple always read; role families only show if the seed populated them. */
const PALETTE_DISPLAY_ORDER: ReadonlyArray<PaletteKey> = [
  'ceremony',
  'reception',
  'bride',
  'groom',
  'wedding_party',
  'principal_sponsors',
  'secondary_sponsors',
  'bearers_flower_girl',
  'officiants',
  'guest',
];

export default async function TourGalleryPage() {
  const ev = await getSampleEvent();
  const id = await getSampleEventId();
  const admin = createAdminClient();

  // ── Live Photo Wall ──────────────────────────────────────────────────────
  // getWallSnapshot takes (eventId, sinceIso, opts) and builds its OWN
  // service-role client internally; it reads the screened wall_feed mirror only.
  // limit:12 mirrors the guest-phone block (a dozen tiles, sliced before
  // presigning). If the sample has no wall_feed rows, snap.tiles is [] and the
  // wall renders its "warming up" empty state (see RISK note).
  const snap = await getWallSnapshot(id, null, { limit: 12 });
  const initialTiles: TourWallTile[] = snap.tiles.map((t) => ({
    feedId: t.feedId,
    url: t.url,
    widthPx: t.widthPx,
    heightPx: t.heightPx,
    sortAt: t.sortAt,
  }));
  const initialCount = snap.count;
  const initialCaption = snap.caption
    ? { text: snap.caption.text, author: snap.caption.author }
    : null;

  // A few pre-seeded "about to arrive" tiles for the client-only timer to drip
  // in. These are SYNTHETIC display tiles cloned from real wall tiles (so the
  // imagery is the couple's own screened feed) with fresh feedIds + later
  // sortAt values, so mergeTiles() treats them as genuine new arrivals and the
  // wall's `animate-wall-enter` rise+fade fires. If the wall is empty, there's
  // nothing to clone and the timer simply has no tiles to add (the empty state
  // still reads correctly). No network, no server — resets on reload.
  const nowMs = Date.now();
  const incomingTiles: TourWallTile[] = initialTiles.slice(0, 4).map((t, i) => ({
    feedId: `tour-incoming-${i}-${t.feedId}`,
    url: t.url,
    widthPx: t.widthPx,
    heightPx: t.heightPx,
    sortAt: new Date(nowMs + (i + 1) * 1000).toISOString(),
  }));

  // ── Mood-board palette ───────────────────────────────────────────────────
  const palette = sanitizeRolePalette(ev.role_palette ?? {});
  const swatchGroups: TourSwatchGroup[] = PALETTE_DISPLAY_ORDER.flatMap((key) => {
    const colors = palette[key];
    if (!colors || colors.length === 0) return [];
    const limits = PALETTE_LIMITS[key];
    return [
      {
        key,
        label: limits.label,
        family: limits.family,
        colors,
        slotLabels: limits.slotLabels ? [...limits.slotLabels] : null,
      },
    ];
  });

  // The couple's uploaded inspiration photos (display-safe: image_url + caption
  // only; no uploader identity, no storage internals). image_url is a usable
  // URL (the inspiration board renders it directly).
  const { data: inspirationData } = await admin
    .from('event_inspiration_assets')
    .select('slot_key, slot_position, image_url, caption')
    .eq('event_id', id)
    .is('removed_at', null)
    .order('slot_position', { ascending: true });

  const inspirations: InspirationItem[] = ((inspirationData ?? []) as InspirationRow[])
    .filter((r): r is InspirationRow & { image_url: string } => typeof r.image_url === 'string' && r.image_url.length > 0)
    .map((r) => ({
      slotKey: r.slot_key ?? 'overall',
      slotPosition: r.slot_position ?? 1,
      imageUrl: r.image_url,
      caption: r.caption ?? null,
    }));

  const bride = ev.bride_name ?? 'Maria';
  const groom = ev.groom_name ?? 'Jose';

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-20 pt-12 sm:pt-16">
      <header className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#8C6932]">Stop 05 · The gallery</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight tracking-tight text-[#1E2229] sm:text-5xl">
          See it come alive
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-[#5F5E5A] sm:text-lg">
          On the day, every photo {bride} & {groom}&rsquo;s guests take flows onto one live wall &mdash; the same feed the
          venue screen shows, mirrored to every phone. And it all stays true to the palette they set months before.
        </p>
      </header>

      {/* Live Photo Wall — client-only fork of LiveWallBlock (no network poll). */}
      <section aria-label="Live photo wall" className="mx-auto mt-12 max-w-3xl">
        <div className="flex items-center gap-2">
          <Camera aria-hidden className="h-4 w-4 text-[#8C6932]" strokeWidth={1.75} />
          <h2 className="font-serif text-2xl text-[#1E2229]">The wall, live</h2>
        </div>
        <p className="mt-2 text-sm text-[#5F5E5A]">
          Watch new moments drift in. On a real wedding day these appear the instant they&rsquo;re taken &mdash; here, tap
          &ldquo;Bring the wall to life&rdquo; to see it fill. Nothing is saved; reload to start fresh.
        </p>
        <div className="mt-6">
          <TourLiveWall
            initialTiles={initialTiles}
            initialCount={initialCount}
            initialCaption={initialCaption}
            incomingTiles={incomingTiles}
          />
        </div>
      </section>

      {/* Mood-board palette + inspirations. */}
      <section aria-label="Mood board palette" className="mx-auto mt-16 max-w-3xl">
        <div className="flex items-center gap-2">
          <Palette aria-hidden className="h-4 w-4 text-[#8C6932]" strokeWidth={1.75} />
          <h2 className="font-serif text-2xl text-[#1E2229]">The palette behind it all</h2>
        </div>
        <p className="mt-2 text-sm text-[#5F5E5A]">
          Every render &mdash; the invitation, the live wall chrome, the editorial &mdash; pulls from one colour story.
          Drag the preview to recolor it in your own head; it&rsquo;s a local sketch and nothing here is saved.
        </p>

        {swatchGroups.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[#1E2229]/15 bg-white/50 p-8 text-center text-sm text-[#5F5E5A]">
            This sample wedding hasn&rsquo;t set a palette yet.
          </div>
        ) : (
          <div className="mt-6">
            <TourPalettePreview groups={swatchGroups} />
          </div>
        )}

        {inspirations.length > 0 ? (
          <div className="mt-10">
            <div className="flex items-center gap-2">
              <Sparkles aria-hidden className="h-4 w-4 text-[#8C6932]" strokeWidth={1.75} />
              <h3 className="font-serif text-xl text-[#1E2229]">Their inspirations</h3>
            </div>
            <p className="mt-1.5 text-sm text-[#5F5E5A]">
              The references {bride} & {groom} pinned &mdash; the look they&rsquo;re building toward.
            </p>
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {inspirations.map((item) => (
                <li
                  key={`${item.slotKey}:${item.slotPosition}`}
                  className="overflow-hidden rounded-2xl border border-[#C5A059]/30 bg-[#FBF8F1]"
                >
                  <div className="relative aspect-[4/3] bg-[#1E2229]/5">
                    {/* Plain <img>: inspiration URLs are external/expiring; the
                        optimizer would cache a stale host. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={INSPIRATION_SLOT_LABEL[item.slotKey] ?? item.slotKey}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8C6932]">
                      {INSPIRATION_SLOT_LABEL[item.slotKey] ?? item.slotKey}
                    </p>
                    {item.caption ? (
                      <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-[#5F5E5A]">{item.caption}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* Forward nav. Stop 5 is the last stop — back to Stop 4, then all stops. */}
      <nav className="mx-auto mt-16 flex max-w-3xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <Link
          href="/tour/budget"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5C2542] transition-opacity hover:opacity-80"
        >
          <ArrowRight aria-hidden className="h-4 w-4 rotate-180" strokeWidth={1.75} />
          The budget
        </Link>
        <Link
          href="/tour"
          className="inline-flex min-h-[44px] items-center font-mono text-xs uppercase tracking-wider text-[#9A8F86] transition-opacity hover:opacity-80"
        >
          All stops
        </Link>
      </nav>

      <section className="mx-auto mt-12 max-w-2xl rounded-3xl border border-[#C5A059]/40 bg-[#FBF6EA] px-6 py-10 text-center">
        <h2 className="font-serif text-2xl text-[#1E2229] sm:text-3xl">That&rsquo;s the whole wedding.</h2>
        <p className="mx-auto mt-3 max-w-lg text-base text-[#5F5E5A]">
          The invitation, the vendors, the seating, the budget, the gallery &mdash; one place, start to finish. Start your
          own on Setnayan, free, in minutes. Set na &rsquo;yan.
        </p>
        <Link
          href="/onboarding/wedding?from=tour"
          className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#5C2542] px-7 py-3 text-sm font-semibold text-[#FBFBFA] transition-opacity hover:opacity-90"
        >
          Start planning &middot; free
        </Link>
      </section>
    </main>
  );
}
