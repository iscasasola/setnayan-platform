import { displayServiceLabel } from '@/lib/vendors';

/**
 * perk-unlock-message — the chat line posted when a supplier accepts an inquiry
 * and one of their cards carries a perk for Setnayan couples. ONE module writes
 * it, reads it, and shortens it (owner's test round 1, 2026-09-11).
 *
 * WHAT WAS WRONG. The writer posted `**Setnayan Exclusive unlocked 🎁** live_band:
 * Free 1-hour extension…`. The chat renders system lines as plain text, so the
 * `**` showed; an untitled card printed its raw key (`live_band`, `host_mc`); and
 * "Exclusive" is the retired name.
 *
 * ⚖ WHY IT IS NOT CALLED "THE SETNAYAN GIFT". The text is the card's
 * `exclusive_perk_text` — the SUPPLIER's own promise ("Free 1-hour extension for
 * Setnayan couples"), kept as data by 20271216515644 when the gift was redefined.
 * The Setnayan gift is now Papic credits, sized from the booking and shown on the
 * QUOTE. Calling this line "the Setnayan gift" would promise the couple Setnayan's
 * photos on a booking whose quote may carry none. So it is named for what it is.
 *
 * OLD ROWS ARE READ, NOT REWRITTEN. Production keeps the old bodies; the render
 * (the chat stream) and the preview (conversation-list) parse BOTH shapes and
 * print the new wording, so every existing line reads right with no data change.
 */

export const PERK_UNLOCK_LEAD = '🎁 A perk for Setnayan couples';

const OLD_SHAPE = /^\*\*Setnayan Exclusive unlocked 🎁\*\* (.+?): ([\s\S]*)$/;
const NEW_SHAPE = /^🎁 A perk for Setnayan couples · (.+?) — ([\s\S]*)$/;

/** A card label that is really a raw key (`live_band`) is shown as its label. */
function asLabel(raw: string): string {
  const t = raw.trim();
  return /^[a-z0-9_]+$/.test(t) ? displayServiceLabel(t) : t;
}

/** The body the writer posts, for one card. */
export function perkUnlockBody(cardLabel: string, perkText: string): string {
  return `${PERK_UNLOCK_LEAD} · ${asLabel(cardLabel)} — ${perkText.trim()}`;
}

/** Either shape, parsed; null for any other message. */
export function parsePerkUnlock(body: string): { label: string; perk: string } | null {
  const m = body.match(OLD_SHAPE) ?? body.match(NEW_SHAPE);
  if (!m) return null;
  return { label: asLabel(m[1]!), perk: m[2]!.trim() };
}

/** What the chat shows for a system body: the new wording for either shape. */
export function renderPerkUnlock(body: string): string {
  const p = parsePerkUnlock(body);
  return p ? `${PERK_UNLOCK_LEAD} · ${p.label} — ${p.perk}` : body;
}

/** The one-line preview (conversation list, the supplier's "What's new"). */
export function shortPerkUnlock(body: string): string | null {
  const p = parsePerkUnlock(body);
  return p ? `🎁 Perk: ${p.label}` : null;
}
