'use client';

import { useRef } from 'react';
import { HubDraftField } from '../../website/_components/hub-draft-field';
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
 * 💾 One save path: `updateSpecialMessage` (→ `events.special_message`),
 * DRAFTED like the Maker's other words (`HubDraftField`) — guests see it after
 * Apply. The same column every bound scene and The Finer Details card read.
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
  return (
    <form action={action} data-details-special="" className="flex flex-col gap-2">
      <HubDraftField />
      <input type="hidden" name="return_to" value={back} />
      <textarea
        ref={box}
        name="message"
        defaultValue={initial ?? ''}
        maxLength={600}
        rows={3}
        data-same-field="special_message"
        onInput={(e) => preview(e.currentTarget.value)}
        aria-label="Special message — your closing words to guests"
        placeholder="A heartfelt note to everyone joining you…"
        className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink"
      />
      <p className="text-xs text-ink/60" data-details-bound-note="">
        Every scene that shows your message follows this. A scene you changed “just here” keeps its own words until
        you tap ↺ Use your message on it.
      </p>
      <div>
        <button type="submit" className="button-secondary text-sm">
          Save message
        </button>
      </div>
    </form>
  );
}
