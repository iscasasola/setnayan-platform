/**
 * RsvpClosedNote — what stands where the invitation used to be, once the
 * couple's guest list is final (owner 2026-08-20: the invitation "will only
 * show while the guest list is not yet finalized").
 *
 * 🔑 WHY THIS EXISTS AT ALL, RATHER THAN RENDERING NOTHING.
 * The RSVP is the page's one load-bearing form — the editor is not even
 * allowed to hide it. A guest who opens their invitation in the fortnight
 * before the day and finds NOTHING where "will you come?" should be does not
 * conclude "replies have closed". They conclude the invitation is broken, and
 * the person they tell is the host. One sentence costs nothing and removes
 * that entire failure.
 *
 * 🔒 IT PROMISES NO BUTTON. There is no guest→host message channel on the Hub,
 * so this deliberately says "reach out to them" — a thing the guest already
 * knows how to do — and never points at a control that does not exist.
 */
import type { EventWords } from '../_lib/event-words';

export function RsvpClosedNote({
  words,
  replied,
  flash = null,
}: {
  words: EventWords;
  replied: boolean;
  /**
   * ⚠ THE REFUSAL HAS NOWHERE ELSE TO LAND. `?rsvp=closed` is raised when a
   * guest submits from a page that was open when the deadline passed, and the
   * flash it produces has always been rendered by `RsvpWidget` — the exact
   * component that is gone by the time this note is on screen. Without this
   * prop the guest taps Save, the page returns looking identical, and nothing
   * anywhere says the reply was refused. That is the same silent-failure shape
   * `submitRsvp` was fixed for once already.
   */
  flash?: { tone: 'ok' | 'error'; text: string } | null;
}) {
  // Whose list is it? A guest list is ADMIN work, so an event whose word names
  // the HONOURED person (a seven-year-old celebrant, a graduate) drops the
  // name rather than crediting them with running the door. Same ruling the six
  // other admin sentences follow — see _lib/event-words.ts.
  const whose = words.organizerIsHonoree
    ? 'The guest list is final'
    : `${words.TheOrganizerPossessive} guest list is final`;

  return (
    <section className="border-l-2 border-ink/25 bg-paper-deep px-5 py-4">
      {flash ? (
        <p
          role={flash.tone === 'error' ? 'alert' : 'status'}
          className="mb-3 border-l-2 border-mulberry/50 bg-mulberry/[0.06] px-3 py-2 text-sm leading-relaxed text-ink/80"
        >
          {flash.text}
        </p>
      ) : null}
      <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/50">
        Replies are closed
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink/70">
        {whose}, so we can no longer take replies here.{' '}
        {replied
          ? 'Your answer is in, exactly as it stands above.'
          : `If your plans have changed, please reach out to ${words.theOrganizer} directly.`}
      </p>
    </section>
  );
}
