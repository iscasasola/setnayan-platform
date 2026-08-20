/**
 * counter-on-the-card.test.ts — the number rides the event it belongs to, and
 * the way to remove an event is a sibling of the card, never inside it.
 *
 * ─── WHAT THIS HOLDS (owner 2026-08-20) ─────────────────────────────────────
 * 1 · EVERY composition carries the count. The retired banner rendered
 *     `watchRows[0]` — the busiest event and no other — so a second event with
 *     something waiting said nothing at all, on a page whose entire job is to
 *     show you your events. Three compositions render a card (desktop glass,
 *     mobile hero, mobile chip); a count on two of them is the same defect one
 *     size smaller.
 *
 * 2 · A COUNT IS NEVER INVENTED. `decisionByEvent` only holds the organiser's
 *     active events, so an invited card, an archived card and a degraded read
 *     all arrive as `undefined` — and none of them may render "0 need you".
 *
 * 3 · THE MENU IS NOT INSIDE THE LINK. 🪤 A `<button>` nested in an `<a>` is
 *     invalid HTML and activates both, so the menu would navigate into the
 *     event under it. It is a sibling inside a `relative` wrapper.
 *
 * Every assertion runs over `stripComments` output and is anchored to the ACT
 * (a rendered element, a passed prop) rather than a bare identifier — this file
 * argues about mechanisms in its own comments, and a guard that a comment can
 * satisfy is decoration. Each was mutation-checked with its occurrence count
 * printed before → after.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAUNCHER = resolve(HERE, 'page.tsx');
const MENU = resolve(HERE, '_components/event-card-menu.tsx');
const DELETE_ACTIONS = resolve(
  HERE,
  '../../dashboard/[eventId]/delete-actions.ts',
);
const read = (p: string) => readFileSync(p, 'utf8');

test('all three card compositions receive their own event’s summary', () => {
  const src = stripComments(read(LAUNCHER));
  const passes = src.match(/summary=\{decisionByEvent\.get\(/g) ?? [];
  // 5 card call sites: hero + chips + glass on Coming up, chips + glass on
  // Finished. Fewer means a composition silently lost its counter.
  assert.equal(
    passes.length,
    5,
    `Expected all 5 board card call sites to pass a per-event summary; found ${passes.length}. ` +
      'A card that stops receiving one shows no count and looks perfectly fine.',
  );
});

test('the desktop card and the mobile hero render the named counter', () => {
  const src = stripComments(read(LAUNCHER));
  const mounts = src.match(/<EventAttention\s/g) ?? [];
  assert.ok(
    mounts.length >= 2,
    `EventAttention is mounted ${mounts.length} time(s); the desktop card and ` +
      'the mobile hero must both render it.',
  );
});

test('the mobile chip renders its own count', () => {
  const src = stripComments(read(LAUNCHER));
  // At chip density the named label cannot fit, so the chip renders the total
  // directly. Anchored to the rendered total, not to the word "need".
  assert.match(
    src,
    /\{summary\.total\}<\/span>\s*need you/,
    'The mobile chip no longer shows its count. Two chips sit side by side on a ' +
      'phone and neither would say anything is waiting.',
  );
});

test('the counter never renders for an invited card', () => {
  const src = stripComments(read(LAUNCHER));
  // An invited person has no payments to settle and no quotes to approve —
  // those are the host's decisions. Same rule that keeps "% planned" off an
  // invited card.
  assert.match(
    src,
    /if \(stance === 'invited'\) return null;/,
    'EventAttention lost its invited-card refusal — it would quote somebody ' +
      'else’s decisions at a guest who cannot act on them.',
  );
  assert.match(
    src,
    /summary\.total > 0 && stance !== 'invited'/,
    'The mobile chip lost its invited-card refusal.',
  );
});

test('an absent summary renders nothing — never a zero', () => {
  const src = stripComments(read(LAUNCHER));
  assert.match(
    src,
    /if \(!summary \|\| summary\.total <= 0 \|\| !summary\.top\) return null;/,
    'EventAttention must return nothing when there is no summary. An absence ' +
      'is not a zero: a degraded read rendered as "0 need you" is a calm lie.',
  );
});

test('the one-event nudge banner is gone', () => {
  const src = stripComments(read(LAUNCHER));
  assert.doesNotMatch(
    src,
    /watchRows\[0\]/,
    'The single-event banner is back. It could only ever name the busiest ' +
      'event, which is the defect the per-card counter replaced.',
  );
});

test('the card menu is a sibling of the card, never inside the link', () => {
  const src = stripComments(read(LAUNCHER));
  // The wrapper owns the positioning context; the menu follows {children}.
  assert.match(
    src,
    /<div className="relative h-full">\s*\{children\}\s*<EventCardMenu/,
    'EventCardMenu must render as a sibling AFTER the card inside a relative ' +
      'wrapper. Nested inside the card’s <Link> it is invalid HTML and every ' +
      'press on it also navigates to the event underneath.',
  );
  assert.doesNotMatch(
    src,
    /<CardShell[\s\S]{0,4000}?<EventCardMenu/,
    'EventCardMenu appears inside a CardShell — that is the nested-button bug.',
  );
});

test('only a couple member is offered the menu, matching the server gate', () => {
  const src = stripComments(read(LAUNCHER));
  assert.match(
    src,
    /if \(event\.member_type !== 'couple'\) return <>\{children\}<\/>;/,
    'The menu must be withheld from anyone who is not a couple member. ' +
      'deleteOwnEvent admits couple members only, so offering it more widely ' +
      'is a door to a refusal.',
  );
});

test('every card that shows a menu also reserves room for it', () => {
  const src = stripComments(read(LAUNCHER));
  const reserved = src.match(/hasMenu=\{event\.member_type === 'couple'\}/g) ?? [];
  const heroReserved =
    src.match(/hasMenu=\{upcoming\[0\]\.member_type === 'couple'\}/g) ?? [];
  assert.equal(
    reserved.length + heroReserved.length,
    5,
    'Every one of the 5 card call sites must tell its card whether a menu will ' +
      'be laid over it. Without the reservation the button sits on top of a ' +
      'line of truncating text.',
  );
});

test('put away is offered above delete, and delete costs a typed name', () => {
  const src = stripComments(read(MENU));
  const putAwayAt = src.indexOf('Put this away');
  const deleteAt = src.indexOf('Remove for good');
  assert.ok(putAwayAt > 0 && deleteAt > 0, 'both controls must exist');
  assert.ok(
    putAwayAt < deleteAt,
    'Put away must come first. It is the reversible option delete is measured ' +
      'against; a menu that leads with destruction turns "I am done looking at ' +
      'this" into a deletion.',
  );
  assert.match(
    src,
    /value=\{typed\}/,
    'The typed confirmation input is gone — the delete became a one-tap action.',
  );
  assert.match(
    src,
    /disabled=\{pending \|\| typed\.trim\(\)\.length === 0\}/,
    'The confirm button must stay disabled until something is typed.',
  );
});

test('a blocked event states the refusal before anything is typed', () => {
  const src = stripComments(read(MENU));
  assert.match(
    src,
    /impact\.blocked \?[\s\S]{0,400}?impact\.blockedReason/,
    'The blocked branch must render its reason INSTEAD of the confirm form. ' +
      'Asking somebody to type their wedding’s name and then refusing is a ' +
      'worse refusal than offering no button at all.',
  );
});

test('the card menu is actually MOUNTED on all five card call sites', () => {
  const src = stripComments(read(LAUNCHER));
  // 🚨 THE GAP AN ADVERSARIAL PASS FOUND IN THIS FILE'S FIRST CUT. Every other
  // assertion here proved the wrapper was DEFINED and that cards were told a
  // menu would be laid over them (`hasMenu`) — neither of which renders it.
  // Deleting all five <BoardCardWithMenu> wrappers left the whole launcher
  // suite green while the menu vanished from the product: the classic
  // imported-but-not-mounted decoration, in a guard file written to prevent
  // exactly that.
  const mounts = src.match(/<BoardCardWithMenu\b/g) ?? [];
  assert.equal(
    mounts.length,
    5,
    `Expected the menu wrapper to be mounted on all 5 card call sites; found ` +
      `${mounts.length}. A defined-but-unmounted wrapper is not a control.`,
  );
});

test('the two-up chip grids alternate the popover anchor', () => {
  const src = stripComments(read(LAUNCHER));
  // The popover is a fixed 280px and a phone chip is ~160px. Hung from the
  // right edge of a LEFT-column chip it lands ~97px off the left of the
  // viewport, which an LTR page cannot scroll to — permanently unreachable.
  const alternating = src.match(/align=\{i % 2 === 0 \? 'left' : 'right'\}/g) ?? [];
  assert.equal(
    alternating.length,
    2,
    'Both two-up chip grids (Coming up and Finished) must alternate the ' +
      'popover anchor by column, or half the menus render off-screen.',
  );
});

test('the pill never prints its total straight into a count-led label', () => {
  const src = stripComments(read(LAUNCHER));
  // summarizeEventDecisions returns "3 payments to settle" — the label ALREADY
  // leads with a number. Rendering {count} immediately before it produced
  // "9 3 payments to settle", and "3 3 payments to settle" when one kind was
  // the only kind waiting. The total needs its own noun.
  assert.match(
    src,
    /\{count\} need you/,
    'The pill total lost its noun. Printed bare it collides with the label’s ' +
      'own leading count and the card reads "3 3 payments to settle".',
  );
  // And the remainder must not be printed alongside a total that already counts it.
  assert.match(
    src,
    /more > 0 && count == null/,
    'The "· N more" tail must be suppressed when the total is shown — the ' +
      'total already includes it, so printing both states the arithmetic twice.',
  );
});

test('the removal dialog counts only guests the couple can actually see', () => {
  const src = stripComments(read(DELETE_ACTIONS));
  // 🚨 GUESTS ARE SOFT-DELETED. Removing one writes `deleted_at` and leaves the
  // row; every guest read in the app filters it out, and so does the RLS SELECT
  // policy. This read uses the ADMIN client, which applies no RLS at all — so
  // without the clause it counts people the couple deleted long ago.
  //
  // Measured in prod: "Cale & Ice" holds 6 rows of which 2 are visible. The
  // dialog said "6 guests go with it", and because zero-valued lines are hidden
  // that wrong number was the ONLY figure on a screen read immediately before
  // an irreversible press.
  assert.match(
    src,
    /\.from\('guests'\)[\s\S]{0,200}?\.is\('deleted_at', null\)/,
    'The guests count lost its soft-delete filter — the confirmation would ' +
      'name more people than the couple has ever seen on their own list.',
  );
});
