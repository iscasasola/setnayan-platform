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

/**
 * WHO CAN RSVP? (owner 2026-09-26, DECISION_LOG "NOBODY WITHOUT A KEY"; placed
 * on the Maker's own RSVP page 2026-09-27). ONE stored value, read by every
 * place that shows or enforces it — the Maker's RSVP page, Guest List → Invite
 * and the join door — through `readWhoCanRsvp` below, never re-parsed.
 *
 *   · 'guest_list' — Only my Guest List (the DEFAULT, and what an absent key
 *                    means): a person without a key has no way to ask.
 *   · 'anyone'     — Anyone, I approve: a person without a key may ASK to join;
 *                    they wait in Guest List → Requests until the couple
 *                    Keeps, Links or Removes them. Never an admission.
 */
export const WHO_CAN_RSVP = ['guest_list', 'anyone'] as const;
export type WhoCanRsvp = (typeof WHO_CAN_RSVP)[number];
export const WHO_CAN_RSVP_DEFAULT: WhoCanRsvp = 'guest_list';
export const WHO_CAN_RSVP_LABEL: Record<WhoCanRsvp, string> = {
  guest_list: 'Only my Guest List',
  anyone: 'Anyone, I approve',
};

export function isWhoCanRsvp(v: unknown): v is WhoCanRsvp {
  return typeof v === 'string' && (WHO_CAN_RSVP as readonly string[]).includes(v);
}

/**
 * Sparse: an absent question key is ON. Only an explicit `false` turns a
 * question off. The two page-level keys ride in the same object (no new column —
 * brief item 4): `whoCanRsvp` (absent = Only my Guest List) and `oneAtATime`
 * (absent = one scrolling page).
 */
export type RsvpAskConfig = Partial<Record<RsvpAskField, boolean>> & {
  whoCanRsvp?: WhoCanRsvp;
  oneAtATime?: boolean;
  /**
   * 📮 REMINDER EMAILS at 30 · 7 · 1 days before the event (owner 2026-09-26:
   * *"couple can switch off"*). Absent = ON, the owner's default; only an
   * explicit `false` switches them off. Read by `runGuestReminderEmails`
   * (lib/guest-reminder-emails.ts) from the LIVE column — a draft that has not
   * been Applied changes nothing about what guests receive, like every other
   * key here.
   */
  guestReminders?: boolean;
};

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
    // The two page-level keys — kept only in their own shape, so a Maker save
    // of the six switches can never drop "Who can RSVP?" on the way through.
    if (key === 'whoCanRsvp') {
      if (isWhoCanRsvp(value)) out.whoCanRsvp = value;
      continue;
    }
    if (key === 'oneAtATime') {
      if (typeof value === 'boolean') out.oneAtATime = value;
      continue;
    }
    if (key === 'guestReminders') {
      if (typeof value === 'boolean') out.guestReminders = value;
      continue;
    }
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

// ── WHO CAN RSVP · ONE AT A TIME · REPLY BY ─────────────────────────────────
// Typed readers over the RAW stored blob (`events.rsvp_ask_config`), so no
// caller re-implements a default. The guest side reads these same functions.

/** "Who can RSVP?" — absent, malformed or unknown reads as Only my Guest List. */
export function readWhoCanRsvp(raw: unknown): WhoCanRsvp {
  return sanitizeRsvpAskConfig(raw).whoCanRsvp ?? WHO_CAN_RSVP_DEFAULT;
}

/** May a person WITHOUT a key ask to join? Only when the couple chose "Anyone, I approve". */
export function anyoneMayAskToJoin(raw: unknown): boolean {
  return readWhoCanRsvp(raw) === 'anyone';
}

/** "Ask one question at a time" — absent reads as OFF (one scrolling page). */
export function readOneAtATime(raw: unknown): boolean {
  return sanitizeRsvpAskConfig(raw).oneAtATime === true;
}

/**
 * "Reminder emails" — absent reads as ON. Only an explicit `false` switches
 * the 30 · 7 · 1 day guest reminders off (owner 2026-09-26: on by default, the
 * couple can switch them off). The sender reads THIS, never the raw blob.
 */
export function readGuestReminders(raw: unknown): boolean {
  return sanitizeRsvpAskConfig(raw).guestReminders !== false;
}

export const GUEST_REMINDERS_TIP =
  'Guests who gave an email get three short reminders — 30 days, 7 days and the day before — each listing only what they have not ticked on their checklist, with a link to their own page. A guest who has not replied is asked to reply by your date first. Off means nobody is emailed. Guests without an email are never emailed either way.';

export const ONE_AT_A_TIME_TIP =
  'OFF: every question on one scrolling page. ON: one question per screen with progress dots and Back — easier for elders and small screens. Same questions either way.';

export const WHO_CAN_RSVP_TIP =
  '“Anyone, I approve” lets people without a key ask to join. They wait in Requests until you Keep, Link or Remove them — nobody gets inside on a name alone.';

/** How far before the day the reply-by date falls when the couple never set one. */
export const DEFAULT_REPLY_BY_DAYS = 30;

/**
 * THE REPLY-BY DATE (brief item 4). The couple's own `guest_list_edit_deadline`
 * always wins and is never overwritten; only when it is unset does the default
 * — 30 days before the event — stand in, marked `isDefault` so the screen can
 * say so. Dates are `YYYY-MM-DD` (both columns are `date`). Null when neither
 * exists (no event date yet).
 */
export function resolveReplyBy(input: {
  deadline: string | null | undefined;
  eventDate: string | null | undefined;
}): { date: string; isDefault: boolean } | null {
  const set = (input.deadline ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(set)) return { date: set.slice(0, 10), isDefault: false };
  const day = (input.eventDate ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(day)) return null;
  const [y = NaN, m = NaN, d = NaN] = day.slice(0, 10).split('-').map(Number);
  const t = Date.UTC(y, m - 1, d) - DEFAULT_REPLY_BY_DAYS * 86_400_000;
  if (!Number.isFinite(t)) return null;
  return { date: new Date(t).toISOString().slice(0, 10), isDefault: true };
}
