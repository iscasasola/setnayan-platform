/**
 * a-draft-save-does-not-rerender-the-maker.test.ts — ⚡ A DRAFT SAVE DOES NOT
 * REVALIDATE THE MAKER.
 *
 * Owner, 2026-09-28: *"picking something takes a lot of time before the
 * website reacts"*. Every Maker pick is a DRAFT write — guests meet the draft
 * only at Apply — and yet every draft door ended with `revalidatePath`:
 *
 *   · `hubDraftAction` (every bridged pick) revalidated `/website`, which made
 *     the action's response carry a FULL render of the Maker route; the caller
 *     then threw it away and asked again with `router.refresh()` — two
 *     whole-Maker renders per tap;
 *   · `draftEventsAndReturn` (colours, message, dress code, what to bring, our
 *     story) revalidated the `/website` LAYOUT and `/launch`;
 *   · the drafted hero revalidated EVERY guest page (`'/[slug]', 'page'`) for
 *     a change no guest can see.
 *
 * What this holds (source, comments stripped — a comment saying "no revalidate"
 * is not the absence of the call):
 *   1. `hubDraftAction`'s draft-only intents (save · reset · undo · restore)
 *      revalidate nothing; Apply — the one intent that changes what guests see
 *      — still revalidates the guest page it changed;
 *   2. every redirecting draft door revalidates nothing (its redirect carries
 *      the fresh render back in the same response);
 *   3. no draft door anywhere revalidates the Maker's `'layout'`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const REVALIDATES = /revalidatePath\(|revalidateWebsiteEditor\(|revalidateGuestSite\(|revalidateTag\(/;

/** The body of `if (intent === '<x>') { … }` — up to the next top-level intent branch. */
function intentBody(src: string, intent: string, next: string): string {
  const a = src.indexOf(`if (intent === '${intent}')`);
  const b = src.indexOf(next, a + 1);
  assert.ok(a > 0 && b > a, `no ${intent} branch`);
  return src.slice(a, b);
}

test('hubDraftAction: save · reset · undo · restore revalidate nothing; Apply revalidates the guest page it changed', () => {
  const src = read('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  const bodies: Array<[string, string]> = [
    ['restore', intentBody(src, 'restore', 'const current = ')],
    ['save', intentBody(src, 'save', "if (intent === 'reset')")],
    ['reset', intentBody(src, 'reset', "if (intent === 'undo')")],
    ['undo', intentBody(src, 'undo', 'const live = await readHubLiveState(')],
  ];
  for (const [intent, body] of bodies) {
    assert.doesNotMatch(body, REVALIDATES, `${intent}: a draft-only write re-rendered the whole Maker in its response`);
    assert.match(body, /return done\(\);/, `${intent}: the branch was not found whole`);
  }
  const apply = src.slice(src.indexOf('const live = await readHubLiveState('));
  assert.match(apply, /revalidateGuestSite\(/, 'Apply changes the live page — its guest page must be revalidated');
});

test('the redirecting draft doors revalidate nothing — the redirect brings the fresh render', () => {
  const store = read('lib/hub-draft-store.ts');
  const door = store.slice(store.indexOf('export async function draftEventsAndReturn('), store.indexOf('export async function draftedEventColumn('));
  /* It lands through `landAfterWrite` (`lib/maker-land.server.ts`): from the Maker, ONE render of the page it is on, in place. */
  assert.match(door, /return landAfterWrite\(formData, fallback\)/);
  assert.doesNotMatch(door, REVALIDATES, 'draftEventsAndReturn re-rendered the Maker layout on every save');

  const widgets = read('app/dashboard/[eventId]/website/widgets/actions.ts');
  const finish = widgets.slice(widgets.indexOf('function finishDraftSave('), widgets.indexOf('async function saveWidgetToDraft('));
  assert.match(finish, /return landAfterWrite\(/);
  assert.doesNotMatch(finish, REVALIDATES, 'the eye / Hidden / a move re-rendered the Maker twice');

  const hero = read('app/dashboard/[eventId]/website/hero-photo/actions.ts');
  const draftHero = hero.slice(hero.indexOf('async function draftHero('), hero.indexOf('export async function', hero.indexOf('async function draftHero(')));
  assert.doesNotMatch(draftHero, REVALIDATES, 'a DRAFTED hero invalidated every guest page');

  const editor = read('app/dashboard/[eventId]/website/editor/actions.ts');
  const backdrop = editor.slice(editor.indexOf('async function draftBackdrop('));
  assert.doesNotMatch(backdrop.slice(0, backdrop.indexOf('redirect(')), REVALIDATES);
});

test("no draft door revalidates the Maker's LAYOUT", () => {
  for (const f of [
    'lib/hub-draft-store.ts',
    'app/dashboard/[eventId]/website/hub-draft-actions.ts',
    'app/dashboard/[eventId]/website/widgets/actions.ts',
    'app/dashboard/[eventId]/website/photo-moments/actions.ts',
  ]) {
    const src = read(f);
    assert.doesNotMatch(src, /revalidatePath\(`\/dashboard\/\$\{[^}]+\}\/website`, 'layout'\)/, `${f}: the whole /website layout is revalidated`);
  }
  // Photo moments' draft door RETURNS (no redirect), so it keeps ONE revalidation — the Maker's own page.
  const pm = read('app/dashboard/[eventId]/website/photo-moments/actions.ts');
  const door = pm.slice(pm.indexOf('if (isHubDraftWrite(formData))'), pm.indexOf('return { ok: true };', pm.indexOf('if (isHubDraftWrite(formData))')));
  assert.equal((door.match(/revalidatePath\(/g) ?? []).length, 1);
  assert.match(door, /revalidatePath\(`\/dashboard\/\$\{eventIdRaw\}\/launch`\)/);
});

test('every hubDraftAction caller in the Maker refreshes ONCE, through makerSave — never on its own', () => {
  /** A refresh that is not a save's, with its reason. */
  const OTHER_REFRESH: Record<string, number> = {
    // `replay()`: the Reveal's frame could not be reloaded in place, so the page is refreshed instead.
    'app/dashboard/[eventId]/launch/_components/maker-reveal.tsx': 1,
    // It answers `requestMakerRefresh` for a control with no router (the RSVP settings) — that save's one refresh.
    'app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx': 1,
  };
  for (const f of [
    'app/dashboard/[eventId]/website/editor/_components/element-sheet.tsx',
    'app/dashboard/[eventId]/website/editor/_components/scene-background-row.tsx',
    'app/dashboard/[eventId]/website/editor/_components/scene-inspector.tsx',
    'app/dashboard/[eventId]/website/editor/_components/details-bound-field.tsx',
    'app/dashboard/[eventId]/website/editor/_components/main-background-panel.tsx',
    'app/dashboard/[eventId]/launch/_components/maker-rsvp-ask.tsx',
    'app/dashboard/[eventId]/launch/_components/maker-logo.tsx',
    'app/dashboard/[eventId]/launch/_components/maker-reveal.tsx',
    'app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx',
  ]) {
    const src = read(f);
    assert.match(src, /makerSave\(/, `${f}: a draft save outside makerSave`);
    assert.doesNotMatch(src, /await hubDraftAction\(|await draftAction\(/, `${f}: a draft save called bare`);
    // The only router.refresh() left is the one makerSave calls, once per burst.
    const bare = src.replace(/makerSave\([\s\S]*?\(\) => router\.refresh\(\)/g, '');
    assert.equal((bare.match(/router\.refresh\(\);/g) ?? []).length, OTHER_REFRESH[f] ?? 0, `${f}: a second refresh of its own`);
  }
});
