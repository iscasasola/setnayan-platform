/**
 * counter-on-the-card.test.ts — the number rides the event it belongs to, and
 * the way to remove an event is a sibling of the card, never inside it.
 *
 * ─── WHAT THIS HOLDS (owner 2026-08-20) ─────────────────────────────────────
 * 1 · EVERY composition carries the count. The retired banner rendered
 *     `watchRows[0]` — the busiest event and no other — so a second event with
 *     something waiting said nothing at all, on a page whose entire job is to
 *     show you your events.
 *     ⚠ THERE USED TO BE THREE COMPOSITIONS (desktop glass · mobile hero ·
 *     mobile chip) and this file argued that a count on two of them was the
 *     same defect one size smaller. Since 2026-08-23 there is ONE card at every
 *     width (owner ruling — `DECISION_LOG.md`), so "every composition" is one
 *     composition. The assertions below are re-anchored to that, NOT relaxed:
 *     each still checks the same property, and the derived counts still fail if
 *     a shelf mounts a card the guard does not reach.
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

/**
 * Every place the board mounts a card. Counted from the SOURCE rather than
 * written down as a number: the board grew a shelf on 2026-08-20 (Finished
 * split into Unpublished + Published) and a hardcoded 5 turned that into a
 * failure of a guard that was not actually broken. **A count of what exists is
 * a fact; a count typed into a test is a claim with an expiry date.**
 */
function cardMounts(src: string): number {
  return (src.match(/<GlassEventCard\s/g) ?? []).length;
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

test('the one card renders the NAMED counter, at every width', () => {
  const src = stripComments(read(LAUNCHER));
  const mounts = src.match(/<EventAttention\s/g) ?? [];
  assert.equal(
    mounts.length,
    1,
    `EventAttention is mounted ${mounts.length} time(s). There is one card ` +
      'composition; more than one mount means a second card came back without ' +
      'this guard noticing, and none means the count is gone from the board.',
  );
  /*
    ⚠ THE PHONE GAINED SOMETHING HERE, IT DID NOT LOSE IT. The two-up chip that
    used to serve phones could not fit a named label, so it printed a bare
    total ("3 need you"). The card that replaced it renders the same
    `EventAttention` the wide layout always had — the count AND what it is
    about. The retired assertion on the chip's bare total is not restated
    anywhere, because there is no longer anything that renders one.
  */
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
  /*
    The chip's own parallel refusal (`summary.total > 0 && stance !== 'invited'`)
    went with the chip. One component now decides this, which is why the refusal
    above is the whole rule rather than one of two copies that could drift.
  */
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
  // The `upcoming[0]` variant went with the phone hero — the board no longer
  // singles out a first event, so every reservation is written the same way.
  const reserved = src.match(/hasMenu=\{event\.member_type === 'couple'\}/g) ?? [];
  assert.equal(
    reserved.length,
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

test('the card menu is actually MOUNTED on every card, not merely defined', () => {
  const src = stripComments(read(LAUNCHER));
  // 🚨 THE GAP AN ADVERSARIAL PASS FOUND IN THIS FILE'S FIRST CUT. Every other
  // assertion here proved the wrapper was DEFINED and that cards were told a
  // menu would be laid over them (`hasMenu`) — neither of which renders it.
  // Deleting every <BoardCardWithMenu> wrapper left the whole launcher suite
  // green while the menu vanished from the product: the classic
  // imported-but-not-mounted decoration, in a guard file written to prevent
  // exactly that.
  //
  // DERIVED from cardMounts for the reason this file's own header gives — a
  // count typed into a test is a claim with an expiry date. It expired inside
  // one branch: the PUBLISHED shelf arrived with two more card call sites and
  // a hardcoded 5 would have failed for a reason that had nothing to do with
  // whether those new cards were wired.
  const wrapped = (src.match(/<BoardCardWithMenu\b/g) ?? []).length;
  assert.equal(
    wrapped,
    cardMounts(src),
    `${cardMounts(src)} board cards are mounted but ${wrapped} are wrapped in ` +
      'the menu. A card rendered outside the wrapper cannot be put away or ' +
      'removed, and looks completely normal.',
  );
});

/*
  ⛔ DELETED 2026-08-23 — "every two-up chip grid alternates the popover anchor".

  It derived its subject list from `<MobileEventChip` mounts, and there are now
  none: one card renders at every width, one column on a phone, so no card sits
  in a left column with a 280px popover to hang off the side of the screen.

  🪤 IT IS DELETED RATHER THAN LEFT PASSING. With zero chips it compared 0 to 0
  and went green — a vacuous assertion that reads exactly like a guard doing its
  job. If two-up chips ever return, this check must return with them; leaving a
  hollow version standing would make it look like they were already covered.
*/

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

test('the pill never says the same number twice', () => {
  const src = stripComments(read(LAUNCHER));
  // 🔴 THE OWNER SAW "9 need you · 9 tasks overdue" ON HIS OWN HOME SCREEN.
  // summarizeEventDecisions always returns a COUNT-LED label, so when the total
  // equals the top action's count — everything waiting is one kind — printing
  // the total as well states the same number twice.
  //
  // The total is passed ONLY when other kinds are also waiting, i.e. when it is
  // strictly larger than the top count and therefore says something the label
  // cannot.
  assert.match(
    src,
    /const otherKinds = Math\.max\(0, summary\.total - summary\.top\.count\);/,
    'The pill lost the test that decides whether the total adds anything.',
  );
  assert.match(
    src,
    /count=\{otherKinds > 0 \? summary\.total : undefined\}/,
    'The total is being passed unconditionally again — a card with one kind of ' +
      'thing waiting will read "9 need you · 9 tasks overdue".',
  );
});
