import { VolumeX } from 'lucide-react';
import type { HubMusicButton } from '@/lib/hub-music-button';

/**
 * 🎵 The round control itself — its size, ground and colour. ONE spelling, worn by the guest's button
 * (`background-music.tsx`) and by the three drawn in the Maker (Look › Music › Music button, and the sample screen),
 * so what the couple picks is the thing a guest taps. The colour is the page's own accent-as-text token: it follows
 * the couple's five and the ground, exactly as the eyebrows do.
 */
export const MUSIC_BUTTON_CLASS =
  'inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-cream/90 text-terracotta-700 shadow-sm backdrop-blur';

/**
 * 🎵 THE BUTTON'S FACE — one of three designs (owner 2026-10-08, round 5; `lib/hub-music-button.ts`). It moves ONLY
 * while the song plays; before the first tap, and whenever the song is stopped, it rests in a clear still. One
 * colour — `currentColor`, the couple's Accent as the button wears it — and nothing fetched: bars are spans, the
 * record and the note are inline SVG. Under "reduce motion" each rests where it is (`globals.css`).
 *   · bars   — exactly the shipped face: three bars while playing, the muted speaker at rest;
 *   · record — a disc with grooves; it turns while playing;
 *   · note   — a note; two soft rings pulse out from it while playing, none at rest.
 */
export function MusicButtonFace({ design, playing }: { design: HubMusicButton; playing: boolean }) {
  if (design === 'record') {
    return (
      <svg aria-hidden data-music-face="record" viewBox="0 0 24 24" className={`h-6 w-6${playing ? ' sn-music-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6.5" opacity="0.55" />
        <path d="M12 2a10 10 0 0 1 7 3" strokeWidth="2.25" strokeLinecap="round" />
        <circle cx="12" cy="12" r="2.25" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (design === 'note') {
    return (
      <span aria-hidden data-music-face="note" className="relative inline-flex h-6 w-6 items-center justify-center">
        {playing ? (
          <>
            <span className="sn-music-ring absolute inset-0 rounded-full border border-current" />
            <span className="sn-music-ring absolute inset-0 rounded-full border border-current [animation-delay:0.9s]" />
          </>
        ) : null}
        <svg viewBox="0 0 24 24" className="relative h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l10-2v13" />
          <circle cx="6.5" cy="18" r="2.5" fill="currentColor" />
          <circle cx="16.5" cy="16" r="2.5" fill="currentColor" />
        </svg>
      </span>
    );
  }
  return playing ? (
    <span aria-hidden className="inline-flex h-4 items-end gap-[2px]">
      <span className="sn-eq-bar h-4 w-[3px] rounded-sm bg-current" />
      <span className="sn-eq-bar h-4 w-[3px] rounded-sm bg-current [animation-delay:0.2s]" />
      <span className="sn-eq-bar h-4 w-[3px] rounded-sm bg-current [animation-delay:0.4s]" />
    </span>
  ) : (
    <VolumeX aria-hidden className="h-5 w-5" strokeWidth={1.75} />
  );
}
