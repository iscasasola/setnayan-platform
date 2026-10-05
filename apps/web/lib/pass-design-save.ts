/**
 * pass-design-save.ts — 🎫 how a Maker control SAVES the guest's Ticket style
 * (Classic · Ticket · Photo poster): into the Event Hub DRAFT, never the live
 * row (owner 2026-10-02 Q7, *"the pass look waits for Apply"*; built with the
 * Maker's three zones, 2026-10-05). The patch is the one `hubDraftAction`
 * (intent=save) takes: the draft's `events.print_details` holds
 * `{ name_style?, pass_design? }` (`HUB_DRAFT_PASS_DESIGN_KEY`, lib/hub-draft.ts),
 * merged key by key; Apply merges it into the prints' settings blob
 * (`events.print_details.pass_design`) — the ONE setting every saved card, the
 * couple's zip and the Phone card print read.
 *
 * Until Apply, guests' cards are drawn from what is live (`lib/pass-card.server.ts`
 * reads `loadPrintSet` without a draft); the Maker's own pictures name the
 * design they draw (`pass_design=` on the preview's address).
 *
 * The Guest's ticket scene's Ticket style ▾ and Prints' (`PassCardDesignPicker`)
 * both build their patch here. Pure: no I/O.
 */
import type { HubDraftPatch } from './hub-draft';
import { PASS_CARD_FORMAT_ID, type PassCardDesign } from './pass-card';

export function passDesignDraftPatch(design: PassCardDesign): HubDraftPatch {
  return { events: { print_details: { pass_design: design } } };
}

/** The ticket the Maker draws for a design: the first guest who is coming (else the stand-in). */
export function makerTicketSrc(eventId: string, design: PassCardDesign): string {
  return `/api/hub-print/pass?event=${eventId}&mode=screen&pass_format=${PASS_CARD_FORMAT_ID}&pass_design=${design}&pass_guest=first`;
}
