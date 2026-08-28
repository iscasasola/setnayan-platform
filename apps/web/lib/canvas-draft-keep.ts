/**
 * canvas-draft-keep.ts — THE HALF-FINISHED CARD IS KEPT (owner 2026-08-28: *"add it"*).
 *
 * 🔴 WHAT IT FIXES. The maker saves in ONE submit, by design. So a supplier who
 * lost signal, took a call, or closed the tab three questions in came back to a
 * blank card — the photo they had already uploaded, the sentence they had
 * written, the price they had worked out, all gone with nothing said. *Save as
 * draft* existed, but it is a button somebody has to know to press before the
 * thing they are afraid of happens.
 *
 * 🔑 IT IS KEPT IN THEIR OWN BROWSER, NOT IN OUR DATABASE, and that is the
 * design rather than a shortcut. A server-side autosave would mint a real card
 * row per abandoned attempt — junk in the shop's own list, in the caps that
 * count cards, and in every read that counts what a shop offers. What is kept
 * here can only ever be seen by the person who typed it, on the device they
 * typed it on, and it never becomes a card until they press Publish or Save as
 * draft exactly as before.
 *
 * ⚖ WHAT IS DELIBERATELY NOT KEPT:
 *   · **file pickers** — a chosen file is not a value, and the picker's own
 *     upload already put the object in storage and wrote its key into a hidden
 *     field. The KEY is kept, so a restored card still has its photo.
 *   · **rows that were added by hand** (extra inclusions, discount lines). They
 *     are DOM the editor creates on demand; a name with nowhere to land is
 *     dropped rather than half-restored into the wrong row.
 *   · **anything older than a week**, and anything from a different shop on the
 *     same browser — the key is namespaced by profile.
 *
 * 🔒 EVERY READ AND WRITE IS WRAPPED. `localStorage` throws outright in some
 * contexts (private windows, blocked site data), and a card maker that white-
 * screens because a convenience feature could not write is a far worse product
 * than one that quietly does not keep.
 */

/** Bumped when the shape below changes; an older keep is dropped, never guessed at. */
export const KEEP_VERSION = 1;

/** A week. Long enough to survive a weekend, short enough not to haunt anybody. */
export const KEEP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Refuse to hold more than this; a runaway form must not fill their storage. */
export const KEEP_MAX_BYTES = 64 * 1024;

export type CanvasKeep = {
  v: number;
  /** When it was written, epoch ms. */
  at: number;
  /** The kind of service, which lives in React state rather than in the form. */
  category: string;
  /** name → value, in document order. Repeated names are kept repeated. */
  fields: [string, string][];
};

/** Namespaced by shop: two shops on one browser must never see each other's work. */
export function keepStorageKey(vendorProfileId: string): string {
  return `sn.card-keep.${vendorProfileId}`;
}

/**
 * Is this worth offering back? A keep holding nothing but empty strings is a
 * keep of a blank card, and *"pick up where you left off"* pointing at nothing
 * is worse than no offer at all.
 */
export function keepHasContent(keep: CanvasKeep): boolean {
  if (keep.category.trim().length > 0) return true;
  return keep.fields.some(([, value]) => value.trim().length > 0);
}

/**
 * Parse what came out of storage. Returns null for anything not exactly right —
 * wrong version, expired, malformed, empty. **Never throws**: the caller is a
 * render path.
 */
export function readKeep(raw: string | null, nowMs: number): CanvasKeep | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const k = parsed as Partial<CanvasKeep>;
    if (k.v !== KEEP_VERSION) return null;
    if (typeof k.at !== 'number' || !Number.isFinite(k.at)) return null;
    if (nowMs - k.at > KEEP_TTL_MS) return null;
    // A keep written in the future is a clock change, not data — take it rather
    // than throwing away real work over a timezone.
    if (typeof k.category !== 'string') return null;
    if (!Array.isArray(k.fields)) return null;
    const fields: [string, string][] = [];
    for (const pair of k.fields) {
      if (!Array.isArray(pair) || pair.length !== 2) return null;
      const [name, value] = pair;
      if (typeof name !== 'string' || typeof value !== 'string') return null;
      fields.push([name, value]);
    }
    const keep: CanvasKeep = { v: k.v, at: k.at, category: k.category, fields };
    return keepHasContent(keep) ? keep : null;
  } catch {
    return null;
  }
}

/** Serialize for storage. Returns null when it would be too big to hold. */
export function serializeKeep(keep: CanvasKeep): string | null {
  try {
    const raw = JSON.stringify(keep);
    return raw.length > KEEP_MAX_BYTES ? null : raw;
  } catch {
    return null;
  }
}

/**
 * How long ago, in the words a person uses. Shown on the offer so they know
 * whether this is the thing they were doing five minutes ago or last Tuesday.
 */
export function keepAgeLabel(atMs: number, nowMs: number): string {
  const mins = Math.floor((nowMs - atMs) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}
