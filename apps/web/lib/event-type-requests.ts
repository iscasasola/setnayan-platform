/**
 * event-type-requests.ts — "Can't find yours? Ask us to add it" (owner 2026-10-28, DECISION_LOG "EVENT TYPES MUST BE
 * SPECIFIC — NO GENERIC 'CELEBRATION' / 'OTHER EVENT' FOR NEW EVENTS").
 *
 * Pure + I/O-free: the client sheet, the admin queue and the Event settings line all read these rules.
 *
 * THE LIFE OF AN ASK (`event_type_requests.status`, migration 20271294233183):
 *   pending   → the host named it; it waits in Admin › Event types
 *   linked    → the admin made (or named) the type; it is not in the picker yet
 *   added     → the type is in the picker and the host was told in the app (`event_type_added`)
 *   dismissed → closed without a type
 */

/** The one generic type that stays on existing events but is never offered for a new one (owner 2026-10-28). */
export const GENERIC_EVENT_TYPE = 'celebration';

export type AskOutcome = 'sent' | 'already' | 'too_short' | 'signed_out' | 'failed';

/** What a host typed, as it is stored: one line, trimmed, 2–80 characters — else null (the sheet says so). */
export function cleanAskLabel(raw: string | null | undefined): string | null {
  const s = (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return s.length >= 2 ? s : null;
}

/** The insert's answer, in the sheet's words. A unique-index hit is "you already asked" — never a failure. */
export function askOutcome(error: { code?: string | null } | null | undefined): AskOutcome {
  if (!error) return 'sent';
  if (error.code === '23505') return 'already';
  return 'failed';
}

/** One open ask as Admin › Event types lists it (`loadEventTypeAsks`). */
export type EventTypeAsk = {
  requestId: string;
  label: string;
  status: 'pending' | 'linked';
  eventType: string | null;
  createdAt: string;
  /** The asker's display name — never their email. */
  askedBy: string;
};

/** Event settings' "Kind of event" line — null when there is nothing to offer. */
export type EventKindLineInput = {
  /** True when the stored type is the generic one — the line asks for a specific kind. */
  generic: boolean;
  /** The stored type's own label (the generic one's word is never drawn — see `EventKindLine`). */
  currentLabel: string;
  choices: Array<{ key: string; label: string; asked: boolean }>;
};

export type EventTypeRequestRow = {
  request_id: string;
  requested_by: string;
  label: string;
  status: string;
  event_type: string | null;
  created_at: string;
};

/**
 * The types a host may switch an EXISTING event to from Event settings ("Kind of event"):
 *  - a generic `celebration` event → any type in the create picker (the owner's "one line … to pick a specific type");
 *  - any event → a type THEY asked for that is now added, when the ask came before the event (they "start with the
 *    closest type and may switch once it exists").
 * Never the generic type itself, and never a wedding (its own onboarding owns its ceremony fields). Empty = no line.
 */
export function eventKindChoices(args: {
  eventType: string | null | undefined;
  eventCreatedAt: string | null | undefined;
  creatable: ReadonlyArray<{ key: string; label: string }>;
  /** The viewer's OWN asks (RLS returns nothing else), any status. */
  myAsks: ReadonlyArray<Pick<EventTypeRequestRow, 'status' | 'event_type' | 'created_at' | 'label'>>;
}): { key: string; label: string; asked: boolean }[] {
  const { eventType, eventCreatedAt, creatable, myAsks } = args;
  const offered = creatable.filter((t) => t.key !== GENERIC_EVENT_TYPE && t.key !== 'wedding' && t.key !== eventType);
  const asked = new Set(
    myAsks
      .filter(
        (a) =>
          a.status === 'added' &&
          a.event_type &&
          (!eventCreatedAt || !a.created_at || a.created_at <= eventCreatedAt),
      )
      .map((a) => a.event_type as string),
  );
  if (eventType === GENERIC_EVENT_TYPE) {
    return [
      ...offered.filter((t) => asked.has(t.key)).map((t) => ({ ...t, asked: true })),
      ...offered.filter((t) => !asked.has(t.key)).map((t) => ({ ...t, asked: false })),
    ];
  }
  return offered.filter((t) => asked.has(t.key)).map((t) => ({ ...t, asked: true }));
}

/** May this event's kind be switched to `next`? The server's half of `eventKindChoices` — same inputs, same answer. */
export function maySwitchEventKind(args: Parameters<typeof eventKindChoices>[0], next: string): boolean {
  return eventKindChoices(args).some((c) => c.key === next);
}
