/**
 * apps/web/lib/going-public.ts — WHAT CHANGES WHEN AN EVENT GOES PUBLIC (pure).
 *
 * Owner 2026-09-29 (DECISION_LOG "DISCOVER BUILD — TWO LAST ANSWERS", item 1):
 * switching visibility TO `public` turns on "Ask to join" — `rsvp_ask_config`
 * `.whoCanRsvp = 'anyone'` ("Anyone, I approve"). Set on the switch, never
 * re-forced on a later save. The live half is `rsvpAskConfigOnGoingPublic`
 * (lib/rsvp-ask.ts); this file is the DRAFT half.
 *
 * 🔑 WHY THE DRAFT TOO. "What you ask your guests" is a Maker draft column
 * (lib/hub-draft.ts `rsvp_ask_config`): the Maker's RSVP page shows the DRAFTED
 * object when there is one, and Apply writes it over the live column. A draft
 * saved before the switch still says "Only my Guest List" — so without this the
 * host would see the old answer on their RSVP page, and their next Apply would
 * quietly switch requests back off. Only a draft that already HOLDS the column is
 * touched; a draft without it has nothing to overwrite the live value with.
 *
 * No I/O and no `server-only`, so the unit tests read it directly — the writers
 * (lib/going-public.server.ts) only move the rows.
 */
import { rsvpAskConfigOnGoingPublic } from './rsvp-ask';
import type { HubDraft } from './hub-draft';

/** The draft to write back, or null when the draft needs no change. */
export function draftAskToJoinOnGoingPublic(draft: HubDraft | null): HubDraft | null {
  if (!draft) return null;
  if (!Object.prototype.hasOwnProperty.call(draft.events, 'rsvp_ask_config')) return null;
  const next = rsvpAskConfigOnGoingPublic({
    // The live column has just moved into public; the draft follows it.
    previousVisibility: null,
    nextVisibility: 'public',
    // A drafted `null` ("clear the column at Apply") reads as the empty config.
    rawConfig: draft.events.rsvp_ask_config ?? {},
  });
  if (!next) return null;
  return { ...draft, events: { ...draft.events, rsvp_ask_config: next } };
}
