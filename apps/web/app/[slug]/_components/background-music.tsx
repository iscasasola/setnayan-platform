'use client';

import { useEffect, useRef, useState } from 'react';
import { Music, Pause, Volume2 } from 'lucide-react';

/**
 * Looping background music for the wedding site (Increment B ·
 * Wedding_Website_Lifecycle_Spec_2026-06-07 §6.2). The couple opts in
 * (events.site_bg_music_enabled) and uploads a track (site_bg_music_r2_key) or
 * points at their Pakanta song; the page resolves a presigned URL and passes
 * it here.
 *
 * UX rules from §6.2 (and the owner's "UX is north star"):
 *   - Autoplay is blocked by browsers → the song NEVER force-plays. A visible
 *     floating control lets the guest TAP to start.
 *   - An always-visible toggle (play ⇄ pause) — accessible, never a hidden
 *     auto-soundtrack a guest can't silence.
 *   - Lazy: preload="none" so the audio bytes don't compete with LCP.
 *
 * v1 uses a looping <audio> element. The spec's gapless-via-Web-Audio loop is
 * a deferred refinement — `loop` has a tiny seam on some browsers but is
 * robust, accessible, and ships the feature; Web Audio gapless can layer on
 * later without changing this component's contract.
 */
export function BackgroundMusic({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  // Pause on unmount so a client-side navigation doesn't leave audio running.
  useEffect(() => {
    const el = audioRef.current;
    return () => {
      if (el) {
        el.pause();
      }
    };
  }, []);

  async function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
      return;
    }
    try {
      await el.play();
      setPlaying(true);
    } catch {
      // Autoplay/gesture policy rejected play — leave it paused. The tap that
      // triggered this IS a user gesture, so a second tap reliably starts it.
      setPlaying(false);
    }
  }

  return (
    <>
      {/* Optional background soundtrack the guest opts into — no captions. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={src} loop preload="none" />
      <button
        type="button"
        onClick={toggle}
        aria-pressed={playing}
        aria-label={playing ? 'Pause background music' : 'Play background music'}
        className="fixed bottom-5 left-5 z-50 inline-flex items-center gap-2 rounded-full border border-ink/10 bg-cream/90 px-4 py-2.5 text-xs font-medium text-ink shadow-lg backdrop-blur transition hover:bg-cream"
      >
        {playing ? (
          <Pause aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
        ) : (
          <Music aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
        )}
        <span className="hidden sm:inline">{playing ? 'Pause music' : 'Play music'}</span>
        {playing ? (
          <Volume2 aria-hidden className="h-3.5 w-3.5 text-ink/45" strokeWidth={1.75} />
        ) : null}
      </button>
    </>
  );
}
