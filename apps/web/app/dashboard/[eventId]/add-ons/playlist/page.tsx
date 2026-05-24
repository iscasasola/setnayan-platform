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
  countPositivePicks,
  PLAYLIST_SLOT_TYPES,
  PLAYLIST_SLOT_LABELS,
  PLAYLIST_SLOT_HINTS,
  type PlaylistSlotType,
} from '@/lib/playlist';
import { PlaylistSlotSection } from './_components/playlist-slot-section';

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
  const [picksRaw, eventRow, musicVendorRow] = await Promise.all([
    fetchPlaylistPicks(supabase, eventId),
    supabase
      .from('events')
      .select('event_id,event_name')
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

  const grouped = groupPicksBySlot(picksRaw);
  const positiveCount = countPositivePicks(picksRaw);
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
        Back to {eventRow.data.event_name ?? 'event home'}
      </Link>

      <header className="mb-6 space-y-2">
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
        <h1 className="font-display text-3xl italic leading-tight text-ink sm:text-4xl">
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
        <div className="mb-6 rounded-xl border border-emerald-300/50 bg-emerald-50/60 p-4">
          <p className="inline-flex items-start gap-2 text-sm text-emerald-900">
            <Sparkles
              aria-hidden
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-700"
              strokeWidth={2}
            />
            <span className="leading-relaxed">
              Synced with{' '}
              <strong className="font-medium">{bookedMusic.vendor_name}</strong>{' '}
              — they'll see this lineup in their Setnayan workspace. Edit
              anytime; they'll always see your latest picks.
            </span>
          </p>
        </div>
      ) : (
        <div className="mb-6 rounded-xl border border-ink/15 bg-cream/50 p-4">
          <p className="text-sm leading-relaxed text-ink/75">
            Build the lineup whenever you're ready. The moment you lock
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
      <div className="space-y-5">
        {PLAYLIST_SLOT_TYPES.map((slot) => (
          <PlaylistSlotSection
            key={slot}
            eventId={eventId}
            slotType={slot}
            label={PLAYLIST_SLOT_LABELS[slot]}
            hint={PLAYLIST_SLOT_HINTS[slot]}
            picks={grouped[slot]}
            isBannedSlot={slot === 'banned_songs'}
          />
        ))}
      </div>
    </main>
  );
}
