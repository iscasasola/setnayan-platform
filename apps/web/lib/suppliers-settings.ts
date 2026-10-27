/**
 * suppliers-settings.ts — what Suppliers ⚙'s sheet draws (owner 2026-10-27, DECISION_LOG "SUPPLIERS GETS ITS ⚙ — THE
 * SUPPLIER SETTINGS MOVE THERE"). Neutral types + the cluster order; the reads are `suppliers-settings.server.ts`,
 * the rows `vendors/_components/suppliers-settings-rows.tsx`, the one home of each row `SETTINGS_ROWS`.
 */

/** Suppliers ⚙ — its clusters, in order. */
export const SUPPLIERS_SETTINGS_CLUSTERS = ['Costs', 'Payments', 'Photos'] as const;

export type SuppliersSettingsView = {
  /** How you see costs + the stored reply-by date it must carry. Null: the read was refused. */
  costs: { mode: 'realtime' | 'final_only'; deadline: string | null } | null;
  /** The next two supplier payments. Null: the read was refused. */
  payments: { id: string; when: string; words: string }[] | null;
  /** The booked suppliers who shot here, each with its photos switch. Null: not the couple, or the read was refused. */
  photos: { vendorRowId: string; name: string; hidden: boolean }[] | null;
  /** False when the couple's photos read was refused (say so — never "no supplier photos"). */
  photosRead: boolean;
};
