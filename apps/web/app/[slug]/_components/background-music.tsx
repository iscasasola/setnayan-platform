'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TOP_CORNER_SLOT_ID } from '../_lib/top-corner';
import { HUB_MUSIC_BUTTON_DEFAULT, type HubMusicButton } from '@/lib/hub-music-button';
import { MUSIC_BUTTON_CLASS, MusicButtonFace } from './music-button-face';
import { onUnveil, onUnveilPress, primeMedia, VEIL_FREE_ATTR } from '@/lib/hub-veil';
import { SILENT_HINT_COPY, SILENT_HINT_FADE_MS, SILENT_HINT_SHOW_MS, songStartNeedsSilentHint } from '@/lib/hub-music-silent-hint';

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
 * 🔕 AND ONE HINT EACH TIME IT STARTS, ON AN iPHONE OR iPAD (owner 2026-11-01:
 * "keep it silently playing but a message saying the audio is playing but your
 * phone is in silent/muted?"). The song respects the silent switch, so on a
 * phone set to silent it plays unheard while the bars move. A page cannot read
 * that switch, so the same chip says "may be on silent" for a few seconds and
 * fades (no fade under reduced motion). Never on Android or a computer.
 *
 * v1 uses a looping <audio> element. The spec's gapless-via-Web-Audio loop is
 * a deferred refinement — `loop` has a tiny seam on some browsers but is
 * robust, accessible, and ships the feature; Web Audio gapless can layer on
 * later without changing this component's contract.
 */
/** The corner on its own, when the page has no top-right cluster to join. */
const CORNER_ALONE = 'fixed right-[max(0.75rem,var(--sn-safe-r))] top-3 z-[95] [padding-top:env(safe-area-inset-top)] print:hidden';

export function BackgroundMusic({ src, design = HUB_MUSIC_BUTTON_DEFAULT }: { src: string; /** 🎵 The couple's design (`hubMusicButton`). */ design?: HubMusicButton }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [touched, setTouched] = useState(false);
  // 🔕 The silent hint: shown after a start, then fading, then gone (`lib/hub-music-silent-hint.ts`).
  const [silentHint, setSilentHint] = useState<'off' | 'on' | 'fading'>('off');
  const silentHintTimers = useRef<number[]>([]);
  function hideSilentHint() {
    for (const t of silentHintTimers.current) window.clearTimeout(t);
    silentHintTimers.current = [];
    setSilentHint('off');
  }
  function showSilentHint() {
    if (!songStartNeedsSilentHint(navigator.userAgent, navigator.maxTouchPoints)) return;
    hideSilentHint();
    setSilentHint('on');
    silentHintTimers.current = [
      window.setTimeout(() => setSilentHint('fading'), SILENT_HINT_SHOW_MS),
      window.setTimeout(() => setSilentHint('off'), SILENT_HINT_SHOW_MS + SILENT_HINT_FADE_MS),
    ];
  }
  useEffect(() => () => {
    for (const t of silentHintTimers.current) window.clearTimeout(t);
  }, []);
  // 📜 THE HINT BELONGS TO THE TOP OF THE PAGE. The button is pinned to the
  // viewport, so a hint pinned with it rode down over the invitation's text
  // as the guest scrolled (seen live 2026-09-21, covering the "open the link
  // the couple sent you" line). It shows only while the page is at the top.
  const [atTop, setAtTop] = useState(true);
  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
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

  /*
    🎵 THE UNVEIL STARTS THE SONG (owner 2026-10-15, verbatim: "when they unveil, the music starts playing upon
    tap"). The veil calls this synchronously inside the guest's tap / swipe up (`onUnveil`, a direct call —
    not a dispatched event), and `play()` is called HERE — still inside the gesture, the one moment a browser lets sound start (iOS
    Safari refuses anything later, silently). Not after the lift, not in a timeout.
    🔇 A REFUSAL IS NOT SILENT: the button stays ▶ and "Tap for their song" stays under it, exactly as before
    the first tap. No veil on the page → this is never called → the song starts on a tap, as it always has.
    Reduced motion has no say over sound: those guests get no veil, so their song is the tap, as today.
  */
  useEffect(() => {
    const startOnUnveil = () => {
      const el = audioRef.current;
      if (!el || !el.paused) return;
      // `startSong` calls `el.play()` before its first await — i.e. right here, inside the gesture.
      void startRef.current(el).then((ok) => {
        if (ok) setTouched(true);
      });
    };
    return onUnveil(startOnUnveil);
  }, []);
  /* 👇 …AND THE PRESS UNLOCKS IT (PR #7129). A swipe up's pointerup carries no media credit on iOS (measured in the
     app's "View Event Hub" sheet: refused 2 of 2, a tap allowed), so the unveil's play() above was refused for a
     swipe and the song stayed off. The veil's pointerdown plays-and-pauses the song at once (silent), which unlocks
     it, and the swipe up's play() then starts it (2 of 2). */
  useEffect(
    () =>
      onUnveilPress(() => {
        const el = audioRef.current;
        if (el) primeMedia(el);
      }),
    [],
  );

  /** The ONE way the song starts — the guest's tap on the button, or their tap / swipe that opened the veil. */
  async function startSong(el: HTMLAudioElement): Promise<boolean> {
    try {
      await el.play();
      setPlaying(true);
      showSilentHint();
      return true;
    } catch {
      // Autoplay/gesture policy rejected play — leave it paused. The tap that
      // triggered this IS a user gesture, so a second tap reliably starts it.
      setPlaying(false);
      return false;
    }
  }
  const startRef = useRef(startSong);
  startRef.current = startSong;

  async function toggle() {
    setTouched(true);
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
      hideSilentHint();
      return;
    }
    await startSong(el);
  }

  const control = (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={playing}
        aria-label={playing ? 'Mute background music' : 'Play background music'}
        title={playing ? 'Mute music' : 'Play music'}
        data-music-button={design}
        className={`${MUSIC_BUTTON_CLASS} transition hover:bg-cream`}
      >
        <MusicButtonFace design={design} playing={playing} />
      </button>
      {touched || !atTop ? null : (
        <span
          role="note"
          className="absolute right-0 top-full mt-2 whitespace-nowrap rounded-lg bg-ink px-3 py-1.5 text-xs text-cream shadow-lg"
        >
          Tap for their song
        </span>
      )}
      {silentHint === 'off' ? null : (
        <span
          role="status"
          data-silent-hint
          className={`pointer-events-none absolute right-0 top-full mt-2 w-max max-w-[min(16rem,calc(100vw-1.5rem))] rounded-lg bg-ink px-3 py-1.5 text-xs text-cream shadow-lg transition-opacity duration-700 motion-reduce:transition-none ${silentHint === 'fading' ? 'opacity-0' : 'opacity-100'}`}
        >
          {SILENT_HINT_COPY}
        </span>
      )}
    </div>
  );

  return (
    <>
      {/* Optional background soundtrack the guest opts into — no captions. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      {/* `data-veil-free`: it only ever plays on the guest's own tap or the unveil itself — the veil's hold
          (`lib/hub-veil.ts`) must not pause the song the guest just asked for. */}
      <audio ref={audioRef} src={src} loop preload="none" {...{ [VEIL_FREE_ATTR]: '' }} />
      {mounted ? (slot ? createPortal(control, slot) : <div data-top-corner className={CORNER_ALONE}>{control}</div>) : null}
    </>
  );
}
