/**
 * apps/web/lib/rsvp-ask.ts
 *
 * WHAT DO YOU WANT TO ASK YOUR GUESTS? — a per-event on/off for the RSVP form's
 * own questions (spec corpus `DECISION_LOG.md`, 2026-09-25, verbatim: *"with
 * this invitation process in mind we need to add this process on the editor
 * for easier setup. to ask what are the information you want to get from the
 * guest."* Follow-up, item 5: *"yes on and off"*).
 *
 * ── THE SIX SWITCHES, AND WHY ATTENDING ISN'T ONE ──────────────────────────
 * `rsvp-widget.tsx` and `submitRsvp` (app/[slug]/actions.ts) already ask five
 * things beyond the answer itself: a plus-one's name, a meal, a dietary note,
 * a note to the couple, and a mobile number. The Event Hub separately carries
 * a sixth guest-facing ask, the song request card (`song-request-card.tsx`) —
 * its own widget with its own open/paused window, folded into this ONE on/off
 * because the owner named it in the same list. `attending` is not a field here
 * on purpose: the couple cannot ask the answer itself off (owner's own list
 * marks it "always on, not switchable").
 *
 * ── STORED SPARSE, DEFAULT ON ───────────────────────────────────────────────
 * A key ABSENT from the stored config means "still asked" — so an event that
 * never opens this panel keeps asking exactly what it asks today, byte for
 * byte, and a couple flips only the ones they mean to turn off. `{}` and `null`
 * both mean "nothing changed yet".
 *
 * Pure. No I/O — read by the Maker's client toggle, `submitRsvp`, both RSVP
 * render sites (`site-body.tsx`, `invite/reply/page.tsx`) and the song-request
 * route, so a drift between what is ASKED and what is ENFORCED cannot happen
 * without editing this file's own type.
 */

export const RSVP_ASK_FIELDS = ['plus_ones', 'meal', 'dietary', 'song_request', 'note', 'mobile'] as const;
export type RsvpAskField = (typeof RSVP_ASK_FIELDS)[number];

/** Sparse: an absent key is ON. Only an explicit `false` turns a question off. */
export type RsvpAskConfig = Partial<Record<RsvpAskField, boolean>>;

export function isRsvpAskField(v: unknown): v is RsvpAskField {
  return typeof v === 'string' && (RSVP_ASK_FIELDS as readonly string[]).includes(v);
}

const CONFIG_MAX_BYTES = 2048;

/**
 * Drop anything that is not a known field with a boolean value. Stored config
 * is data a human saved months ago, not a promise about shape — the same rule
 * `sanitizeRoleAttire` follows for `dress_code_config`.
 */
export function sanitizeRsvpAskConfig(raw: unknown): RsvpAskConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: RsvpAskConfig = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isRsvpAskField(key)) continue;
    if (typeof value !== 'boolean') continue;
    out[key] = value;
  }
  return out;
}

/** The same cap the migration's CHECK enforces — asked here so a Maker save can refuse before the round trip. */
export function rsvpAskConfigFits(config: RsvpAskConfig): boolean {
  return Buffer.byteLength(JSON.stringify(config), 'utf8') <= CONFIG_MAX_BYTES;
}

/**
 * Is this field asked? Absent (never touched, or dropped by `sanitizeRsvpAskConfig`)
 * reads as ON — the default that keeps every existing event's form unchanged.
 */
export function rsvpAsks(config: RsvpAskConfig | null | undefined, field: RsvpAskField): boolean {
  return config?.[field] !== false;
}

/** Every field resolved at once, for a renderer that wants the whole shape. */
export function resolveRsvpAsk(raw: unknown): Record<RsvpAskField, boolean> {
  const config = sanitizeRsvpAskConfig(raw);
  const out = {} as Record<RsvpAskField, boolean>;
  for (const field of RSVP_ASK_FIELDS) out[field] = rsvpAsks(config, field);
  return out;
}

export const RSVP_ASK_LABEL: Record<RsvpAskField, string> = {
  plus_ones: 'Plus-ones',
  meal: 'Meal choice',
  dietary: 'Dietary needs',
  song_request: 'Song request',
  note: 'Note to you',
  mobile: 'Mobile number',
};

export const RSVP_ASK_TIP: Record<RsvpAskField, string> = {
  plus_ones: 'Only guests you already allowed a plus-one still see this — turning it off hides the name box for everyone.',
  meal: 'The meal picker on the reply card.',
  dietary: 'The allergy / dietary notes box.',
  song_request: 'The song-request card on your Event Hub — separate from its own open/paused window.',
  note: 'The free-text note guests can leave you.',
  mobile: 'Only the mobile box — email always shows, since it is also how a guest keeps their invitation.',
};
