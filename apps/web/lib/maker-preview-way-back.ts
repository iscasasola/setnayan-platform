/**
 * ↩ EVERY PREVIEW HAS A WAY BACK TO THE MAKER (DECISION_LOG 2026-09-28).
 *
 * Owner, verbatim: *"no way to get back. event when we played the preview, it
 * has no way to return to the event hub maker"*. The Maker's ▶ → "Preview the
 * whole <stage>" opened `/<slug>?phase=<stage>&preview=draft` in a new tab, and
 * that page had no door home — on a phone, and inside the app, a new tab is a
 * dead end.
 *
 * This module is the pure half of the fix, in two directions:
 *
 *   · OUT — `previewCarriesPlace` adds WHERE the couple was in the Maker (the
 *     scene they had picked, or the made-once page they had open) to the
 *     preview's address, and `previewOpensInSameView` decides whether the
 *     preview takes the same view (a phone, or any installed shell) or a new
 *     tab (a desktop browser).
 *   · BACK — `makerWayBackHref` turns the preview's own address back into the
 *     Maker's, at the same stage and the same place. `app/[slug]/_lib/
 *     editor-canvas.ts` (`previewWayBackHref`) is the ONLY caller on the guest
 *     page, and it answers null unless the host canvas is already VERIFIED.
 *
 * 🔒 Every value that travels is checked against a closed list or a strict
 * shape before it is written into a link: a `?scene=` is a widget id, a
 * `?tool=` is one of the Maker's own made-once pages, a `?phase=` one of the
 * four stages. Anything else is dropped, never echoed.
 */

import { STORE_SHELL_CLIENT_TYPE_COOKIE, isStoreShellInBrowser } from './store-shell';

/** The four stages the Maker's `?stage=` accepts (`resolveHubStageSelection`). */
const MAKER_STAGES = ['save_the_date', 'rsvp', 'event', 'editorial'] as const;
export type MakerWayBackStage = (typeof MAKER_STAGES)[number];

/** The made-once pages the Maker's `?tool=` reopens (`launch/page.tsx`'s
 *  `initialSelection`). A tool not on this list has no address to land on. */
export const MAKER_WAY_BACK_TOOLS = [
  'hero',
  'reveal',
  'logo',
  'love-story',
  'details',
  'rsvp-page',
  'prints',
] as const;
export type MakerWayBackTool = (typeof MAKER_WAY_BACK_TOOLS)[number];

/** A scene's id is its widget id (`website/editor/page.tsx`, `id: row.widget_id`). */
const SCENE_ID = /^[A-Za-z0-9_-]{1,64}$/;

function isStage(v: unknown): v is MakerWayBackStage {
  return typeof v === 'string' && (MAKER_STAGES as readonly string[]).includes(v);
}
function isTool(v: unknown): v is MakerWayBackTool {
  return typeof v === 'string' && (MAKER_WAY_BACK_TOOLS as readonly string[]).includes(v);
}
function isSceneId(v: unknown): v is string {
  return typeof v === 'string' && SCENE_ID.test(v);
}

/** What the Maker had open — the subset of `MakerSelection` a preview carries. */
export type MakerPlace =
  | { kind: 'scene'; id: string }
  | { kind: 'tool'; key: string }
  | { kind: string }
  | null
  | undefined;

/**
 * OUT: the preview's address plus where the couple was. A scene rides as
 * `scene=<id>`, a made-once page as `tool=<key>`; anything else (nothing
 * picked, a main-row panel) adds nothing — the Maker then reopens on the stage.
 */
export function previewCarriesPlace(stageHref: string, place: MakerPlace): string {
  if (!place) return stageHref;
  const join = stageHref.includes('?') ? '&' : '?';
  if (place.kind === 'scene' && 'id' in place && isSceneId(place.id)) {
    return `${stageHref}${join}scene=${encodeURIComponent(place.id)}`;
  }
  if (place.kind === 'tool' && 'key' in place && isTool(place.key)) {
    return `${stageHref}${join}tool=${encodeURIComponent(place.key)}`;
  }
  return stageHref;
}

/**
 * BACK: the Maker's address at the same stage and place. Pure — the caller
 * decides WHETHER a way back may be drawn (a verified host's preview only).
 */
export function makerWayBackHref(input: {
  eventId: string;
  phase?: unknown;
  scene?: unknown;
  tool?: unknown;
}): string {
  const q = new URLSearchParams();
  if (isStage(input.phase)) q.set('stage', input.phase);
  if (isSceneId(input.scene)) q.set('scene', input.scene);
  else if (isTool(input.tool)) q.set('tool', input.tool);
  const qs = q.toString();
  return `/dashboard/${encodeURIComponent(input.eventId)}/launch${qs ? `?${qs}` : ''}`;
}

/**
 * The Maker's own phone line (`maker-shell.tsx` switches its canvas to the
 * phone below it). Below it a new tab is a dead end.
 */
export const PREVIEW_SAME_VIEW_QUERY = '(max-width: 767px)';

/** The installed shells whose "new tab" is a different browser, or nothing. */
const INSTALLED_CLIENT_TYPES = new Set(['capacitor', 'tauri', 'pwa']);

function clientTypeFrom(cookieString: string | null | undefined): string {
  for (const part of (cookieString ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== STORE_SHELL_CLIENT_TYPE_COOKIE) continue;
    return part.slice(eq + 1).trim();
  }
  return '';
}

/**
 * OUT: does "Preview the whole <stage>" open in the SAME view?
 *
 *   · the App Store / Play Store shell — asked exactly as the rest of the repo
 *     asks it (`isStoreShellInBrowser`, lib/store-shell.ts);
 *   · any other installed shell — the desktop app (`tauri`) and an installed
 *     PWA (`pwa`, or `display-mode: standalone`): their "new tab" is the
 *     system browser, where the couple is not signed in, so the preview would
 *     fail the host check and show the LIVE guest page, not the draft;
 *   · a phone-width window (`PREVIEW_SAME_VIEW_QUERY`).
 *
 * Only a desktop browser keeps the new tab — and that tab still carries the
 * way back.
 */
export function previewOpensInSameView(signals: {
  userAgent: string | null | undefined;
  cookie: string | null | undefined;
  standalone: boolean;
  narrow: boolean;
  storeShell?: boolean;
}): boolean {
  if (signals.storeShell) return true;
  if (isStoreShellInBrowser(signals.userAgent, signals.cookie)) return true;
  if (/SetnayanApp/i.test(signals.userAgent ?? '')) return true;
  if (INSTALLED_CLIENT_TYPES.has(clientTypeFrom(signals.cookie))) return true;
  if (signals.standalone) return true;
  return signals.narrow;
}
