import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * apps/web/lib/live-studio-overlays.ts
 *
 * WAVE 2 — the ₱0 BROADCAST EXTRAS for the unified Live Studio controller
 * (owner-locked 2026-07-25 · Live_Studio_Unified_Spec_2026-07-25.md § 4b).
 *
 * Four things ride ON the broadcast at zero marginal cost, composited as DOM
 * layers on the surface the couple's encoder already captures — never on a server
 * mixer, so a wedding with 100 viewers and a wedding with 1,000,000 cost us the
 * same ₱0:
 *
 *   Ⓜ  monogram bug   — repositionable, default UPPER-RIGHT   · PAID (LIVE_STUDIO)
 *   ▬  lower third    — the host's own two lines               · PAID (LIVE_STUDIO)
 *   ⬛ event QR       — "scan to join", on the broadcast       · FREE (owner-locked)
 *   ⚡ highlight       — a timestamped moment, metadata only     · PAID (LIVE_STUDIO)
 *
 * ── THE TWO OWNER LOCKS THIS MODULE ENFORCES ────────────────────────────────────
 *
 * 1. THE EVENT-QR OVERLAY IS FREE. A scan-to-join code on a wedding broadcast
 *    pulls that wedding's guests into Setnayan, so gating it would be charging for
 *    our own distribution. It is the one overlay a free host gets.
 *
 * 2. "POWERED BY SETNAYAN" IS PERMANENT ON THE FREE TIER. Every free stream
 *    carries it as its lower third; the ₱3,000 unlock REPLACES it with the couple's
 *    own. It is therefore **derived from the entitlement, never stored as a row** —
 *    if it were a row a free host could switch it off, and `resolveOverlays` would
 *    have to trust their setting. Here the free branch simply never consults
 *    `lower_third_enabled`, so there is no request to replay and no column to
 *    tamper with. The server actions carry the same ownership backstop; this is the
 *    second, independent one.
 *
 * A corollary worth stating: the resolver re-asks the entitlement on EVERY render,
 * so a `monogram_enabled = true` left behind by a LAPSED unlock renders nothing.
 * Settings persist; permission does not.
 *
 * The pure half (positions · normalizers · `resolveOverlays` · highlight
 * formatting) is unit-tested and shared by the controller, the server actions and
 * the capture surface, so free-vs-paid cannot drift between what the host is shown
 * and what actually goes to air. The I/O half at the bottom graceful-degrades on a
 * pre-migration database (42P01 / 42703), matching the panood-moments.ts posture.
 */

/* ═══════════════════════════════════════════════════════════════════════════════
   PURE — positions, normalizers, the resolver
   ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Where the Ⓜ monogram bug may sit. UPPER-RIGHT FIRST and default — the corner a
 * broadcast bug conventionally lives in, and the owner's stated default. The set is
 * deliberately a small corner catalogue rather than free x/y: a draggable bug can
 * be dropped half off-frame, and every corner here is safe in both 16:9 and the
 * letterboxing a phone-shot vertical feed produces.
 */
export const MONOGRAM_POSITIONS = ['top-right', 'bottom-right', 'bottom-left', 'top-center'] as const;
export type MonogramPosition = (typeof MONOGRAM_POSITIONS)[number];
export const DEFAULT_MONOGRAM_POSITION: MonogramPosition = 'top-right';

/**
 * Where the event-QR overlay may sit. TOP-LEFT default — diagonally opposite the
 * monogram's default so the two never collide out of the box, and clear of the
 * lower third along the bottom edge.
 */
export const QR_POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
export type QrPosition = (typeof QR_POSITIONS)[number];
export const DEFAULT_QR_POSITION: QrPosition = 'top-left';

/** Host-facing labels for the corner pickers — one source of truth for the copy. */
export const POSITION_LABELS: Record<MonogramPosition | QrPosition, string> = {
  'top-right': 'Top right',
  'top-left': 'Top left',
  'bottom-right': 'Bottom right',
  'bottom-left': 'Bottom left',
  'top-center': 'Top center',
};

/**
 * Tailwind placement for a corner, shared by the controller's placement preview and
 * the real capture surface. ONE map so "upper right" cannot mean two different
 * things in the two places it is drawn — the whole point of the preview is that it
 * predicts the broadcast.
 *
 * The bottom corners sit at `bottom-16` rather than the frame edge to stay clear of
 * the lower third, which owns the bottom strip whenever it is on.
 */
export function overlayPositionClass(position: MonogramPosition | QrPosition): string {
  switch (position) {
    case 'top-right':
      return 'right-3 top-3';
    case 'top-left':
      return 'left-3 top-3';
    case 'bottom-right':
      return 'bottom-16 right-3';
    case 'bottom-left':
      return 'bottom-16 left-3';
    case 'top-center':
      return 'left-1/2 top-3 -translate-x-1/2';
  }
}

export function normalizeMonogramPosition(raw: unknown): MonogramPosition {
  return (MONOGRAM_POSITIONS as readonly string[]).includes(raw as string)
    ? (raw as MonogramPosition)
    : DEFAULT_MONOGRAM_POSITION;
}

export function normalizeQrPosition(raw: unknown): QrPosition {
  return (QR_POSITIONS as readonly string[]).includes(raw as string)
    ? (raw as QrPosition)
    : DEFAULT_QR_POSITION;
}

/**
 * Lower-third line caps. A lower third is one strip across a 16:9 frame; past
 * roughly these lengths it either wraps into a paragraph or ellipsises mid-word on
 * a phone-shot feed. Capping at save time keeps the bar a bar.
 */
export const LOWER_THIRD_TITLE_MAX = 40;
export const LOWER_THIRD_SUBTITLE_MAX = 80;

/** Trim + collapse whitespace + cap. Empty / non-string → null (clears the line). */
export function normalizeLowerThirdLine(raw: unknown, max: number): string | null {
  if (typeof raw !== 'string') return null;
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  if (!collapsed) return null;
  return collapsed.slice(0, max);
}

/** Optional ⚡ moment note ("The kiss"). Same normalisation, shorter cap. */
export const HIGHLIGHT_LABEL_MAX = 60;
export function normalizeHighlightLabel(raw: unknown): string | null {
  return normalizeLowerThirdLine(raw, HIGHLIGHT_LABEL_MAX);
}

/**
 * The FREE tier's permanent lower third — the growth loop (owner-locked): every
 * free wedding stream advertises the platform that carried it. Not a row, not a
 * setting, not removable; see the header.
 */
export const SETNAYAN_LOWER_THIRD = {
  title: 'POWERED BY SETNAYAN',
  subtitle: 'Free live stream · setnayan.com',
} as const;

/** The persisted overlay row, exactly as the table stores it. */
export type OverlaySettings = {
  monogramEnabled: boolean;
  monogramPosition: MonogramPosition;
  lowerThirdEnabled: boolean;
  lowerThirdTitle: string | null;
  lowerThirdSubtitle: string | null;
  eventQrEnabled: boolean;
  eventQrPosition: QrPosition;
};

/** A host with no row yet: everything off, at the owner's default corners. */
export const DEFAULT_OVERLAY_SETTINGS: OverlaySettings = {
  monogramEnabled: false,
  monogramPosition: DEFAULT_MONOGRAM_POSITION,
  lowerThirdEnabled: false,
  lowerThirdTitle: null,
  lowerThirdSubtitle: null,
  eventQrEnabled: false,
  eventQrPosition: DEFAULT_QR_POSITION,
};

/**
 * What actually goes to air. `null` means "draw nothing" — the capture surface and
 * the controller preview both key off these three fields and nothing else, so
 * neither can invent a layer the other doesn't know about.
 */
export type ResolvedOverlays = {
  monogram: { text: string; position: MonogramPosition } | null;
  lowerThird: {
    title: string;
    subtitle: string | null;
    /**
     * True = this is the Setnayan bar on a free stream. The host cannot switch it
     * off; the controller renders the toggle as locked and says why.
     */
    forced: boolean;
  } | null;
  eventQr: { position: QrPosition } | null;
};

/**
 * Resolve persisted settings + the live entitlement into the layers that are drawn.
 *
 * `owned` is the server-resolved LIVE_STUDIO entitlement (eventSkuActive) — the
 * SAME value the controller's lock and the server actions use. Pass `false` on any
 * entitlement lookup failure: that lands on the free branch, which is the safe
 * default (branded, nothing paid leaks) and is identical to what the host already
 * sees before they buy, so a transient failure never changes what is on screen
 * mid-show.
 */
export function resolveOverlays(input: {
  owned: boolean;
  settings: OverlaySettings;
  /** The couple's monogram text (events.monogram_text ?? deriveMonogram(name)). */
  monogramText: string | null;
}): ResolvedOverlays {
  const { owned, settings, monogramText } = input;

  // FREE: the Setnayan bar, always. `settings.lowerThirdEnabled` is not consulted
  // on this branch at all — there is nothing for a free host to flip.
  const lowerThird: ResolvedOverlays['lowerThird'] = !owned
    ? { title: SETNAYAN_LOWER_THIRD.title, subtitle: SETNAYAN_LOWER_THIRD.subtitle, forced: true }
    : settings.lowerThirdEnabled
      ? {
          // A paid host who enabled the bar but typed nothing gets their own name
          // slot left to the caller's fallback rather than an empty strip.
          title: settings.lowerThirdTitle ?? '',
          subtitle: settings.lowerThirdSubtitle,
          forced: false,
        }
      : null;

  // Ⓜ monogram — paid, and only when there is actually something to draw.
  const text = monogramText?.trim() ?? '';
  const monogram =
    owned && settings.monogramEnabled && text
      ? { text, position: settings.monogramPosition }
      : null;

  // Event QR — FREE for everyone (owner-locked). The only overlay that does not
  // consult `owned`.
  const eventQr = settings.eventQrEnabled ? { position: settings.eventQrPosition } : null;

  return { monogram, lowerThird, eventQr };
}

/**
 * Is the ⚡ highlight button a real control right now? It needs BOTH the unlock and
 * a broadcast actually on air — a "moment" stamped while off air has no broadcast to
 * be an offset into, so the honest thing is not to render the button at all rather
 * than persist a row that can never become a chapter.
 */
export function canMarkHighlight(input: { owned: boolean; isLive: boolean }): boolean {
  return input.owned && input.isLive;
}

/**
 * Seconds from the broadcast going live to the moment being marked. Null when the
 * start is unknown or the mark precedes it (clock skew) — an honest absence beats a
 * fabricated 0, which would silently claim "this happened at the very top of the
 * show".
 */
export function highlightOffsetSeconds(
  markedAt: Date | string,
  wentLiveAt: Date | string | null | undefined,
): number | null {
  if (!wentLiveAt) return null;
  const start = wentLiveAt instanceof Date ? wentLiveAt : new Date(wentLiveAt);
  const mark = markedAt instanceof Date ? markedAt : new Date(markedAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(mark.getTime())) return null;
  const seconds = Math.floor((mark.getTime() - start.getTime()) / 1000);
  return seconds < 0 ? null : seconds;
}

/**
 * `h:mm:ss` / `mm:ss` — the shape a YouTube chapter line wants, which is the whole
 * point of storing the offset. Null offset renders as an em dash, never "0:00".
 */
export function formatHighlightOffset(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '—';
  const s = Math.floor(seconds);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   I/O — reads/writes. Graceful-degrade on a pre-migration database.
   ═══════════════════════════════════════════════════════════════════════════════ */

const OVERLAY_SELECT =
  'monogram_enabled, monogram_position, lower_third_enabled, lower_third_title, lower_third_subtitle, event_qr_enabled, event_qr_position';

type OverlayRow = {
  monogram_enabled?: boolean | null;
  monogram_position?: string | null;
  lower_third_enabled?: boolean | null;
  lower_third_title?: string | null;
  lower_third_subtitle?: string | null;
  event_qr_enabled?: boolean | null;
  event_qr_position?: string | null;
};

/** Row → typed settings, re-normalising the enum columns (defence in depth). */
export function mapOverlayRow(row: OverlayRow | null | undefined): OverlaySettings {
  if (!row) return DEFAULT_OVERLAY_SETTINGS;
  return {
    monogramEnabled: row.monogram_enabled === true,
    monogramPosition: normalizeMonogramPosition(row.monogram_position),
    lowerThirdEnabled: row.lower_third_enabled === true,
    lowerThirdTitle: normalizeLowerThirdLine(row.lower_third_title, LOWER_THIRD_TITLE_MAX),
    lowerThirdSubtitle: normalizeLowerThirdLine(row.lower_third_subtitle, LOWER_THIRD_SUBTITLE_MAX),
    eventQrEnabled: row.event_qr_enabled === true,
    eventQrPosition: normalizeQrPosition(row.event_qr_position),
  };
}

/**
 * Read this event's overlay settings. Missing row → all-off defaults, which is the
 * correct state for a host who has not touched an overlay yet. Missing table /
 * column (pre-migration) → the same defaults rather than a crash, so the controller
 * still operates the broadcast.
 */
export async function fetchOverlaySettings(
  supabase: SupabaseClient,
  eventId: string,
): Promise<OverlaySettings> {
  try {
    const { data, error } = await supabase
      .from('live_studio_overlay_settings')
      .select(OVERLAY_SELECT)
      .eq('event_id', eventId)
      .maybeSingle();
    if (error) return DEFAULT_OVERLAY_SETTINGS;
    return mapOverlayRow(data as OverlayRow | null);
  } catch {
    return DEFAULT_OVERLAY_SETTINGS;
  }
}

/**
 * Upsert a partial overlay patch for one event. Runs under the CALLER's session so
 * the couple+coordinator RLS policy applies — the actions add the entitlement gate
 * on top. Returns false on any failure so the action can show a real error instead
 * of a success banner over an unsaved change.
 */
export async function saveOverlaySettings(
  supabase: SupabaseClient,
  eventId: string,
  patch: Partial<{
    monogram_enabled: boolean;
    monogram_position: MonogramPosition;
    lower_third_enabled: boolean;
    lower_third_title: string | null;
    lower_third_subtitle: string | null;
    event_qr_enabled: boolean;
    event_qr_position: QrPosition;
  }>,
): Promise<boolean> {
  if (!eventId || Object.keys(patch).length === 0) return false;
  try {
    const { error } = await supabase
      .from('live_studio_overlay_settings')
      .upsert({ event_id: eventId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'event_id' });
    return !error;
  } catch {
    return false;
  }
}

/** One ⚡ moment, as the post-event list reads it. */
export type HighlightRow = {
  id: number;
  marked_at: string;
  offset_seconds: number | null;
  channel: number | null;
  channel_label: string | null;
  label: string | null;
};

const HIGHLIGHT_SELECT = 'id, marked_at, offset_seconds, channel, channel_label, label';

/** Newest first — the operator's mental model mid-show is "what did I just mark?". */
export async function fetchHighlights(
  supabase: SupabaseClient,
  eventId: string,
  limit = 50,
): Promise<HighlightRow[]> {
  try {
    const { data, error } = await supabase
      .from('live_studio_highlights')
      .select(HIGHLIGHT_SELECT)
      .eq('event_id', eventId)
      .order('marked_at', { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data ?? []) as HighlightRow[];
  } catch {
    return [];
  }
}
