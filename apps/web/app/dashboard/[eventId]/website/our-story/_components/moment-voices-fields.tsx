'use client';

import { MOMENT_LINE_MAX, momentHasBothVoices, type LoveStoryMoment, type MomentVoiceSlot } from '@/lib/love-story-moments';

/**
 * 🗣 "A LINE OR TWO" BECOMES TWO VOICES — the one block of the moment sheet that changes (owner 2026-10-17,
 * DECISION_LOG "APPROVED — LOVE STORY, TWO VOICES"; prototype `love_story_two_voices_2026-10-17.html`, "The Maker:
 * one moment's editor"). Shared by both shipped sheets (`moment-sheet.tsx`, `moment-sheet-studio.tsx`), each handing
 * its own field and label classes, so the two can never ask for different words.
 *
 *   · Two fields, one under the other, each under a partner's own first name (slot a = the first, b = the second, in
 *     the order `loveStoryPartners` gives the Maker's "Added by"); posted as `voice_a` / `voice_b`.
 *   · A moment written BEFORE the voices — a line and no voice — keeps that line in a folded, editable "Told
 *     together" row above them (posted as `line`). It keeps rendering until a voice is written; once one is, the row
 *     is gone and the form carries no `line`, so the line is KEPT, never blanked (`momentFromForm`).
 *   · A new moment shows exactly the two fields.
 *   · Required: one of the three — said under the fields; the server refuses a moment with none (`MOMENT_NEEDS`).
 */
export function MomentVoicesFields({
  moment,
  partners,
  field,
  eye,
  quiet,
  serif,
  studio,
}: {
  moment: LoveStoryMoment | null;
  partners: readonly string[];
  /** The sheet's own input class. */
  field: string;
  /** The sheet's own small-caps label class. */
  eye: string;
  /** The sheet's own quiet-words class. */
  quiet: string;
  /** The sheet's serif for words ('' in the Studio). */
  serif: string;
  studio: boolean;
}) {
  const told = Boolean(moment?.line) && !moment?.voices;
  /* One name = one voice (a debut, a solo-named event); no name at all = one unnamed field. */
  const slots: Array<{ slot: MomentVoiceSlot; name: string }> =
    partners.length >= 2
      ? [
          { slot: 'a', name: partners[0]! },
          { slot: 'b', name: partners[1]! },
        ]
      : [{ slot: 'a', name: partners[0] ?? '' }];
  const words = `${field} ${serif} ${studio ? '' : 'text-lg'} leading-snug`;
  return (
    <div data-moment-voices="">
      {told ? (
        <details open data-moment-told-together="" className={`mb-4 border-y py-3 ${studio ? 'border-ink/10' : 'border-[color:var(--ls-rule)]'}`}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-[14px] font-medium [&::-webkit-details-marker]:hidden">
            <span>Told together · the line you wrote before</span>
            <span aria-hidden className={quiet}>
              ›
            </span>
          </summary>
          <textarea
            name="line"
            rows={3}
            maxLength={MOMENT_LINE_MAX}
            defaultValue={moment?.line ?? ''}
            aria-label="The line you wrote before"
            className={words}
          />
          <p className={`mt-1.5 text-[12px] ${quiet}`}>This line shows on your Event Hub until one of you writes below. It is kept, never deleted.</p>
        </details>
      ) : null}
      <div className="space-y-4">
        {slots.map(({ slot, name }) => (
          <label key={slot} className="block" data-moment-voice={slot}>
            <span className={`inline-flex items-center gap-2 ${eye}`}>
              <span
                aria-hidden
                className={`grid h-[22px] w-[22px] place-items-center rounded-full font-sans text-[11px] font-semibold tracking-normal ${
                  studio
                    ? slot === 'a'
                      ? 'bg-terracotta text-white'
                      : 'bg-ink text-cream'
                    : slot === 'a'
                      ? 'bg-[color:var(--ls-accent)] text-[color:var(--ls-accent-ink)]'
                      : 'bg-[color:var(--ls-ink)] text-[color:var(--ls-canvas)]'
                }`}
              >
                {(name || '·').charAt(0).toUpperCase()}
              </span>
              {name || 'In your words'}
            </span>
            <textarea
              name={`voice_${slot}`}
              rows={3}
              maxLength={MOMENT_LINE_MAX}
              defaultValue={moment?.voices?.[slot] ?? ''}
              placeholder={name ? `In your words, ${name}…` : 'What happened, in your words…'}
              className={words}
            />
          </label>
        ))}
      </div>
      <p className={`mt-2 text-[12px] ${quiet}`}>
        {slots.length > 1 ? 'One of you is enough. The moment shows only the voices that wrote.' : 'A few words are enough.'}
      </p>
    </div>
  );
}

/** "Added by" hides once both voices are written — the two names already say who wrote what (controller, 2026-10-17). */
export function addedByShows(moment: LoveStoryMoment | null): boolean {
  return !moment || !momentHasBothVoices(moment);
}
