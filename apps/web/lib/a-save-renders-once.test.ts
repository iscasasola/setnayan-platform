/**
 * a-save-renders-once.test.ts — one save, one server render (owner 2026-10-20: "we want all pages to load at its fastest").
 *
 * ── The defect ─────────────────────────────────────────────────────────────
 * A server action that calls `revalidatePath` / `revalidateTag` already answers WITH a fresh render of the page it was
 * pressed on — Next 15 sets `pathWasRevalidated` for ANY revalidation ("TODO: only revalidate if the path matches") and
 * the action handler then renders the current page into the answer, which the client router applies to what is on
 * screen. A `router.refresh()` after it asks the server for the same page AGAIN: every read the page makes, twice
 * (Guests: 85–150 database calls a press). The comments that defended those refreshes ("revalidatePath marks the
 * cache stale; it does not push fresh props into a client component already on screen") were measured wrong on
 * 2026-10-20 in `/dev/guests-lab`: an autosave with no refresh moved the card's own server-drawn render marker
 * 2 → 3 (one POST, one render); the Undo that still refreshed made two renders (3 → 5).
 *
 * ── What is proven, and how (read from the syntax tree of every app file; `one-save-one-render.ts`) ──────────────
 *   1 · the reader still sees the tree: it finds the app's refreshes and its server actions (a blank cannot pass);
 *   2 · NO `router.refresh()` follows a server action that revalidates — called earlier in the same handler (or an
 *       enclosing one), through this file's imports, a local wrapper, a `useActionState`, or a context/prop by the
 *       action's exported name — unless it runs only when that write FAILED (`after-failure`: a `catch`, or the
 *       refusal branch), or it is handed to the one-render batcher (`batched`: `makerSave`, `makerRedrawSave`, the
 *       add queue's `setRefresher`), or it is one of the counted `unsure` ones;
 *   3 · every refresh that is kept says why, on the line above it: `// one-render: keep (<reason>) — <why>`, with a
 *       reason from `KEEP_REASONS`, and the reason must not contradict what the tree shows (`fetch` needs a fetch;
 *       `after-failure` needs a failure branch; `batched` needs the batcher; the no-write reasons need no action);
 *   4 · the `unsure` count may only fall.
 *
 * ── Caveats — read before trusting a green run ─────────────────────────────
 *   · An action handed in as a PROP under another name (`onSave`, `action`, a `.bind`) is not resolved; those sites
 *     were each read by hand on 2026-10-20 and carry their reason. A new one is caught only by § 3 (it needs a marker).
 *   · "Revalidates" means SOMEWHERE in the action (or what it calls). An action that revalidates only on success is
 *     right for a refresh that runs only on success; a refresh on its refusal branch is `after-failure`.
 *   · Nothing here renders a page. The one-render claim on screen is the lab walk's (`/dev/guests-lab` counts its own
 *     renders: dev log `[one-render]` and `data-lab-render`).
 *
 * Sabotage (2026-10-20, each on the real file, restored by `git checkout`): see the PR body's table.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { auditRefreshes, KEEP_REASONS, serverActionIndex, type RefreshSite } from './one-save-one-render';

const WEB = join(__dirname, '..');
const sites: RefreshSite[] = auditRefreshes(WEB);
const at = (s: RefreshSite) => `${s.file}:${s.line}`;

/** The refreshes kept because nobody could prove them either way (2026-10-20). This number may only go DOWN. */
const UNSURE_CEILING = 7;

const NO_WRITE_REASONS = new Set(['realtime', 'retry', 'auth', 'navigation', 'client-write', 'other-frame', 'no-revalidate']);

test('1 · the reader still sees the tree', () => {
  // A blank cannot pass: the refreshes that are left are found, the app's server actions are found, and the
  // resolver still knows one that revalidates (the guest card's `updateGuest`) and one that does not (the lab's).
  assert.ok(sites.length >= 60, `only ${sites.length} router.refresh() calls found — the reader is not reading the app`);
  const actions = serverActionIndex(WEB);
  assert.ok(actions.size >= 500, `only ${actions.size} server actions found — the action reader is blind`);
  assert.deepEqual(actions.get('updateGuest')?.map((a) => a.revalidates), [true], 'updateGuest no longer reads as revalidating');
  assert.deepEqual(actions.get('libraryLab')?.map((a) => a.revalidates), [false], 'the lab stand-in reads as revalidating');
  assert.ok(sites.some((s) => s.actions.some((a) => a.revalidates)), 'no refresh resolves to a revalidating action — § 2 checks nothing');
});

test('2 · no refresh follows a server action that already revalidated (the page would render twice)', () => {
  const twice = sites
    .filter((s) => s.actions.some((a) => a.revalidates))
    .filter((s) => !(s.marker === 'after-failure' && s.onFailure) && !(s.marker === 'batched' && s.batched) && s.marker !== 'unsure')
    .map((s) => `${at(s)} — after ${s.actions.filter((a) => a.revalidates).map((a) => `${a.name} (${a.module})`).join(', ')}`);
  assert.deepEqual(twice, [], `these render the page a second time — remove the refresh (the action's answer already carries the render):\n${twice.join('\n')}`);
});

test('3 · every kept refresh says why, and the why fits what the code does', () => {
  const bad: string[] = [];
  for (const s of sites) {
    if (!s.marker) { bad.push(`${at(s)} — no "// one-render: keep (<reason>) — <why>" marker`); continue; }
    if (!(KEEP_REASONS as readonly string[]).includes(s.marker)) { bad.push(`${at(s)} — unknown reason "${s.marker}"`); continue; }
    const wrote = s.actions.length > 0;
    if (s.marker === 'fetch' && !s.fetches) bad.push(`${at(s)} — "fetch", but no fetch() comes before it`);
    if (s.marker === 'after-failure' && !s.onFailure) bad.push(`${at(s)} — "after-failure", but it is not on a failure branch`);
    if (s.marker === 'batched' && !s.batched) bad.push(`${at(s)} — "batched", but it is not handed to makerSave / makerRedrawSave / setRefresher`);
    if (NO_WRITE_REASONS.has(s.marker) && s.actions.some((a) => a.revalidates)) {
      bad.push(`${at(s)} — "${s.marker}", but it follows ${s.actions.map((a) => a.name).join(', ')}, which revalidates`);
    }
    if (s.marker === 'realtime' && wrote) bad.push(`${at(s)} — "realtime", but a server action is called before it`);
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

test('4 · the unsure count may only fall', () => {
  const unsure = sites.filter((s) => s.marker === 'unsure').map(at);
  assert.ok(unsure.length <= UNSURE_CEILING, `${unsure.length} unsure refreshes (ceiling ${UNSURE_CEILING}) — prove the new one:\n${unsure.join('\n')}`);
  assert.equal(unsure.length, UNSURE_CEILING, `the unsure count fell to ${unsure.length} — lower UNSURE_CEILING to match`);
});
