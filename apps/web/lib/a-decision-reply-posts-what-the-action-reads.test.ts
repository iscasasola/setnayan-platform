/**
 * a-decision-reply-posts-what-the-action-reads.test.ts
 *
 * ── What this exists to stop ────────────────────────────────────────────────
 * Every reply on the Decisions view is a hand-written `<form>` posting hidden
 * fields to an action that already exists. Nothing type-checks a hidden
 * field's NAME against the `formData.get(…)` that reads it — a typo compiles,
 * renders, submits, and the action quietly does something else.
 *
 * The case that makes this concrete: the meeting action reads `return_path`
 * and the adjustment action reads `return_to`. Normalise the adjustment form to
 * `return_path` — the obvious tidy-up — and `safeReturn(null)` sends every
 * couple who accepts an adjustment to a bare `/dashboard` instead of back to
 * the conversation. It works. It just lands them somewhere else, every time.
 *
 * ── Why it compares against the ACTION, not the existing card ───────────────
 * "Posts the same fields as the chat's own card" is a proxy: two forms can
 * agree with each other and both be wrong. The claim that matters is that the
 * form supplies what the action READS, and reads nothing it does not supply.
 * So each assertion is two-sided:
 *
 *   • every name the action reads (minus an explicitly-reasoned optional list)
 *     is posted — else the action runs without it;
 *   • every name posted is read — else it is dead, and usually a misspelling
 *     of one of the required ones.
 *
 * 🛡 Runs on comment-stripped source (`lib/strip-comments.ts`, the repo's one
 * stripper), so the ⚠ note naming `return_to` inside the component cannot
 * satisfy the check on the form's behalf.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** The source between `start` and the next top-level function (or EOF). */
function slice(src: string, start: string): string {
  const at = src.indexOf(start);
  assert.notEqual(at, -1, `could not find "${start}" — renamed? update this guard`);
  const rest = src.slice(at + start.length);
  // Any top-level function — async or not — or the next `case` ends the slice.
  // (It once stopped only at async ones, so the last `case` ran on into the
  // next React component and read ITS forms as the quote's.)
  const next = rest.search(/\n(?:export\s+)?(?:async\s+)?function |\n\s*case '/);
  return next === -1 ? rest : rest.slice(0, next);
}

const readsOf = (body: string) =>
  new Set([...body.matchAll(/formData\.get\(\s*'([a-z_]+)'\s*\)/g)].map((m) => m[1]!));
const postsOf = (body: string) =>
  new Set([...body.matchAll(/name="([a-z_]+)"/g)].map((m) => m[1]!));

const VIEW = read('app/_components/chat-thread-views.tsx');
const APPT = read('app/_components/appointments-actions.ts');
const NEG = read('app/_components/negotiation-actions.ts');
const PAY = read('app/vendor-dashboard/messages/[threadId]/pay-confirm-actions.ts');
const PAX = read('app/vendor-dashboard/messages/[threadId]/pax-actions.ts');
/** The shared new-time form — posted from Decisions AND the chat card. */
const NEW_TIME = read('app/_components/propose-new-time-form.tsx');

type Case = {
  reply: string;
  /**
   * The source of the reply's form(s). Defaults to the `case` branch; a reply
   * that grew its own component names it, plus any shared form it renders.
   */
  formSource?: string;
  actionBody: string;
  /** Read by the action but legitimately not posted from Decisions — with why. */
  optional: Record<string, string>;
};

const CASES: Case[] = [
  {
    reply: "case 'meeting':",
    // Confirm · New time · Decline — the three the chat card offers. The new
    // time is the SHARED form, so it is checked once here for both doors.
    formSource: slice(VIEW, 'function MeetingReply(') + NEW_TIME,
    actionBody: slice(APPT, 'export async function respondAppointment('),
    optional: {
      duration_min: 'a new time keeps the length already booked; neither door asks for one',
    },
  },
  {
    reply: "case 'adjustment':",
    actionBody: slice(NEG, 'export async function respondAmendmentFromChat('),
    optional: { reason: 'an optional note on decline; the chat card does not ask for one either' },
  },
  {
    reply: "case 'payment':",
    actionBody: slice(PAY, 'export async function confirmVendorPayment('),
    optional: {},
  },
  {
    reply: "case 'guest_count':",
    // Both pax actions read their fields through the shared `resolve()`.
    actionBody: slice(PAX, 'async function resolve('),
    optional: {},
  },
];

for (const c of CASES) {
  test(`the ${c.reply.replace(/case '|':/g, '')} reply posts exactly what its action reads`, () => {
    const reads = readsOf(c.actionBody);
    const posts = postsOf(c.formSource ?? slice(VIEW, c.reply));
    assert.ok(reads.size > 0, 'found no formData.get in the action — the slice is wrong, not the form');

    for (const name of reads) {
      if (name in c.optional) continue;
      assert.ok(posts.has(name), `the action reads "${name}" but the Decisions form never posts it`);
    }
    for (const name of posts) {
      assert.ok(
        reads.has(name),
        `the Decisions form posts "${name}", which the action never reads — dead, or a misspelling`,
      );
    }
  });
}

test('the quote reply is a link, and posts to no action at all', () => {
  const body = slice(VIEW, "case 'quote_review':");
  assert.match(body, /href=\{`\/proposals\/\$\{reply\.publicId\}`\}/, 'the review link moved or lost its public id');
  assert.doesNotMatch(body, /<form/, 'a quote reply grew a form — accepting books the supplier; review first');
});
