'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Music, VolumeX } from 'lucide-react';

/**
 * Onboarding background music (owner 2026-06-08). A low-volume, owned/AI-generated
 * soundtrack (uploaded by an admin at /admin/onboarding, streamed from R2) that plays
 * while couples go through /onboarding/wedding so the ~15-min flow doesn't feel long.
 *
 * UX (owner "UX is north star" + browser autoplay policy):
 *   - NEVER force-plays muted/unmuted on load. It starts softly on the FIRST real
 *     user gesture anywhere in onboarding (a gesture satisfies the autoplay policy),
 *     unless the couple previously muted it (remembered in localStorage).
 *   - The control PULSES to invite a tap until the music has played once (or the
 *     couple opts out), so they notice it and know they can turn sound on/off.
 *   - An always-visible pill toggles play ⇄ pause; the choice persists.
 *   - `preload="none"` + streams (the 30-min track never blocks the page), `loop` so
 *     a longer session never falls silent.
 *   - Pauses on unmount (e.g. the lazy commit → dashboard navigation).
 */

const MUTED_KEY = 'setnayan_onboarding_music_muted';
const VOLUME = 0.32;

export function OnboardingMusic({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [playing, setPlaying] = useState(false);
  // Pulse the control to invite the couple to turn music on — shown until the
  // track has played once or they've made an explicit choice.
  const [showPulse, setShowPulse] = useState(false);
  // Whether the couple has explicitly muted before (don't auto-start if so).
  const prefersMutedRef = useRef(false);

  const start = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = VOLUME;
    void el
      .play()
      .then(() => {
        setPlaying(true);
        setShowPulse(false);
      })
      .catch(() => setPlaying(false));
  }, []);

  // Read the saved mute preference once on mount; invite (pulse) unless muted.
  useEffect(() => {
    let muted = false;
    try {
      muted = localStorage.getItem(MUTED_KEY) === '1';
    } catch {
      /* storage blocked — treat as not-muted */
    }
    prefersMutedRef.current = muted;
    setShowPulse(!muted);
  }, []);

  // Auto-start on the first user gesture (unless previously muted). One-shot.
  //
  // A gesture ON the music button is owned by its onClick — we must skip it
  // here, otherwise the two handlers race on the same tap: this listener
  // (pointerdown) starts the audio, then the button's click handler sees a
  // now-playing element and immediately pauses it, so the couple had to click
  // twice to unmute. Excluding the button makes a first-tap-on-the-button a
  // clean single toggle.
  useEffect(() => {
    if (prefersMutedRef.current) return;
    let fired = false;
    const onFirst = (e: Event) => {
      if (fired) return;
      const onButton =
        buttonRef.current != null &&
        e.target instanceof Node &&
        buttonRef.current.contains(e.target);
      fired = true;
      cleanup();
      if (!onButton && !prefersMutedRef.current) start();
    };
    const cleanup = () => {
      window.removeEventListener('pointerdown', onFirst);
      window.removeEventListener('keydown', onFirst);
      window.removeEventListener('touchstart', onFirst);
    };
    window.addEventListener('pointerdown', onFirst, { passive: true });
    window.addEventListener('keydown', onFirst);
    window.addEventListener('touchstart', onFirst, { passive: true });
    return cleanup;
  }, [start]);

  // Pause on unmount so a client-side navigation doesn't leave audio running.
  useEffect(() => {
    const el = audioRef.current;
    return () => {
      if (el) el.pause();
    };
  }, []);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!el.paused) {
      el.pause();
      setPlaying(false);
      setShowPulse(false);
      prefersMutedRef.current = true;
      try {
        localStorage.setItem(MUTED_KEY, '1');
      } catch {
        /* ignore */
      }
    } else {
      prefersMutedRef.current = false;
      try {
        localStorage.setItem(MUTED_KEY, '0');
      } catch {
        /* ignore */
      }
      start();
    }
  }, [start]);

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- instrumental background loop, no captions */}
      <audio ref={audioRef} src={src} loop preload="none" />
      <button
        ref={buttonRef}
        type="button"
        className={`onb-music${playing ? ' on' : ''}${showPulse && !playing ? ' pulse' : ''}`}
        onClick={toggle}
        aria-label={playing ? 'Mute background music' : 'Play background music'}
        title={playing ? 'Mute music' : 'Play music'}
      >
        {playing ? <Music size={15} strokeWidth={2} aria-hidden /> : <VolumeX size={15} strokeWidth={2} aria-hidden />}
      </button>
    </>
  );
}
