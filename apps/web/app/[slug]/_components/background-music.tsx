'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { VolumeX } from 'lucide-react';
import { TOP_CORNER_SLOT_ID } from '../_lib/top-corner';

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
 *   - An always-visible icon-only mute toggle (speaker-on ⇄ muted) — the
 *     universal sound affordance, accessible, never a hidden auto-soundtrack a
 *     guest can't silence.
 *   - Lazy: preload="none" so the audio bytes don't compete with LCP.
 *
 * 🔝 IT LIVES IN THE TOP-RIGHT CORNER (owner 2026-09-21: "follow your
 * proposed" — design canvas, "The music button — today and proposed"). It used
 * to float bottom-left, over whatever scrolled under it, one lift away from the
 * menu bar. The top-right corner is where apps put sound, and nothing reads
 * there. A guest's page already has its Account control in that corner, so the
 * button joins that cluster through a portal into `TOP_CORNER_SLOT_ID` rather
 * than stacking a second fixed element on top of it; with no cluster on the
 * page (a visitor, the couple's own view) it holds the corner itself.
 *
 * 💬 ONE HINT, BEFORE THE FIRST TAP. Browsers never let music start on its
 * own, so the only way a guest learns there IS a song is being told once:
 * "Tap for their song", under the button, until the first tap. Then never.
 * While music plays, three small bars move in place of the speaker — they
 * hold still under prefers-reduced-motion.
 *
 * v1 uses a looping <audio> element. The spec's gapless-via-Web-Audio loop is
 * a deferred refinement — `loop` has a tiny seam on some browsers but is
 * robust, accessible, and ships the feature; Web Audio gapless can layer on
 * later without changing this component's contract.
 */
/** The corner on its own, when the page has no top-right cluster to join. */
const CORNER_ALONE = 'fixed right-3 top-3 z-[95] [padding-top:env(safe-area-inset-top)] print:hidden';

export function BackgroundMusic({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [touched, setTouched] = useState(false);
  // The guest's top-right cluster, when the page has one. Read after mount:
  // GuestHubBar renders after this component in the tree.
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setSlot(document.getElementById(TOP_CORNER_SLOT_ID));
    setMounted(true);
  }, []);

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
    setTouched(true);
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

  const control = (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={playing}
        aria-label={playing ? 'Mute background music' : 'Play background music'}
        title={playing ? 'Mute music' : 'Play music'}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-cream/90 text-terracotta-700 shadow-sm backdrop-blur transition hover:bg-cream"
      >
        {playing ? (
          <span aria-hidden className="inline-flex h-4 items-end gap-[2px]">
            <span className="sn-eq-bar h-4 w-[3px] rounded-sm bg-current" />
            <span className="sn-eq-bar h-4 w-[3px] rounded-sm bg-current [animation-delay:0.2s]" />
            <span className="sn-eq-bar h-4 w-[3px] rounded-sm bg-current [animation-delay:0.4s]" />
          </span>
        ) : (
          <VolumeX aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        )}
      </button>
      {touched ? null : (
        <span
          role="note"
          className="absolute right-0 top-full mt-2 whitespace-nowrap rounded-lg bg-ink px-3 py-1.5 text-xs text-cream shadow-lg"
        >
          Tap for their song
        </span>
      )}
    </div>
  );

  return (
    <>
      {/* Optional background soundtrack the guest opts into — no captions. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={src} loop preload="none" />
      {mounted ? (slot ? createPortal(control, slot) : <div className={CORNER_ALONE}>{control}</div>) : null}
    </>
  );
}
