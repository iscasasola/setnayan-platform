'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Pause, Play, X } from 'lucide-react';
import type { HubMusicChoice } from '@/lib/hub-music-ref';

/**
 * 🎵 LOOK › MUSIC › SOURCE ▾ "OUR MUSIC" — the Song row and its list by mood
 * (owner 2026-10-08, the approved Look restudy: *"background music is upload
 * your music or pick from our background music"*; screens 13–14).
 *
 * The tracks are the ones a Setnayan admin uploads and publishes at
 * /admin/hub-music. This piece only CHOOSES: a tap on a song hands its id to
 * the Music form (`SiteChromePanel`), which posts it into the draft like every
 * other Look change — ✓ Apply publishes it. ▶ plays a song here, in the Maker,
 * before or after picking; nothing a guest hears changes until Apply.
 *
 * ⚡ Loaded when Source ▾ is on "Our music" — never with the Maker
 * (`media-panels.tsx` reaches it through `next/dynamic`, in the `maker-details`
 * chunk).
 *
 * A list that could not be read says so. It is never drawn as an empty list.
 */
export function OurMusicSong({
  choices,
  currentRef,
  onPick,
}: {
  /** The published tracks, by mood — or `null` when they could not be read. */
  choices: readonly HubMusicChoice[] | null;
  /** The song in place, when it is one of ours. */
  currentRef: string | null;
  onPick: (trackId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [cannotPlay, setCannotPlay] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const headingId = useId();

  useEffect(() => {
    const audio = audioRef.current;
    return () => audio?.pause();
  }, []);

  if (choices === null) {
    return (
      <p role="alert" className="mt-2 text-xs text-ink" data-our-music="unread">
        Couldn’t load our music — refresh to try again.
      </p>
    );
  }

  const current = choices.find((c) => c.ref === currentRef) ?? null;

  function toggle(choice: HubMusicChoice) {
    const audio = audioRef.current;
    if (!audio || !choice.previewUrl) return;
    if (playing === choice.trackId) {
      audio.pause();
      setPlaying(null);
      return;
    }
    setCannotPlay(null);
    audio.src = choice.previewUrl;
    setPlaying(choice.trackId);
    audio.play().catch(() => {
      setPlaying(null);
      setCannotPlay(choice.title);
    });
  }

  const playButton = (choice: HubMusicChoice) => (
    <button
      type="button"
      onClick={() => toggle(choice)}
      disabled={!choice.previewUrl}
      aria-label={playing === choice.trackId ? `Pause ${choice.title}` : `Play ${choice.title}`}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink/5 text-ink disabled:opacity-40"
      data-our-music-play=""
    >
      {playing === choice.trackId ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
    </button>
  );

  return (
    <div data-our-music={open ? 'list' : 'row'}>
      <audio
        ref={audioRef}
        preload="none"
        onEnded={() => setPlaying(null)}
        onError={() => {
          const title = choices.find((c) => c.trackId === playing)?.title ?? null;
          setPlaying(null);
          if (title) setCannotPlay(title);
        }}
      />
      {cannotPlay ? (
        <p role="alert" className="mt-2 text-xs text-ink">
          This browser could not play “{cannotPlay}”.
        </p>
      ) : null}

      {!open ? (
        <div className="flex min-h-11 items-center justify-between gap-3">
          <p className="shrink-0 text-[0.72rem] font-semibold text-ink/80">Song</p>
          {choices.length === 0 ? (
            <p className="text-xs text-ink/70" data-our-music-none="">
              No music here yet.
            </p>
          ) : (
            <span className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-haspopup="listbox"
                className="inline-flex h-11 min-w-0 items-center gap-2 rounded-full border border-ink/15 bg-cream px-4 text-sm text-ink"
                data-our-music-open=""
              >
                <span className="truncate">
                  {current
                    ? `${current.title} · ${current.moodLabel}`
                    : currentRef
                      ? 'A song no longer on our list'
                      : 'Pick a song'}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
              </button>
              {current ? playButton(current) : null}
            </span>
          )}
        </div>
      ) : (
        <div role="group" aria-labelledby={headingId}>
          <div className="flex min-h-11 items-center justify-between gap-3">
            <p id={headingId} className="text-sm font-semibold text-ink">
              Our music
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close our music"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-ink/5 text-ink"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <ul role="listbox" aria-labelledby={headingId} className="pb-1">
            {choices.map((choice, i) => {
              const chosen = choice.ref === currentRef;
              const firstOfMood = i === 0 || choices[i - 1]!.moodLabel !== choice.moodLabel;
              return (
                <li key={choice.trackId} role="presentation">
                  {firstOfMood ? (
                    <p
                      role="presentation"
                      className="pb-1 pt-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink/70"
                      data-our-music-mood=""
                    >
                      {choice.moodLabel}
                    </p>
                  ) : null}
                  <div
                    className={`flex items-center gap-3 rounded-md px-1 py-1${chosen ? ' bg-ink/5' : ''}`}
                    data-our-music-track={chosen ? 'chosen' : ''}
                  >
                    {playButton(choice)}
                    <button
                      type="button"
                      role="option"
                      aria-selected={chosen}
                      onClick={() => {
                        onPick(choice.trackId);
                        setOpen(false);
                      }}
                      className="flex min-w-0 flex-1 flex-col items-start justify-center text-left"
                    >
                      <span className="truncate text-sm text-ink">{choice.title}</span>
                      <span className="font-mono text-[0.7rem] text-ink/70">{choice.length}</span>
                    </button>
                    {chosen ? <Check className="h-4 w-4 shrink-0 text-mulberry" aria-label="Your song" /> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
