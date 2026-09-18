'use client';

/**
 * "Ask the band for a song" — the guest's end of the song desk (SUP-52).
 *
 * The band's end is `RequestsInbox` in
 * `vendor-dashboard/on-the-day/live/[eventId]/_components/song-desk/` (NOT the
 * coordinator's same-named inbox over `event_day_requests`). This card POSTs to
 * `/api/song-requests`, which calls the July `guest_submit_song_request` RPC.
 *
 * Mounted by site-body only in the live window and only when a booked act can
 * read the inbox (`songRequestCardShows`) — so "Sent to the band" is never said
 * to a room with nobody listening. A paused band renders the pause up front
 * rather than letting a guest type a request to be refused.
 */

import { useState, useTransition } from 'react';
import { Loader2, Music } from 'lucide-react';
import {
  SONG_ARTIST_MAX,
  SONG_REQUESTER_NAME_MAX,
  SONG_REQUEST_COPY,
  SONG_TITLE_MAX,
  type SongRequestError,
  type SongRequestOutcome,
} from '@/lib/guest-song-request-rule';

export function SongRequestCard({ paused }: { paused: boolean }) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [name, setName] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setResult(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/song-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, artist, name }),
        });
        const data = (await res.json().catch(() => null)) as
          | { outcome?: SongRequestOutcome; error?: SongRequestError }
          | null;
        if (!res.ok || !data?.outcome) {
          const code = data?.error ?? 'save_failed';
          setResult({ ok: false, text: SONG_REQUEST_COPY[code] ?? SONG_REQUEST_COPY.save_failed });
          return;
        }
        setResult({ ok: true, text: SONG_REQUEST_COPY[data.outcome] });
        setTitle('');
        setArtist('');
      } catch {
        setResult({ ok: false, text: SONG_REQUEST_COPY.save_failed });
      }
    });
  };

  return (
    <section
      id="song-request"
      data-song-request-card
      className="scroll-mt-24 rounded-2xl border border-ink/10 bg-white/60 p-5"
    >
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
        <Music aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={2} />
        Ask the band for a song
      </h2>

      {paused ? (
        <p className="mt-2 text-sm text-ink/70">{SONG_REQUEST_COPY.paused}</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="mt-3 space-y-3"
        >
          <div>
            <label htmlFor="songreq-title" className="block text-xs font-medium text-ink/70">
              Song
            </label>
            <input
              id="songreq-title"
              type="text"
              required
              value={title}
              maxLength={SONG_TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Ikaw"
              className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-terracotta focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="songreq-artist" className="block text-xs font-medium text-ink/70">
              Artist <span className="text-ink/40">(optional)</span>
            </label>
            <input
              id="songreq-artist"
              type="text"
              value={artist}
              maxLength={SONG_ARTIST_MAX}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="e.g. Yeng Constantino"
              className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-terracotta focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="songreq-name" className="block text-xs font-medium text-ink/70">
              From <span className="text-ink/40">(optional — the band sees this)</span>
            </label>
            <input
              id="songreq-name"
              type="text"
              value={name}
              maxLength={SONG_REQUESTER_NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name or table"
              className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-terracotta focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={pending || title.trim().length === 0}
            className="button-primary inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {pending ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} /> : null}
            Send to the band
          </button>
          {result ? (
            <p
              role="status"
              className={result.ok ? 'text-sm text-ink/80' : 'text-sm text-terracotta'}
            >
              {result.text}
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}
