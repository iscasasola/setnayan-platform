/**
 * lib/march-as-drafted.ts — THE WEDDING MARCH AS THE COUPLE IS ARRANGING IT: the live march (what guests see) with
 * the Event Hub draft's moves laid on, step by step, the way each shipped action leaves it (`replayMarch`).
 *
 * ONE builder for both places the march maker is drawn — the Maker's Details (`details-your-event-load.tsx`, until
 * R4) and Guests › March (`guests/_components/guests-march.tsx`, R4, owner 2026-10-27/28): the same reads, the same
 * "shown as drafted" (owner 2026-10-06, *"Wait for apply"*), so the two can never draw a different march.
 *
 * An unread draft is said — never drawn as "no moves", which would let the next drop plan against a march the couple
 * did not draft. An unread MARCH is the same refusal: a full march must never read "Nobody walks yet".
 *
 * Pure: no I/O.
 */
import { replayMarch, type MarchOut, type MarchSection, type MarchStep } from '@/lib/march-drag';

export type MarchShown = {
  sections: MarchSection[];
  printed: string[];
  out: MarchOut[] | null;
  /** The Event Hub draft could not be read — the maker says so instead of letting a drop plan against it. */
  draftUnread?: true;
  /** The march itself could not be read. */
  marchUnread?: true;
};

export function marchAsDrafted(
  live: { sections: MarchSection[]; printed: string[]; out: MarchOut[] | null },
  drafted: MarchStep[][] | null | undefined,
  marchUnread = false,
): MarchShown {
  if (marchUnread) return { ...live, draftUnread: true, marchUnread: true };
  if (drafted === null) return { ...live, draftUnread: true };
  if (!drafted?.length) return live;
  const shown = replayMarch({ sections: live.sections, printed: live.printed, out: live.out ?? [] }, drafted.flat());
  return { sections: shown.sections, printed: shown.printed, out: live.out === null ? null : shown.out };
}
