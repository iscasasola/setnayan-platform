/**
 * apps/web/app/[slug]/_components/rsvp-sheet-state.ts
 *
 * THE REPLY IS A SHEET, AND THE INVITATION IS STILL BEHIND IT.
 *
 * Fourth slice of the arrival design (owner-approved canvas, 2026-09-20, board
 * "2 · RSVP sheet"). Until now the reply card was a SECTION in the page's flow:
 * answering meant leaving the invitation, scrolling past the hub card, the
 * keepsake and the details widgets, and scrolling back. The canvas draws the
 * iOS convention every event app in the research uses instead — a half sheet
 * that rises over the page, with the couple's mark still visible above it.
 *
 * 🔑 ONE RSVP MECHANISM, AND THIS FILE DECIDES NOTHING ABOUT THE FORM. The
 * sheet is a CONTAINER. Inside it is the same `<RsvpWidget>`, posting the same
 * `submitRsvp` with the same field names. Nothing here forks the action, and
 * nothing here may ever start deciding what the form contains — the moment two
 * places declare `meal_preference`, the two drift and one of them silently
 * stops saving an allergy.
 *
 * Pure on purpose: every branch below is executed by
 * `the-reply-is-a-sheet.test.ts`. Nothing in this file touches `window`.
 */

import { SITE_MENU_ANCHORS } from '../_lib/site-menu';

/**
 * THE IN-PAGE ANCHORS THAT MEAN "OPEN THE REPLY SHEET".
 *
 * 🔗 TWO DOORS, ONE DESTINATION — the brief's hard requirement. A guest reaches
 * their reply from two places and both must land in the same sheet:
 *
 *   · `your-details` — the chip on the guest hub card ("Your details"), shipped
 *     and pinned by `the-reply-card-can-be-reached.test.ts`.
 *   · `SITE_MENU_ANCHORS.me` — where `resolveArrivalAction` (lib/arrival-action.ts)
 *     sends its RSVP label by default. Read from the anchor map rather than
 *     retyped, so the two cannot drift apart; a fragment link to a missing id
 *     fails SILENTLY, which is the quietest failure this page can have.
 *
 * 🛑 `site-me` ALREADY EXISTS, AND THIS FILE MUST NEVER EMIT A SECOND ONE.
 * The first draft of this slice asserted the opposite — site-body.tsx really
 * does not emit it anywhere in the guest arm, and its own PR11 comment says so
 * in as many words — and concluded the id was dead. It is not:
 * `guest-hub-bar.tsx` renders `<section id="site-me">`, the guest's personal QR
 * section, as a sibling of SiteBody from page.tsx. `bottom-edge.test.ts` exists
 * to keep that single, and it caught the duplicate marker on the first run.
 *
 * 🔑 AN ACCURATE ABSENCE PLUS AN INFERRED LOCATION IS A FALSE FINDING. The grep
 * was right about the file it searched and wrong about the product.
 *
 * So this list is a LISTENER, not a set of ids to create. The sheet opens on the
 * fragment; the browser scrolls to whatever already owns it, or to nothing. That
 * is also why the arrival action works without a line of its own: it already
 * points here.
 *
 * ⚖ AND IT MEANS THE MENU'S "Me" TAB OPENS THE SHEET TOO, during the `rsvp`
 * phase only — the sheet is mounted under `plan.rsvpShouldRender`, so on the day
 * itself (the `event` phase) tapping Me still just shows the QR, with nothing
 * over it. A judgement call, and a one-line one to reverse: drop `site-me` from
 * this list and feed `resolveArrivalAction` its `rsvpHref` input instead
 * (`/${slug}#your-details`), which is the hook that function already exposes.
 */
export const RSVP_SHEET_ANCHORS = ['your-details', SITE_MENU_ANCHORS.me] as const;

/**
 * Does this location fragment ask for the reply sheet?
 *
 * Tolerant about what it is handed — a bare id, a `#id`, or a whole href — so a
 * caller that has already stripped the `#` is not silently wrong. Strict about
 * what it matches: the id must be one of the two anchors WHOLE, or
 * `#your-details-map` would open a reply form.
 */
export function hashOpensSheet(hash: string | null | undefined): boolean {
  if (typeof hash !== 'string') return false;
  const cut = hash.indexOf('#');
  const id = (cut === -1 ? hash : hash.slice(cut + 1)).trim();
  if (id === '') return false;
  return (RSVP_SHEET_ANCHORS as readonly string[]).includes(id);
}

/** What `page.tsx` builds from `?rsvp=` after `submitRsvp` redirects back. */
export type RsvpSheetFlash = { tone: 'ok' | 'error'; text: string } | null;

/**
 * SHOULD THE SHEET BE OPEN THE MOMENT THE PAGE LOADS?
 *
 * 🔴 THIS IS THE ONE THAT WOULD HAVE SHIPPED A SILENT FAILURE. The flash from a
 * save is rendered by `RsvpWidget`, at the top of the form — so the instant the
 * form moved inside a sheet that starts closed, every outcome of a save moved
 * with it. `submitRsvp` redirects to `/{slug}?rsvp=refused` when a guest posts
 * a changed answer into a finalized list; that guest would have landed on a
 * page that said nothing at all, and walked away believing their reply moved.
 * The same disease as the guest list that answered `[]` and rendered "No guests
 * yet" — a failure that looks exactly like success.
 *
 * So: an ERROR reopens the sheet, because the form is where it is fixed and
 * where the sentence explaining it lives. An OK outcome does not — the save
 * landed, the keepsake below is the answer, and the confirmation is rendered on
 * the trigger row in the page's own flow (see `site-body.tsx`). Both outcomes
 * reach a pixel; neither is only in a log.
 */
export function sheetOpensOnLoad(flash: RsvpSheetFlash): boolean {
  return flash?.tone === 'error';
}

export type RsvpSheetStatus = 'pending' | 'attending' | 'declined' | 'maybe';

export type RsvpSheetTriggerInput = {
  status: RsvpSheetStatus;
  /** The guest list is final (owner 2026-08-20) — only the ANSWER freezes. */
  guestListClosed: boolean;
};

/**
 * The words on the quiet control that opens the sheet, in the page's flow.
 *
 * ⚠ BOTH ANSWERED LABELS ARE THE SHIPPED STRINGS, CARRIED OVER VERBATIM from
 * the `<details>` drawer this sheet replaces, and they are load-bearing: #4683
 * is the defect where a guest's own message sat behind a label advertising
 * something else, and `the-reply-card-can-be-reached.test.ts` exists because a
 * drawer labelled only "Need to change your reply?" gave somebody wanting to
 * fix a phone number no reason to open it. A control that names the DETAILS is
 * the fix; do not shorten these to "Change".
 *
 * 🔒 AND IT IS NEVER THE ACCENTED CONTROL. `lib/arrival-action.ts` puts one
 * accented control under the mark and the whole point of that slice is that
 * there is exactly one per screen. This row is quiet; the accent belongs to the
 * two answers inside the sheet.
 */
export function rsvpSheetTrigger(input: RsvpSheetTriggerInput): { label: string } {
  // The answer is frozen but the meal, the allergy note and the phone number
  // are not — and the list finalizes about two weeks out, which is exactly when
  // "nut allergy" matters most. The control must still invite them in.
  if (input.guestListClosed) return { label: 'Need to update your details?' };
  if (input.status === 'attending' || input.status === 'declined') {
    return { label: 'Need to change your reply or your details?' };
  }
  return { label: 'Reply to the invitation' };
}

export type RsvpSheetHeadingInput = RsvpSheetTriggerInput & {
  /** A wake cannot ask anybody whether they will "be with us". */
  solemn: boolean;
};

/**
 * The sheet's own heading — the canvas's question, or what the sheet is FOR
 * once the question has been answered.
 *
 * 🔑 DELIBERATELY NOT A STATUS SENTENCE. "You said you cannot make it." already
 * exists in `RsvpWidget`'s `LockedAnswer`, and "No reply yet" already exists in
 * BOTH `RsvpPill` and `guest-hub-card.tsx` — those two drifted apart once
 * already and are now pinned to each other. A third copy of the same fact, in a
 * third file, is a third thing to keep in step for no gain. The sheet's heading
 * says what the sheet does; the status is stated by the surfaces that own it.
 */
export function rsvpSheetHeading(input: RsvpSheetHeadingInput): string {
  if (input.guestListClosed) return 'Your details';
  if (input.status === 'attending' || input.status === 'declined') return 'Change your reply';
  return input.solemn ? 'Will you be able to come?' : 'Will you be with us?';
}
