import { RoomFooter } from '../_components/room-footer';
import type { RoomLink } from '../_lib/room-links';
import { loadRoomLinks } from '../_lib/room-links.server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, MapPin } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveProfile, surfaceEnabled } from '@/lib/event-type-profile';
import { eventWordsFromProfile } from '../_lib/event-words';
import { canViewSlugEvent } from '@/lib/slug-access';
import { Logo } from '@/app/_components/logo';
import { NameSearch } from './_components/name-search';

export const metadata = { title: 'Find your seat' };

// Public, no-session free finder — never statically cached (publication state
// + the search are dynamic).
export const dynamic = 'force-dynamic';

/**
 * /[slug]/find-seat — the FREE, public "find your seat" finder (seat-finding
 * PR 1). A guest who scans the shared/master venue QR lands on /[slug]; from
 * there (or directly) they reach this page, type their name, and see their
 * table label. No guest session, no paid SKU — the generic free tier that a PH
 * rival gates behind a ₱8,995 plan. The richer personalized entrance->table
 * map stays the paid /[slug]/find-my-table surface.
 *
 * Read safety: the event is resolved by slug via the admin client (public
 * route, no RLS session). NO guest data is read on this page — the actual
 * name->table lookup is the SECURITY DEFINER public_seat_lookup() RPC, hit
 * from the client through /api/seat-lookup/[slug], which returns only
 * {display_name, table_label} for a PUBLISHED plan. Here we only read the
 * publication flag to choose between the search UI and a friendly
 * "not posted yet" state; graceful-degrade on a pre-migration floor-plan table
 * (42P01 / 42703) → treat as not published.
 */

type Props = { params: Promise<{ slug: string }> };

export default async function FindSeatPage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const admin = createAdminClient();

  const { data: event } = await admin
    .from('events')
    .select('event_id, display_name, slug, venue_name, event_type, event_date, landing_page_visibility')
    .ilike('slug', slug)
    .maybeSingle();

  if (!event) notFound();
  // Iteration 0053: public guest pages under /[slug] are the 'website' surface.
  // Non-wedding (generic) profiles don't enable it → still notFound() (same as
  // the old `!== 'wedding'`), now config-driven.
  const profile = await resolveProfile(event.event_type);
  if (!surfaceEnabled(profile, 'website')) notFound();
  // The same profile, reused for its WORDS — the plate below said "the couple"
  // to a graduation. Wedding → 'couple', so a wedding is byte-identical.
  const words = eventWordsFromProfile(profile);
  const roomLinks = await loadRoomLinks({
    event,
    current: 'seat',
    // `true` is EARNED here, not assumed: this room already ran
    // `canViewSlugEvent` against the SAME raw visibility column the money-gift
    // page applies, and redirected away if it failed. Reaching this line means
    // the viewer passed that exact gate. Anywhere that is NOT true, pass the
    // real answer — a door drawn by a rule laxer than the one at the other end
    // sends a guest to a redirect with no explanation.
    pabuyaViewerAllowed: true,
  });

  // Visibility gate (owner 2026-06-20): don't leak a private (pre-launch) page's
  // couple data through this sub-route. Strangers on a private page bounce to
  // /[slug] (the lock screen); by the wedding day the page is launched → public
  // → everyone passes, so the day-of QR seat-finder is unaffected.
  if (!(await canViewSlugEvent(event.event_id, event.landing_page_visibility))) {
    redirect(`/${slug}`);
  }

  // Publication gate — only a published seating pack is searchable. Degrade to
  // "not posted yet" on a missing/legacy floor-plan table rather than crashing.
  let published = false;
  const { data: plan, error: planError } = await admin
    .from('event_floor_plan')
    .select('published_at')
    .eq('event_id', event.event_id)
    .maybeSingle();
  if (planError && planError.code !== '42P01' && planError.code !== '42703') {
    throw new Error(`Failed to resolve seating publication: ${planError.message}`);
  }
  published = Boolean(plan?.published_at);

  return (
    <Shell roomLinks={roomLinks} displayName={event.display_name} slug={slug}>
      {published ? (
        <div className="space-y-6">
          <header className="space-y-2 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
              Find your seat
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Type your name
            </h1>
            {event.venue_name ? (
              <p className="inline-flex items-center justify-center gap-1.5 text-sm text-ink/60">
                <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                {event.venue_name}
              </p>
            ) : null}
            <p className="mx-auto max-w-prose text-sm text-ink/55">
              Start typing your name to see which table you&rsquo;re at.
            </p>
          </header>
          <NameSearch
            slug={slug}
            eventDate={event.event_date as string | null}
            organizer={words.theOrganizer}
          />
        </div>
      ) : (
        <PromptCard
          title="Seating isn&rsquo;t posted yet"
          body={`${words.TheHost} hasn’t published the seating plan for this ${words.occasion}. Check back closer to the day — once they post it, you’ll be able to find your table here.`}
        />
      )}

      <div className="mt-8 text-center">
        <Link
          href={`/${slug}`}
          className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Back to the invitation
        </Link>
      </div>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Chrome — self-contained guest-microsite shell (mirrors find-my-table's,
// decoupled from the [slug] page so it stays independent).
// ─────────────────────────────────────────────────────────────────────────

function Shell({
  displayName,
  slug,
  children,
  roomLinks,
}: {
  displayName: string;
  slug: string;
  children: React.ReactNode;
  roomLinks: RoomLink[];
}) {
  return (
    <main className="min-h-dvh bg-cream text-ink">
      <header className="border-b border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href={`/${slug}`} className="flex items-center gap-2 text-ink">
            <Logo height={28} />
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink/60">
              Setnayan
            </span>
          </Link>
          <span className="font-mono text-xs uppercase tracking-[0.15em] text-ink/50">
            {displayName}
          </span>
        </div>
      </header>
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">{children}</div>
      <footer className="border-t border-ink/10 px-4 py-8 text-center">
        <p className="font-serif text-lg italic text-terracotta">See you soon.</p>
        <p className="mt-3 text-xs text-ink/50">Powered by Setnayan · setnayan.com</p>
      </footer>
      <RoomFooter links={roomLinks} />
    </main>
  );
}

function PromptCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-cream p-6 text-center sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mx-auto mt-3 max-w-prose text-sm text-ink/60">{body}</p>
    </div>
  );
}
