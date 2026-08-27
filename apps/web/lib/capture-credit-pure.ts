/**
 * lib/capture-credit-pure.ts — WHO TOOK THIS PHOTOGRAPH, as a pure rule.
 *
 * The gallery archetype's designer's note: *"Credit is a feature. Every tile
 * names its camera — 'Ninang Cora · 4:12 PM' — because in a samahan album, who
 * shot it is part of the memory."*
 *
 * PURE on purpose, and split from the server half for a reason this repo has
 * paid for: `lib/capture-credit.ts` imports `server-only`, which is NOT
 * installed here, so a module importing it cannot be loaded by `node:test` at
 * all. The rule that decides what a person reads lives here, where a test can
 * reach it.
 *
 * ── THE LADDER, AND WHY IT HAS FOUR RUNGS AND A FLOOR ───────────────────────
 *
 * 🚨 MEASURED AGAINST PRODUCTION 2026-08-27, BEFORE THIS WAS WRITTEN: all 14
 * photographs carry a capturer person id (the trigger added on 2026-08-26 works
 * and its backfill landed) — and the person behind every one of them HAS NO
 * NAME. 32 of the 34 people rows in production have `display_name` AND
 * `first_name` null, and the account that took all 14 has no `users.display_name`
 * either. A credit built on any single one of those columns renders empty on
 * every photograph we have, which looks exactly like a feature nobody uses.
 *
 * So: try the person spine, then the guest row for this event, then the account
 * — and when none of them knows, RENDER NOTHING. Never "Unknown", never
 * "A guest", never the email. A tile with no credit is honest; a tile crediting
 * "Unknown" tells the couple we lost the answer, and a tile crediting an email
 * address publishes one.
 *
 * ⚠ The floor is the point. `capturerName` returning null is a RESULT, not a
 * failure, and the commonest one today.
 */

export type CapturerNameSources = {
  /** `people.display_name` — the person spine's own name for them. */
  personDisplay?: string | null;
  /** `people.first_name`. */
  personFirst?: string | null;
  /** `guests.display_name` for this event — what the host typed on the list. */
  guestDisplay?: string | null;
  /** `guests.first_name`. */
  guestFirst?: string | null;
  /** `users.display_name` — the account that claimed the camera. */
  userDisplay?: string | null;
};

function clean(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  // An email is a contact detail, not a credit. `users.display_name` is
  // occasionally seeded from one, and the wall is a surface every guest at the
  // event can read.
  if (trimmed.includes('@')) return null;
  return trimmed;
}

/** The name to print, or null when we genuinely do not know. */
export function capturerName(sources: CapturerNameSources): string | null {
  return (
    clean(sources.personDisplay) ??
    clean(sources.personFirst) ??
    clean(sources.guestDisplay) ??
    clean(sources.guestFirst) ??
    clean(sources.userDisplay) ??
    null
  );
}

/**
 * The time half of the credit, in the VENUE'S clock.
 *
 * 🔑 NO TIMEZONE ⇒ NO TIME. `captured_at` is a real instant, so rendering it
 * without the event's zone prints the READER'S clock — a Manila reception shot
 * at 4:12 PM reads 8:12 AM to a relative in London, and looks like a fact. This
 * project has already paid for that mistake across nine surfaces; the rule since
 * then is that a surface with no zone in hand reports nothing rather than
 * something plausible.
 *
 * The archetype's own mobile tiles carry the name alone, so the name-only credit
 * is not a compromise — it is the drawing's phone form.
 */
export function capturedAtLabel(
  capturedAtIso: string | null | undefined,
  timeZone: string | null | undefined,
): string | null {
  if (!capturedAtIso || !timeZone) return null;
  const at = new Date(capturedAtIso);
  if (Number.isNaN(at.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(at);
  } catch {
    // An unknown zone string is the same state as no zone at all.
    return null;
  }
}

/**
 * The whole credit line for a tile: "Ninang Cora · 4:12 PM", "Ninang Cora", or
 * null. A time with no name is NOT a credit — it is a timestamp — so a nameless
 * capture renders nothing at all rather than a bare clock.
 */
export function creditLine(
  name: string | null | undefined,
  capturedAtIso?: string | null,
  timeZone?: string | null,
): string | null {
  const who = clean(name);
  if (!who) return null;
  const when = capturedAtLabel(capturedAtIso, timeZone);
  return when ? `${who} · ${when}` : who;
}
