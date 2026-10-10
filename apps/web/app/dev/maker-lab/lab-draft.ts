import {
  HUB_DRAFT_TOO_LARGE_MESSAGE,
  emptyHubDraft,
  hubDraftForWrite,
  hubResetPatch,
  isHubDraftIntent,
  isHubResetScope,
  mergeHubDraft,
  overlayHubDraftWidgets,
  sanitizeHubDraft,
  summarizeHubDraft,
  undoHubDraft,
  type HubDraft,
  type HubDraftActionResult,
  type HubDraftBarLive,
  type HubDraftPatch,
  type HubDraftState,
  type HubDraftSummary,
  type HubLiveState,
} from '@/lib/hub-draft';
import { hubDraftChangeLines } from '@/lib/hub-draft-change-lines';
import { hubDraftProEffects, hubProEffectView } from '@/lib/hub-pro-effects';
import type { InvitationWidgetRow, WidgetType } from '@/lib/invitation-widgets';
import { LAB_EDITORIAL_COOKIE } from './lab-post-event';
import { labScrubCanvases, labWidgetsCookie } from './lab-scrub';

/**
 * 🧪 THE MAKER LAB'S DRAFT — THE REAL DRAFT'S OWN REDUCERS, ON A DRAFT THE BROWSER KEEPS
 * (DEV-ONLY — `/dev/maker-lab`; production 404s the lab).
 *
 * Owner, 2026-10-11, after a tester walked the whole Maker in this lab: *"always, feeling almost done. but when we
 * check so many problems."* The walk's two blockers were the lab's own: its stand-in for the draft counted calls
 * (`labChanges += 1`) and kept a scene's canvas in a cookie — it had NO undo, NO order, NO remove, and it forgot its
 * count on every render. So ↺, Earlier · Later · Remove and ＋ could not be walked by anybody without a signed-in
 * event, and the ✓ count read 0 by itself (P01 · P02 · P05 of `hub-walk/maker/REPORT.md`).
 *
 * This is the lab's draft, done the way a signed-in couple's is — by the SAME functions, never a second copy of
 * them (`website/hub-draft-actions.ts` is the door they stand behind for a real event):
 *
 *   save     `mergeHubDraft`        — the state before goes onto `history`
 *   undo     `undoHubDraft`         — one state back
 *   restore  `emptyHubDraft`        — the draft thrown away
 *   reset    `hubResetPatch` merged — into the draft, undoable
 *   the ✓    `summarizeHubDraft`    — keys that DIFFER FROM LIVE (Fade on, then off, is no change)
 *   the page `overlayHubDraftWidgets` — a scene's place, its eye and its Auto · Hidden laid over the sample's rows
 *
 * 🔑 WHERE IT IS KEPT. The whole draft (its Undo history included) is the browser's (`localStorage`, by the caller);
 * the lab's two pages are drawn by the server, so the draft's STATE is handed to them in the lab's cookies
 * (`labDraftCookies`) — written afresh from the state after every step, so an Undo takes back what the page shows
 * too. No write leaves the browser. Apply answers that the sample cannot go live: the lab has no live page.
 *
 * Pure. No DOM, no I/O — `lab-draft.test.ts` runs it bare.
 */

const EVENT = '00000000-0000-4000-8000-000000000000';

/** maria-and-jose's section rows, as production holds them (order · always-on), read 2026-10-05. */
const MJ_ROWS: ReadonlyArray<[WidgetType, boolean]> = [
  ['hero', true],
  ['greeting', true],
  ['qr_card', true],
  ['event_details', false],
  ['countdown', false],
  ['schedule', false],
  ['rsvp', true],
  ['venue_map', false],
  ['dress_code', false],
  ['photo_moments', false],
  ['your_photos', false],
  ['tier_comparison', false],
  ['special_message', false],
  ['what_to_bring', false],
  ['our_photos', false],
  ['our_love_story', false],
];

/** The sample's LIVE rows — what guests of the sample would see with no draft at all. */
export function labRows(): InvitationWidgetRow[] {
  const now = '2026-10-05T00:00:00Z';
  return MJ_ROWS.map(([type, alwaysOn], i) => ({
    widget_id: `w-${type}`,
    event_id: EVENT,
    widget_type: type,
    display_order: i + 1,
    is_visible: true,
    is_always_on: alwaysOn,
    tier: 'basic',
    config_json: {},
    created_at: now,
    updated_at: now,
    mode: 'auto',
  }));
}

/** What the draft is compared against: the sample's rows — on the Scrub chain (`?scrub=1`), wearing the chain's start. */
export function labLive(scrub: boolean): HubLiveState {
  const start = labScrubCanvases(scrub, {});
  return {
    events: {},
    widgets: labRows().map((r) => (start[r.widget_type] ? { ...r, config_json: { canvas: start[r.widget_type] } as InvitationWidgetRow['config_json'] } : r)),
  };
}

/** The ✓ bar for the lab's draft — the SAME summary, named changes and Pro effects the real save answers with. */
export function labDraftBar(draft: HubDraft, scrub: boolean): HubDraftBarLive {
  const live = labLive(scrub);
  return {
    free: { ...summarizeHubDraft(draft, live, false), changes: hubDraftChangeLines(draft, live, false) },
    owned: { ...summarizeHubDraft(draft, live, true), changes: hubDraftChangeLines(draft, live, true) },
    proEffects: hubDraftProEffects(draft, live, false).map(hubProEffectView),
    priceLabel: null,
  };
}

/** The sample cannot go live — said in the bar's own line, never a silent nothing. */
export const LAB_APPLY_MESSAGE = 'This is the sample event — nothing here goes live. Your changes stay in the draft.';

/**
 * ONE STEP OF THE DRAFT, answered as `hubDraftAction` answers (`HubDraftActionResult`). `fields` are the form's own
 * (`intent`, `patch`, `stage`, `bar`). A step that is refused returns the draft it was given.
 */
export function labDraftStep(
  current: HubDraft,
  fields: { intent?: unknown; patch?: unknown; stage?: unknown; bar?: unknown },
  scrub: boolean,
): { draft: HubDraft; result: HubDraftActionResult } {
  const intent = isHubDraftIntent(fields.intent) ? fields.intent : null;
  if (!intent) return { draft: current, result: { ok: false, intent, error: 'That did not look like an Event Hub change.' } };
  const done = (draft: HubDraft, withBar = false): { draft: HubDraft; result: HubDraftActionResult } => {
    let fitted: HubDraft;
    try {
      /* The one door every real draft write passes (`writeHubDraft`): the oldest Undo states go until it fits. */
      fitted = hubDraftForWrite(draft);
    } catch {
      return { draft: current, result: { ok: false, intent, error: HUB_DRAFT_TOO_LARGE_MESSAGE } };
    }
    return { draft: fitted, result: { ok: true, intent, applied: 0, held: [], ...(withBar ? { bar: labDraftBar(fitted, scrub) } : {}) } };
  };
  if (intent === 'restore') return done(emptyHubDraft());
  if (intent === 'undo') return done(undoHubDraft(current));
  if (intent === 'reset') {
    if (!isHubResetScope(fields.stage)) return { draft: current, result: { ok: false, intent, error: 'Choose which stage to reset.' } };
    return done(mergeHubDraft(current, hubResetPatch(fields.stage)));
  }
  if (intent === 'save') {
    let patch: HubDraftPatch;
    try {
      patch = JSON.parse(String(fields.patch ?? '{}')) as HubDraftPatch;
    } catch {
      return { draft: current, result: { ok: false, intent, error: 'That change could not be read.' } };
    }
    /* ⚡ The bar comes back with the save only when the save asked for it (`HUB_DRAFT_BAR_FIELD`) — as the real one. */
    return done(mergeHubDraft(current, patch), fields.bar === '1');
  }
  /* apply · drop · date_change need a live page, an order, a booked supplier: the sample has none. */
  return { draft: current, result: { ok: false, intent, error: LAB_APPLY_MESSAGE } };
}

/** A stored draft, read back through the real sanitiser — anything unreadable is no draft. */
export function labDraftFrom(stored: string | null | undefined): HubDraft {
  if (!stored) return emptyHubDraft();
  try {
    return sanitizeHubDraft(JSON.parse(stored));
  } catch {
    return emptyHubDraft();
  }
}

/* ── the draft's state, handed to the lab's two server-drawn pages ─────────────────────────────────────────────── */

/** A scene's place, eye and Auto · Hidden — the part of the draft the lab kept nowhere before (P02). */
export const LAB_ROWS_COOKIE = 'lab_rows';
/** The draft's summary as the lab's "server" reports it on a render (P05: it reported 0, always). */
export const LAB_BAR_COOKIE = 'lab_bar';

const json = (v: unknown) => encodeURIComponent(JSON.stringify(v));
const some = (o: Record<string, unknown>) => Object.keys(o).length > 0;

/**
 * THE LAB'S COOKIES FOR A DRAFT — every one, written from the STATE (never from the last patch), `null` = cleared.
 * So an Undo, a Restore and a Reset take back what the pages draw, exactly as they take back the draft.
 */
export function labDraftCookies(draft: HubDraft, scrub: boolean): Record<string, string | null> {
  const canvases: Record<string, unknown> = {};
  const rows: Record<string, unknown> = {};
  for (const [type, w] of Object.entries(draft.widgets)) {
    if (!w) continue;
    if (w.canvas !== undefined) canvases[type] = w.canvas ?? {};
    const row = {
      ...(w.mode !== undefined ? { mode: w.mode } : {}),
      ...(w.is_visible !== undefined ? { is_visible: w.is_visible } : {}),
      ...(w.display_order !== undefined ? { display_order: w.display_order } : {}),
      ...(w.stage_order !== undefined ? { stage_order: w.stage_order } : {}),
    };
    if (some(row)) rows[type] = row;
  }
  const hero = draft.widgets.hero;
  const prefs = (draft.events.style_preferences ?? null) as { camera_look?: unknown; block_looks?: unknown } | null;
  const styles = Object.fromEntries(Object.entries(draft.fixedStyles ?? {}).filter(([, v]) => v !== null));
  const bar = summarizeHubDraft(draft, labLive(scrub), false);
  return {
    [labWidgetsCookie(scrub)]: some(canvases) ? json(canvases) : null,
    [LAB_ROWS_COOKIE]: some(rows) ? json(rows) : null,
    lab_main: hero && 'main' in hero ? json(hero.main ?? null) : null,
    lab_styles: some(styles) ? json(styles) : null,
    lab_camera: typeof prefs?.camera_look === 'string' ? prefs.camera_look : null,
    lab_blocks: prefs?.block_looks && typeof prefs.block_looks === 'object' ? json(prefs.block_looks) : null,
    [LAB_EDITORIAL_COOKIE]: draft.editorial && some(draft.editorial) ? json(draft.editorial) : null,
    [LAB_BAR_COOKIE]: bar.hasChanges || bar.canUndo ? json({ n: bar.changeCount, pro: bar.proCount, undo: bar.canUndo }) : null,
  };
}

/** The lab's "server" summary — the count the draft bar is drawn with on a render (`LAB_BAR_COOKIE`). */
export function labBarFromCookie(value: string | undefined): HubDraftSummary {
  const none: HubDraftSummary = { hasChanges: false, changeCount: 0, proCount: 0, canUndo: false };
  if (!value) return none;
  try {
    const v = JSON.parse(decodeURIComponent(value)) as { n?: unknown; pro?: unknown; undo?: unknown };
    const n = typeof v.n === 'number' && Number.isFinite(v.n) ? Math.max(0, Math.floor(v.n)) : 0;
    const pro = typeof v.pro === 'number' && Number.isFinite(v.pro) ? Math.max(0, Math.floor(v.pro)) : 0;
    return { hasChanges: n > 0, changeCount: n, proCount: pro, canUndo: v.undo === true };
  } catch {
    return none;
  }
}

/** The drafted places, eyes and modes (`LAB_ROWS_COOKIE`) as a draft state — read through the real sanitiser. */
export function labRowsDraft(value: string | undefined): HubDraftState | null {
  if (!value) return null;
  try {
    const widgets = JSON.parse(decodeURIComponent(value)) as unknown;
    const state = sanitizeHubDraft({ widgets });
    return Object.keys(state.widgets).length > 0 ? state : null;
  } catch {
    return null;
  }
}

/** The sample's rows as the Maker and its canvas read them: the draft's place · eye · mode laid over (the real overlay). */
export function labDraftedRows(value: string | undefined): InvitationWidgetRow[] {
  return overlayHubDraftWidgets(labRows(), labRowsDraft(value));
}
