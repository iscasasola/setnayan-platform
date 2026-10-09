/**
 * apps/web/lib/going-public.ts — WHAT CHANGES WHEN AN EVENT GOES PUBLIC (pure).
 *
 * Owner 2026-09-29 (DECISION_LOG "DISCOVER BUILD — TWO LAST ANSWERS", item 1):
 * switching visibility TO `public` turns on "Ask to join" — `rsvp_ask_config`
 * `.whoCanRsvp = 'anyone'` ("Anyone, I approve"). Set on the switch, never
 * re-forced on a later save. The live half is `rsvpAskConfigOnGoingPublic`
 * (below); `draftAskToJoinOnGoingPublic` is the DRAFT half.
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
import { sanitizeRsvpAskConfig, type RsvpAskConfig } from './rsvp-ask';
import type { HubDraft } from './hub-draft';

/**
 * 🌐 CHOOSING PUBLIC TURNS ON "ASK TO JOIN" (owner 2026-09-29, DECISION_LOG
 * "DISCOVER BUILD — TWO LAST ANSWERS", item 1: *"yes to both"*). An event listed
 * on Discover with no way to ask is a dead end — the default "Only my Guest
 * List" shows a stranger nothing to press.
 *
 * So the MOMENT visibility moves INTO `public` from anything else, "Who can
 * RSVP?" becomes "Anyone, I approve". Returns the config to write, or `null`
 * when nothing must change:
 *   · not a transition into public (public → public, or to any other value) —
 *     the host may have turned requests OFF after going public, and a later
 *     save must never re-force it;
 *   · already "Anyone, I approve" — nothing to write.
 * Every other key the couple set rides through untouched (the same sanitizer
 * the Maker's RSVP page and the join door read).
 *
 * ⚖ ONLY THE HOST'S EXPLICIT SWITCH asks this (`updateLandingPageVisibility`,
 * the privacy page and the Maker's panel). LAUNCHING A SAVE-THE-DATE also makes
 * the page public, and it does NOT — owner 2026-09-29 (DECISION_LOG "PUBLIC
 * EVENTS (PR #6159) — TWO OWNER ANSWERS": "no"): sending a Save-the-Date is not
 * announcing a public event, so the launch leaves "Who can RSVP?" as it was.
 *
 * HERE since 2026-10-10, not in `lib/rsvp-ask.ts`: that file is read by the Maker's first load (`lib/hub-draft.ts`),
 * and only server code asks this.
 */
export function rsvpAskConfigOnGoingPublic(input: {
  previousVisibility: string | null | undefined;
  nextVisibility: string;
  rawConfig: unknown;
}): RsvpAskConfig | null {
  if (input.nextVisibility !== 'public') return null;
  if (input.previousVisibility === 'public') return null;
  const current = sanitizeRsvpAskConfig(input.rawConfig);
  if (current.whoCanRsvp === 'anyone') return null;
  return { ...current, whoCanRsvp: 'anyone' };
}

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
