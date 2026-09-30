'use client';

import { useRef, useState } from 'react';
import { HubDraftField } from '../../website/_components/hub-draft-field';
import { useMaker } from './maker-context';
import { HUB_DRAFT_BAR_FIELD, SUPERSEDED, makerLatestWrite, makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { hubDraftAction } from '../../website/hub-draft-actions';
import { markMakerCanvasStale } from '@/lib/maker-live-preview';
import { useSceneWordsBox } from '../../website/editor/_components/canvas-words';
import { useDetailsFactScene } from './details-tap';

/**
 * THE SPECIAL MESSAGE — Details › Words › Special message, and the ONE editor
 * of it wherever it is opened (Details part 2b):
 *
 *   · in Details, as its own item, and under The Finer Details' "Special
 *     message" switch (one field, two doors — `data-same-field`, `same-field.ts`);
 *   · on a stage, when the couple taps the message on a scene — the inspector
 *     shows THIS component, not a copy (DECISION_LOG "DETAILS IS THE ONE FILL-IN
 *     AREA; STAGES ARE LOOK AND MOTION; TAP IS A SHORTCUT"). There, what is
 *     typed is on the scene as it is typed (`useSceneWordsBox`, the canvas's
 *     `words` preview); nothing is saved until Save.
 *
 * 💾 One column: `events.special_message`, DRAFTED like the Maker's other words
 * — guests see it after Apply. The same column every bound scene and The Finer
 * Details card read.
 *
 * ⚡ IN THE MAKER IT SAVES AS IT IS TYPED (owner 2026-09-30, "every edit
 * alteration … forces the whole screen to reload"; DECISION_LOG "EVERYTHING
 * REBUILT IN THE MAKER IS INSTANT BY DESIGN"). The Save button posted
 * `updateSpecialMessage`, whose answer carried a whole render of the Maker; now
 * the words are on the tapped scene and on Details' own card at the keystroke,
 * and saved behind them — `hubDraftAction` intent=save, batched (one save after
 * the pause), `held` (no render). A refused save puts the last saved words back
 * and says so. Outside the Maker (no Maker around it) the form posts as before.
 */
export function SpecialMessageField({
  action,
  initial,
  back,
}: {
  /** `updateSpecialMessage` bound to this event. */
  action: (formData: FormData) => Promise<void>;
  initial: string | null;
  /** Where a no-script save lands. */
  back: string;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  const scene = useDetailsFactScene();
  const preview = useSceneWordsBox(scene, box, () => initial ?? '');
  const eventId = useMaker()?.eventId ?? null;
  const saved = useRef(initial ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'refused'>('idle');
  const [said, setSaid] = useState<string | null>(null);
  /** Details' own card for the message (`WordsCard`) follows the box. */
  const showOnCards = (text: string) => {
    document.querySelectorAll<HTMLElement>('[data-live-words="special_message"]').forEach((el) => {
      const words = text.trim();
      const shown = el.querySelector<HTMLElement>('[data-live-words-text]');
      const empty = el.querySelector<HTMLElement>('[data-live-words-empty]');
      if (shown) {
        if (shown.textContent !== words) shown.textContent = words;
        shown.hidden = words === '';
      }
      if (empty) empty.hidden = words !== '';
    });
  };
  const type = (text: string) => {
    preview(text);
    showOnCards(text);
    if (!eventId) return;
    setState('saving');
    setSaid(null);
    void (async () => {
      let res: Awaited<ReturnType<typeof hubDraftAction>> | typeof SUPERSEDED;
      try {
        res = await makerSave(
          () =>
            makerLatestWrite('events:special_message', () => {
              const fd = new FormData();
              fd.set('intent', 'save');
              fd.set('patch', JSON.stringify({ events: { special_message: text } }));
              fd.set(HUB_DRAFT_BAR_FIELD, '1');
              return hubDraftAction(eventId, fd);
            }),
          requestMakerRefresh,
          { held: true, ok: (r) => r !== SUPERSEDED && r.ok === true },
        );
      } catch {
        res = { ok: false, intent: 'save', error: 'Please try again.' };
      }
      if (res === SUPERSEDED) return;
      if (res.ok) {
        saved.current = text;
        setState('saved');
        /* Every OTHER scene that shows the message loads again, behind the page shown. */
        markMakerCanvasStale();
        return;
      }
      /* Only what did not save goes back — in the box, on the scene, on the card. */
      if (box.current) box.current.value = saved.current;
      preview(saved.current);
      showOnCards(saved.current);
      setState('refused');
      setSaid(`Your message did not save, so it is back as it was. ${res.error || 'Please try again.'}`);
    })();
  };
  const stayPut = eventId ? (e: React.FormEvent) => e.preventDefault() : undefined;
  return (
    /* In the Maker every keystroke is already saving — the form never posts the old way there. */
    <form action={action} data-details-special="" className="flex flex-col gap-2" onSubmit={stayPut}>
      <HubDraftField />
      <input type="hidden" name="return_to" value={back} />
      <textarea
        ref={box}
        name="message"
        defaultValue={initial ?? ''}
        maxLength={600}
        rows={3}
        data-same-field="special_message"
        onInput={(e) => type(e.currentTarget.value)}
        aria-label="Special message — your closing words to guests"
        placeholder="A heartfelt note to everyone joining you…"
        className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink"
      />
      <p className="text-xs text-ink/60" data-details-bound-note="">
        Every scene that shows your message follows this. A scene you changed “just here” keeps its own words until
        you tap ↺ Use your message on it.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {eventId ? (
          <span role="status" className="text-xs text-ink/60" data-special-save-state={state}>
            {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved to your draft' : 'Saves as you type'}
          </span>
        ) : (
          <button type="submit" className="button-secondary text-sm">
            Save message
          </button>
        )}
        {/* The approved stage drawing's own line (blueprint Part 3c): it is DRAFTED. */}
        <span className="text-xs text-ink/55" data-details-drafted-note="">
          Drafted — Apply puts it live.
        </span>
      </div>
      {said ? (
        <p role="alert" className="text-xs text-terracotta-700">
          {said}
        </p>
      ) : null}
    </form>
  );
}
