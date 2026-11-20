/**
 * app/[slug]/_lib/day-hub.ts — WHEN THE DAY'S HUB (`/[slug]/hub`) SPEAKS.
 *
 * `/[slug]/hub` is the day's own screen: its first tab is "Live", its header
 * names the day. Measured on the live page 61 days before an event
 * (2026-10-11): it said "THE DAY" over a lit "Live" tab, while the event's own
 * page — one address up — said "INVITATION". Two pages, two answers to "what
 * stage is this event at", because the hub asked only the calendar window
 * (`getDayOfPhase`) and never the page's stage.
 *
 * 🔑 ONE ANSWER. The stage is the one `app/[slug]/page.tsx` resolves — the
 * couple's pin, else the clock (`manualLaunchPhase(…) ?? getLifecyclePhase(…)`),
 * a host's `?phase=` preview first. The hub page composes exactly that and asks
 * this: while the stage is still BEFORE the day (Save the Date · Invitation),
 * there is no day to show, and `/hub` sends the visitor to the page that speaks
 * for that stage. On The Day and after it (Post Event links back to it as the
 * record of the day) the hub draws.
 *
 * Pure. No second clock, no second rule.
 */
import type { LifecyclePhase } from '@/lib/invitation-widgets';

/** Does the day's hub draw at this stage? */
export function dayHubOpens(stage: LifecyclePhase): boolean {
  return stage === 'event' || stage === 'editorial';
}

/**
 * 🎬 WHAT `/hub` DOES FOR THIS VIEWER.
 *
 *   · 'open'      — the stage is The Day or after it: the hub, for everyone who may see the event.
 *   · 'rehearsal' — the stage is still before the day and the viewer is a signed-in HOST: the couple checks the
 *                   day's hub before their guests do, so it opens for them AS THE DAY (the same preview
 *                   `?phase=event` has always given a host — no new power, only no address to remember). Until
 *                   2026-10-11's first cut of this rule a host was redirected like everyone else, and the event
 *                   page's own preview of The Day linked to a hub that sent them straight back.
 *   · 'leave'     — the stage is before the day and the viewer is a guest or a stranger: the event's own page.
 *
 * `isHost` is asked only when it can matter (the stage is before the day), so a guest's ordinary visit on the day
 * costs no account lookup. A host who ASKED for an earlier stage (`?phase=rsvp`) is not rehearsing the day — the
 * caller passes `isHost: false` for them and they leave for the page that shows that stage.
 */
export type DayHubDoor = 'open' | 'rehearsal' | 'leave';
export function dayHubDoor(stage: LifecyclePhase, isHost: boolean): DayHubDoor {
  if (dayHubOpens(stage)) return 'open';
  return isHost ? 'rehearsal' : 'leave';
}

/* ══════════════════════════════════════════════════════════════════════════
 * 🧭 ONE BAR PER STAGE — `/hub` DRAWS NO BAR OF ITS OWN (controller under owner
 * delegation, 20 Nov 2026 — DECISION_LOG "EVENT HUB MAKER — ONE TOOLBAR, FULL
 * SCREEN, APPROVED", its last sentence: *"The Day keeps ONE bar (Live · Home ·
 * Camera · Memories · Me), the /hub second bar goes and Watch lives inside
 * Live"*).
 *
 * Until then `/hub` was a second screen with a second bar — Live · Watch ·
 * Camera · Memories · Me · More (Schedule, Directions) — beside the event page's
 * own. Every one of those tabs already had a home on the event page: The Day's
 * Live tab carries the programme, the broadcast and the directions; Memories the
 * wall; Me the pass and the code; the bar's Camera the camera. So the address
 * stays — printed passes, installed home-screen tiles (`to=hub`), the footer's
 * "Happening now" and every shared link still land — and lands on the event
 * page's matching tab instead of drawing a bar of its own.
 *
 * 🔑 NO DEAD ROUTE: every old `?tab=` value has a destination, and an unknown or
 * absent one lands on Live, the day's first tab. The mark (`#site-gallery`,
 * `#site-me`) carries the same landing to a page whose bar is marks, not tabs —
 * the story after the day — where `?tab=` does nothing.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** The `/hub` bar's old tab keys (`HubPanelKey`), every one of which a shared link may still carry. */
export const OLD_HUB_TABS = ['now', 'watch', 'camera', 'photos', 'me', 'schedule', 'directions'] as const;
export type OldHubTab = (typeof OLD_HUB_TABS)[number];

/**
 * Where each old `/hub` tab lives on the event page now: the day's tab, and the
 * section mark that reaches the same thing on a page with no tabs.
 *   · Live      ← Live (was "Now"), Watch, Schedule, Directions — all on The Day's Live tab.
 *   · Live      ← Camera: the camera is the bar's own Camera, one tap from Live; the
 *                 camera's page was always a page of its own, never inside `/hub`.
 *   · Memories  ← Memories ("photos"): the live wall and the guest's own album.
 *   · Me        ← Me: the pass, the code and the seat.
 */
export const HUB_TAB_HOME: Readonly<Record<OldHubTab, { tab: 'live' | 'gallery' | 'me'; mark: string | null }>> = {
  now: { tab: 'live', mark: null },
  watch: { tab: 'live', mark: null },
  schedule: { tab: 'live', mark: null },
  directions: { tab: 'live', mark: null },
  camera: { tab: 'live', mark: null },
  photos: { tab: 'gallery', mark: 'site-gallery' },
  me: { tab: 'me', mark: 'site-me' },
};

/** An old `?tab=` value, read: one of the old keys, the new keys it maps to, or Live. */
function oldHubTabHome(raw: unknown): { tab: 'live' | 'gallery' | 'me'; mark: string | null } {
  const v = (typeof raw === 'string' ? raw : Array.isArray(raw) ? String(raw[0] ?? '') : '').trim();
  if ((OLD_HUB_TABS as readonly string[]).includes(v)) return HUB_TAB_HOME[v as OldHubTab];
  if (v === 'gallery') return HUB_TAB_HOME.photos;
  if (v === 'live') return HUB_TAB_HOME.now;
  return HUB_TAB_HOME.now;
}

/**
 * THE ADDRESS `/hub` SENDS ITS VISITOR TO — always the event's own page.
 *
 *   · 'open' on The Day — that page's matching tab (`?tab=live` · `?tab=gallery` · `?tab=me`).
 *   · 'open' after the day — the story (one page of marks): the matching mark, or its top.
 *   · 'rehearsal' — a signed-in host before the day sees the day, as `/hub` always gave them: `?phase=event`.
 *   · 'leave' — the page that speaks for this stage, keeping a host's `?phase=` preview.
 *
 * `slug` must already be the event's checked slug; it is encoded here all the same.
 */
export function dayHubLanding(input: {
  slug: string;
  door: DayHubDoor;
  stage: LifecyclePhase;
  /** The `?tab=` the visitor arrived with. */
  tab: unknown;
  /** A host's honoured `?phase=` preview, kept on the way through. */
  phaseOverride?: LifecyclePhase | null;
}): string {
  const base = `/${encodeURIComponent(input.slug)}`;
  if (input.door === 'leave') return input.phaseOverride ? `${base}?phase=${input.phaseOverride}` : base;
  const home = oldHubTabHome(input.tab);
  const theDay = input.door === 'rehearsal' || input.stage === 'event';
  const params = new URLSearchParams();
  const phase = input.door === 'rehearsal' ? 'event' : (input.phaseOverride ?? null);
  if (phase) params.set('phase', phase);
  if (theDay) params.set('tab', home.tab);
  const query = params.toString();
  const mark = !theDay && home.mark ? `#${home.mark}` : '';
  return `${base}${query ? `?${query}` : ''}${mark}`;
}
