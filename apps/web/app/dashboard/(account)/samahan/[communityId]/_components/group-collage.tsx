'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Clapperboard, Play, X } from 'lucide-react';
import { leftLabel, storiesWord, type HourCollage } from '@/lib/samahan-chatroom';
import type { SamahanStory } from '@/lib/samahan-stories';
import { usePrefersReducedMotion } from '@/lib/use-responsive';
import { ActionButton } from '@/components/action-button';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { useBackCloses } from '@/lib/use-back-closes';

/**
 * group-collage.tsx — 🎞 THE HOURLY COLLAGE (owner 2026-10-28: *"all stories will run in a collage every hour"*;
 * prototypes/groups_chatroom_2026-10-28 frames A and C).
 *
 * In the chat: that hour's clips as ONE item — the tiles play together, MUTED, looping — with "3 PM · 6 stories" and
 * ▶ Play. ▶ Play opens it full-screen; a tile opens THAT person's story in the strip's own player (sound and all);
 * Next hour steps to the next collage. Same clips, same presigned URLs, nothing uploaded or rendered.
 *
 * 🔇 Muted on purpose, full-screen too: six clips with sound at once is noise, and a phone refuses unmuted autoplay
 * anyway. Sound is one tap away — a tile opens that clip in the player, which carries it.
 * 🧘 Reduced motion: the tiles hold still on their posters (no video element at all).
 * 👁 A tile plays only while it is on screen — a long chat never runs twenty hidden videos.
 */

/** How many tiles the chat item draws; the full-screen view draws them all. */
export const COLLAGE_TILES_IN_CHAT = 6;

function Tile({ story, still, onOpen }: { story: SamahanStory; still: boolean; onOpen?: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [still, story.clip_url]);
  const face =
    story.clip_url && !still ? (
      <video
        ref={ref}
        src={story.clip_url}
        poster={story.poster_url ?? undefined}
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
        className="absolute inset-0 h-full w-full object-cover"
        data-collage-video=""
      />
    ) : story.poster_url ? (
      // eslint-disable-next-line @next/next/no-img-element -- short-lived presigned URL; the optimizer would re-transform per render
      <img src={story.poster_url} alt="" className="absolute inset-0 h-full w-full object-cover" data-collage-still="" />
    ) : (
      <span className="absolute inset-0 flex items-center justify-center text-white/40">
        <Clapperboard className="h-5 w-5" aria-hidden />
      </span>
    );
  const name = story.is_self ? 'You' : story.author_name;
  const inner = (
    <>
      {face}
      <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-transparent from-55% to-black/55" />
      <span className="absolute bottom-1.5 left-2 right-2 truncate text-left text-[11px] font-semibold text-white drop-shadow">
        {name}
      </span>
    </>
  );
  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Watch ${name}’s story`}
      className="relative block h-full min-h-0 w-full overflow-hidden bg-black/40"
      data-collage-tile={story.story_id}
    >
      {inner}
    </button>
  ) : (
    <span className="relative block h-full w-full overflow-hidden bg-black/40" data-collage-tile={story.story_id}>
      {inner}
    </span>
  );
}

/** The collage as it sits in the chat. */
export function GroupCollage({
  collage,
  nowMs,
  onPlay,
  onOpenStory,
}: {
  collage: HourCollage;
  nowMs: number;
  onPlay: () => void;
  onOpenStory: (storyId: string) => void;
}) {
  const still = usePrefersReducedMotion();
  const shown = collage.stories.slice(0, COLLAGE_TILES_IN_CHAT);
  const more = collage.stories.length - shown.length;
  const title = `${collage.label} · ${storiesWord(collage.stories.length)}`;
  return (
    <div
      className="w-full self-stretch overflow-hidden rounded-2xl bg-black text-white"
      data-collage={collage.key}
      aria-label={title}
      role="group"
    >
      <div className={`grid h-[210px] gap-0.5 ${shown.length === 1 ? 'grid-cols-1' : shown.length === 2 || shown.length === 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {shown.map((s, i) => (
          <span key={s.story_id} className="relative block min-h-0">
            <Tile story={s} still={still} onOpen={() => onOpenStory(s.story_id)} />
            {more > 0 && i === shown.length - 1 ? (
              <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 text-lg font-semibold">
                +{more}
              </span>
            ) : null}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2 px-3 py-2 text-[13px]">
        <b className="min-w-0 flex-1 truncate font-semibold">{title}</b>
        <span className="text-[11px] text-white/60">{leftLabel(collage.goneAtMs, nowMs)}</span>
        <span data-collage-play="">
          <ActionButton tone="brand" filled icon={Play} label="Play" onClick={onPlay} />
        </span>
      </div>
    </div>
  );
}

/** ▶ Play — the collage full-screen; Next hour steps forward; a tile opens that person's story. */
export function CollagePlayer({
  collages,
  openKey,
  nowMs,
  onClose,
  onStep,
  onOpenStory,
}: {
  collages: readonly HourCollage[];
  openKey: string | null;
  nowMs: number;
  onClose: () => void;
  onStep: (key: string) => void;
  onOpenStory: (storyId: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const at = openKey ? collages.findIndex((c) => c.key === openKey) : -1;
  const collage = at >= 0 ? collages[at]! : null;
  const next = at >= 0 ? collages[at + 1] : undefined;
  const close = useBackCloses(collage !== null, onClose);
  useModalA11y({ open: collage !== null, onClose: close, containerRef: ref });
  const still = usePrefersReducedMotion();
  const [, setTick] = useState(0);
  // Re-read "21h left" each minute while it is open.
  useEffect(() => {
    if (!collage) return;
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, [collage]);
  if (!collage) return null;
  const title = `${collage.label} · ${storiesWord(collage.stories.length)}`;
  const n = collage.stories.length;
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
      data-collage-player={collage.key}
    >
      <div className="flex items-center gap-2.5 px-3.5 pb-2 pt-[max(0.875rem,env(safe-area-inset-top))]">
        <b className="min-w-0 flex-1 truncate text-[16px] font-semibold">{title}</b>
        <span className="text-xs text-white/70">{leftLabel(collage.goneAtMs, nowMs)}</span>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div
        key={collage.key}
        className={`grid min-h-0 flex-1 auto-rows-fr gap-0.5 overflow-y-auto ${n === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}
      >
        {collage.stories.map((s) => (
          <Tile key={s.story_id} story={s} still={still} onOpen={() => onOpenStory(s.story_id)} />
        ))}
      </div>
      <div className="flex gap-2 px-3.5 pb-[max(1.625rem,env(safe-area-inset-bottom))] pt-3">
        {next ? (
          <button
            type="button"
            onClick={() => onStep(next.key)}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-full bg-white/[0.12] font-semibold"
            data-collage-next=""
          >
            Next hour <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={close}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-full bg-white/[0.12] font-semibold"
            data-collage-next="done"
          >
            That’s the newest hour · Close
          </button>
        )}
      </div>
    </div>
  );
}
