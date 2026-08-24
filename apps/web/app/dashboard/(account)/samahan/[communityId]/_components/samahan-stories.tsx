'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clapperboard, Loader2, Trash2, X } from 'lucide-react';
import { compressVideoForWeb } from '@/lib/video-compress';
import type { SamahanStory } from '@/lib/samahan-stories';

// Samahan Stories strip (Setlog concept, owner 2026-08-24): raw short clips,
// one per member per hour, gone in 24 hours. The phone does the heavy work —
// the picked video is transcoded to web720 in the browser (the same
// compressVideoForWeb both Papic cameras use) and a poster frame is drawn
// from it for the server's NSFW screen, so the server never sees a raw
// phone export.

const MAX_DURATION_S = 10; // platform clip cap — the server refuses past it too
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

const ERROR_COPY: Record<string, string> = {
  one_per_hour: 'One story an hour — yours for this hour is already up.',
  too_long: 'Keep it under 10 seconds — 2 or 3 is perfect.',
  screen_refused: 'That clip can’t go up here.',
  screen_unavailable: 'We couldn’t check that clip just now. Try again in a moment.',
  clip_size: 'That video is too heavy to share. Try a shorter clip.',
  not_a_member: 'Only members can post here.',
};

function hoursLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'gone';
  const h = ms / 3_600_000;
  return h >= 1 ? `${Math.floor(h)}h left` : `${Math.max(1, Math.floor(ms / 60_000))}m left`;
}

async function extractPoster(file: File): Promise<{ poster: Blob; durationS: number }> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('unreadable'));
    });
    const durationS = Number.isFinite(video.duration) ? video.duration : 0;
    video.currentTime = Math.min(0.1, Math.max(0, durationS / 2));
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error('unreadable'));
    });
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const poster = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no_poster'))), 'image/jpeg', 0.8);
    });
    return { poster, durationS };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function SamahanStories({
  communityId,
  stories,
}: {
  communityId: string;
  stories: SamahanStory[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'idle' | 'compressing' | 'posting'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [playing, setPlaying] = useState<SamahanStory | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const myHourUsed = useMemo(() => {
    const hourStart = new Date();
    hourStart.setMinutes(0, 0, 0);
    return stories.some((s) => s.is_self && new Date(s.created_at) >= hourStart);
  }, [stories]);

  async function onPick(file: File) {
    setMessage(null);
    try {
      const { poster, durationS } = await extractPoster(file);
      if (durationS > MAX_DURATION_S + 0.9) {
        setMessage(ERROR_COPY.too_long!);
        return;
      }
      setBusy('compressing');
      const web = await compressVideoForWeb(file, { profile: 'web720' });
      if (web.size > MAX_UPLOAD_BYTES) {
        setMessage(ERROR_COPY.clip_size!);
        return;
      }
      setBusy('posting');
      const form = new FormData();
      form.append('community_id', communityId);
      form.append('clip', web, web.name || 'story.mp4');
      form.append('poster', poster, 'poster.jpg');
      form.append('duration_ms', String(Math.min(Math.round(durationS * 1000), 10_000)));
      const res = await fetch('/api/samahan/story', { method: 'POST', body: form });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setMessage(ERROR_COPY[json?.error ?? ''] ?? 'That didn’t go up. Try again.');
        return;
      }
      router.refresh();
    } catch {
      setMessage('We couldn’t read that video. Try another one.');
    } finally {
      setBusy('idle');
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function onRemove(storyId: string) {
    setRemoving(storyId);
    try {
      const res = await fetch('/api/samahan/story', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ story_id: storyId }),
      });
      if (res.ok) {
        setPlaying(null);
        router.refresh();
      }
    } finally {
      setRemoving(null);
    }
  }

  return (
    <section aria-label="Stories">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">This hour, right now</h2>
          <p className="text-xs text-ink/60">
            A few raw seconds from each of you — one an hour, gone after 24.
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy !== 'idle' || myHourUsed}
          className="inline-flex items-center gap-1.5 rounded-full bg-mulberry px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {busy !== 'idle' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Clapperboard className="h-3.5 w-3.5" aria-hidden />
          )}
          {busy === 'compressing'
            ? 'Shrinking…'
            : busy === 'posting'
              ? 'Posting…'
              : myHourUsed
                ? 'Yours is up'
                : 'Share this hour'}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onPick(f);
        }}
      />
      {message ? <p className="mt-2 text-xs text-mulberry-700">{message}</p> : null}

      {stories.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-ink/15 p-4 text-xs text-ink/55">
          Nothing yet this day. Share a couple of seconds of whatever is in front of you.
        </p>
      ) : (
        <ul className="mt-4 flex gap-3 overflow-x-auto pb-2" role="list">
          {stories.map((s) => (
            <li key={s.story_id} className="w-24 flex-none">
              <button
                type="button"
                onClick={() => setPlaying(s)}
                className="block w-full overflow-hidden rounded-xl border border-ink/10 bg-ink/5"
                aria-label={`Play ${s.author_name}’s story`}
              >
                {s.poster_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived presigned URL; the optimizer would re-transform per render
                  <img
                    src={s.poster_url}
                    alt=""
                    className="aspect-[3/4] w-full object-cover"
                  />
                ) : (
                  <span className="flex aspect-[3/4] w-full items-center justify-center text-ink/30">
                    <Clapperboard className="h-6 w-6" aria-hidden />
                  </span>
                )}
              </button>
              <p className="mt-1 truncate text-[11px] font-medium text-ink/80">
                {s.is_self ? 'You' : s.author_name}
              </p>
              <p className="text-[10px] text-ink/50">{hoursLeft(s.expires_at)}</p>
            </li>
          ))}
        </ul>
      )}

      {playing ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4"
          role="dialog"
          aria-label={`${playing.author_name}’s story`}
        >
          <div className="relative w-full max-w-sm">
            {playing.clip_url ? (
              <video
                src={playing.clip_url}
                poster={playing.poster_url ?? undefined}
                autoPlay
                loop
                playsInline
                controls
                className="w-full rounded-2xl"
              />
            ) : null}
            <div className="mt-3 flex items-center justify-between text-xs text-white/80">
              <span>
                {playing.is_self ? 'You' : playing.author_name} · {hoursLeft(playing.expires_at)}
              </span>
              <span className="flex items-center gap-3">
                {playing.is_self ? (
                  <button
                    type="button"
                    onClick={() => void onRemove(playing.story_id)}
                    disabled={removing === playing.story_id}
                    className="inline-flex items-center gap-1 text-white/80 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> Take it down
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setPlaying(null)}
                  className="inline-flex items-center gap-1"
                >
                  <X className="h-3.5 w-3.5" aria-hidden /> Close
                </button>
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
