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
const read = (p: string) => readFileSync(p, 'utf8');

/**
 * Every place the board mounts a card. Counted from the SOURCE rather than
 * written down as a number: the board grew a shelf on 2026-08-20 (Finished
 * split into Unpublished + Published) and a hardcoded 5 turned that into a
 * failure of a guard that was not actually broken. **A count of what exists is
 * a fact; a count typed into a test is a claim with an expiry date.**
 */
function cardMounts(src: string): number {
  return (src.match(/<(MobileEventHero|MobileEventChip|GlassEventCard)\s/g) ?? [])
    .length;
}

test('EVERY card composition receives its own event’s summary', () => {
  const src = stripComments(read(LAUNCHER));
  const mounts = cardMounts(src);
  const passes = (src.match(/summary=\{decisionByEvent\.get\(/g) ?? []).length;
  assert.ok(mounts >= 5, `Only ${mounts} card mounts found — the board lost a composition.`);
  assert.equal(
    passes,
    mounts,
    `${mounts} board cards are mounted but only ${passes} are handed a per-event ` +
      'summary. A card that stops receiving one shows no count and looks ' +
      'perfectly fine.',
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
    cardMounts(src),
    'Every board card must tell its card whether a menu will be laid over it. ' +
      'Without the reservation the button sits on top of a line of truncating ' +
      'text.',
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
