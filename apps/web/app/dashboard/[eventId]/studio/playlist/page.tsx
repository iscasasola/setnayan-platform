/**
 * Playlist Builder add-on surface.
 *
 * Owner directive 2026-05-24 (via AskUserQuestion): "create your song
 * list" = playlist builder for the booked DJ/band (NOT Pakanta · the
 * custom songwriter SKU). Free utility · couples pick songs by slot ·
 * vendor reads through the music-vendor RLS policy on
 * event_playlist_picks.
 *
 * Server component shell · fetches picks · groups by slot · renders 8
 * slot sections (7 positive + 1 banned). Each section has an inline
 * "Add song" form + per-pick edit/delete handled by the
 * <PlaylistSlotSection> client island.
 *
 * Brand voice per [[feedback_setnayan_no_dev_text_post_launch]]:
 * polite editorial PH-luxe voice across all empty-state, button, and
 * helper copy. No engineering jargon.
 *
 * Booked Music vendor detection: scan event_vendors for any
 * (band_dj/host_emcee/choir/string_quartet) row with non-considering
 * status. If found, show a sync chip at the top: "Synced with {vendor}
 * — they'll see this lineup in their Setnayan workspace." If not found,
 * show a polite nudge: "Book your DJ or band first so your lineup syncs
 * to them automatically." The playlist still works without a booked
 * vendor — the host can build it ahead and the sync activates the
 * moment a Music vendor locks.
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Music as MusicIcon, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  fetchPlaylistPicks,
  groupPicksBySlot,
  fetchSlotVibes,
  countPositivePicks,
  PLAYLIST_SLOT_TYPES,
  PLAYLIST_SLOT_LABELS,
  PLAYLIST_SLOT_HINTS,
  type PlaylistSlotType,
} from '@/lib/playlist';
import { fetchEventSongRequests } from '@/lib/songs';
import { buildUnsortedTray } from '@/lib/song-desk';
import { PlaylistSlotSection } from './_components/playlist-slot-section';
import { UnsortedTray } from './_components/unsorted-tray';

type Props = {
  params: Promise<{ eventId: string }>;
};

export default async function PlaylistPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch event + booked Music vendor (if any) in parallel with picks.
  // Music vendor detection: scan event_vendors for confirmed bookings
  // matching the four Music canonical categories.
  const [picksRaw, vibes, flatPicks, eventRow, musicVendorRow] = await Promise.all([
    fetchPlaylistPicks(supabase, eventId),
    // The feel per moment (PR 4) — same event scope, so it joins the batch.
    fetchSlotVibes(supabase, eventId),
    // The couple's FLAT onboarding picks (PR 3) — the tray is these minus
    // whatever is already placed in a moment.
    fetchEventSongRequests(supabase, eventId),
    // ⚠ `display_name`, NOT `event_name` — public.events has no `event_name`
    // column and never has. PostgREST 42703'd the WHOLE query, so
    // `eventRow.data` was always null and the `if (!eventRow.data) redirect(…)`
    // below bounced EVERY visitor straight back to /dashboard: this page was
    // 100% unreachable in production.
    supabase
      .from('events')
      .select('event_id,display_name')
      .eq('event_id', eventId)
      .maybeSingle(),
    supabase
      .from('event_vendors')
      .select('vendor_id,vendor_name,category,status')
      .eq('event_id', eventId)
      .in('category', ['band_dj', 'host_emcee', 'choir', 'string_quartet'])
      .in('status', ['contracted', 'deposit_paid', 'delivered', 'complete'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!eventRow.data) redirect('/dashboard');

  // `.rows` because a failed read is now distinguishable from an empty one
  // (lib/playlist.ts). This surface behaves the same either way — the couple's
  // own editor shows empty slots to fill — so it reads through to the rows; the
  // distinction exists for the vendor song desk, which otherwise turns a denied
  // read into a claim about what the couple did.
  const unsorted = buildUnsortedTray({ flatPicks, placed: picksRaw.rows });
  const grouped = groupPicksBySlot(picksRaw.rows);
  const positiveCount = countPositivePicks(picksRaw.rows);
  const bookedMusic = musicVendorRow.data;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:max-w-4xl">
      {/* Back-to-event-home link · matches the navigation pattern from
          other add-on surfaces. */}
      <Link
        href={`/dashboard/${eventId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink/55 transition-colors hover:text-ink/85"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to {eventRow.data.display_name ?? 'event home'}
      </Link>

      <header className="sn-reveal mb-6 space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-terracotta/10 px-3 py-1">
          <MusicIcon
            aria-hidden
            className="h-3 w-3 text-terracotta"
            strokeWidth={2.25}
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
            Playlist
          </span>
        </div>
        <h1 className="sn-h1">
          Your wedding playlist
        </h1>
        <p className="text-sm leading-relaxed text-ink/75 sm:text-base">
          Pick the songs you want at each moment — your DJ or band sees
          this lineup the second you book them. Add favorites; flag
          must-not-plays. They handle the rest of the night.
        </p>
      </header>

      {/* Sync status chip · whether a Music vendor is already booked. */}
      {bookedMusic ? (
        <div className="mb-6 rounded-xl border border-success-300/50 bg-success-50/60 p-4">
          <p className="inline-flex items-start gap-2 text-sm text-success-900">
            <Sparkles
              aria-hidden
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-700"
              strokeWidth={2}
            />
            <span className="leading-relaxed">
              Synced with{' '}
              <strong className="font-medium">{bookedMusic.vendor_name}</strong>{' '}
              — they&apos;ll see this lineup in their Setnayan workspace. Edit
              anytime; they&apos;ll always see your latest picks.
            </span>
          </p>
        </div>
      ) : (
        <div className="mb-6 sn-row p-4">
          <p className="text-sm leading-relaxed text-ink/75">
            Build the lineup whenever you&apos;re ready. The moment you lock
            your DJ or band, this playlist syncs to their workspace
            automatically.
          </p>
        </div>
      )}

      {/* Pick count summary · helps the host see progress at a glance. */}
      {positiveCount > 0 ? (
        <p className="mb-6 text-xs text-ink/55">
          {positiveCount} song{positiveCount === 1 ? '' : 's'} picked across{' '}
          the timeline
          {grouped.banned_songs.length > 0
            ? ` · ${grouped.banned_songs.length} on the don't-play list`
            : ''}
          .
        </p>
      ) : null}

      {/* 8 slot sections · one per canonical slot type. Each is a client
          island wrapping the inline add/edit/delete form. */}
      {/* The tray answers "where did my songs go?", which is asked before any
          other question on this page — so it sits above the moments. It renders
          nothing once everything is placed. */}
      <UnsortedTray eventId={eventId} entries={unsorted} />

      <div className="space-y-5">
        {PLAYLIST_SLOT_TYPES.map((slot) => (
          <PlaylistSlotSection
            key={slot}
            eventId={eventId}
            slotType={slot}
            label={PLAYLIST_SLOT_LABELS[slot]}
            hint={PLAYLIST_SLOT_HINTS[slot]}
            picks={grouped[slot]}
            vibe={vibes[slot] ?? null}
            isBannedSlot={slot === 'banned_songs'}
          />
        ))}
      </div>
    </main>
  );
}
