'use client';

/**
 * 🎵 STUDIO › LOOK › MUSIC › MUSIC BUTTON — the guest's music button, in three designs.
 *
 * Owner, 2026-10-08, round 5 (DECISION_LOG "LOOK ROUNDS 4–5"; `BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 2.E):
 * *"music icon can be that animated moving bars. can we make them choose 2 more designs?"* — Moving bars (the
 * shipped one, the default) · Record · Note. Each card is the REAL control (`MusicButtonFace` in the guest button's
 * own round, `MUSIC_BUTTON_CLASS`), drawn as it looks while the song plays, with the picked one ringed.
 *
 * control → kind (`INTERACTION_RULES.md` § 9): the three → Choice cards (the thing itself, like the button shapes).
 * No dropdown, no Save button.
 *
 * ⚡ ONE PICK = ONE DRAFT WRITE, HELD (`makerSave(…, { held: true })`): no whole-Maker render and no canvas redraw
 * — the sample screen wears the pick at the tap (`tellLookSample`). Guests see nothing until ✓ Apply. A refused
 * save puts the ring AND the sample back, and says so. With no song chosen the row is quiet: "Pick a song first".
 *
 * Free: a music button must exist for free music, and a shape is not a Pro look.
 *
 * Loaded lazily with the Music part (`scene-styles-lazy.tsx`) — never in the Maker's first load.
 */
import { useEffect, useRef, useState } from 'react';
import { MUSIC_BUTTON_CLASS, MusicButtonFace } from '@/app/[slug]/_components/music-button-face';
import {
  HUB_MUSIC_BUTTONS,
  HUB_MUSIC_BUTTON_LABEL,
  hubMusicButtonWrite,
  type HubMusicButton,
} from '@/lib/hub-music-button';
import { tellLookSample } from '@/lib/look-sample-store';
import { HUB_DRAFT_BAR_FIELD, makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { hubDraftAction } from '../../hub-draft-actions';

export const MUSIC_BUTTON_NO_SONG = 'Pick a song first';

export function MusicButtonRow({
  eventId,
  design,
  hasSong,
  draftAction = hubDraftAction,
}: {
  eventId: string;
  /** The design the hero row holds, the draft over live (`hubMusicButton`). */
  design: HubMusicButton;
  /** Is there a song? With none, there is no button to design. */
  hasSong: boolean;
  /** The draft door — the dev lab hands its own stand-in so no write leaves it. */
  draftAction?: typeof hubDraftAction;
}) {
  const [picked, setPicked] = useState<HubMusicButton>(design);
  const [error, setError] = useState<string | null>(null);
  const saved = useRef<HubMusicButton>(design);
  /* A Maker refresh (Undo, Restore, another save) hands in what the draft now holds — follow it. Reading writes nothing. */
  useEffect(() => {
    saved.current = design;
    setPicked(design);
  }, [design]);

  const lastTap = useRef(0);
  const commit = (next: HubMusicButton) => {
    if (next === picked) return;
    const tap = ++lastTap.current;
    setPicked(next);
    setError(null);
    /* 🪟 The sample screen wears it at the tap — drawn in the browser, no request. */
    tellLookSample(eventId, { musicButton: next });
    void (async () => {
      let ok = false;
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        fd.set('patch', JSON.stringify({ widgets: { hero: { music: hubMusicButtonWrite(next) } } }));
        fd.set(HUB_DRAFT_BAR_FIELD, '1');
        const r = await makerSave(() => draftAction(eventId, fd), requestMakerRefresh, { held: true });
        ok = r.ok === true;
      } catch {
        ok = false;
      }
      if (ok) {
        saved.current = next;
        return;
      }
      if (tap !== lastTap.current) return; // a newer pick took over
      setPicked(saved.current);
      tellLookSample(eventId, { musicButton: saved.current });
      setError('Your music button was not saved. Please try again.');
    })();
  };

  return (
    <div data-music-button-row="" className="mt-3 flex flex-col">
      <p className="text-[0.72rem] font-semibold text-ink/80">Music button</p>
      {hasSong ? (
        <div role="group" aria-label="Music button" className="flex items-start gap-5 pb-1 pt-3">
          {HUB_MUSIC_BUTTONS.map((d) => {
            const on = d === picked;
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                data-music-button-pick={d}
                onClick={() => commit(d)}
                className="sn-press flex flex-none flex-col items-center gap-2"
              >
                <span
                  aria-hidden
                  className={`sn-press-ring ${MUSIC_BUTTON_CLASS} ${on ? 'ring-[3px] ring-sn-accent ring-offset-[3px] ring-offset-cream' : ''}`.trim()}
                >
                  <MusicButtonFace design={d} playing />
                </span>
                <span className={`text-[12px] ${on ? 'font-semibold text-sn-accent' : 'font-medium text-ink'}`}>
                  {HUB_MUSIC_BUTTON_LABEL[d]}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p data-music-button-quiet="" className="pt-1 text-xs text-ink/60">
          {MUSIC_BUTTON_NO_SONG}
        </p>
      )}
      {error ? (
        <p role="alert" data-music-button-error="" className="pt-2 text-[12.5px] text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
