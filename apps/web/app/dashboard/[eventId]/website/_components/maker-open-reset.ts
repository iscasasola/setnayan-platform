/**
 * The Maker toolbar's More ▾ → "Reset this stage…" fires this; the draft bar
 * (`hub-draft-bar.tsx`) opens its own Reset confirm. ONE Reset — the draft
 * bar's confirm flow, never a second copy of it (the approved prototype moves
 * the entry into More ▾; the confirm stays where the draft lives).
 *
 * Its own module so the toolbar can import it without the draft bar's
 * server action (`hub-draft-button.tsx` is split out for the same reason).
 */
export const MAKER_OPEN_RESET_EVENT = 'setnayan:maker-open-reset';
