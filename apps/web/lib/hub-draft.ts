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
 * events  — `rsvp_backdrop` only, sanitised through the SAME parser its live
 *           writer and the guest render use. The rule for joining this list is
 *           "the host's preview can SHOW it": the page colours, face and art
 *           direction are painted by `app/[slug]/layout.tsx` (`loadGuestLook`),
 *           which cannot see `?editor=1`, so a drafted colour would be a save the
 *           preview never shows — they stay live-writing until the layout can
 *           overlay a draft. Media columns (hero photo/video, music, gallery) are
 *           not here either: their writers also verify the file is this event's
 *           and was screened, and draft media is the open owner decision D6.
 * widgets — per section: `mode` (Auto · Shown · Hidden), `is_visible` (the
 *           navigator's eye — the legacy gate `mode: 'auto'` falls back to),
 *           `display_order`, and the section's whole `canvas` (background, crop,
 *           motion, transition),
 *           sanitised by `sanitizeHubCanvas` — the same function the guest render
 *           reads through. `canvas: null` means "take the canvas off".
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
import { sanitizeHubCanvas, type HubSectionCanvas } from '@/lib/hub-canvas';
import {
  HUB_CANVAS_LOOK_KEYS,
  HUB_LOOK_EVENT_COLUMNS,
  combineChanges,
  lookWriteAllowed,
  refChange,
  type LookChange,
} from '@/lib/hub-look-pro';
import { parseRsvpBackdropConfig } from '@/lib/spatial-backdrop';

/** The form field that sends an existing Event Hub writer's save to the draft. */
export const HUB_DRAFT_FIELD = 'draft';

/** How many earlier states Undo can walk back through. */
export const HUB_DRAFT_HISTORY_LIMIT = 10;

/* ═══════════════════════════════════════════════════════════════════════════
   THE SHAPE
   ═══════════════════════════════════════════════════════════════════════════ */

/** The `events` columns a draft may hold. See the file note for why only these. */
export const HUB_DRAFT_EVENT_COLUMNS = ['rsvp_backdrop'] as const;
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
  switch (column) {
    case 'rsvp_backdrop':
      if (raw === null) return null;
      return parseRsvpBackdropConfig(raw) ?? undefined;
  }
}

function sanitizeWidget(raw: unknown): HubDraftWidget | null {
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
    const w = sanitizeWidget(value);
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

/** The live widget rows with the draft's mode / order / canvas on top (new objects). */
export function overlayHubDraftWidgets(
  rows: readonly InvitationWidgetRow[],
  draft: HubDraftState | null,
): InvitationWidgetRow[] {
  if (!draft || Object.keys(draft.widgets).length === 0) return [...rows];
  return rows.map((row) => {
    const w = draft.widgets[row.widget_type];
    if (!w) return row;
    return {
      ...row,
      ...(w.mode !== undefined && !row.is_always_on ? { mode: w.mode } : {}),
      ...(w.is_visible !== undefined && !row.is_always_on ? { is_visible: w.is_visible } : {}),
      ...(w.display_order !== undefined && !row.is_always_on ? { display_order: w.display_order } : {}),
      ...(w.canvas !== undefined ? { config_json: configWithCanvas(row.config_json, w.canvas) } : {}),
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
      field: 'mode' | 'is_visible' | 'display_order' | 'canvas';
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
  }
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
 * snippet) is classified like any other ref; a COLOUR is never an input, so a
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
  return combineChanges(...changes);
}

const liveCanvasOf = (config: unknown): HubSectionCanvas => sanitizeHubCanvas(config);

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
      pro: eventColumnIsPro(column) && (change === 'add' || change === 'change'),
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
  const columns = scope === 'all' ? [...HUB_DRAFT_EVENT_COLUMNS] : STAGE_EVENT_COLUMNS[scope];
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

/** A sentence-ready name for one draft key. */
export function hubDraftItemLabel(item: HubDraftItem, sectionLabel: (t: WidgetType) => string): string {
  if (item.kind === 'event') return 'The RSVP backdrop';
  const what =
    item.field === 'mode' || item.field === 'is_visible'
      ? 'shown or hidden'
      : item.field === 'display_order'
        ? 'its place'
        : 'how it looks';
  return `${sectionLabel(item.widgetType)} · ${what}`;
}
