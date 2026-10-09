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
