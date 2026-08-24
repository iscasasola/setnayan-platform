/**
 * ReadRefusedNotice — the one sentence a couple sees when we could not read
 * something, rather than the absence we would otherwise have stated.
 *
 * ── Why this exists as a component and not as prose ───────────────────────
 * The first three passes over this class hand-rolled the same `role="alert"`
 * paragraph five times. Prose can be half-deleted — the flag left in place, the
 * sentence quietly dropped — and a guard that looks for words cannot tell an
 * edited sentence from a removed one. A NAMED component either renders or it
 * does not, and `<ReadRefusedNotice` is what the per-tree guard now looks for.
 *
 * ── The two shapes, and the difference between them ───────────────────────
 * `whole`   — nothing came back. "This does not mean you have none."
 * `partial` — SOME of it came back and the rest did not, which is the worse
 *             one: the screen looks complete and is not. A coordinator once
 *             read only the vendor documentation shots under a card headed
 *             "Your gallery" and had no way to know the rest had been refused.
 *
 * Keep the voice: say what is missing, say nothing has been lost, say what to
 * do. Never name a table, a query or an error code — the person reading this is
 * planning a wedding.
 */
export function ReadRefusedNotice({
  what,
  partial = false,
  className = '',
}: {
  /** What could not be read, in the couple's words — "your guest list". */
  what: string;
  /** True when part of the screen DID load: the danger is it looking complete. */
  partial?: boolean;
  className?: string;
}) {
  return (
    <p
      role="alert"
      className={`rounded-2xl border-t-[3px] border-mulberry/70 bg-mulberry/5 p-4 text-sm text-ink/70 ${className}`}
    >
      <strong className="text-ink">
        {partial
          ? `Some of this page is missing — we couldn’t load ${what}.`
          : `We couldn’t load ${what}.`}
      </strong>{' '}
      {partial
        ? 'What you can see is real, but it isn’t everything, so please don’t go by it yet. Nothing has been lost — reload in a moment.'
        : 'This does not mean there is none. Nothing has been lost or removed — reload in a moment.'}
    </p>
  );
}
