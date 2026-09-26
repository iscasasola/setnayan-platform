/**
 * apps/web/lib/hub-draft.ts
 *
 * THE EVENT HUB DRAFT — what it holds, and every decision about it (Maker Phase 2).
 *
 * Owner, 2026-09-24 (DECISION_LOG "EDIT … AS A DRAFT: Apply · Restore · Reset to
 * default"): *"have a button to apply save. so they can restore to last state or
 * reset back to default."* And 2026-09-25 "Try then pay": a free couple may TRY a
 * Pro change in the draft and pays at Apply.
 *
 *   Save    — a changed key goes into the draft; guests still see the live page.
 *   Apply   — the draft's keys are written to the live columns, in a fixed order,
 *             each classified by the ONE look rule (`lib/hub-look-pro.ts`). A
 *             Pro key without Event Hub Pro is REFUSED and STAYS in the draft, so
 *             the couple who tried it can pay and Apply again without redoing it.
 *   Restore — the draft is thrown away; the preview matches the guest link again.
 *   Reset   — the page we wrote, for one stage, written INTO THE DRAFT (so it can
 *             be undone until Apply). It never names a guest-owned table.
 *   Undo    — the draft keeps its last ten states.
 *
 * 🔑 PURE ON PURPOSE. No I/O, no Supabase, no `server-only`: the store
 * (`lib/hub-draft-store.ts`), the action (`website/hub-draft-actions.ts`) and the
 * guest loader overlay all call into this file, and the tests prove the rules
 * here without a database — including that Apply's plan refuses every Pro key
 * for a free couple and applies it for an owning one (a gate that can only
 * answer one way renders exactly like a gate that works).
 *
 * ── WHAT A DRAFT MAY HOLD (and why the list is short) ──────────────────────
 * events  — `rsvp_backdrop`, and (Phase 6) the made-once group: the hero photo,
 *           the reveal and the Logo — each sanitised through the SAME parser its
 *           live writer and the guest render use (see `HUB_DRAFT_EVENT_COLUMNS`). The rule for joining this list is
 *           "the host's preview can SHOW it". (The page colours, face and art
 *           direction are painted by `app/[slug]/layout.tsx`, which cannot see
 *           `?editor=1` — so the host canvas re-wears them from the overlaid row
 *           inside the page; see `HostDraftLook`.) Media columns (hero video, music, gallery) are not
 *           here either: their writers also verify the file is this event's and
 *           was screened, and draft media is the open owner decision D6. The hero
 *           PHOTO is the exception (Phase 6): its live writer checks nothing but
 *           the `r2://` scheme, the draft holds it to the public bucket, and
 *           Apply holds it to THIS event's own uploads (`not_your_photo`).
 *         — and (2026-09-25, "the Maker's live savers go into the draft") the
 *           page's COLOURS AND FACE and the couple's WORDS: the owner edits his
 *           own public page in the Maker, and every "Saves immediately" there
 *           was a half-finished edit a guest could read. See
 *           `HUB_DRAFT_EVENT_COLUMNS` for how the host's preview shows each.
 * widgets — per section: `mode` (Auto · Shown · Hidden), `is_visible` (the
 *           navigator's eye — the legacy gate `mode: 'auto'` falls back to),
 *           `display_order`, and the section's whole `canvas` (background, crop,
 *           motion, transition),
 *           sanitised by `sanitizeHubCanvas` — the same function the guest render
 *           reads through. `canvas: null` means "take the canvas off".
 *           The HERO row alone also carries `main` (Maker Phase 10): what is
 *           behind every scene — by default the hero itself, with the adaptive
 *           theme's `tint` measured off its photo, or an opt-in override clip or
 *           photo — stored at `config_json.main`, read through
 *           `sanitizeHubMainGround`. `main: null` = the plain hero, unmeasured.
 */
import {
  WIDGET_PHASES,
  WIDGET_TYPES,
  isWidgetType,
  type InvitationWidgetRow,
  type LifecyclePhase,
  type WidgetType,
} from '@/lib/invitation-widgets';
import { isCustomSectionType } from '@/lib/custom-sections';
import {
  HUB_MAIN_GROUND_KEY,
  hubMainGround,
  isHubMainFollow,
  sanitizeHubCanvas,
  sanitizeHubMainGround,
  type HubMainGround,
  type HubSectionCanvas,
} from '@/lib/hub-canvas';
import {
  HUB_CANVAS_LOOK_KEYS,
  HUB_LOOK_EVENT_COLUMNS,
  combineChanges,
  lookWriteAllowed,
  refChange,
  type LookChange,
} from '@/lib/hub-look-pro';
import { parseRsvpBackdropConfig } from '@/lib/spatial-backdrop';
import { siteMediaServeRef } from '@/lib/site-media-ref';
import { REVEAL_TEMPLATE_IDS } from '@/lib/reveal-config-pure';
import { REVEAL_NONE, revealTemplateWriteAllowed } from '@/lib/reveal-access';
import { sanitizeStudioConfig, sanitizeStudioSvg } from '@/lib/monogram-studio-shared';
import { sanitizeHubFontKey } from '@/lib/hub-fonts';
import { sanitizeMagicTraveller } from '@/lib/magic-move';
import { OMBRE_IS_PRO, encodeSiteBackground, isOmbreValue, parseSiteBackground } from '@/lib/ombre';
import { MOMENT_MAX, momentCapRefusal, readMoment, resolveMoments, type LoveStoryMoment } from '@/lib/love-story-moments';

/** The form field that sends an existing Event Hub writer's save to the draft. */
export const HUB_DRAFT_FIELD = 'draft';

/** How many earlier states Undo can walk back through. */
export const HUB_DRAFT_HISTORY_LIMIT = 10;

/* ═══════════════════════════════════════════════════════════════════════════
   THE SHAPE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The `events` columns a draft may hold. See the file note for why only these.
 *
 * 🧩 MAKER PHASE 6 — THE MADE-ONCE GROUP joins, each because the host's preview
 * CAN show it (`app/[slug]/page.tsx` overlays the draft on the event row BEFORE
 * `loadMedia` and the reveal mount read it):
 *   · `landing_page_hero_image_url` — the ONE hero (`lib/event-hero.ts`). Pro to
 *     add or change (it is in `HUB_LOOK_EVENT_COLUMNS`); removing is free.
 *   · `std_reveal_template` — the reveal. "No reveal" is free; every opening is
 *     Pro (`revealTemplateWriteAllowed`, owner 2026-09-24 "all reveal is paid").
 *   · `monogram_custom_svg` + `monogram_studio_config` — the Logo, autosaved
 *     from the studio so a design is never lost by leaving (owner 2026-09-25,
 *     FINAL_PLAN_INPUTS 29). Letters, frame and ink are free.
 */
/** The Colors panel's five columns — `updateSiteColors`, all of it. */
export const HUB_DRAFT_LOOK_COLUMNS = [
  'site_bg_color',
  'site_button_color',
  'site_art_direction',
  'site_font_key',
  'site_magic_traveller',
] as const;

/**
 * The words the Maker edits: Text (special message · what to bring), Our story
 * + Our Love Story's moments (`love_story`, and `together_since`, which
 * `updateOurStory` dual-stores beside it), Dress code and Camera cues.
 */
export const HUB_DRAFT_WORDS_COLUMNS = [
  'special_message',
  'what_to_bring',
  'love_story',
  'together_since',
  'dress_code_config',
  'photo_moments_config',
] as const;

export const HUB_DRAFT_EVENT_COLUMNS = [
  'rsvp_backdrop',
  'landing_page_hero_image_url',
  'std_reveal_template',
  'monogram_custom_svg',
  'monogram_studio_config',
  // 🎨 THE COLOURS AND FACE (the Maker's Colors panel · `updateSiteColors`).
  // Painted by `app/[slug]/layout.tsx`, which cannot see `?editor=1` — so the
  // host canvas re-wears the look from the OVERLAID row inside the page
  // (`HostDraftLook`, `app/[slug]/page.tsx`). The background colour is free;
  // the other four are Pro (`HUB_LOOK_EVENT_COLUMNS`), tried here, paid at Apply.
  ...HUB_DRAFT_LOOK_COLUMNS,
  // ✍ THE COUPLE'S WORDS (`HUB_WORDS_EVENT_COLUMNS` — never gated, except the
  // Love Story's moment cap, which Apply re-asks). The guest page reads every
  // one of them from the event row the host canvas already overlays.
  ...HUB_DRAFT_WORDS_COLUMNS,
] as const;

/** The largest logo a draft accepts — `saveStudioAction`'s own cap. */
export const HUB_DRAFT_LOGO_MAX_BYTES = 400_000;
export type HubDraftEventColumn = (typeof HUB_DRAFT_EVENT_COLUMNS)[number];

export function isHubDraftEventColumn(v: unknown): v is HubDraftEventColumn {
  return typeof v === 'string' && (HUB_DRAFT_EVENT_COLUMNS as readonly string[]).includes(v);
}

export const HUB_SECTION_MODES = ['auto', 'shown', 'hidden'] as const;
export type HubSectionMode = (typeof HUB_SECTION_MODES)[number];

export type HubDraftEvents = Partial<Record<HubDraftEventColumn, unknown>>;

export type HubDraftWidget = {
  mode?: HubSectionMode;
  /** The eye (`toggleWidgetVisibility`). Never Pro — show and hide are the page we write. */
  is_visible?: boolean;
  display_order?: number;
  /** The section's whole canvas, or `null` to take it off. */
  canvas?: HubSectionCanvas | null;
  /**
   * HERO ROW ONLY — the Main background (Maker Phase 10), or `null` to go back
   * to the theme's own. Replaced whole, like the canvas. Dropped on any other
   * section: the page has one Main background, and a second home for it would
   * be a second source of truth.
   */
  main?: HubMainGround | null;
};

export type HubDraftState = {
  events: HubDraftEvents;
  widgets: Partial<Record<WidgetType, HubDraftWidget>>;
};

export type HubDraft = HubDraftState & {
  v: 1;
  /** Earlier states, newest LAST. Undo pops. */
  history: HubDraftState[];
};

export function emptyHubDraft(): HubDraft {
  return { v: 1, events: {}, widgets: {}, history: [] };
}

/* ═══════════════════════════════════════════════════════════════════════════
   SANITISING — every read and every write goes through here
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * One draft value for one column, through the SAME parser that column's live
 * writer uses. `undefined` = unusable, drop the key. `null` = clear the column.
 */
export function sanitizeHubDraftEventValue(
  column: HubDraftEventColumn,
  raw: unknown,
): unknown | undefined {
  if (raw === null) return null;
  switch (column) {
    case 'rsvp_backdrop':
      return parseRsvpBackdropConfig(raw) ?? undefined;
    case 'landing_page_hero_image_url': {
      // `uploadHeroPhoto`'s own rule (an `r2://` ref) AND the guest render's
      // (`siteMediaServeRef`: the one public bucket) — a private ref never lands.
      if (typeof raw !== 'string' || !raw.startsWith('r2://')) return undefined;
      return siteMediaServeRef(raw) === raw ? raw : undefined;
    }
    case 'std_reveal_template':
      return raw === REVEAL_NONE || (typeof raw === 'string' && (REVEAL_TEMPLATE_IDS as readonly string[]).includes(raw))
        ? raw
        : undefined;
    case 'monogram_custom_svg':
      if (typeof raw !== 'string' || raw.length > HUB_DRAFT_LOGO_MAX_BYTES) return undefined;
      return sanitizeStudioSvg(raw) ?? undefined;
    case 'monogram_studio_config':
      return sanitizeStudioConfig(raw) ?? undefined;
    // 🎨 `updateSiteColors`' own parses — a malformed value is dropped, never repaired.
    case 'site_bg_color': {
      // 🌈 Plain hex OR an encoded ombré (`lib/ombre.ts`) — the ONE reader of
      // the column's two shapes, so the draft holds exactly what the live
      // writer would have written.
      const bg = parseSiteBackground(raw);
      return bg ? encodeSiteBackground(bg) : undefined;
    }
    case 'site_button_color':
      return typeof raw === 'string' && HEX6.test(raw.trim()) ? raw.trim().toLowerCase() : undefined;
    case 'site_art_direction':
      return raw === 'candlelight' || raw === 'daylight' ? raw : undefined;
    case 'site_font_key':
      return sanitizeHubFontKey(raw) ?? undefined;
    case 'site_magic_traveller':
      return sanitizeMagicTraveller(raw) ?? undefined;
    // ✍ Words: the writers' own caps (trimmed; '' is "clear" → null).
    case 'special_message':
    case 'what_to_bring':
      return draftText(raw, HUB_DRAFT_TEXT_MAX);
    case 'together_since':
      return draftText(raw, 120);
    case 'love_story':
      return sanitizeDraftLoveStory(raw);
    case 'dress_code_config':
    case 'photo_moments_config':
      // The guest render parses both through its own readers; the draft only
      // holds them to a plain object of a sane size (the live writer is the
      // one the host could already call with the same shape).
      return isPlainObject(raw) && JSON.stringify(raw).length <= HUB_DRAFT_CONFIG_MAX_CHARS ? raw : undefined;
  }
}

const HEX6 = /^#[0-9a-fA-F]{6}$/;

/** `updateSpecialMessage` / `updateWhatToBring` cap each at 600 characters. */
export const HUB_DRAFT_TEXT_MAX = 600;

/** The largest words blob (dress code, camera cues, the Love Story) a draft holds. */
export const HUB_DRAFT_CONFIG_MAX_CHARS = 200_000;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v);

function draftText(raw: unknown, max: number): string | null | undefined {
  if (typeof raw !== 'string') return undefined;
  const t = raw.trim().slice(0, max);
  return t.length > 0 ? t : null;
}

/**
 * `events.love_story` for the draft: a plain object, its moments (when it has
 * them) each through `readMoment` — the fence every guest read already passes
 * (public-bucket photo refs, capped lines) — and no more than `MOMENT_MAX`.
 */
function sanitizeDraftLoveStory(raw: unknown): Record<string, unknown> | undefined {
  if (!isPlainObject(raw) || JSON.stringify(raw).length > HUB_DRAFT_CONFIG_MAX_CHARS) return undefined;
  if (!('moments' in raw)) return raw;
  const list = Array.isArray(raw.moments) ? raw.moments : [];
  const moments = list
    .map((m) => readMoment(m))
    .filter((m): m is LoveStoryMoment => m !== null)
    .slice(0, MOMENT_MAX);
  return { ...raw, moments };
}

function sanitizeWidget(raw: unknown, type: WidgetType): HubDraftWidget | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const out: HubDraftWidget = {};
  if (typeof src.mode === 'string' && (HUB_SECTION_MODES as readonly string[]).includes(src.mode)) {
    out.mode = src.mode as HubSectionMode;
  }
  if (typeof src.is_visible === 'boolean') out.is_visible = src.is_visible;
  if (
    typeof src.display_order === 'number' &&
    Number.isInteger(src.display_order) &&
    src.display_order >= 0 &&
    src.display_order <= 10_000
  ) {
    out.display_order = src.display_order;
  }
  if (src.canvas === null) out.canvas = null;
  else if (src.canvas && typeof src.canvas === 'object' && !Array.isArray(src.canvas)) {
    // `sanitizeHubCanvas` reads either `{canvas:{…}}` or the canvas itself; a
    // stored draft canvas is always the bare canvas, so hand it the bare one.
    out.canvas = sanitizeHubCanvas({ canvas: src.canvas });
  }
  if (type === 'hero' && 'main' in src) {
    if (src.main === null) out.main = null;
    else {
      const main = sanitizeHubMainGround(src.main);
      if (main) out.main = main;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

function sanitizeState(raw: unknown): HubDraftState {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const events: HubDraftEvents = {};
  const rawEvents = src.events && typeof src.events === 'object' && !Array.isArray(src.events)
    ? (src.events as Record<string, unknown>)
    : {};
  for (const col of HUB_DRAFT_EVENT_COLUMNS) {
    if (!(col in rawEvents)) continue;
    const v = sanitizeHubDraftEventValue(col, rawEvents[col]);
    if (v !== undefined) events[col] = v;
  }
  const widgets: HubDraftState['widgets'] = {};
  const rawWidgets = src.widgets && typeof src.widgets === 'object' && !Array.isArray(src.widgets)
    ? (src.widgets as Record<string, unknown>)
    : {};
  for (const [type, value] of Object.entries(rawWidgets)) {
    if (!isWidgetType(type)) continue;
    const w = sanitizeWidget(value, type);
    if (w) widgets[type] = w;
  }
  return { events, widgets };
}

/** Anything → a well-formed draft. Unknown keys and unusable values are dropped. */
export function sanitizeHubDraft(raw: unknown): HubDraft {
  const state = sanitizeState(raw);
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const history = Array.isArray(src.history)
    ? src.history.slice(-HUB_DRAFT_HISTORY_LIMIT).map(sanitizeState)
    : [];
  return { v: 1, ...state, history };
}

/** Does the draft differ from nothing? (Whether it differs from LIVE is `planHubDraftApply`.) */
export function hubDraftHasChanges(d: HubDraftState): boolean {
  return Object.keys(d.events).length > 0 || Object.keys(d.widgets).length > 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SAVE · UNDO
   ═══════════════════════════════════════════════════════════════════════════ */

/** A patch as a writer sends it — the same shape as a state, every part optional. */
export type HubDraftPatch = {
  events?: HubDraftEvents;
  widgets?: Partial<Record<WidgetType, HubDraftWidget>>;
};

const stateOf = (d: HubDraftState): HubDraftState => ({
  events: { ...d.events },
  widgets: Object.fromEntries(
    Object.entries(d.widgets).map(([k, v]) => [k, { ...v }]),
  ) as HubDraftState['widgets'],
});

/**
 * Merge one save into the draft. The state before it goes onto the history so
 * Undo can take it back. A widget's fields merge one by one (a mode save does not
 * forget a canvas already drafted); its canvas is replaced whole, because the
 * writer that sends it has already merged the canvas it read.
 */
export function mergeHubDraft(current: HubDraft, patch: HubDraftPatch): HubDraft {
  const clean = sanitizeState(patch);
  const next = stateOf(current);
  for (const [col, v] of Object.entries(clean.events)) next.events[col as HubDraftEventColumn] = v;
  for (const [type, w] of Object.entries(clean.widgets)) {
    next.widgets[type as WidgetType] = { ...(next.widgets[type as WidgetType] ?? {}), ...w };
  }
  const history = [...current.history, stateOf(current)].slice(-HUB_DRAFT_HISTORY_LIMIT);
  return { v: 1, ...next, history };
}

/** Step back one save. With nothing to go back to, the draft is returned as is. */
export function undoHubDraft(current: HubDraft): HubDraft {
  if (current.history.length === 0) return current;
  const history = current.history.slice(0, -1);
  const prev = current.history[current.history.length - 1]!;
  return { v: 1, ...stateOf(prev), history };
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE HOST'S PREVIEW — the draft laid over the live rows
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The live event row with the draft's columns on top. A NEW object: the row the
 * guest loaders hand around is a `cache()`d value other readers share, so it is
 * never mutated.
 */
export function overlayHubDraftEvent<T extends Record<string, unknown>>(
  row: T,
  draft: HubDraftState | null,
): T {
  if (!draft || Object.keys(draft.events).length === 0) return row;
  return { ...row, ...draft.events };
}

function configWithCanvas(config: unknown, canvas: HubSectionCanvas | null): Record<string, unknown> {
  const base =
    config && typeof config === 'object' && !Array.isArray(config)
      ? { ...(config as Record<string, unknown>) }
      : {};
  if (canvas === null) delete base.canvas;
  else base.canvas = canvas;
  return base;
}

/** `config_json` with the Main background set or taken off; every sibling key kept. */
export function configWithMainGround(config: unknown, main: HubMainGround | null): Record<string, unknown> {
  const base =
    config && typeof config === 'object' && !Array.isArray(config)
      ? { ...(config as Record<string, unknown>) }
      : {};
  if (main === null) delete base[HUB_MAIN_GROUND_KEY];
  else base[HUB_MAIN_GROUND_KEY] = main;
  return base;
}

/** The live widget rows with the draft's mode / order / canvas on top (new objects). */
export function overlayHubDraftWidgets(
  rows: readonly InvitationWidgetRow[],
  draft: HubDraftState | null,
): InvitationWidgetRow[] {
  if (!draft || Object.keys(draft.widgets).length === 0) return [...rows];
  return rows.map((row) => {
    const w = draft.widgets[row.widget_type];
    if (!w) return row;
    let config: unknown = row.config_json;
    if (w.canvas !== undefined) config = configWithCanvas(config, w.canvas);
    if (w.main !== undefined && row.widget_type === 'hero') config = configWithMainGround(config, w.main);
    return {
      ...row,
      ...(w.mode !== undefined && !row.is_always_on ? { mode: w.mode } : {}),
      ...(w.is_visible !== undefined && !row.is_always_on ? { is_visible: w.is_visible } : {}),
      ...(w.display_order !== undefined && !row.is_always_on ? { display_order: w.display_order } : {}),
      ...(config !== row.config_json ? { config_json: config as InvitationWidgetRow['config_json'] } : {}),
    };
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   APPLY — classify every key against LIVE, in a fixed order
   ═══════════════════════════════════════════════════════════════════════════ */

/** What the live page holds, as Apply reads it just before writing. */
export type HubLiveState = {
  events: Partial<Record<HubDraftEventColumn, unknown>>;
  widgets: ReadonlyArray<
    Pick<InvitationWidgetRow, 'widget_id' | 'widget_type' | 'is_always_on' | 'display_order' | 'config_json' | 'mode'> &
      // Optional so a live read from before the eye was draftable still types;
      // absent reads as visible, the column's own default.
      Partial<Pick<InvitationWidgetRow, 'is_visible'>>
  >;
};

export type HubDraftItem =
  | {
      kind: 'event';
      column: HubDraftEventColumn;
      value: unknown;
      change: LookChange;
      /** Would this write need Event Hub Pro for a couple without it? */
      pro: boolean;
    }
  | {
      kind: 'widget';
      widgetType: WidgetType;
      widgetId: string;
      field: 'mode' | 'is_visible' | 'display_order' | 'canvas' | 'main';
      value: unknown;
      change: LookChange;
      pro: boolean;
    };

const asText = (v: unknown): string | null =>
  v === null || v === undefined ? null : typeof v === 'string' ? v : JSON.stringify(v);

/** One `events` column: what the draft's value does to what is live. */
export function eventColumnChange(column: HubDraftEventColumn, live: unknown, next: unknown): LookChange {
  switch (column) {
    case 'rsvp_backdrop': {
      // Classified exactly as `saveRsvpBackdrop` classifies it: theme/intensity.
      const key = (v: unknown) => {
        const c = parseRsvpBackdropConfig(v);
        return c ? `${c.theme}/${c.intensity}` : null;
      };
      return refChange(key(live), key(next));
    }
    case 'landing_page_hero_image_url':
      // Exactly as `uploadHeroPhoto` classifies it (`refChange` on the ref).
      return refChange(siteMediaServeRef(live), siteMediaServeRef(next));
    case 'std_reveal_template':
      // 'none' is a real choice (No reveal), distinct from null (the house
      // default for a Pro couple) — so both are compared as written.
      return refChange(typeof live === 'string' ? live : null, typeof next === 'string' ? next : null);
    case 'monogram_custom_svg':
    case 'monogram_studio_config':
      return refChange(asText(live), asText(next));
    case 'site_art_direction': {
      // Exactly as `siteLookChange` reads it: only Candlelight is a choice;
      // Daylight and "never chosen" are the same page.
      const candle = (v: unknown) => (v === 'candlelight' ? 'candlelight' : null);
      return refChange(candle(live), candle(next));
    }
    case 'site_bg_color':
    case 'site_button_color': {
      const hex = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v.toLowerCase() : null);
      return refChange(hex(live), hex(next));
    }
    default: {
      // The face, the magic move and every words column: compared as written,
      // with '' read as unset (an empty text column renders nothing).
      const norm = (v: unknown) => {
        const t = asText(v);
        return t === '' ? null : t;
      };
      return refChange(norm(live), norm(next));
    }
  }
}

/**
 * Does THIS drafted value need Event Hub Pro to Apply? The one rule per column:
 * a look column (`HUB_LOOK_EVENT_COLUMNS`) when it adds or changes; the reveal
 * when the value is an opening (never "No reveal" or clearing it — both free);
 * the Logo never (its animation is gated where it plays, not where it is saved).
 */
export function eventItemIsPro(
  column: HubDraftEventColumn,
  value: unknown,
  change: LookChange,
  live: unknown = null,
): boolean {
  if (change !== 'add' && change !== 'change') return false;
  if (column === 'std_reveal_template') {
    return !revealTemplateWriteAllowed(typeof value === 'string' ? value : null, false);
  }
  if (column === 'love_story') {
    // 💌 THE ONE MOMENT RULE (`momentCapRefusal`), asked of live → drafted as
    // if the couple did not own Pro: more than five stories, or any photo the
    // live story did not already hold, is Pro. Words alone never are.
    return (
      momentCapRefusal({ before: resolveMoments(live), after: resolveMoments(value), ownsPro: false }) !== null
    );
  }
  if (column === 'site_bg_color') {
    // 🌈 A plain colour is free (owner 2026-09-24). An OMBRÉ is free too unless
    // the one switch in `lib/ombre.ts` says otherwise — then it is tried here
    // and paid at Apply, like every other look.
    return OMBRE_IS_PRO && isOmbreValue(value);
  }
  return eventColumnIsPro(column);
}

/**
 * Is this column the page's LOOK (Pro to add or change)? Read from the one list
 * in `lib/hub-look-pro.ts`, so a free column (a colour) could never be classed
 * Pro here, nor a Pro one free.
 */
export function eventColumnIsPro(column: HubDraftEventColumn): boolean {
  return (HUB_LOOK_EVENT_COLUMNS as readonly string[]).includes(column);
}

/**
 * A section's canvas, live → drafted. Media behind the section (photo or
 * snippet), and media in a template scene's slots, is classified like any
 * other ref; a COLOUR is never an input, so a
 * colour background stays free in every direction; every other look key
 * (crop, arrangement, motion, transition) adds, changes or removes.
 */
export function canvasLookChange(live: HubSectionCanvas, next: HubSectionCanvas): LookChange {
  const mediaRef = (c: HubSectionCanvas) =>
    c.kind !== 'color' && c.media ? `${c.kind ?? 'photo'}:${c.media}` : null;
  const changes: LookChange[] = [refChange(mediaRef(live), mediaRef(next))];
  for (const k of HUB_CANVAS_LOOK_KEYS) {
    if (k === 'media') continue;
    changes.push(refChange(asText(live[k]), asText(next[k])));
  }
  /* 🎬 A TEMPLATE SCENE'S PICTURES AND CLIP PLAYBACK (Maker Phase 5) — the same
     line `saveCustomSection` draws live (`lib/scene-writes.ts`): putting a
     picture or a clip into a slot, or swapping it, is Pro; taking one off is
     not; any non-default playback (tap to play) is Pro, back to Loop is not.
     The template pick and a slot's WORDS are free, so they are not inputs.
     Without these lines a free couple could draft a slot photo and Apply it —
     the gate would see no look key change at all. */
  const slotRef = (c: HubSectionCanvas, i: number) => {
    const s = c.slots?.[i];
    return s?.media ? `${s.kind ?? 'photo'}:${s.media}` : null;
  };
  const slotCount = Math.max(live.slots?.length ?? 0, next.slots?.length ?? 0);
  for (let i = 0; i < slotCount; i += 1) changes.push(refChange(slotRef(live, i), slotRef(next, i)));
  changes.push(refChange(asText(live.video), asText(next.video)));
  return combineChanges(...changes);
}

const liveCanvasOf = (config: unknown): HubSectionCanvas => sanitizeHubCanvas(config);

/**
 * The Main background, live → drafted (Maker Phase 10). All of it is LOOK — the
 * owner's "making media a background is pro", and "Adaptive theme is for PRO":
 * putting their own clip or photo up, swapping it, or changing how the theme
 * follows it (the `tint` toggle) adds or changes; going back to the hero (or
 * the theme's own) removes, which is free.
 *
 * FOLLOWING THE HERO (the default, owner 2026-09-25 item 6) carries no media of
 * its own — the hero photo is gated where the hero is written — so only its
 * measured frame and toggle are compared: the adaptive tint, which is Pro.
 */
export function mainGroundChange(live: HubMainGround | null, next: HubMainGround | null): LookChange {
  const ref = (m: HubMainGround | null) => (m && !isHubMainFollow(m) ? `${m.kind}:${m.media}` : null);
  const poster = (m: HubMainGround | null) => (m && !isHubMainFollow(m) ? (m.poster ?? null) : null);
  const tint = (m: HubMainGround | null) =>
    m ? asText(isHubMainFollow(m) ? { of: m.of, ...m.tint } : (m.tint ?? null)) : null;
  if (!next) return combineChanges(refChange(ref(live), null), refChange(tint(live), null));
  return combineChanges(
    refChange(ref(live), ref(next)),
    refChange(poster(live), poster(next)),
    refChange(tint(live), tint(next)),
  );
}

/**
 * Every key in the draft that differs from live, in THE fixed order Apply writes
 * them: the `events` columns in `HUB_DRAFT_EVENT_COLUMNS` order, then each
 * section in `WIDGET_TYPES` order — mode, then visibility, then order, then canvas. A key equal to
 * what is live is not an item (Apply writes nothing for it).
 *
 * A drafted section with no live row (a custom section that was deleted) is
 * returned in `orphans`, never silently dropped.
 */
export function classifyHubDraft(
  draft: HubDraftState,
  live: HubLiveState,
): { items: HubDraftItem[]; orphans: WidgetType[] } {
  const items: HubDraftItem[] = [];
  for (const column of HUB_DRAFT_EVENT_COLUMNS) {
    if (!(column in draft.events)) continue;
    const value = draft.events[column];
    const change = eventColumnChange(column, live.events[column] ?? null, value);
    // 'none' = what guests see would not change (the classifier compares the
    // same normalised key the render reads), so there is nothing to write.
    if (change === 'none') continue;
    items.push({
      kind: 'event',
      column,
      value,
      change,
      pro: eventItemIsPro(column, value, change, live.events[column] ?? null),
    });
  }
  const orphans: WidgetType[] = [];
  for (const type of WIDGET_TYPES) {
    const w = draft.widgets[type];
    if (!w) continue;
    const row = live.widgets.find((r) => r.widget_type === type);
    if (!row) {
      orphans.push(type);
      continue;
    }
    if (w.mode !== undefined && !row.is_always_on && w.mode !== (row.mode ?? 'auto')) {
      items.push({ kind: 'widget', widgetType: type, widgetId: row.widget_id, field: 'mode', value: w.mode, change: 'change', pro: false });
    }
    if (w.is_visible !== undefined && !row.is_always_on && w.is_visible !== (row.is_visible ?? true)) {
      items.push({ kind: 'widget', widgetType: type, widgetId: row.widget_id, field: 'is_visible', value: w.is_visible, change: 'change', pro: false });
    }
    if (w.display_order !== undefined && !row.is_always_on && w.display_order !== row.display_order) {
      items.push({ kind: 'widget', widgetType: type, widgetId: row.widget_id, field: 'display_order', value: w.display_order, change: 'change', pro: false });
    }
    if (w.main !== undefined && type === 'hero') {
      const liveMain = hubMainGround(row.config_json);
      const nextMain = w.main;
      if (JSON.stringify(liveMain) !== JSON.stringify(nextMain)) {
        const change = mainGroundChange(liveMain, nextMain);
        items.push({
          kind: 'widget',
          widgetType: type,
          widgetId: row.widget_id,
          field: 'main',
          value: nextMain,
          change,
          pro: change === 'add' || change === 'change',
        });
      }
    }
    if (w.canvas !== undefined) {
      const liveCanvas = liveCanvasOf(row.config_json);
      const nextCanvas = w.canvas ?? {};
      if (JSON.stringify(liveCanvas) !== JSON.stringify(nextCanvas)) {
        const change = canvasLookChange(liveCanvas, nextCanvas);
        items.push({
          kind: 'widget',
          widgetType: type,
          widgetId: row.widget_id,
          field: 'canvas',
          value: w.canvas,
          change,
          pro: change === 'add' || change === 'change',
        });
      }
    }
  }
  return { items, orphans };
}

export type HubDraftApplyPlan = {
  /** Written, in this order. */
  apply: HubDraftItem[];
  /** Refused: Pro keys for a couple without Event Hub Pro. They stay in the draft. */
  refused: HubDraftItem[];
  /** The draft that remains after the apply (the refused keys only). */
  remaining: HubDraftState;
  orphans: WidgetType[];
};

/**
 * THE GATE, as a plan. `ownsPro` is measured by the caller (admin-client SKU
 * read, `lookProAllows`); this decides with the one rule, `lookWriteAllowed`.
 * Nothing here can let a Pro key through for a couple who does not own Pro.
 */
export function planHubDraftApply(
  draft: HubDraftState,
  live: HubLiveState,
  ownsPro: boolean,
): HubDraftApplyPlan {
  const { items, orphans } = classifyHubDraft(draft, live);
  const apply: HubDraftItem[] = [];
  const refused: HubDraftItem[] = [];
  for (const item of items) {
    const allowed = item.pro ? lookWriteAllowed(ownsPro, item.change) : true;
    (allowed ? apply : refused).push(item);
  }
  const remaining: HubDraftState = { events: {}, widgets: {} };
  for (const item of refused) {
    if (item.kind === 'event') remaining.events[item.column] = item.value;
    else {
      const w = (remaining.widgets[item.widgetType] ??= {});
      if (item.field === 'canvas') w.canvas = item.value as HubSectionCanvas | null;
      else if (item.field === 'main') w.main = item.value as HubMainGround | null;
    }
  }
  return { apply, refused, remaining, orphans };
}

/** The tables an Apply of these items writes. Only ever these two. */
export function hubDraftWriteTables(items: readonly HubDraftItem[]): Array<'events' | 'invitation_widgets'> {
  const out = new Set<'events' | 'invitation_widgets'>();
  for (const i of items) out.add(i.kind === 'event' ? 'events' : 'invitation_widgets');
  return [...out];
}

/* ═══════════════════════════════════════════════════════════════════════════
   RESET — the page we wrote, for one stage, into the draft
   ═══════════════════════════════════════════════════════════════════════════ */

/** The four stages (`PUBLIC_STAGE_ORDER`'s phases), or the whole Event Hub. */
export const HUB_RESET_SCOPES = ['save_the_date', 'rsvp', 'event', 'editorial', 'all'] as const;
export type HubResetScope = (typeof HUB_RESET_SCOPES)[number];

export function isHubResetScope(v: unknown): v is HubResetScope {
  return typeof v === 'string' && (HUB_RESET_SCOPES as readonly string[]).includes(v);
}

/**
 * The order every event is seeded with (migration
 * `20270919679722_invitation_widget_seed_16_reconcile.sql`: hero = 1 … our_love_story
 * = 16), which is `WIDGET_TYPES`' own order for the sixteen shipped sections.
 */
export function seededDisplayOrder(type: WidgetType): number | null {
  if (isCustomSectionType(type)) return null;
  const i = (WIDGET_TYPES as readonly string[]).indexOf(type);
  return i >= 0 ? i + 1 : null;
}

/** The `events` columns Reset 'all' clears. The made-once group is never here. */
export const HUB_RESET_EVENT_COLUMNS: readonly HubDraftEventColumn[] = ['rsvp_backdrop'];

/** Stage-specific `events` look columns. Site-wide ones reset only with 'all'. */
const STAGE_EVENT_COLUMNS: Record<Exclude<HubResetScope, 'all'>, HubDraftEventColumn[]> = {
  save_the_date: [],
  rsvp: ['rsvp_backdrop'],
  event: [],
  editorial: [],
};

/**
 * What Reset never touches — shown in its confirm, and asserted by the tests on
 * the PLAN (the tables it would write), not on this prose.
 */
export const HUB_RESET_NEVER_TOUCHES = [
  'your guest list and their replies',
  'your schedule',
  'your photos and galleries',
  'orders and payments',
  'your Post Event story',
  'your Event Hub address and who can view it',
  'sections you wrote yourself',
] as const;

/**
 * The page we wrote for one stage, as a draft patch: every shipped section that
 * appears in that stage goes back to Auto, its seeded place and no canvas; the
 * stage's own look column is cleared. The couple's own sections (custom_1..6) are
 * their words and are left exactly as they are. Always-on sections keep their
 * fixed place — only their canvas is reset.
 */
export function hubResetPatch(scope: HubResetScope): HubDraftPatch {
  const widgets: HubDraftPatch['widgets'] = {};
  for (const type of WIDGET_TYPES) {
    if (isCustomSectionType(type)) continue;
    if (scope !== 'all' && !WIDGET_PHASES[type].includes(scope as LifecyclePhase)) continue;
    const order = seededDisplayOrder(type);
    widgets[type] = { mode: 'auto', canvas: null, ...(order !== null ? { display_order: order } : {}) };
  }
  // 'all' resets the stage LOOK columns only — never the hero photo, the reveal
  // or the Logo: those are the couple's own made-once choices ("your photos",
  // HUB_RESET_NEVER_TOUCHES), and Reset is "the page we wrote", not an eraser.
  const columns = scope === 'all' ? [...HUB_RESET_EVENT_COLUMNS] : STAGE_EVENT_COLUMNS[scope];
  const events: HubDraftEvents = {};
  for (const c of columns) events[c] = null;
  return { events, widgets };
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE BAR'S SUMMARY
   ═══════════════════════════════════════════════════════════════════════════ */

export type HubDraftSummary = {
  /** A draft row exists and differs from live. */
  hasChanges: boolean;
  /** Keys that differ from live. */
  changeCount: number;
  /** Of those, how many need Event Hub Pro to Apply (0 for an owning couple). */
  proCount: number;
  canUndo: boolean;
};

export function summarizeHubDraft(draft: HubDraft | null, live: HubLiveState, ownsPro: boolean): HubDraftSummary {
  if (!draft) return { hasChanges: false, changeCount: 0, proCount: 0, canUndo: false };
  const plan = planHubDraftApply(draft, live, ownsPro);
  const changeCount = plan.apply.length + plan.refused.length;
  return {
    hasChanges: changeCount > 0,
    changeCount,
    proCount: plan.refused.length,
    canUndo: draft.history.length > 0,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE ONE ACTION'S VOCABULARY (types only — a 'use server' file exports only
   async functions, so its shapes live here)
   ═══════════════════════════════════════════════════════════════════════════ */

export const HUB_DRAFT_INTENTS = ['save', 'apply', 'restore', 'reset', 'undo'] as const;
export type HubDraftIntent = (typeof HUB_DRAFT_INTENTS)[number];

export function isHubDraftIntent(v: unknown): v is HubDraftIntent {
  return typeof v === 'string' && (HUB_DRAFT_INTENTS as readonly string[]).includes(v);
}

/** Why Apply held a key back. */
export type HubDraftRefusal = 'needs_pro' | 'apply_on_the_web' | 'not_your_photo' | 'empty_section' | 'missing_section';

export type HubDraftActionResult =
  | {
      ok: true;
      intent: HubDraftIntent;
      /** Keys written to the live page (apply only). */
      applied: number;
      /** Keys held back, each with a sentence-ready label and a reason (apply only). */
      held: Array<{ label: string; reason: HubDraftRefusal }>;
    }
  | { ok: false; intent: HubDraftIntent | null; error: string };

/** A sentence-ready name for each draftable `events` column. */
export const HUB_DRAFT_EVENT_LABEL: Record<HubDraftEventColumn, string> = {
  rsvp_backdrop: 'The RSVP backdrop',
  landing_page_hero_image_url: 'Your hero photo',
  std_reveal_template: 'Your reveal',
  monogram_custom_svg: 'Your logo',
  monogram_studio_config: 'Your logo design',
  site_bg_color: 'Your background colour',
  site_button_color: 'Your button colour',
  site_art_direction: 'Candlelight',
  site_font_key: 'Your typeface',
  site_magic_traveller: 'Magic move',
  special_message: 'Your special message',
  what_to_bring: 'What to bring',
  love_story: 'Your Love Story',
  together_since: 'Together since',
  dress_code_config: 'Your dress code',
  photo_moments_config: 'Your camera cues',
};

/** A sentence-ready name for one draft key. */
export function hubDraftItemLabel(item: HubDraftItem, sectionLabel: (t: WidgetType) => string): string {
  if (item.kind === 'event') return HUB_DRAFT_EVENT_LABEL[item.column];
  if (item.field === 'main') return 'Behind every scene';
  const what =
    item.field === 'mode' || item.field === 'is_visible'
      ? 'shown or hidden'
      : item.field === 'display_order'
        ? 'its place'
        : 'how it looks';
  return `${sectionLabel(item.widgetType)} · ${what}`;
}
