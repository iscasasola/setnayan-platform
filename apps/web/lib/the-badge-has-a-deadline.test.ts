/**
 * GUARD — the Verified BADGE follows `hasVerifiedBadge` (its own deadline,
 * Q4/Q5/Q7), never `verification_state`/`public_visibility` read raw.
 *
 * Owner rulings 2026-09-11 (DECISION_LOG "SEVEN SUPPLIER-SIDE QUESTIONS"):
 *   Q4 — the two shops verified before the papers check keep the badge 6
 *        months while papers come in, then it comes off.
 *   Q5 — a Mayor's Permit that expires: reminder 60 days ahead, badge off on
 *        the day. THE SHOP STAYS LISTED AND BOOKABLE.
 *   Q7 — the free day-of tools get a dated end (unrelated to this guard,
 *        see lib/vendor-dayof-free-until.ts).
 *
 * PR #5433 built `hasVerifiedBadge` (lib/verified-badge.ts) and pointed the
 * marketplace cards + admin desk at it, but its own body named ~12 other
 * sites still reading `verification_state` alone for their badge. RULE 0
 * on THIS PR found the real picture is more specific than that list: most of
 * those sites feed `resolveVendorDisplayName`'s hybrid-anonymity NAME-REVEAL
 * gate (`is_verified` there — a DIFFERENT question, "is the name shown",
 * which the owner has never put a deadline on and MUST stay on the raw
 * state) or a ranking/compat-score input, or the `public_visibility`
 * listing/bookability state (also must stay raw — Q5 says explicitly the
 * shop stays listed past the badge's deadline). Only six sites actually fed
 * a rendered "Verified" pill off the raw state; this PR pointed all six at
 * `hasVerifiedBadge` (see `changelog.d/small-badge-spots.md` for the list).
 *
 * ── WHAT THIS GUARDS ─────────────────────────────────────────────────────
 * A raw `X.verification_state === 'verified'` or `X.public_visibility ===
 * 'verified'` comparison, ANYWHERE under `app/` (excluding the staff/shop's-
 * own trees below) or `lib/`. Every occurrence must be on BADGE_SITE_BILL
 * at its EXACT count, with a reason — a NEW file, or an existing file whose
 * count moved, fails until it is looked at and either (a) proven to feed
 * something other than the badge (add a bill line with the real reason) or
 * (b) routed through `hasVerifiedBadge` instead (the count drops, delete
 * the bill line).
 *
 * ── EXCLUDED TREES ───────────────────────────────────────────────────────
 *   app/admin/           — staff console; the desk already uses badgeDeadline.
 *   app/vendor-dashboard/ — the shop's OWN view of its OWN verification —
 *                           a different question from a COUPLE seeing the
 *                           badge, and not in scope for Q4/Q5/Q7's "couple
 *                           sees the badge" asks.
 *   app/api/              — machine endpoints, not rendered pages.
 *
 * ── WHAT IT DOES NOT COVER ───────────────────────────────────────────────
 *   • `.eq('verification_state', 'verified')` / `.match(...)` query-filter
 *     shapes (a LISTING filter, e.g. explore/compare's "only show verified
 *     shops" — a different question the owner has not asked to change).
 *   • `app/v/[slug]/page.tsx` — deliberately NOT scanned here. It is being
 *     edited by a parallel session (HONEST SHOP, PR #5450, the share-card
 *     metadata) at the time this guard was written, and its own badge fix
 *     is PART 3 of this build (L2, after that PR merges) — see
 *     changelog.d/small-badge-spots.md. Excluding it here avoids a false
 *     conflict with that session; PART 3 must extend BADGE_SITE_BILL (or
 *     drop this exclusion) once it lands.
 *   • Full transitive import-graph reachability (contrast
 *     `lib/no-door-out-of-the-app.test.ts`) — a path-prefix scan was enough
 *     to find and bill every real site RULE 0 turned up here, and stays
 *     fast. A future session tightening this guard can graduate it to the
 *     same reachability walk if a path-based gap is ever found.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { stripComments } from './strip-comments';

const WEB = path.join(import.meta.dirname, '..');

const EXCLUDED_PREFIXES = [
  'app/admin/',
  'app/vendor-dashboard/',
  'app/api/',
];

/** `app/v/[slug]/page.tsx` — see the header. Not a permanent exclusion. */
const DEFERRED_FILES = new Set(['app/v/[slug]/page.tsx']);

function scannedFiles(): string[] {
  const out = execSync(
    "grep -rl --include=*.ts --include=*.tsx '' app lib || true",
    { cwd: WEB, encoding: 'utf8', shell: '/bin/bash', maxBuffer: 64 * 1024 * 1024 },
  );
  return out
    .split('\n')
    .filter((f) => f && !f.includes('.test.'))
    .filter((f) => !EXCLUDED_PREFIXES.some((p) => f.startsWith(p)))
    .filter((f) => !DEFERRED_FILES.has(f));
}

const FILES = scannedFiles();

/**
 * BADGE_SITE_BILL — every file where a raw `=== 'verified'` comparison on
 * `verification_state` or `public_visibility` remains, with the EXACT count
 * and why it is not the badge. Each reason is checked (RULE 0, this PR,
 * 2026-09-11) against what the value actually feeds.
 */
const BADGE_SITE_BILL: ReadonlyMap<string, { count: number; why: string }> = new Map([
  [
    'app/dashboard/(account)/library/_data/saved-vendors.ts',
    { count: 1, why: 'Feeds resolveVendorDisplayName only — SavedVendorCard has no verified field, no badge renders here.' },
  ],
  [
    'app/dashboard/[eventId]/vendors/_actions/bench-marketplace-search.ts',
    { count: 1, why: 'Feeds resolveVendorDisplayName/isVendorNameRevealed only — the returned row carries no verified field.' },
  ],
  [
    'app/dashboard/[eventId]/vendors/_actions/category-search.ts',
    { count: 3, why: 'Two feed resolveVendorDisplayName/isVendorNameRevealed (name-reveal); one feeds computeCompatScore (a ranking input, not the badge). The badge field itself (verified:) now calls hasVerifiedBadge.' },
  ],
  [
    'app/dashboard/[eventId]/vendors/page.tsx',
    { count: 2, why: 'Both feed resolveVendorDisplayName/isVendorNameRevealed (name-reveal). The badge field (enrichmentByVendorId.is_verified) now calls hasVerifiedBadge.' },
  ],
  [
    'app/dashboard/[eventId]/messages/[threadId]/page.tsx',
    { count: 2, why: 'Both feed resolveVendorDisplayName (name-reveal) — no "Verified" badge renders on this page.' },
  ],
  [
    'app/dashboard/[eventId]/messages/page.tsx',
    { count: 2, why: 'Both feed resolveVendorDisplayName (name-reveal) — no "Verified" badge renders on this page.' },
  ],
  [
    'app/tour/vendors/page.tsx',
    { count: 1, why: 'Feeds computeCompatScore (a ranking input). The badge field (isVerified) now calls hasVerifiedBadge separately.' },
  ],
  [
    'app/(shell)/explore/compare/page.tsx',
    { count: 1, why: 'A LISTING filter ("only compare verified shops") — Q5 leaves listing/bookability on the raw state; not a badge render.' },
  ],
  [
    'lib/showcase-db.ts',
    { count: 1, why: 'Feeds resolveVendorDisplayName only — ShowcaseVendorCredit carries no verified field.' },
  ],
  [
    'lib/creator-public.ts',
    { count: 1, why: 'Feeds resolveVendorDisplayName only (a creator surface\'s vendor credit) — no badge field on the result.' },
  ],
  [
    'lib/creator-offers.ts',
    { count: 1, why: 'Feeds resolveVendorDisplayName only — same shape as creator-public.ts.' },
  ],
  [
    'lib/vendor-visibility.ts',
    { count: 1, why: 'The canonical isPubliclyVisible/isBookable helper — listing/bookability itself, which Q5 keeps on the raw state by design.' },
  ],
  [
    'app/(shell)/explore/_components/folder-vendors-section.tsx',
    { count: 1, why: 'Feeds resolveVendorDisplayName only — this card renders no separate "Verified" badge.' },
  ],
  [
    'app/(shell)/explore/_components/vendor-card.tsx',
    { count: 1, why: 'Feeds resolveVendorDisplayName only. The marketplace badge itself is a `badges` PROP already computed upstream via computeVendorBadges (lib/vendor-badges.ts, hasVerifiedBadge — fixed in #5433).' },
  ],
  [
    'app/v/[slug]/booth/page.tsx',
    { count: 2, why: 'One feeds resolveVendorDisplayName (name-reveal); one is the booth\'s public/verified LISTING gate (404 vs render — Q5 territory, stays raw). No "Verified" text renders on this page.' },
  ],
  [
    'app/dashboard/[eventId]/vendors/build-3state-actions.ts',
    { count: 1, why: 'Feeds computeCompatScore (a ranking input), not a rendered badge.' },
  ],
  [
    'app/(shell)/explore/page.tsx',
    { count: 1, why: 'Feeds computeCompatScore (a ranking input). The marketplace card\'s actual badge is computeVendorBadges (hasVerifiedBadge, already fixed in #5433) — see its own next_renewal_due_at select.' },
  ],
  [
    'lib/vendor-counts.ts',
    { count: 1, why: 'A per-service STATS counter (how many verified vendors per category) — not a rendered badge.' },
  ],
  [
    'lib/vendor-first-steps.server.ts',
    { count: 1, why: "A vendor's OWN onboarding-checklist gate (is this vendor verified, to show their own next step) — not a couple-facing badge." },
  ],
  [
    'lib/vendor-corrections.ts',
    { count: 1, why: "fetchVerifiedLock — whether THIS vendor's own identity fields are locked from editing (app/vendor-dashboard/actions.ts). The shop's own dashboard concern, not a couple-facing badge." },
  ],
]);

const RE = /\b[\w.?!]*\b(?:verification_state|public_visibility)\s*===\s*'verified'/g;

function badgeSiteCount(src: string): number {
  return [...src.matchAll(new RegExp(RE.source, 'g'))].length;
}

const STRIPPED = new Map(FILES.map((f) => [f, stripComments(readFileSync(path.join(WEB, f), 'utf8'))]));

test('the corpus is real (an emptied scan would pass vacuously)', () => {
  assert.ok(FILES.length > 500, `expected the app+lib sources, found ${FILES.length}`);
});

test('hasVerifiedBadge is reachable and the fixed sites actually call it', () => {
  for (const f of [
    'lib/wizard-recommendations.ts',
    'app/dashboard/[eventId]/vendors/_actions/category-search.ts',
    'app/dashboard/[eventId]/vendors/page.tsx',
    'app/onboarding/wedding/actions.ts',
    'app/tour/vendors/page.tsx',
    'app/_components/frontdoor/data.ts',
  ]) {
    const src = STRIPPED.get(f);
    assert.ok(src, `${f} is no longer scanned`);
    if (f !== 'lib/wizard-recommendations.ts') {
      assert.ok(src!.includes('hasVerifiedBadge('), `${f} no longer calls hasVerifiedBadge`);
    } else {
      assert.ok(src!.includes('next_renewal_due_at'), `${f} no longer carries the badge deadline`);
    }
  }
});

test('every raw verification_state/public_visibility === \'verified\' site is billed at its exact count', () => {
  const actual = new Map<string, number>();
  for (const [f, src] of STRIPPED) {
    const n = badgeSiteCount(src);
    if (n > 0) actual.set(f, n);
  }
  const problems: string[] = [];
  for (const [f, n] of actual) {
    const billed = BADGE_SITE_BILL.get(f);
    if (!billed) {
      problems.push(
        `NEW  ${f} reads verification_state/public_visibility raw ${n}× and is not on the bill. ` +
          'If it feeds a rendered "Verified" badge, switch it to hasVerifiedBadge() (lib/verified-badge.ts) ' +
          'instead — that is the whole point of this guard. If it genuinely feeds something else ' +
          '(name-reveal, a ranking input, a listing/bookability gate), add a bill line saying so.',
      );
    } else if (billed.count !== n) {
      problems.push(`MOVED ${f}: bill says ${billed.count}, found ${n} — update the bill or fix the new site.`);
    }
  }
  for (const [f, billed] of BADGE_SITE_BILL) {
    if (!actual.has(f)) {
      problems.push(`STALE ${f} is on the bill (${billed.count}) but reads none raw now — delete its line.`);
    }
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('the regex bites the shapes it claims to', () => {
  assert.equal(badgeSiteCount("const x = row.verification_state === 'verified';"), 1);
  assert.equal(badgeSiteCount("verified: vendor.public_visibility === 'verified',"), 1);
  assert.equal(badgeSiteCount("hasVerifiedBadge({ verification_state, next_renewal_due_at })"), 0);
  assert.equal(badgeSiteCount(".eq('verification_state', 'verified')"), 0);
});

test('the bill and the exclusions carry real reasons', () => {
  for (const [f, b] of BADGE_SITE_BILL) assert.ok(b.why.length > 30, `${f} has no real reason`);
});
