'use client';

/**
 * Life Story · the flash (PR-4, Build Plan §6) — the in-app life review.
 *
 * Owner-locked framing: experienced while you're ALIVE — opens on a face,
 * surfaces moments by weight, turns once to someone else's camera, holds
 * quiet on the ✦, and always ends on the present pointing forward.
 *
 * SAFETY CONTRACT (each line is a QA checkbox, Build Plan §6):
 *   · cross-dissolves + gentle Ken Burns only — never a strobe;
 *   · prefers-reduced-motion → a static contact sheet, with the why;
 *   · ANY stage interaction pauses instantly; explicit Stop always visible;
 *   · Escape closes; keyboard operable end-to-end; focus managed;
 *   · media preloads before play (no mid-playback jank);
 *   · clips mount only around the current beat (≤2 live videos).
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useReducedMotion } from '@/app/[slug]/_components/editorial/living-moments';
import { useFlashTimeline } from './use-flash-timeline';
import { placeholderBackground, orbBackground } from './placeholder';
import { captureLifeFlash } from './life-flash-analytics';
import styles from './flash.module.css';

export type FlashBeatView =
  | {
      kind: 'face_open';
      dwellMs: number;
      name: string;
      memoriam: boolean;
      recurrence: number;
    }
  | {
      kind: 'moment' | 'perspective' | 'memoriam_hold';
      dwellMs: number;
      id: string;
      url: string | null;
      type: 'photo' | 'clip';
      eventName: string;
      year: string;
      peopleCount: number;
      byName: string | null;
      bySelf: boolean;
      /** memoriam_hold only — the remembered person's name. */
      personName?: string;
    }
  | {
      kind: 'present_forward';
      dwellMs: null;
      id: string | null;
      url: string | null;
      type: 'photo' | 'clip' | null;
    };

const BADGES: Record<FlashBeatView['kind'], string> = {
  face_open: 'Open on a face',
  moment: 'A moment that mattered',
  perspective: 'Through someone else’s eyes',
  memoriam_hold: 'The ones we hold',
  present_forward: 'The present',
};

type Stage = 'closed' | 'loading' | 'playing' | 'paused' | 'ended';

function preloadImages(urls: string[], timeoutMs = 4000): Promise<void> {
  const loads = urls.map(
    (url) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve(); // a missed preload degrades, never blocks
        img.src = url;
      }),
  );
  const timeout = new Promise<void>((resolve) => {
    setTimeout(resolve, timeoutMs);
  });
  return Promise.race([Promise.all(loads).then(() => undefined), timeout]);
}

export function Flash({ beats, scopeKind }: { beats: FlashBeatView[]; scopeKind: string }) {
  const [stage, setStage] = useState<Stage>('closed');
  const [currentBeat, setCurrentBeat] = useState(0);
  const reducedMotion = useReducedMotion();

  const stageRef = useRef<HTMLDivElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const stopBtnRef = useRef<HTMLButtonElement | null>(null);
  // Fire-once guards so a metric never double-counts within one playthrough.
  const completedRef = useRef(false);
  const perspectiveFiredRef = useRef(false);
  const currentBeatRef = useRef(0);

  const open = stage !== 'closed';
  const timelineActive = stage === 'playing' || stage === 'paused';

  const hasPerspective = beats.some((b) => b.kind === 'perspective');
  const hasMemoriam = beats.some((b) => b.kind === 'memoriam_hold');

  const handle = useFlashTimeline({
    scope: stageRef,
    active: timelineActive && !reducedMotion,
    dwellsMs: beats.map((b) => b.dwellMs),
    onBeatChange: (i) => {
      setCurrentBeat(i);
      currentBeatRef.current = i;
      if (beats[i]?.kind === 'perspective' && !perspectiveFiredRef.current) {
        perspectiveFiredRef.current = true;
        void captureLifeFlash('life_flash_perspective_viewed', { scope: scopeKind });
      }
    },
    onComplete: () => {
      completedRef.current = true;
      void captureLifeFlash('life_flash_completed', {
        scope: scopeKind,
        beat_count: beats.length,
      });
      setStage('ended');
    },
  });

  // Scroll lock + focus management while the room is open.
  useEffect(() => {
    if (!open) return;
    const launcher = launcherRef.current; // captured now — the cleanup must not re-read the ref
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    stopBtnRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      launcher?.focus();
    };
  }, [open]);

  const close = () => {
    // A close before the ending (and not from the reduced-motion still sheet)
    // is a cancellation — the emotional-drop-off signal (strategy §9).
    if ((stage === 'playing' || stage === 'paused') && !completedRef.current && !reducedMotion) {
      void captureLifeFlash('life_flash_cancelled', {
        scope: scopeKind,
        at_beat: currentBeatRef.current,
        beat_count: beats.length,
      });
    }
    setStage('closed');
  };

  const play = async () => {
    completedRef.current = false;
    perspectiveFiredRef.current = false;
    currentBeatRef.current = 0;
    void captureLifeFlash('life_flash_started', {
      scope: scopeKind,
      beat_count: beats.length,
      has_perspective: hasPerspective,
      has_memoriam: hasMemoriam,
      reduced_motion: reducedMotion,
    });
    setStage('loading');
    setCurrentBeat(0);
    await preloadImages(
      beats.flatMap((b) => ('url' in b && b.url && b.type === 'photo' ? [b.url] : [])),
    );
    setStage('playing');
  };

  const pause = () => {
    handle.pause();
    setStage('paused');
  };
  const resume = () => {
    handle.resume();
    setStage('playing');
  };

  const onOverlayKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    // Any other key during playback pauses instantly (manual-interaction rule).
    if (stage === 'playing' && !(e.target as HTMLElement).closest('button, a')) {
      e.preventDefault();
      pause();
    }
  };
  const onStagePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    if (stage === 'playing') pause();
    else if (stage === 'paused') resume();
  };

  if (beats.length === 0) return null;

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        onClick={() => void play()}
        className="group mb-8 flex w-full items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-ink p-5 text-left transition-transform hover:-translate-y-0.5"
      >
        <span>
          <span className="block text-sm font-semibold text-white">▶ Play your Life-Flash</span>
          <span className="mt-0.5 block text-xs text-white/60">
            Your whole story in under a minute — the moments that mattered, rising out of the
            dark
          </span>
        </span>
        <span aria-hidden className="text-white/40 transition-colors group-hover:text-white">
          ✦
        </span>
      </button>

      {open ? (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-label="Life-Flash"
          onKeyDown={onOverlayKeyDown}
        >
          <div className={styles.controls}>
            {stage === 'paused' ? (
              <button type="button" className={styles.controlBtn} onClick={resume}>
                ▶ Resume
              </button>
            ) : null}
            {stage === 'ended' || stage === 'paused' ? (
              <button type="button" className={styles.controlBtn} onClick={() => void play()}>
                ↻ Replay
              </button>
            ) : null}
            <button
              ref={stopBtnRef}
              type="button"
              className={styles.controlBtn}
              onClick={close}
            >
              ■ Stop
            </button>
          </div>

          {reducedMotion ? (
            <ContactSheet beats={beats} />
          ) : stage === 'loading' ? (
            <div className={styles.endFrame}>
              <p className={styles.endSub}>Gathering your moments…</p>
            </div>
          ) : (
            <div
              ref={stageRef}
              className={styles.stage}
              onPointerDown={onStagePointerDown}
            >
              <div className={styles.progress} aria-hidden>
                <div className={styles.progressBar} data-progress-bar />
              </div>
              <div className={styles.badge}>{BADGES[beats[currentBeat]!.kind]}</div>

              {beats.map((beat, i) => (
                <div key={i} className={styles.layer} data-beat-layer>
                  <BeatLayer
                    beat={beat}
                    index={i}
                    nearCurrent={Math.abs(i - currentBeat) <= 1}
                    onClose={close}
                  />
                </div>
              ))}
              <div className={styles.vignette} aria-hidden />
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}

function BeatLayer({
  beat,
  index,
  nearCurrent,
  onClose,
}: {
  beat: FlashBeatView;
  index: number;
  nearCurrent: boolean;
  onClose: () => void;
}) {
  if (beat.kind === 'face_open') {
    return (
      <div className={styles.faceFrame}>
        <div>
          <div className={styles.orb} style={{ background: orbBackground(beat.name, beat.memoriam) }}>
            {beat.name.slice(0, 1)}
          </div>
          <div className={styles.who}>
            {beat.name}
            {beat.memoriam ? <span style={{ color: '#c9cee0' }}> ✦</span> : null}
          </div>
          <div className={styles.rec}>
            in {beat.recurrence} of your {beat.recurrence === 1 ? 'moment' : 'moments'}
          </div>
        </div>
      </div>
    );
  }

  if (beat.kind === 'present_forward') {
    return (
      <>
        {beat.url ? (
          <BeatMedia index={index} url={beat.url} type={beat.type ?? 'photo'} nearCurrent={nearCurrent} />
        ) : null}
        <div className={styles.endFrame}>
          <div>
            <p className={styles.endLine}>Keep giving it days worth remembering.</p>
            <p className={styles.endSub}>Your story is still being shot.</p>
            <div className={styles.endActions}>
              <Link href="/dashboard/create-event" className={styles.endCta}>
                Plan what’s next →
              </Link>
              <button type="button" className={styles.controlBtn} onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // moment · perspective · memoriam_hold
  return (
    <>
      {beat.url ? (
        <BeatMedia index={index} url={beat.url} type={beat.type} nearCurrent={nearCurrent} />
      ) : (
        <div className={styles.placeholder} style={{ background: placeholderBackground(beat.id) }} />
      )}
      <div className={styles.cap}>
        {beat.kind === 'perspective' ? (
          <>
            <p className={styles.kwentoItalic}>This is how {beat.byName} saw that day.</p>
            <div className={styles.meta}>
              <span className={styles.chipEmber}>◐ {beat.byName}’s camera</span>
            </div>
          </>
        ) : beat.kind === 'memoriam_hold' ? (
          <>
            <p className={styles.kwento}>
              {beat.eventName} · {beat.year}
            </p>
            <div className={styles.meta}>
              <span className={styles.chipSilver}>✦ {beat.personName ?? 'They'} was here</span>
            </div>
          </>
        ) : (
          <>
            <p className={styles.kwento}>
              {beat.eventName} · {beat.year}
            </p>
            <div className={styles.meta}>
              <span className={styles.chip}>
                {beat.bySelf ? '⌾ your camera' : beat.byName ? `◐ ${beat.byName}’s camera` : '◐ a Papic camera'}
              </span>
              {beat.peopleCount > 0 ? (
                <span className={styles.chip}>
                  {beat.peopleCount} {beat.peopleCount === 1 ? 'person' : 'people'} present
                </span>
              ) : null}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function BeatMedia({
  index,
  url,
  type,
  nearCurrent,
}: {
  index: number;
  url: string;
  type: 'photo' | 'clip';
  nearCurrent: boolean;
}) {
  return (
    <div className={styles.mediaWrap}>
      {type === 'clip' ? (
        nearCurrent ? (
          <video
            src={url}
            className={styles.media}
            data-beat-media={index}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
          />
        ) : null
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- presigned R2 URL isn't in the next/image allowlist
        <img src={url} alt="" className={styles.media} data-beat-media={index} decoding="async" />
      )}
    </div>
  );
}

function ContactSheet({ beats }: { beats: FlashBeatView[] }) {
  return (
    <div className={styles.sheet}>
      <p className={styles.sheetNote}>
        Reduced motion is on, so your story shows as stills — the same moments, none of the
        auto-play.
      </p>
      <div className={styles.sheetGrid}>
        {beats.map((beat, i) => {
          if (beat.kind === 'face_open') {
            return (
              <div key={i} className={styles.sheetCard}>
                <div
                  className={styles.placeholder}
                  style={{ background: orbBackground(beat.name, beat.memoriam) }}
                />
                <div className={styles.sheetCap}>
                  {beat.name}
                  {beat.memoriam ? ' ✦' : ''} — in {beat.recurrence} of your moments
                </div>
              </div>
            );
          }
          if (beat.kind === 'present_forward') {
            return (
              <div key={i} className={styles.sheetCard}>
                {beat.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- presigned R2 URL isn't in the next/image allowlist
                  <img src={beat.url} alt="" className={styles.media} loading="lazy" />
                ) : null}
                <div className={styles.sheetCap}>Keep giving it days worth remembering.</div>
              </div>
            );
          }
          const caption =
            beat.kind === 'perspective'
              ? `How ${beat.byName} saw it`
              : beat.kind === 'memoriam_hold'
                ? `✦ ${beat.personName ?? 'Remembered'}`
                : `${beat.eventName} · ${beat.year}`;
          return (
            <div key={i} className={styles.sheetCard}>
              {beat.url && beat.type === 'photo' ? (
                // eslint-disable-next-line @next/next/no-img-element -- presigned R2 URL isn't in the next/image allowlist
                <img src={beat.url} alt="" className={styles.media} loading="lazy" />
              ) : (
                <div
                  className={styles.placeholder}
                  style={{ background: placeholderBackground(beat.id) }}
                />
              )}
              <div className={styles.sheetCap}>{caption}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
