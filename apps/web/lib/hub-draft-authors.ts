/**
 * lib/hub-draft-authors.ts — WHO MADE EACH STEP OF THE MAKER DRAFT (owner 2026-10-18, round 3 of "two hosts never
 * overwrite each other"; the owner: "do your recommendation" on #6626's two questions — now the rulings):
 *
 *   A. THE NOTE NAMES THE PERSON. When another host's change reached a save, the screen says
 *      "Claire changed this a moment ago — showing the newest." — their first name as the event shows it
 *      (`lib/host-first-name.server.ts`); "Someone" only when the draft does not know who; and the shipped
 *      "Changed on another screen…" when it was YOU, on your other phone.
 *   B. ↺ UNDOES ONLY YOUR OWN STEPS. It skips the other host's steps — their work is never taken back by your press —
 *      and with no step of yours left, ↺ is greyed. Reset and Restore are unchanged.
 *
 * 🔑 THE RECORD. Each draft state carries `by` — the account whose save produced it (`HubDraftState.by`, set by the
 * one door: `updateHubDraft` → `mergeHubDraft(…, by)`). The step from state k-1 to state k was made by `state[k].by`.
 * A step with no `by` (made before this record, or by a writer with no session) is nobody's in particular: ↺ may take
 * it back, as before — greying it would strand every draft that predates this.
 *
 * 🔑 TAKING BACK A STEP THAT IS NOT THE NEWEST. The draft keeps whole states, not changes. To take back my step k while
 * the other host's later steps stay, each later state is merged three ways (`mergeFromBase`) — base = the state my step
 * left, mine = the later state, theirs = the state before my step: what my step changed and nobody touched since goes
 * back; what the other host changed after it stays; a value BOTH touched keeps the other host's newer value (theirs is
 * the later work — an undo never wipes it). The later steps keep their own authors, so the other host's ↺ still finds
 * them. Pure — no I/O; the server action and the dev lab use it, never the Maker's first load.
 */
import { mergeFromBase, sameValue, TWO_SCREENS_NOTE } from './merge-from-base';
import { fitHubDraftHistory, isOwnStep, type HubDraft, type HubDraftPatch, type HubDraftState } from './hub-draft';

/** Every state of the draft, oldest first — its Undo history, then the state it holds now. */
function statesOf(d: HubDraft): HubDraftState[] {
  const { v: _v, history, ...now } = d;
  return [...history, now];
}

/** The index (in `statesOf`) of the newest state a step of `me`'s produced — or -1. State 0's own step is gone. */
function newestOwnStep(states: HubDraftState[], me: string | undefined): number {
  for (let k = states.length - 1; k >= 1; k -= 1) if (isOwnStep(states[k]!.by, me)) return k;
  return -1;
}

const stripAuthor = (s: HubDraftState): HubDraftState => {
  const { by: _by, ...rest } = s;
  return rest;
};

/**
 * ↺ Take back the newest step of `me`'s, keeping every later step of the other host's. With no step of `me`'s the
 * draft is returned as it is. `me` unknown: the newest step, whoever made it (`undoHubDraft`'s rule).
 */
export function undoOwnHubDraftStep(d: HubDraft, me?: string): HubDraft {
  const states = statesOf(d);
  const k = newestOwnStep(states, me);
  if (k < 1) return d;
  const before = stripAuthor(states[k - 1]!);
  const after = stripAuthor(states[k]!);
  // mine = the later state (its value wins where both touched), theirs = the state before my step.
  const revert = (later: HubDraftState): HubDraftState => {
    const m = mergeFromBase(after, stripAuthor(later), before).value as HubDraftState;
    const out: HubDraftState = { ...m, events: m.events ?? {}, widgets: m.widgets ?? {} };
    return later.by ? { ...out, by: later.by } : out;
  };
  const next = [...states.slice(0, k), ...states.slice(k + 1).map(revert)];
  const now = next[next.length - 1]!;
  return fitHubDraftHistory({ v: 1, ...now, history: next.slice(0, -1) });
}

/**
 * 👥 Rule A — whose change did a save just meet? The newest step that touched any value the save had to take
 * (`merged`: what the screen must now show — `rebaseHubDraftPatch`). `found: false` = no drafted step touched it (the
 * change came from the live page — an Apply, a live writer): not known.
 */
export function hubDraftStepAuthorOf(d: HubDraft, merged: HubDraftPatch): { found: boolean; by?: string } {
  const states = statesOf(d);
  const cols = Object.keys(merged.events ?? {});
  const canvases = Object.keys(merged.widgets ?? {});
  for (let k = states.length - 1; k >= 1; k -= 1) {
    const a = states[k - 1]!;
    const b = states[k]!;
    const ev = (s: HubDraftState, c: string) => (s.events as Record<string, unknown>)[c];
    const cv = (s: HubDraftState, t: string) => (s.widgets as Record<string, { canvas?: unknown } | undefined>)[t]?.canvas;
    if (cols.some((c) => !sameValue(ev(a, c), ev(b, c))) || canvases.some((t) => !sameValue(cv(a, t), cv(b, t)))) {
      return b.by ? { found: true, by: b.by } : { found: true };
    }
  }
  return { found: false };
}

/** Who a save met: this account itself (its other screen) · a host by first name · nobody the draft can name. */
export type TwoScreensWho = { self: true } | { self: false; name: string | null };

/** Rule A's words. Calm, said once, never a modal and never a choice. */
export function twoScreensNoteFor(who: TwoScreensWho): string {
  if (who.self) return TWO_SCREENS_NOTE;
  return `${who.name ?? 'Someone'} changed this a moment ago — showing the newest.`;
}

/** One clean first word — never an email (a contact detail, not a name). */
function firstWord(v: string | null | undefined): string | null {
  if (typeof v !== 'string') return null;
  const w = v.trim().split(/\s+/)[0] ?? '';
  return w && !w.includes('@') ? w : null;
}
/**
 * Rule A's name — "their first name as the event shows it": the first name on THIS event's guest row that is theirs
 * (the guest list is where the event names its hosts), else their own profile's first name, else the first word of
 * their account name. Null = not known ("Someone").
 */
export function pickHostFirstName(src: {
  guestFirst?: string | null;
  guestDisplay?: string | null;
  userFirst?: string | null;
  userDisplay?: string | null;
}): string | null {
  return firstWord(src.guestFirst) ?? firstWord(src.guestDisplay) ?? firstWord(src.userFirst) ?? firstWord(src.userDisplay);
}
