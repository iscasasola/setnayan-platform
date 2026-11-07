/**
 * What a self-added supplier's Share sends — the approved message and their digital card (DECISION_LOG 2026-10-30,
 * "…A SELF-ADDED SUPPLIER GETS A SHARE BUTTON, AN AUTOMATIC CLAIM LINK AND A DIGITAL CARD").
 *
 * Handed back by the ONE link writer when asked (`createManualVendorInvite({ …, withShare: true })`), built by
 * `supplierSharePayload` (lib/supplier-share.server.ts). Types only — the browser imports it.
 */
export type SupplierSharePayload = {
  /** Their claim link. */
  url: string;
  /** The approved message, filled in (`buildSupplierInviteMessage`). */
  message: string;
  /** Their digital card, the 1080 × 1440 PNG as a data address — null when it could not be drawn (the message still goes). */
  card: string | null;
  /** "bloom-ribbon-styling-setnayan-card.png". */
  fileName: string;
  /** Who the message greets — "Liza", for the line said after a copy. */
  greeting: string;
};
