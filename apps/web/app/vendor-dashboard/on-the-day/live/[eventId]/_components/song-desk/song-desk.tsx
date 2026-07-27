import Link from 'next/link';
import { ArrowRight, CircleAlert, Music, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchEventSongRequests, fetchVendorSongs } from '@/lib/songs';
import { buildSongDesk, type SongDeskEntry, type SongDeskModel } from '@/lib/song-desk';
import { ConsoleRule } from '../../../../_components/pahina-console';
import type { SpecializationSurfaceProps } from '../specialization-registry';

/**
 * THE SONG DESK — the day-of specialization for a band / singer / choir /
 * orchestra / DJ.
 *
 * WHAT THIS DESK IS FOR, AND WHAT IT DELIBERATELY LEAVES ALONE. The owner's
 * lock names three things (requests · set list · what's-next); two of them were
 * already on this screen before this component existed, so this one builds only
 * the third:
 *
 *   ✗ what's-next — `FloorClock` (next-block countdown) and `RunOfShowHeader`
 *     (live timeline) render ABOVE this desk on the same page. A third clock
 *     here would be a duplicate that can disagree with the two above it.
 *   ✗ set list — authored at `/vendor-dashboard/repertoire`; the generic kit's
 *     `setlist` module already links there and stays in the generic kit.
 *   ✓ requests — the couple's picks, crossed against this act's repertoire.
 *     Until migration 20271013090000 a vendor could not read `event_song_picks`
 *     at all, so this existed at NO layer, DB or UI. This is the whole delta.
 *
 * THE ORDER IS THE OPINION. `gaps` first — a requested song this act does not
 * play is the only row anyone can act on before the set starts. `ready` second
 * (confidence). `spare` last, collapsed (filler). See `lib/song-desk.ts`.
 *
 * RENDERED INSIDE THE SLOT'S PLATE. `specialization-slot.tsx` already wraps this
 * in a `ConsolePlate` with a `ConsoleHeading` carrying the set's label, so this
 * component starts at the content and adds no outer plate or title of its own.
 *
 * ITS OWN DATA BOUNDARY. The frame mounts this only for an entitled, booked,
 * authenticated vendor — but that is not authorisation for these queries
 * (registry doc; 2026-07-26 security review). Both reads go through the
 * REQUEST-SCOPED client under the caller's own RLS, and both are scoped to the
 * `eventId` / `vendorProfileId` handed in. No admin client on this path: an
 * unbooked vendor reads zero request rows from the policy, not from this code.
 */
export async function SongDesk({ eventId, vendorProfileId, coupleName }: SpecializationSurfaceProps) {
  const supabase = await createClient();

  // Independent reads (one keys off the event, the other off the vendor) → one
  // parallel batch, matching the repertoire page's own perf idiom.
  const [requests, repertoire] = await Promise.all([
    fetchEventSongRequests(supabase, eventId),
    fetchVendorSongs(supabase, vendorProfileId),
  ]);

  const desk = buildSongDesk({ requests, repertoire });

  return (
    <div className="space-y-4">
      <Coverage desk={desk} coupleName={coupleName} />

      {desk.gaps.length > 0 ? (
        <Group
          tone="gap"
          title={desk.gaps.length === 1 ? '1 request you don’t play yet' : `${desk.gaps.length} requests you don’t play yet`}
          caption="Worth a word with the couple before you go on — learn it, swap it, or say so early."
          entries={desk.gaps}
        />
      ) : null}

      {desk.ready.length > 0 ? (
        <Group
          tone="ready"
          title={desk.ready.length === 1 ? '1 request in your set' : `${desk.ready.length} requests in your set`}
          caption="Asked for, and you play them."
          entries={desk.ready}
        />
      ) : null}

      {desk.spare.length > 0 ? <Spare entries={desk.spare} /> : null}

      <ConsoleRule />
      <Link
        href="/vendor-dashboard/repertoire"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-terracotta-700 underline-offset-4 hover:underline"
      >
        Edit your repertoire
        <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      </Link>
    </div>
  );
}

/**
 * The headline number, and the one case that must not render as a number.
 *
 *   • The couple picked nothing → a sentence, not "0 / 0". There is nothing to
 *     match, which is not the same as failing to match anything, and a 0%
 *     would read as an accusation about a test nobody set.
 *   • Otherwise → the plain fraction.
 *
 * NO SPECIAL CASE FOR "you play none of them", deliberately. `0 / 5` plus the
 * gap list directly beneath it is already the clearest statement of that
 * situation; a softening sentence here would only push the actionable list
 * further down the screen.
 */
function Coverage({ desk, coupleName }: { desk: SongDeskModel; coupleName: string }) {
  if (desk.noRequests) {
    return (
      <p className="text-sm leading-relaxed text-ink/70">
        {coupleName} haven’t picked any songs yet, so there’s nothing to match tonight —
        play your set. Anything they choose later will show up here.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-2xl font-bold text-ink">
          {desk.coveredCount} / {desk.requestedCount}
        </span>
        <span className="text-sm text-ink/65">
          of {coupleName}’s requests are in your repertoire
        </span>
      </div>
      {/* Decorative only — the fraction above already carries the information,
          so the bar needs no ARIA role and no percentage label of its own. */}
      <div aria-hidden className="h-1 w-full max-w-xs bg-ink/10">
        <div className="h-full bg-gild" style={{ width: `${desk.coveragePct}%` }} />
      </div>
    </div>
  );
}

/** One titled group of songs. `gap` gets the only alert colour on the desk. */
function Group({
  tone,
  title,
  caption,
  entries,
}: {
  tone: 'gap' | 'ready';
  title: string;
  caption: string;
  entries: SongDeskEntry[];
}) {
  const gap = tone === 'gap';
  return (
    <section className="space-y-1.5">
      <h4 className="flex items-center gap-1.5 text-sm font-medium text-ink">
        {gap ? (
          <CircleAlert aria-hidden className="h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
        ) : (
          <Check aria-hidden className="h-4 w-4 shrink-0 text-success-700" strokeWidth={2} />
        )}
        {title}
      </h4>
      <p className="text-xs leading-relaxed text-ink/60">{caption}</p>
      <ul className="pt-0.5">
        {entries.map((e) => (
          <SongRow key={e.songId} entry={e} emphasis={gap} />
        ))}
      </ul>
    </section>
  );
}

/**
 * The spare repertoire, collapsed. It is the longest list and the least
 * urgent — open by default it would push the actionable gaps off a phone
 * screen, which is the only screen that matters here.
 */
function Spare({ entries }: { entries: SongDeskEntry[] }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-ink/75 hover:text-ink">
        <Music aria-hidden className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={1.75} />
        {entries.length} more in your repertoire
        <ArrowRight
          aria-hidden
          className="h-3.5 w-3.5 text-ink/40 transition-transform group-open:rotate-90"
          strokeWidth={1.75}
        />
      </summary>
      <p className="pt-1 text-xs leading-relaxed text-ink/60">
        Not requested — your room to read the floor.
      </p>
      <ul className="pt-1">
        {entries.map((e) => (
          <SongRow key={e.songId} entry={e} emphasis={false} />
        ))}
      </ul>
    </details>
  );
}

/** One song. Title carries the weight; artist is secondary and may be absent. */
function SongRow({ entry, emphasis }: { entry: SongDeskEntry; emphasis: boolean }) {
  return (
    <li className="flex min-w-0 items-baseline gap-2 py-1">
      <span
        className={`min-w-0 truncate text-sm ${
          emphasis ? 'font-medium text-ink' : 'text-ink/85'
        }`}
      >
        {entry.title}
      </span>
      {entry.artist ? (
        <span className="min-w-0 shrink truncate text-xs text-ink/55">{entry.artist}</span>
      ) : null}
    </li>
  );
}
