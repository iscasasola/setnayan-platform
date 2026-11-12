/**
 * lib/hub-draft-history.ts — ↺ THE MAKER'S HISTORY LIST (Build 6 Lane F, ruling 5).
 *
 * Owner 2026-11-09 (DECISION_LOG "EVENT HUB MAKER: ↺ BECOMES A HISTORY LIST"), verbatim: *"instead of undo, show all
 * history so they can step back to a recent edit and track back from there."* Refined 2026-11-10 ("ALL YES"):
 * stepped-past rows stay GREYED until the next edit — that is the redo. Contract drawing: specs repo
 * `prototypes/event_hub_stages_scenes_2026-11-10/index.html` frame M9.
 *
 *   · ↺ opens THIS draft's edits, newest first, each a plain label and a time ("Cover · Top line · 3:41 PM").
 *   · A tap returns the page to that point; editing continues from there (`jumpHubDraft`).
 *   · The rows stepped past stay greyed (`HubDraft.ahead`); a tap on one goes forward again. The next edit drops them
 *     (`mergeHubDraft`).
 *   · The last row is "What guests see now" — the state the last Apply left, "Published <time>" (`HubDraftState.pub`).
 *
 * 🔑 THE DRAFT ALREADY KEPT WHOLE STATES (`HubDraft.history`). This adds only what a list needs to SAY them: a time on
 * each state (`at`), the Apply that left one (`pub`), and the states stepped past (`ahead`) — all inside `draft_json`,
 * whose only CHECK is "an object under 200 kB" (20271246169682), so no migration. A draft written before this has no
 * times: its rows show none, and its labels are read off the states the same way.
 *
 * 👥 RULING B STILL HOLDS (owner 2026-10-18, `lib/hub-draft-authors.ts`): ↺ never takes back another host's work. Every
 * row is listed — another host's named — but a tap only returns ACROSS YOUR OWN steps. Behind another host's newer
 * edit a tap takes back only your edits after that point (theirs stay, `undoOwnHubDraftStep`); that is a new page, so
 * it leaves no greyed rows. With no edit of yours after a row, it cannot be tapped and says why.
 *
 * 🏷 NO WORD IS INVENTED: a step's label is the Apply sheet's own line for what changed (`hubDraftChangeLines`), read
 * between the state before it and the state it left — the same names the couple meets at Apply.
 *
 * Pure — no I/O. Server (the bar's loader, the action) and the dev lab's lazy engine only; never the Maker's first load.
 */
import {
  HUB_DRAFT_FOLDED_SAID,
  fitHubDraftHistory,
  isHubDraftBaseState,
  isOwnStep,
  overlayHubDraftEvent,
  overlayHubDraftWidgets,
  type HubDraft,
  type HubDraftHistoryRow,
  type HubDraftState,
  type HubLiveState,
} from './hub-draft';
import { hubDraftChangeLines } from './hub-draft-change-lines';
import { undoOwnHubDraftStep } from './hub-draft-authors';
import { hubDraftStamp } from './hub-draft-stamp';
import type { InvitationWidgetRow } from './invitation-widgets';

/** Every state of the draft, oldest first: its history, the state it holds now, then the greyed ones ahead. */
export function hubDraftTimeline(d: HubDraft): { states: HubDraftState[]; here: number } {
  const { v: _v, history, ahead, ...now } = d;
  return { states: [...history, now, ...(ahead ?? [])], here: history.length };
}

const draftOf = (s: HubDraftState): HubDraft => ({ v: 1, ...s, history: [] });

/** The stamp of each state on the timeline — what a row names, so a tap reaches that state even if the list moved. */
export function hubDraftTimelineStamps(d: HubDraft): string[] {
  return hubDraftTimeline(d).states.map((s) => hubDraftStamp(draftOf(s)));
}

/**
 * Which state a tap means: the row's index while it still holds that stamp, else the nearest state that does
 * (another screen saved between the list and the tap). -1 = that state is no longer in the history.
 */
export function hubDraftTimelineIndexOf(d: HubDraft, stamp: string, hint: number): number {
  const stamps = hubDraftTimelineStamps(d);
  if (stamps[hint] === stamp) return hint;
  let best = -1;
  stamps.forEach((s, i) => {
    if (s === stamp && (best < 0 || Math.abs(i - hint) < Math.abs(best - hint))) best = i;
  });
  return best;
}

/** What a tap on state `to` may do for `me`: go there exactly · take back only my own steps after it · nothing. */
export function hubDraftTapOf(d: HubDraft, to: number, me?: string): 'go' | 'mine' | 'none' {
  const { states, here } = hubDraftTimeline(d);
  if (to === here || to < 0 || to >= states.length) return 'none';
  // Forward along the greyed rows re-does work — it never takes any back.
  if (to > here) return 'go';
  const passed = states.slice(to + 1, here + 1);
  if (passed.every((s) => isOwnStep(s.by, me))) return 'go';
  return passed.some((s) => isOwnStep(s.by, me)) ? 'mine' : 'none';
}

/**
 * ↺ RETURN THE DRAFT TO STATE `to` of its timeline (`hubDraftTimeline`). Back across your own steps: the states passed
 * go ahead, greyed. Forward along the greyed rows: they come back. Back across another host's newer step: only your
 * own steps after `to` are taken back, theirs stay, and nothing is left greyed (ruling B). The draft is returned as it
 * is when the tap may do nothing.
 */
export function jumpHubDraft(d: HubDraft, to: number, me?: string): HubDraft {
  const tap = hubDraftTapOf(d, to, me);
  if (tap === 'none') return d;
  const { states } = hubDraftTimeline(d);
  if (tap === 'go') {
    const ahead = states.slice(to + 1);
    return fitHubDraftHistory({ v: 1, ...states[to]!, history: states.slice(0, to), ...(ahead.length > 0 ? { ahead } : {}) });
  }
  // 👥 Mine only: take back my newest step after `to`, again and again — each keeps the other host's later work.
  const { ahead: _ahead, ...rest } = d;
  let cur: HubDraft = rest as HubDraft;
  for (let guard = 0; guard < states.length; guard += 1) {
    const before = hubDraftTimeline(cur).states.length;
    const own = newestOwnIndex(cur, me);
    if (own <= to) break;
    cur = undoOwnHubDraftStep(cur, me);
    const { ahead: _a, ...lean } = cur;
    cur = lean as HubDraft;
    if (hubDraftTimeline(cur).states.length >= before) break;
  }
  return cur;
}

function newestOwnIndex(d: HubDraft, me?: string): number {
  const { states, here } = hubDraftTimeline(d);
  for (let k = here; k >= 1; k -= 1) if (isOwnStep(states[k]!.by, me)) return k;
  return -1;
}

/**
 * 🏷 THE STEP'S WORDS — what changed between `before` and `after`, as the Apply sheet names it. Reads the lines `after`
 * would have against the live page with `before` laid over it, less the ones `before` already had (kinds the overlay
 * cannot lay over — the story, the march — would otherwise repeat on every row). Null = nothing it can name.
 */
export function hubDraftStepWords(before: HubDraftState, after: HubDraftState, live: HubLiveState): { what: string; more: number } | null {
  const seen: HubLiveState = {
    ...live,
    events: overlayHubDraftEvent({ ...live.events } as Record<string, unknown>, before) as HubLiveState['events'],
    widgets: overlayHubDraftWidgets(live.widgets as unknown as InvitationWidgetRow[], before) as unknown as HubLiveState['widgets'],
  };
  const name = (l: { place: string; what: string }) => `${l.place} · ${l.what}`;
  const had = new Set(hubDraftChangeLines(before, seen, true).map(name));
  const lines = [...new Set(hubDraftChangeLines(after, seen, true).map(name))].filter((l) => !had.has(l));
  if (lines.length === 0) return null;
  return { what: lines[0]!, more: lines.length - 1 };
}

/** The words of a row whose step nobody can name any more. */
export const HUB_DRAFT_UNNAMED_STEP = 'An edit';
/** The last row, with no Apply recorded on it. */
export const HUB_DRAFT_GUESTS_SEE_NOW = 'What guests see now';

/**
 * ↺ THE ROWS, NEWEST FIRST — what the History list draws. `me` is whose steps a tap may take back (ruling B; unknown =
 * every step, as in the dev lab). Another host's rows carry their account (`by`) for the loader to name.
 */
export function hubDraftHistoryRows(d: HubDraft | null, live: HubLiveState | null, me?: string): HubDraftHistoryRow[] {
  if (!d) return [{ i: 0, stamp: '', what: HUB_DRAFT_GUESTS_SEE_NOW, more: 0, at: null, pub: false, base: true, where: 'here', theirs: false, tap: 'none' }];
  const { states, here } = hubDraftTimeline(d);
  const stamps = hubDraftTimelineStamps(d);
  const rows: HubDraftHistoryRow[] = [];
  for (let i = states.length - 1; i >= 0; i -= 1) {
    const s = states[i]!;
    const where = i > here ? 'ahead' : i === here ? 'here' : 'behind';
    const base = i === 0 && isHubDraftBaseState(s);
    const theirs = i > 0 && !base && !isOwnStep(s.by, me);
    let what: string;
    let more = 0;
    if (base) what = s.pub ? 'Published' : HUB_DRAFT_GUESTS_SEE_NOW;
    else if (s.said) what = s.said;
    else if (i === 0) what = HUB_DRAFT_FOLDED_SAID;
    else {
      const words = live ? hubDraftStepWords(states[i - 1]!, s, live) : null;
      what = words?.what ?? HUB_DRAFT_UNNAMED_STEP;
      more = words?.more ?? 0;
    }
    rows.push({
      i,
      stamp: stamps[i]!,
      what,
      more,
      at: base ? (s.pub ?? null) : (s.at ?? null),
      pub: base && Boolean(s.pub),
      base,
      where,
      theirs,
      ...(theirs && s.by ? { by: s.by } : {}),
      tap: hubDraftTapOf(d, i, me),
    });
  }
  return rows;
}

/** 👥 Another host's rows named by first name (`name` null = "Someone"), the account id taken off before the client. */
export function namedHistoryRows(rows: HubDraftHistoryRow[], names: ReadonlyMap<string, string | null>): HubDraftHistoryRow[] {
  return rows.map(({ by, ...r }) => (r.theirs ? { ...r, name: (by && names.get(by)) || null } : r));
}
