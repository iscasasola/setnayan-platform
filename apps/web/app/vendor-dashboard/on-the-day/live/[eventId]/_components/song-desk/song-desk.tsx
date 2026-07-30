import Link from 'next/link';
import { ArrowRight, Ban, CircleAlert, Music, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchEventSongRequests, fetchVendorSongs } from '@/lib/songs';
import { fetchPlaylistPicks } from '@/lib/playlist';
import {
  buildHostPlaylist,
  buildSongDesk,
  type HostPlaylistEntry,
  type HostPlaylistModel,
  type SongDeskEntry,
  type SongDeskModel,
} from '@/lib/song-desk';
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
 * PR 2 ADDS THE HOST'S PLAYLIST (owner 2026-07-27: "make this helpful for the
 * host and the band first"). The couple has been able to build a moment-by-
 * moment playlist since iteration 0016 — processional, first dance, dinner, and
 * a "Don't play these" list — and the act booked to play it could not see it.
 * `event_playlist_picks_music_vendor_read` already existed (verified against the
 * migration, 2026-07-27), so this is a pure read: no migration, no new policy,
 * and the slot vocabulary comes from `lib/playlist.ts` rather than being
 * restated here. The decision lives in `buildHostPlaylist`; this file renders it.
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
 * (registry doc; 2026-07-26 security review). All three reads go through the
 * REQUEST-SCOPED client under the caller's own RLS, and each is scoped to the
 * `eventId` / `vendorProfileId` handed in. No admin client on this path: an
 * unbooked vendor reads zero request rows from the policy, not from this code.
 *
 * ⚠ ONE HONEST NOTE ON THE PLAYLIST READ. `event_playlist_picks_music_vendor_read`
 * is keyed on `auth.uid()` + a booked music-category `event_vendors` row — the
 * USER, not the `vendorProfileId` handed in — and the table itself has no vendor
 * column to filter on, so `eventId` is the only scope this code can add (it
 * does). A user holding two profiles could therefore read this event's playlist
 * through either one; harmless here because the frame only mounts this desk for
 * a profile holding `song_desk`, and every profile it would resolve through is
 * one of that same user's booked music acts. Worth knowing before this read is
 * copied somewhere the mounting rules differ.
 */
export async function SongDesk({ eventId, vendorProfileId, coupleName }: SpecializationSurfaceProps) {
  const supabase = await createClient();

  // Independent reads (two key off the event, one off the vendor) → one parallel
  // batch, matching the repertoire page's own perf idiom.
  const [requests, repertoire, picks] = await Promise.all([
    fetchEventSongRequests(supabase, eventId),
    fetchVendorSongs(supabase, vendorProfileId),
    fetchPlaylistPicks(supabase, eventId),
  ]);

  const desk = buildSongDesk({ requests, repertoire });
  const playlist = buildHostPlaylist({ picks, repertoire });

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

      <HostPlaylist playlist={playlist} desk={desk} coupleName={coupleName} />

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
 * THE HOST'S PLAYLIST — the night, moment by moment, as the couple wrote it.
 *
 * Sits BELOW the flat requests and ABOVE the spare repertoire, which is the
 * order of a musician's questions before a set: what can't I play that they
 * asked for (gaps) → what does the night look like (this) → what else have I got
 * (spare).
 *
 * THE EMPTY STATE IS DELIBERATELY CONDITIONAL. If the couple has picked nothing
 * anywhere, `Coverage` already said so and a second "nothing here" line would
 * just be noise. But a couple with flat picks and no per-moment playlist is a
 * real and currently common state — the two surfaces do not talk to each other
 * yet (Song Desk PR 3) — and a band should be told that rather than left to
 * assume the moments are unplanned.
 *
 * ⚠ KNOWN, AND PR 3'S TO FIX: a song the couple chose in BOTH places appears in
 * both blocks — once as a flat request, once under its moment. Cross-matching
 * the two here would mean inventing a merge rule days before the owner-answered
 * one (onboarding pre-fills the studio) lands, so this PR leaves the duplication
 * visible and labelled rather than papering over it. The two headings say which
 * list is which, and prod holds zero playlist rows today.
 */
function HostPlaylist({
  playlist,
  desk,
  coupleName,
}: {
  playlist: HostPlaylistModel;
  desk: SongDeskModel;
  coupleName: string;
}) {
  if (playlist.isEmpty) {
    if (desk.noRequests) return null; // Coverage already said it.
    return (
      <>
        {/* The rule belongs to whatever renders below it, so it lives on each
            branch that renders — never above a section that returned null. */}
        <ConsoleRule />
        <p className="text-sm leading-relaxed text-ink/70">
          {coupleName} haven’t set out the night moment by moment yet — the songs above are
          their list, without a running order.
        </p>
      </>
    );
  }

  return (
    <>
      <ConsoleRule />
      <section className="space-y-3">
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-ink">
            {coupleName}’s night, moment by moment
          </h4>
          <p className="text-xs leading-relaxed text-ink/60">
            {summarise(playlist)}
          </p>
        </div>

        {playlist.moments.map((moment) => (
          <div key={moment.slot} className="space-y-0.5">
            <h5 className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-ink/50">
              {moment.label}
            </h5>
            <ul>
              {moment.entries.map((entry) => (
                <PickRow key={entry.pickId} entry={entry} tone="moment" />
              ))}
            </ul>
          </div>
        ))}

        {playlist.banned.length > 0 ? <Banned playlist={playlist} /> : null}
      </section>
    </>
  );
}

/**
 * "8 songs across 3 moments — 2 not in your repertoire."
 *
 * Pulled out of the JSX because the plurals made the template unreadable, and
 * because a band with one song in one moment should not read "1 songs across 1
 * moments". The all-covered wording is a different sentence, not a missing
 * clause — confidence, not a zero.
 */
function summarise(playlist: HostPlaylistModel): string {
  const songs = `${playlist.positiveCount} ${playlist.positiveCount === 1 ? 'song' : 'songs'}`;
  const moments = `${playlist.moments.length} ${playlist.moments.length === 1 ? 'moment' : 'moments'}`;
  return playlist.gapCount > 0
    ? `${songs} across ${moments} — ${playlist.gapCount} not in your repertoire.`
    : `${songs} across ${moments}, all in your repertoire.`;
}

/**
 * "DON'T PLAY THESE" — the same crossing, read the other way up.
 *
 * On a normal moment the flag is "they asked and you don't play it". Here it
 * inverts: a banned song sitting in your own repertoire is the one row on this
 * screen that can ruin a wedding, so it gets the alert colour and the count in
 * the caption. A banned song you don't play needs no emphasis at all — it is
 * already impossible.
 */
function Banned({ playlist }: { playlist: HostPlaylistModel }) {
  return (
    <div className="space-y-0.5 pt-1">
      <h5 className="flex items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-ink/50">
        <Ban aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        Don’t play these
      </h5>
      {playlist.hazardCount > 0 ? (
        <p className="text-xs leading-relaxed text-terracotta-700">
          {playlist.hazardCount === 1
            ? '1 of these is in your repertoire — worth a mark on your list.'
            : `${playlist.hazardCount} of these are in your repertoire — worth a mark on your list.`}
        </p>
      ) : null}
      <ul>
        {playlist.banned.map((entry) => (
          <PickRow key={entry.pickId} entry={entry} tone="banned" />
        ))}
      </ul>
    </div>
  );
}

/**
 * One song off the host's playlist.
 *
 * Three things beyond the title, each earning its space:
 *   • the artist — the couple's, or (when they named none) the one from the
 *     repertoire song this matched, so a wrong "Perfect" is spottable;
 *   • the couple's note, if they left one ("the acoustic version, please") —
 *     the whole reason a band wants to read this screen rather than be told;
 *   • a flag, in the direction that matters for this list.
 */
function PickRow({ entry, tone }: { entry: HostPlaylistEntry; tone: 'moment' | 'banned' }) {
  const flagged = tone === 'banned' ? entry.inRepertoire : !entry.inRepertoire;
  return (
    <li className="py-1">
      <div className="flex min-w-0 items-baseline gap-2">
        {flagged ? (
          <CircleAlert
            aria-hidden
            className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-terracotta"
            strokeWidth={1.75}
          />
        ) : null}
        <span className={`min-w-0 truncate text-sm ${flagged ? 'font-medium text-ink' : 'text-ink/85'}`}>
          {entry.title}
        </span>
        {entry.artist ? (
          <span className="min-w-0 shrink truncate text-xs text-ink/55">{entry.artist}</span>
        ) : entry.matchedArtist ? (
          <span className="min-w-0 shrink truncate text-xs text-ink/45">
            {/* Not the couple's word — ours, from the match. Lighter on purpose. */}
            {entry.matchedArtist}
          </span>
        ) : null}
      </div>
      {entry.notes ? (
        <p className="pl-0.5 text-xs leading-relaxed text-ink/60">{entry.notes}</p>
      ) : null}
      {tone === 'moment' && flagged ? (
        <p className="pl-0.5 text-xs leading-relaxed text-ink/60">Not in your repertoire.</p>
      ) : null}
    </li>
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
