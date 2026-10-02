/**
 * ⚖ Owner tracker d19 (2026-10-02, first-timer test fix 1): **couples read "book",
 * never "lock"** — "Ask X to confirm your booking" · "Book ›" · "This books your
 * date." The supplier side may keep its own word.
 *
 * 🔑 THE PROPERTY: outside the reasoned allowlist below, no word a person reads says
 * "lock / locked / locking". Identifiers, routes, columns, stored notes, icon names
 * and comments are not words on a screen and stay (`retired-names-scan.ts` judges
 * each occurrence by its AST position; `retired-word-guard.ts` is the shared walk).
 *
 * The allowlist is where "lock" is still the right word, in three families:
 *   1. the supplier's own screens, and staff/legal text nobody on the couple side reads;
 *   2. things that are not a supplier booking — a seat, the guest count, the privacy
 *      screen, the mood board, a Papic price, the DATE's own lock state;
 *   3. strings the database matches on, so changing the word in code alone breaks them.
 * ⚠ Family 2 includes the date's lock ("Lock this date", "The date is locked"). The
 * ruling names the booking; whether the date's own state should also read "set" is an
 * owner call this guard does not make — it only keeps the booking from relapsing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { RetiredName } from './retired-names-scan';
import { allowlistProblems, scanSource, scanTree, type WordAllow } from './retired-word-guard';

const NAMES: readonly RetiredName[] = [{ was: 'lock', now: 'book', pattern: 'lock(?:ed|ing)?' }];

const ALLOW: readonly WordAllow[] = [
  // ── 1 · the supplier's side, staff and legal text ───────────────────────────
  { prefix: 'app/vendor-dashboard/', why: 'the supplier app — the supplier side keeps its own word (owner d19)' },
  { prefix: 'app/vendor/', why: 'supplier claim / lock-by-token pages — read by the supplier, not the couple' },
  { prefix: 'app/for-suppliers/', why: 'supplier-facing marketing — the supplier side keeps its own word' },
  { prefix: 'app/_components/proposal-maker.tsx', why: "the supplier's quote builder — supplier side" },
  { prefix: 'app/_components/chat-amendment-card.tsx', text: /Waiting for the couple to lock/, why: 'the supplier’s view of the same card; the couple’s button reads "Book this deal"' },
  { prefix: 'app/_components/negotiation-actions.ts', text: /Deal locked/, why: 'the notification title the SUPPLIER receives when the couple books' },
  { prefix: 'app/proposals/', text: /already locked at the accepted quote|couple has asked to lock/, why: 'supplier-only notices on the quote page' },
  { prefix: 'app/[slug]/_components/supplier-desk.tsx', why: "the supplier's day-of desk — supplier side" },
  { prefix: 'lib/vendor-', why: 'supplier-facing helpers (verification, first steps, funnel, payment schedules, corrections)' },
  { prefix: 'lib/supplier-', why: 'the supplier’s Today / next-move copy' },
  { prefix: 'lib/quote-event-brief.ts', why: "the event brief a supplier reads while building a quote (\"Already locked\" = suppliers the couple has booked)" },
  { prefix: 'lib/chat-actions.ts', why: 'the supplier’s inbox limit message ("Lock one in, or decline someone")' },
  { prefix: 'lib/proposal-send.ts', why: 'notices a supplier reads when sending a quote' },
  { prefix: 'lib/quote-card-state.ts', text: /asked you to lock|waiting for the couple to lock/, why: 'the supplier’s lines of the quote card; the couple’s read "confirm your booking"' },
  { prefix: 'lib/lock-freeze-copy.ts', text: /couple can lock a price|Deal locked — price frozen/, why: 'the supplier’s lines of the deal card; the couple’s read "Booked — price frozen."' },
  { prefix: 'lib/deal-lock-readiness.ts', text: /couple can’t lock this deal|can’t lock it\./, why: 'the supplier’s variant of the same refusal; the couple’s says "booked"' },
  { prefix: 'lib/event-access-stage.ts', why: "the supplier's day-of fee screen — supplier side" },
  { prefix: 'lib/tours.ts', text: /booking locks/, why: "the supplier's schedule tour" },
  { prefix: 'app/admin/', why: 'the staff console' },
  { prefix: 'lib/admin/', why: 'the staff console’s helpers' },
  { prefix: 'lib/ugat/', why: 'the staff Root map’s own vocabulary' },
  { prefix: 'lib/erasure/', why: 'the DPO’s erasure register (legal text)' },
  { prefix: 'lib/security/', why: 'internal security registries' },
  { prefix: 'lib/interconnect/', why: 'internal reachability probes' },
  { prefix: 'lib/plausibility-', why: 'staff price-plausibility review' },
  { prefix: 'lib/prove-the-flow-watch-format.ts', why: 'staff flow-watch report' },
  { prefix: 'lib/blog', why: 'public blog articles — a separate SEO pass' },
  { prefix: 'lib/data-privacy-controls.ts', why: 'the DPO register quotes the consent control by name and is mirrored by migration 20270902120000 — renamed through a data migration, not a code edit' },
  { prefix: 'app/(shell)/privacy/', why: 'legal text — the privacy policy' },
  // ── 2 · not a supplier booking ──────────────────────────────────────────────
  { prefix: 'app/dashboard/[eventId]/seating/', why: 'a SEAT lock ("Lock this seat", "Fill around locked seats")' },
  { prefix: 'app/dashboard/[eventId]/guests/', why: 'a guest’s seat lock, or the finalized guest count' },
  { prefix: 'lib/extra-seats-sync.ts', why: 'the finalized guest count' },
  { prefix: 'app/dashboard/[eventId]/website/privacy/', why: 'the private-event "locked screen" a guest sees' },
  { prefix: 'lib/event-hub-control.ts', why: 'the private-event lock screen' },
  { prefix: 'lib/user-delete-blockers.ts', why: 'an account locked out on deletion' },
  { prefix: 'app/(shell)/mood-board/', why: 'the mood board ("Nothing here is locked")' },
  { prefix: 'app/dashboard/[eventId]/studio/mood-board/', why: 'a mood-board preview the couple keeps as is' },
  { prefix: 'lib/help.ts', text: /locked vision|locked behavior/, why: 'a locked mood-board vision and a locked display-name rule — neither is a booking' },
  { prefix: 'app/(shell)/papic/', why: 'Papic credits — "never locked into what you pick"' },
  { prefix: 'app/dashboard/[eventId]/studio/papic/', why: 'a locked Papic price' },
  { prefix: 'lib/camera-bridge/', why: 'a locked Papic clip cap — a developer error string' },
  { prefix: 'app/(shell)/pricing/', why: '"no lock-in" — a contract word, not a booking' },
  { prefix: 'app/(shell)/explore/compare/', text: /hide-prices lock/, why: 'a demo-data note about the hide-prices rule' },
  { prefix: 'app/v/[slug]/page.tsx', text: /hide-prices lock/, why: 'an admin dogfooding note about the hide-prices rule' },
  { prefix: 'app/dashboard/(account)/create-event/', why: '"Nothing is locked in" — the event-type choice can still change' },
  { prefix: 'app/dashboard/[eventId]/alaala/', why: 'fixed editorial moments, not a booking' },
  { prefix: 'app/dashboard/[eventId]/clearance/', why: 'locking the photo wall so it becomes the recap' },
  { prefix: 'app/panood/control/', why: 'a venue screen locked with the Live Watch purchase' },
  { prefix: 'app/_components/app-store/studio-card-demo.tsx', text: /locked to your wedding/, why: 'a song kept to one wedding' },
  { prefix: 'app/[slug]/_components/tier-comparison-widget.tsx', why: 'a guest’s +1 count is locked once registered' },
  { prefix: 'lib/feature-pages/plan-b.ts', why: '"Nothing is locked" — nothing is committed' },
  { prefix: 'lib/hub-setup-locks.ts', why: 'a Maker step locked until its prerequisite is done' },
  { prefix: 'lib/paid-mark.ts', why: 'a paid-add-on mark in the Maker' },
  { prefix: 'lib/nfc-tag.ts', why: 'a locked NFC sticker' },
  { prefix: 'lib/push-unblock-steps.ts', why: 'the padlock icon in the browser’s address bar' },
  { prefix: 'lib/nav-registry-defaults.ts', text: /^Lock$/, why: 'the lucide icon name "Lock", read by code' },
  // the DATE's own lock state (see the ⚠ in the docblock)
  { prefix: 'app/dashboard/[eventId]/date-selection/', why: "the date's own lock — picking and confirming the date" },
  { prefix: 'app/dashboard/[eventId]/find-date/', why: "the date's own lock" },
  { prefix: 'app/dashboard/[eventId]/_components/set-date-nudge.tsx', why: "the date's own lock" },
  { prefix: 'app/dashboard/[eventId]/_components/event-dashboard.tsx', text: /date is locked|not locked yet/, why: "the date's own lock state on the event dashboard" },
  { prefix: 'app/dashboard/[eventId]/actions.ts', text: /Date is locked|type is locked/, why: 'a refusal to change a date or type a booked supplier fixed' },
  { prefix: 'app/(shell)/explore/_components/vendors-availability-banner.tsx', why: "the date's own lock" },
  { prefix: 'lib/home-first-screen.ts', why: "the date's own lock" },
  { prefix: 'lib/planner.ts', why: 'planner nudges to fix the event date and the table count' },
  { prefix: 'lib/wedding-roadmap.ts', why: "the date's own lock" },
  { prefix: 'lib/progress-stages.ts', text: /Lock your exact date/, why: "the date's own lock" },
  { prefix: 'lib/checklist.ts', text: /locked date|Lock your date/, why: "the date's own lock" },
  { prefix: 'lib/checklist-event-type-defs.ts', why: 'lock the time of a non-wedding event' },
  { prefix: 'lib/onboarding/specialty-recommendations.ts', text: /lock the reunion date|lock the date to their trip/, why: "the date's own lock" },
  // ── 3 · strings the database matches on ─────────────────────────────────────
  { prefix: 'app/dashboard/[eventId]/vendors/actions.ts', text: /awaiting vendor confirmation|^Lock \(finalize\) vendor booking$/, why: 'the payment stamp note the deposit trigger matches, and an analytics element name' },
];

test('the scanner flags "lock" where a person reads it', () => {
  const visible = [
    ['a.tsx', `export const A = () => <button>Lock this pick</button>;`],
    ['b.ts', `export const t = 'Ask them to lock';`],
    ['c.ts', "export const t = (n: string) => `Locking ${n}…`;"],
    ['d.tsx', `export const D = () => <span aria-label="Locked suppliers" />;`],
    ['e.ts', `export const t = { label: 'Locked' };`],
  ] as const;
  for (const [f, s] of visible) assert.ok(scanSource(f, s, NAMES).length >= 1, `missed a visible word in: ${s}`);
});

test('the scanner leaves identifiers, routes, class names and comments alone', () => {
  const code = [
    `export const k = 'lock_group_id';`,
    `export const r = '/dashboard/x/lock-door';`,
    `export const c = () => <span className="chip locked" />;`,
    `// Lock this pick — a comment`,
    `export const s = 'locked_at, lock_state';`,
    `import { x } from '@/lib/lock-door';`,
    `export const t = 'You have booked {locked} of {total}';`,
    `export const log = () => console.warn('lock refused');`,
    `export const l = 'Block';`,
  ];
  for (const s of code) assert.deepEqual(scanSource('x.tsx', s, NAMES), [], `flagged code as copy: ${s}`);
});

test('no couple screen says "lock" for a supplier booking', () => {
  const r = scanTree(NAMES, ALLOW, new Set(['lib/the-couple-books-never-locks.test.ts']));
  console.log(`[couple-books] ${r.scanned} files · ${r.findings.length} findings · ${r.excused} excused by the allowlist`);
  assert.ok(r.scanned > 1000, `walked only ${r.scanned} files — the walk is broken`);
  assert.ok(r.excused > 20, 'the allowlist matched almost nothing — the scan is not reading the tree');
  assert.deepEqual(
    r.findings,
    [],
    'A couple reads "book", never "lock" (owner d19). Change the WORD, never the identifier — or, if ' +
      'it is not a supplier booking, add it to ALLOW with its reason:\n  ' + r.findings.join('\n  '),
  );
});

test('every allowlist row is real, reasoned and still needed', () => {
  const r = scanTree(NAMES, ALLOW);
  assert.deepEqual(allowlistProblems(ALLOW, r.used), []);
});
