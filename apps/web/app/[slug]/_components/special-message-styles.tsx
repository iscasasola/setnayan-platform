import { splitFirstSentence } from '@/lib/scene-style-text';

/**
 * THE SPECIAL MESSAGE'S OTHER TWO STYLES — B · The letter and C · The quote
 * (prototype `every_scene_three_styles_2026-09-29.html` §2). A · The note is
 * `SpecialMessageWidget` itself.
 *
 * The data is `events.special_message` and nothing else, except the letter's
 * signature: the event's own display name, the one extra fact that style
 * reads. With no name to sign with, the letter is simply unsigned — never
 * signed with a word we typed.
 */

/** B · The letter — a drop cap, a narrow measure, signed with the event's names. */
export function SpecialMessageLetter({ text, signedBy }: { text: string; signedBy?: string | null }) {
  const msg = text.trim();
  if (!msg) return null;
  const sign = (signedBy ?? '').trim();
  return (
    <section className="space-y-3" data-scene-style="letter">
      <p className="pahina-eyebrow">
        <span>A note from us</span>
      </p>
      <div className="mx-auto max-w-[34ch]">
        <p className="pahina-dropcap whitespace-pre-line text-base leading-relaxed text-ink/85">{msg}</p>
        {sign ? (
          <p className="mt-5 text-right font-pahina text-2xl font-light italic text-ink">{sign}</p>
        ) : null}
      </div>
    </section>
  );
}

/** C · The quote — the first sentence set large; the rest under a rule. */
export function SpecialMessageQuote({ text }: { text: string }) {
  const { lead, rest } = splitFirstSentence(text);
  if (!lead) return null;
  return (
    <section className="space-y-3 text-center" data-scene-style="quote">
      <p className="pahina-eyebrow justify-center">
        <span>A note from us</span>
      </p>
      <p className="mx-auto max-w-prose font-pahina text-3xl font-light italic leading-snug text-ink">
        &ldquo;{lead}&rdquo;
      </p>
      {rest ? (
        <>
          <p aria-hidden className="text-gild">✦</p>
          <p className="mx-auto max-w-prose whitespace-pre-line text-base leading-relaxed text-ink/75">{rest}</p>
        </>
      ) : null}
    </section>
  );
}
