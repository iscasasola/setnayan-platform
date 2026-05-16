'use client';

import { useState } from 'react';
import { Film } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { submitPatiktokRender } from '../actions';

// Iteration 0017 Phase 5 — Patiktok render-form with music selection.
//
// Builds on Phase 2 (real server action + queue) by adding the music-track
// dropdown sourced from the Setnayan-owned AI music catalogue table (Phase 5
// migration). Tracks are grouped by category (Bridgerton · Pop · Hip-hop ·
// Jazz · Acoustic · Filipino Pop) per spec.
//
// Selection is optional — leaving it on "Auto-pick" lets the render worker
// choose a track from the template's vibe category. Real ffmpeg/Remotion
// looping + beat-sync continuity is still TODO in the worker.

export type MusicTrackOption = {
  track_slug: string;
  category: string;
  display_name: string;
  bpm: number;
  duration_sec: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  bridgerton: 'Bridgerton',
  pop: 'Pop',
  hip_hop: 'Hip-hop',
  jazz: 'Jazz',
  acoustic: 'Acoustic',
  filipino_pop: 'Filipino Pop',
};

type Props = {
  eventId: string;
  templateSlug: string;
  templateName: string;
  defaultDurationSec: number;
  musicTracks: ReadonlyArray<MusicTrackOption>;
};

export function RenderForm({
  eventId,
  templateSlug,
  templateName: _templateName,
  defaultDurationSec,
  musicTracks,
}: Props) {
  const [duration, setDuration] = useState<number>(defaultDurationSec);
  const [musicTrackSlug, setMusicTrackSlug] = useState<string>('');

  // Group tracks by category so the <select> renders <optgroup>s.
  const grouped = musicTracks.reduce<Record<string, MusicTrackOption[]>>(
    (acc, t) => {
      (acc[t.category] ??= []).push(t);
      return acc;
    },
    {},
  );

  return (
    <form action={submitPatiktokRender} className="space-y-4">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="template_slug" value={templateSlug} />
      <input type="hidden" name="duration_sec" value={duration} />
      <input
        type="hidden"
        name="music_track_slug"
        value={musicTrackSlug}
      />

      <div className="space-y-2">
        <label
          htmlFor="duration"
          className="flex items-baseline justify-between gap-2 text-sm font-medium text-ink"
        >
          <span>Mimic duration</span>
          <span className="font-mono text-xs text-ink/60">{duration}s</span>
        </label>
        <input
          id="duration"
          type="range"
          min={1}
          max={30}
          step={1}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="w-full accent-terracotta"
        />
        <p className="text-xs text-ink/55">
          Spec range: 1–30 seconds per clip. Default tracks the template&rsquo;s
          choreographed beat length.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="music-track"
          className="block text-sm font-medium text-ink"
        >
          Music track
        </label>
        <select
          id="music-track"
          value={musicTrackSlug}
          onChange={(e) => setMusicTrackSlug(e.target.value)}
          className="w-full rounded-md border border-ink/15 bg-cream px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none"
        >
          <option value="">Auto-pick from template vibe</option>
          {Object.entries(grouped).map(([category, tracks]) => (
            <optgroup
              key={category}
              label={CATEGORY_LABELS[category] ?? category}
            >
              {tracks.map((t) => (
                <option key={t.track_slug} value={t.track_slug}>
                  {t.display_name} · {t.bpm} BPM · {t.duration_sec}s loop
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="text-xs text-ink/55">
          All tracks are Setnayan-owned AI compositions — safe to download
          and share. Loops seamlessly across the full compilation.
        </p>
      </div>

      <SubmitButton
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-terracotta px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-terracotta-600 disabled:opacity-70"
        pendingLabel="Queuing…"
      >
        <Film aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Render reel
      </SubmitButton>
      <p className="text-[11px] text-ink/55">
        Renders queue server-side. The ffmpeg / Remotion vertical-reel worker
        finishes each job and emails a download link — typically within an hour
        of your booth wrapping.
      </p>
    </form>
  );
}
