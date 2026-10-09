import type { StudioActions } from '@/app/dashboard/[eventId]/launch/_components/studio-actions-context';

/**
 * The lab's stand-ins for the Studio pages' writes (see `lab-studio-actions.tsx`) — a plain module with NO action imported, so a
 * guard can load it and prove what they answer. They succeed LOCALLY: the row shows its saved tick, a switch stays where it was
 * put, the ✓ Apply count (where the lab counts drafts) moves — and nothing leaves the browser.
 *
 * Pages on it: E-Gifts. Each page converted later adds its writes here AND to `STUDIO_REFUSALS`.
 */
export const LAB_STUDIO_ACTIONS: Partial<StudioActions> = {
  setEgiftMethodEnabled: async () => ({ ok: true }),
  saveEgiftMethod: async () => ({ ok: true }),
  savePabuyaMessage: async () => ({ ok: true }),
  /* "Accept gifts?" and the other Your-info answers — the Maker's draft door; the Maker lab hands its own counting stand-in over this one. */
  hubDraftAction: async () => ({ ok: true, intent: 'save', applied: 0, held: [] }),
};

/** Prints: every Save button's file. A tiny stand-in PDF — no route is asked, nothing is drawn from the database (`print-fetch-context.tsx`). */
export const LAB_PRINT_FETCH: typeof fetch = async () =>
  new Response(new Blob(['%PDF-1.4\n% lab stand-in: nothing was drawn and no route was asked\n'], { type: 'application/pdf' }), { status: 200 });
/** `?refuse=1`: an unexpected 500 with an HTML page — the Save button says its own sentence, never the page's words. */
export const LAB_PRINT_FETCH_REFUSED: typeof fetch = async () =>
  new Response('<!doctype html><title>500</title><pre>relation "events" does not exist</pre>', { status: 500, headers: { 'content-type': 'text/html' } });

/** The print words form (Studio › Prints' include switches + Save) — the one form id every include switch posts through (`maker-details.tsx` `WORDS_FORM`). */
export const LAB_PRINT_WORDS_FORM = 'details-print-words';

/**
 * What the lab says when that form is saved with `?refuse=1` — the words the Maker's save status shows (the lab refuses the POST itself;
 * the real route's refusal reaches `SoftPost`, which says exactly this).
 */
export const LAB_PRINT_WORDS_REFUSED = 'That did not save. Nothing changed — please try again.';

/**
 * `?refuse=1`: every write REFUSES with the database's own words, on purpose — so a guard (and a look at 375) can prove the
 * page never prints them: each row says one plain sentence of its own.
 */
export const LAB_STUDIO_REFUSALS: Partial<StudioActions> = {
  setEgiftMethodEnabled: async () => ({ ok: false, error: 'new row violates row-level security policy for table "event_egift_methods"' }),
  saveEgiftMethod: async () => ({ ok: false, error: 'duplicate key value violates unique constraint "event_egift_methods_pkey"' }),
  savePabuyaMessage: async () => ({ ok: false, error: 'column events.pabuya_message does not exist' }),
  hubDraftAction: async () => ({ ok: false, intent: 'save', error: 'invalid input syntax for type uuid: "lab"' }),
};
