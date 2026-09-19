/**
 * apps/web/lib/live-screens.ts
 *
 * LIVE STUDIO VENUE SCREENS (DAY-12) — the pure rules both ends import.
 *
 * A venue screen is a TV / projector / LED wall in the room, running a browser
 * at `setnayan.com/live`. The couple (or their host) adds it from the Live
 * Studio controller, the screen types a 6-character code to pair, and the
 * controller then chooses what it shows. This file is the ONE place that says
 * what a screen may show and how a stored row turns into a picture, so the
 * controller's buttons and the screen's render cannot disagree.
 *
 * 🔴 OWNER RULINGS, 2026-09-20 (answers to the three S32 questions):
 *   1. Screens belong IN the unified Live Studio controller.
 *   2. A Live Studio screen shows LIVE BACKGROUND, MIRROR, or OFF — and never
 *      the photo wall. That keeps the 2026-08-17 ruling that a Live Studio
 *      screen and the Live Photo Wall are different products.
 *   3. The mirror (the couple's YouTube broadcast, embedded) is acceptable in
 *      the same room even though it runs behind, AS LONG AS the screen says so.
 *      `MIRROR_DELAY_NOTICE` below is that label; the screen must render it.
 *
 * ⚠ `panood_screens.current_source` is loose text with a column DEFAULT of
 * 'photos' — a value the legacy Cast room wrote and this product must never
 * obey. So `decideScreenPicture` treats ANY value outside LIVE_SCREEN_MODES as
 * the live background, and every insert on this path writes the mode
 * explicitly rather than trusting the default.
 *
 * Pure: no I/O, no clock reads (the clock is passed in), safe to execute in a
 * unit test.
 */

/** What a Live Studio screen may show. Nothing else, by owner ruling. */
export const LIVE_SCREEN_MODES = ['live_bg', 'mirror', 'off'] as const;
export type LiveScreenMode = (typeof LIVE_SCREEN_MODES)[number];

/** The mode a newly added screen starts in: the ambient branded screen. */
export const DEFAULT_LIVE_SCREEN_MODE: LiveScreenMode = 'live_bg';

/** Button words, in the order the controller offers them. */
export const LIVE_SCREEN_MODE_LABEL: Record<LiveScreenMode, string> = {
  live_bg: 'Live background',
  mirror: 'Mirror the livestream',
  off: 'Off',
};

export function isLiveScreenMode(v: unknown): v is LiveScreenMode {
  return typeof v === 'string' && (LIVE_SCREEN_MODES as readonly string[]).includes(v);
}

/**
 * How many screens one event can hold at once. The corpus sets a SOFT cap of
 * "~4–6, only for live-manageability" (Panood_Multicam_Architecture_2026-06-26
 * § Screen cap — "screens are cheap RECEIVERS"). This takes the top of that
 * range. It governs how many rows one operator must manage, not money.
 */
export const MAX_LIVE_SCREENS = 6;

/** A pairing code is good for this long after it is issued. */
export const LIVE_SCREEN_CODE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * A screen that has not checked in for this long is shown as not responding.
 * The screen polls every LIVE_SCREEN_POLL_MS but only WRITES `last_seen_at`
 * every LIVE_SCREEN_CHECKIN_WRITE_MS, so a healthy screen's stamp can be up to
 * ~15 s old. Thirty seconds is two missed writes, not one slow one.
 */
export const LIVE_SCREEN_POLL_MS = 5_000;
export const LIVE_SCREEN_STALE_MS = 30_000;

/**
 * Write `last_seen_at` at most this often. The screen polls every 5 s; a write
 * on every poll would be twelve writes a minute per TV for no extra truth.
 */
export const LIVE_SCREEN_CHECKIN_WRITE_MS = 10_000;

/**
 * The label a mirroring screen carries. Owner ruling 3: the mirror is fine in
 * the room only if the screen says it is behind.
 */
export const MIRROR_DELAY_NOTICE = 'Livestream · about 10–30 seconds behind the room';

/** A screen's name when the couple has not given it one. */
export function defaultScreenName(screenIndex: number): string {
  return `Screen ${screenIndex}`;
}

export const LIVE_SCREEN_NAME_MAX = 40;

/** Trim and bound a typed screen name; empty means "use the default". */
export function normalizeScreenName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.replace(/\s+/g, ' ').trim().slice(0, LIVE_SCREEN_NAME_MAX);
  return t.length > 0 ? t : null;
}

const PAIR_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const PAIR_CODE_LENGTH = 6;

/**
 * Read what a person typed on a TV remote into the stored code shape.
 *
 * Crockford's own decoding rules: case-insensitive, `O` reads as zero, `I` and
 * `L` read as one, and separators (spaces, dashes) are ignored. The generator
 * never emits those letters (`generateScreenPairingCode`), so mapping them can
 * only rescue a mistype, never collide with a real code. Returns null for
 * anything that cannot be a code, so the caller never queries with it.
 */
export function normalizePairCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    .toUpperCase()
    .replace(/[\s-]+/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (cleaned.length !== PAIR_CODE_LENGTH) return null;
  for (const ch of cleaned) {
    if (!PAIR_CODE_ALPHABET.includes(ch)) return null;
  }
  return cleaned;
}

/** Can this stored code still be used to pair, at `nowMs`? */
export function pairCodeUsable(
  row: { pairing_code: string | null; pairing_expires_at: string | null; revoked_at: string | null },
  nowMs: number,
): boolean {
  if (row.revoked_at) return false;
  if (!row.pairing_code) return false;
  if (!row.pairing_expires_at) return false;
  const exp = Date.parse(row.pairing_expires_at);
  return Number.isFinite(exp) && exp > nowMs;
}

/** What the controller says about one screen. */
export type ScreenPresence = 'waiting' | 'on' | 'not_responding';

/**
 * Presence is derived from `paired_at` and `last_seen_at`, NOT from the stored
 * `status` column. Nothing can write `offline` when a TV is unplugged — a dead
 * screen sends no request — so a stored "online" would stay true forever. The
 * clock comparison is the only honest reading.
 */
export function screenPresence(
  row: { paired_at: string | null; last_seen_at: string | null },
  nowMs: number,
): ScreenPresence {
  if (!row.paired_at) return 'waiting';
  const seen = row.last_seen_at ? Date.parse(row.last_seen_at) : NaN;
  if (!Number.isFinite(seen)) return 'not_responding';
  return nowMs - seen <= LIVE_SCREEN_STALE_MS ? 'on' : 'not_responding';
}

/** Should this check-in write `last_seen_at`? */
export function shouldWriteCheckIn(lastSeenAt: string | null, nowMs: number): boolean {
  if (!lastSeenAt) return true;
  const seen = Date.parse(lastSeenAt);
  if (!Number.isFinite(seen)) return true;
  return nowMs - seen >= LIVE_SCREEN_CHECKIN_WRITE_MS;
}

/** What the screen actually draws. */
export type ScreenPicture =
  | { kind: 'live_bg' }
  | { kind: 'mirror'; embedUrl: string; notice: string }
  | { kind: 'off' };

/**
 * Turn a stored mode plus the event's embed link into a picture.
 *
 *   • any mode outside LIVE_SCREEN_MODES (incl. the legacy 'photos' default)
 *     → live background. Never the photo wall.
 *   • mirror with no usable YouTube embed → live background. A TV in the room
 *     must not show an error to guests; the CONTROLLER is where the operator
 *     is told the mirror has nothing to show (`mirrorHasSource`).
 *   • mirror with an embed → the embed, and the delay notice with it, always.
 */
export function decideScreenPicture(input: {
  mode: string | null | undefined;
  embedUrl: string | null;
}): ScreenPicture {
  const mode = isLiveScreenMode(input.mode) ? input.mode : DEFAULT_LIVE_SCREEN_MODE;
  if (mode === 'off') return { kind: 'off' };
  if (mode === 'mirror' && input.embedUrl) {
    return { kind: 'mirror', embedUrl: screenEmbedSrc(input.embedUrl), notice: MIRROR_DELAY_NOTICE };
  }
  return { kind: 'live_bg' };
}

/** Does the event have something the mirror can show? */
export function mirrorHasSource(embedUrl: string | null): boolean {
  return typeof embedUrl === 'string' && embedUrl.length > 0;
}

/**
 * A TV has no one to press play and nothing to unmute: the room already has
 * the real sound, and a delayed copy of it would echo. So the screen's player
 * autoplays muted, loops nothing, and hides controls.
 */
export function screenEmbedSrc(embedUrl: string): string {
  const sep = embedUrl.includes('?') ? '&' : '?';
  return `${embedUrl}${sep}autoplay=1&mute=1&controls=0&playsinline=1&rel=0`;
}

/** Next free `screen_index`. Counts revoked rows too: the index is UNIQUE per event. */
export function nextScreenIndex(existing: Iterable<number>): number {
  let max = 0;
  for (const n of existing) if (Number.isInteger(n) && n > max) max = n;
  return max + 1;
}

/** Can one more screen be added, given the ones not removed? */
export function canAddScreen(activeCount: number): boolean {
  return activeCount < MAX_LIVE_SCREENS;
}

/* ══════════════════════════════════════════════════════════════════════════════
   VENUE SCREENS COME WITH LIVE STUDIO — owner ruling 2026-09-20.
   ══════════════════════════════════════════════════════════════════════════════
 * Asked whether venue screens should stay free or become a paid perk, the
 * owner said: "live studio is paid… depends on their live studio." Ruling:
 * screens are INCLUDED WITH the paid Live Studio unlock — there is no second
 * charge and no second flag. An event with no active unlock may not add,
 * pair, rename, re-code, or drive a screen. Removing one stays allowed, for
 * cleanup — see the `allowLocked` escape in screens-actions.ts's `gate()`.
 *
 * `liveStudioActive` is resolved the SAME way broadcasting already is —
 * `resolveBroadcastWindow(supabase, eventId).multiCam`
 * (lib/live-studio-window-server.ts, itself `eventSkuActive(LIVE_STUDIO_SKU)`)
 * — so this can never disagree with the controller's own "Unlock · price"
 * bar. This file does not read that entitlement itself (it is pure, no I/O);
 * every caller resolves it first and hands in the boolean.
 */
export function canUseVenueScreens(input: { liveStudioActive: boolean }): boolean {
  return input.liveStudioActive;
}

/**
 * The words shown wherever a screen surface is locked. Points at the
 * controller's EXISTING unlock bar/CTA (`detailHref` + `lock.unlockCtaLabel`
 * in app/panood/control/[eventId]/page.tsx) — there is deliberately no second
 * purchase path.
 */
export const VENUE_SCREENS_LOCKED_MESSAGE = 'Venue screens come with Live Studio';

/** The neutral card a paired TV shows instead of the event's content once it is locked. */
export const VENUE_SCREEN_LOCKED_TV_MESSAGE = "Live Studio isn't active for this event.";
