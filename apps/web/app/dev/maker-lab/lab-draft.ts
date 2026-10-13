import { hubDraftStamp, hubDraftUndoMatched } from '@/lib/hub-draft-stamp';
import {
  HUB_DRAFT_TOO_LARGE_MESSAGE,
  emptyHubDraft,
  hubDraftCountedChanges,
  hubDraftForWrite,
  hubDraftItemLabel,
  hubResetPatch,
  isHubDraftIntent,
  isHubResetScope,
  mergeHubDraft,
  overlayHubDraftWidgets,
  planHubDraftApply,
  sanitizeHubDraft,
  summarizeHubDraft,
  undoHubDraft,
  type HubDraft,
  type HubDraftActionResult,
  type HubDraftBarLive,
  type HubDraftWidget,
  type HubDraftPatch,
  type HubDraftState,
  type HubDraftSummary,
  type HubLiveState,
} from '@/lib/hub-draft';
import { hubDraftChangeLines } from '@/lib/hub-draft-change-lines';
import { hubDraftProEffects, hubProEffectView } from '@/lib/hub-pro-effects';
import { makerSceneLabel } from '@/lib/maker-scene-list';
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
 * too. No write leaves the browser.
 *
 * 📣 A PUBLISHED STATE UNDER THE DRAFT (2026-10-11). The owner ran the new Maker on his real event and hit four faults
 * no lab walk had: every walk here had NOTHING published — a draft over an untouched sample — so a hide that was
 * already live, then ＋, could not happen. ✓ Apply now PUBLISHES in the lab: the real planner (`planHubDraftApply`)
 * decides what goes, it is folded into the lab's own published state (`published`, the browser's — a draft state laid
 * over the sample's rows), and the draft is left with what Apply held back and no Undo history, as the real action
 * leaves it. Everything after reads the draft AGAINST that published state (`labLive`), and the pages are drawn from
 * both. Still no database: "live" here is this browser's.
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

/**
 * ✍ `lab_own=1` (a cookie the WALK sets — nothing in the lab writes it): the sample ALSO holds one scene of the
 * couple's own (`custom_1`, a heading and their words), last on the page. The sample had none, so the one path that
 * must never be silent — a scene of their own dropped on the bin opens "Delete this scene?" and deletes nothing
 * (`add-part-sheet.tsx` `takeOff`) — could not be walked (2026-10-11 → 12). Read by the lab's two server pages only;
 * without the cookie the sample is maria-and-jose's rows exactly, as before.
 */
export const LAB_OWN_COOKIE = 'lab_own';
/** The lab's one scene of the couple's own — what they wrote. */
export const LAB_OWN_SCENE = { type: 'custom_1', config: { title: 'A note from us', body: 'We wrote this part ourselves — it is not one of the scenes Setnayan gives a page.' } } as const;

/** The sample's LIVE rows — what guests of the sample would see with no draft at all (`own`: see `LAB_OWN_COOKIE`). */
export function labRows(own = false): InvitationWidgetRow[] {
  const now = '2026-10-05T00:00:00Z';
  const types: ReadonlyArray<[WidgetType, boolean, InvitationWidgetRow['config_json']]> = [
    ...MJ_ROWS.map(([type, alwaysOn]) => [type, alwaysOn, {}] as [WidgetType, boolean, InvitationWidgetRow['config_json']]),
    ...(own ? [[LAB_OWN_SCENE.type as WidgetType, false, LAB_OWN_SCENE.config as InvitationWidgetRow['config_json']] as [WidgetType, boolean, InvitationWidgetRow['config_json']]] : []),
  ];
  return types.map(([type, alwaysOn, config], i) => ({
    widget_id: `w-${type}`,
    event_id: EVENT,
    widget_type: type,
    display_order: i + 1,
    is_visible: true,
    is_always_on: alwaysOn,
    tier: 'basic',
    config_json: config,
    created_at: now,
    updated_at: now,
    mode: 'auto',
  }));
}

/** What the draft is compared against: the sample's rows — on the Scrub chain (`?scrub=1`), wearing the chain's start. */
/** A draft STATE with nothing in it — the lab with nothing published. */
const noState = (): HubDraftState => ({ events: {}, widgets: {} });
const stateOf = ({ history: _history, v: _v, ...state }: HubDraft): HubDraftState => state;
const asDraft = (state: HubDraftState | null | undefined): HubDraft => ({ v: 1, ...(state ?? noState()), history: [] });

/** `over` laid on `under` by the real merge (a widget's fields one by one, a stage's place and show stage by stage). */
function layState(under: HubDraftState | null | undefined, over: HubDraftState): HubDraftState {
  return stateOf(mergeHubDraft(asDraft(under), over as HubDraftPatch));
}

/**
 * What the draft is compared against: the sample's rows — on the Scrub chain (`?scrub=1`), wearing the chain's start
 * — with what the lab has PUBLISHED laid over them, by the page's own overlay.
 */
export function labLive(scrub: boolean, published: HubDraftState | null = null): HubLiveState {
  const start = labScrubCanvases(scrub, {});
  const sample = labRows().map((r) => (start[r.widget_type] ? { ...r, config_json: { canvas: start[r.widget_type] } as InvitationWidgetRow['config_json'] } : r));
  if (!published) return { events: {}, widgets: sample };
  const styles = Object.fromEntries(Object.entries(published.fixedStyles ?? {}).filter(([, v]) => v !== null));
  return {
    events: { ...published.events },
    widgets: overlayHubDraftWidgets(sample, published),
    ...(published.editorial ? { editorial: published.editorial } : {}),
    ...(Object.keys(styles).length > 0 ? { fixedStyles: styles as HubLiveState['fixedStyles'] } : {}),
  };
}

/** The ✓ bar for the lab's draft — the SAME summary, named changes and Pro effects the real save answers with. */
export function labDraftBar(draft: HubDraft, scrub: boolean, published: HubDraftState | null = null): HubDraftBarLive {
  const live = labLive(scrub, published);
  return {
    free: { ...summarizeHubDraft(draft, live, false), changes: hubDraftChangeLines(draft, live, false) },
    owned: { ...summarizeHubDraft(draft, live, true), changes: hubDraftChangeLines(draft, live, true) },
    proEffects: hubDraftProEffects(draft, live, false).map(hubProEffectView),
    priceLabel: null,
  };
}

/** The bar a RENDER of the lab is drawn with — the count AND its named lines, as the real render's bar carries them. */
export function labRenderedSummary(draft: HubDraft, scrub: boolean, published: HubDraftState | null = null): HubDraftSummary {
  return labDraftBar(draft, scrub, published).free;
}

/** A stored published state, read back through the real sanitiser — anything unreadable is nothing published. */
export function labPublishedFrom(stored: string | null | undefined): HubDraftState | null {
  if (!stored) return null;
  try {
    const state = stateOf(sanitizeHubDraft(JSON.parse(stored)));
    return Object.keys(state.events).length + Object.keys(state.widgets).length + Object.keys(state.editorial ?? {}).length + Object.keys(state.fixedStyles ?? {}).length > 0 ? state : null;
  } catch {
    return null;
  }
}

/** `state` without the keys Apply HELD BACK (`remaining`) — what actually went live. */
function withoutHeld(state: HubDraftState, held: HubDraftState): HubDraftState {
  const events = Object.fromEntries(Object.entries(state.events).filter(([k]) => !(k in held.events))) as HubDraftState['events'];
  const widgets: HubDraftState['widgets'] = {};
  for (const [type, w] of Object.entries(state.widgets)) {
    if (!w) continue;
    const heldW = (held.widgets[type as WidgetType] ?? {}) as Record<string, unknown>;
    const kept = Object.fromEntries(Object.entries(w).filter(([k]) => !(k in heldW)));
    if (Object.keys(kept).length > 0) widgets[type as WidgetType] = kept as HubDraftWidget;
  }
  const editorial = Object.fromEntries(Object.entries(state.editorial ?? {}).filter(([k]) => !(k in (held.editorial ?? {}))));
  const fixedStyles = Object.fromEntries(Object.entries(state.fixedStyles ?? {}).filter(([k]) => !(k in (held.fixedStyles ?? {}))));
  return {
    events,
    widgets,
    ...(Object.keys(editorial).length > 0 ? { editorial: editorial as HubDraftState['editorial'] } : {}),
    ...(Object.keys(fixedStyles).length > 0 ? { fixedStyles: fixedStyles as HubDraftState['fixedStyles'] } : {}),
  };
}

/** What the sample cannot do at all (take one Pro effect off, ask a booked supplier to move a date) — said, never silent. */
export const LAB_APPLY_MESSAGE = 'This is the sample event — that needs a real event. Your changes stay in the draft.';

/**
 * ONE STEP OF THE DRAFT, answered as `hubDraftAction` answers (`HubDraftActionResult`). `fields` are the form's own
 * (`intent`, `patch`, `stage`, `bar`). A step that is refused returns the draft it was given.
 */
export function labDraftStep(
  current: HubDraft,
  fields: { intent?: unknown; patch?: unknown; stage?: unknown; bar?: unknown; expect?: unknown },
  scrub: boolean,
  /** What the lab has published so far (`labPublishedFrom`) — null: nothing. Changed only by `apply`. */
  published: HubDraftState | null = null,
): { draft: HubDraft; result: HubDraftActionResult; published: HubDraftState | null } {
  const intent = isHubDraftIntent(fields.intent) ? fields.intent : null;
  if (!intent) return { draft: current, published, result: { ok: false, intent, error: 'That did not look like an Event Hub change.' } };
  const done = (draft: HubDraft, withBar = false): { draft: HubDraft; result: HubDraftActionResult; published: HubDraftState | null } => {
    let fitted: HubDraft;
    try {
      /* The one door every real draft write passes (`writeHubDraft`): the oldest Undo states go until it fits. */
      fitted = hubDraftForWrite(draft);
    } catch {
      return { draft: current, published, result: { ok: false, intent, error: HUB_DRAFT_TOO_LARGE_MESSAGE } };
    }
    /* ↺ …with the stamp of the state it left, as the real action answers (`lib/hub-draft-stamp.ts`). */
    return { draft: fitted, published, result: { ok: true, intent, applied: 0, held: [], ...(withBar ? { bar: labDraftBar(fitted, scrub, published) } : {}), ...(intent === 'restore' ? {} : { stamp: hubDraftStamp(fitted) }) } };
  };
  if (intent === 'restore') return done(emptyHubDraft());
  /* ↺ Undo and Reset answer with the bar when asked — as the real action (`answerWithBar`). */
  if (intent === 'undo') {
    /* ↺ A drawn undo says the state it expects to step back from — answered `matched`, as the real action does. */
    const matched = hubDraftUndoMatched(current, fields.expect);
    const step = done(undoHubDraft(current), fields.bar === '1');
    return matched === undefined || !step.result.ok ? step : { ...step, result: { ...step.result, matched } };
  }
  if (intent === 'reset') {
    if (!isHubResetScope(fields.stage)) return { draft: current, published, result: { ok: false, intent, error: 'Choose which stage to reset.' } };
    return done(mergeHubDraft(current, hubResetPatch(fields.stage)), fields.bar === '1');
  }
  if (intent === 'save') {
    let patch: HubDraftPatch;
    try {
      patch = JSON.parse(String(fields.patch ?? '{}')) as HubDraftPatch;
    } catch {
      return { draft: current, published, result: { ok: false, intent, error: 'That change could not be read.' } };
    }
    /* ⚡ The bar comes back with the save only when the save asked for it (`HUB_DRAFT_BAR_FIELD`) — as the real one. */
    return done(mergeHubDraft(current, patch), fields.bar === '1');
  }
  if (intent === 'apply') {
    /* ✓ APPLY PUBLISHES — IN THE LAB. The real planner decides, against what is published now: what is written, what a
       couple without Event Hub Pro is held on. What went is folded into the lab's published state by the real merge;
       the draft keeps only what was held, and no Undo history — as the real action leaves it. (A held scene's FREE
       part is not split out here: the whole scene waits. The lab's one shortcut.) */
    const plan = planHubDraftApply(current, labLive(scrub, published), false);
    const went = withoutHeld(stateOf(current), plan.remaining);
    const next = layState(published, went);
    const some = Object.keys(next.events).length + Object.keys(next.widgets).length + Object.keys(next.editorial ?? {}).length + Object.keys(next.fixedStyles ?? {}).length > 0;
    return {
      draft: { v: 1, ...plan.remaining, history: [] },
      published: some ? next : null,
      result: {
        ok: true,
        intent,
        applied: hubDraftCountedChanges({ ...plan, refused: [] }).length,
        held: plan.refused.map((item) => ({ label: hubDraftItemLabel(item, makerSceneLabel), reason: 'needs_pro' as const })),
      },
    };
  }
  /* drop · date_change need an order to pay with, a booked supplier to ask: the sample has neither. */
  return { draft: current, published, result: { ok: false, intent, error: LAB_APPLY_MESSAGE } };
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

/** A scene's place, eye, Auto · Hidden and per-stage shown / hidden — every key of its draft but its canvas and the Main background. */
export const LAB_ROWS_COOKIE = 'lab_rows';
/** The draft's summary as the lab's "server" reports it on a render (P05: it reported 0, always). */
export const LAB_BAR_COOKIE = 'lab_bar';
/**
 * ✍ The drafted Names (`events.display_name`), for the canvas's cover. The lab's cover drew the sample's "Maria & Jose"
 * whatever was typed, so the owner's case — a cover DRAWN for one name, then two typed into it — could not be walked
 * here (2026-10-11: "it did not make the secondary font").
 */
export const LAB_NAMES_COOKIE = 'lab_names';
/** The names the lab's cover draws: the drafted line, else the sample's. */
export function labNamesFrom(value: string | undefined, sample: string): string {
  if (!value) return sample;
  try {
    const typed = decodeURIComponent(value).trim();
    return typed && typed.length <= 200 ? typed : sample;
  } catch {
    return sample;
  }
}

const json = (v: unknown) => encodeURIComponent(JSON.stringify(v));
/**
 * The keys of a scene's draft that have a cookie of their OWN (a scene's whole canvas is too big to share one with
 * the rows; the Main background is the hero's alone). Every other key rides `LAB_ROWS_COOKIE`, whatever it is.
 */
export const LAB_OWN_COOKIE_KEYS = ['canvas', 'main'] as const satisfies ReadonlyArray<keyof HubDraftWidget>;
const some = (o: Record<string, unknown>) => Object.keys(o).length > 0;

/**
 * THE LAB'S COOKIES FOR A DRAFT — every one, written from the STATE (never from the last patch), `null` = cleared.
 * So an Undo, a Restore and a Reset take back what the pages draw, exactly as they take back the draft.
 */
export function labDraftCookies(draftOnly: HubDraft, scrub: boolean, published: HubDraftState | null = null): Record<string, string | null> {
  /* 📣 The pages draw what is PUBLISHED with the draft laid over it (the real merge: a draft's `null` over a published
     hide is the hide taken back). The ✓ count below is still the draft against what is published. */
  const draft: HubDraftState = published ? layState(published, stateOf(draftOnly)) : draftOnly;
  const canvases: Record<string, unknown> = {};
  const rows: Record<string, unknown> = {};
  for (const [type, w] of Object.entries(draft.widgets)) {
    if (!w) continue;
    if (w.canvas !== undefined) canvases[type] = w.canvas ?? {};
    /* 🧾 EVERY OTHER KEY OF THE SCENE'S DRAFT GOES TO THE PAGES — never a hand-kept list of them. The list was
       `mode · is_visible · display_order · stage_order`; "What guests see" and the Maker's Remove then began writing
       `stage_show`, the list was not told, and the lab's pages never drew a tick or a Remove again (the walk of
       2026-10-11, M01–M07). What is left out is NAMED (`LAB_OWN_COOKIE_KEYS`): the two keys with a cookie of their
       own. Anything the real draft learns to carry tomorrow is carried here the same day. */
    const row = Object.fromEntries(Object.entries(w).filter(([key, v]) => v !== undefined && !(LAB_OWN_COOKIE_KEYS as readonly string[]).includes(key)));
    if (some(row)) rows[type] = row;
  }
  const hero = draft.widgets.hero;
  const prefs = (draft.events.style_preferences ?? null) as { camera_look?: unknown; block_looks?: unknown } | null;
  const styles = Object.fromEntries(Object.entries(draft.fixedStyles ?? {}).filter(([, v]) => v !== null));
  const bar = summarizeHubDraft(draftOnly, labLive(scrub, published), false);
  return {
    [labWidgetsCookie(scrub)]: some(canvases) ? json(canvases) : null,
    [LAB_ROWS_COOKIE]: some(rows) ? json(rows) : null,
    lab_main: hero && 'main' in hero ? json(hero.main ?? null) : null,
    lab_styles: some(styles) ? json(styles) : null,
    lab_camera: typeof prefs?.camera_look === 'string' ? prefs.camera_look : null,
    lab_blocks: prefs?.block_looks && typeof prefs.block_looks === 'object' ? json(prefs.block_looks) : null,
    [LAB_EDITORIAL_COOKIE]: draft.editorial && some(draft.editorial) ? json(draft.editorial) : null,
    [LAB_BAR_COOKIE]: bar.hasChanges || bar.canUndo ? json({ n: bar.changeCount, pro: bar.proCount, undo: bar.canUndo }) : null,
    [LAB_NAMES_COOKIE]: typeof draft.events.display_name === 'string' && draft.events.display_name.trim() ? encodeURIComponent(draft.events.display_name) : null,
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
export function labDraftedRows(value: string | undefined, own = false): InvitationWidgetRow[] {
  return overlayHubDraftWidgets(labRows(own), labRowsDraft(value));
}
