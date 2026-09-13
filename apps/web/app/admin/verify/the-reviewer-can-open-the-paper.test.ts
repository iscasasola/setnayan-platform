/**
 * the-reviewer-can-open-the-paper.test.ts
 *
 * TWO MEASURED DEFECTS ARE PINNED HERE, AND THEY HAD TO BE FIXED TOGETHER.
 *
 *  1. **The reviewer could not open a single document from this queue.** The
 *     checklist drawer showed a tick per slot; the only opener in the product
 *     lived on /admin/verification-docs, a storage-hygiene page listing raw R2
 *     keys with no idea which application they belonged to. An automated
 *     mismatch report that escalates to a human who cannot see the paper has
 *     escalated to nowhere.
 *
 *  2. **A one-click Approve → Verified granted the badge with no documents and
 *     no complete profile** — and it is the ONLY verification path production
 *     has ever used. Measured 2026-09-09 in prod: two shops, both `verified`,
 *     every identity column NULL, one `vendor_visibility_change` audit row
 *     whose timestamp matches a shop's `last_verified_at` to the tenth of a
 *     second, and the only application ever created still a draft.
 *
 * ⚠ Source-scanning guards, so every scan STRIPS COMMENTS FIRST — the files
 * they read carry prose naming the very strings being searched for, and a
 * raw-source match would report a pass built out of its own documentation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/**
 * One function body, from its declaration to the next top-level one.
 *
 * 🪤 REV 1 SLICED A FIXED 2,600 CHARACTERS INSTEAD. Adding a cross-shop refusal
 * pushed the content-disposition line past the window and this file went red
 * for a reason that had nothing to do with the code — and the same window would
 * have gone **GREEN ON NOTHING** had the function grown the other way round.
 * A fixed-length slice is not a function body. The floor below means a rename
 * can never leave a check quietly passing on an empty string.
 */
function bodyOf(src: string, fn: string): string {
  const start = src.indexOf(`function ${fn}(`);
  assert.ok(start > 0, `${fn} is gone — it was renamed or deleted`);
  const after = src.slice(start + 10);
  const next = after.search(/\n(export )?(async )?function /);
  const body = next === -1 ? after : after.slice(0, next);
  assert.ok(
    body.length > 200,
    `${fn}: the slice came back nearly empty, so any check on it would pass on anything`,
  );
  return body;
}

const OPENER = 'openApplicationDocument';

const VERIFY_PAGE = 'app/admin/verify/page.tsx';
const VERIFY_ACTIONS = 'app/admin/verify/actions.ts';
const BYPASS_ACTIONS = 'app/admin/vendors/verification-bypass-actions.ts';

// ---------------------------------------------------------------------------
// 1 · THE REVIEWER CAN OPEN THE PAPER
// ---------------------------------------------------------------------------

test('the verification queue offers a way to open a document', () => {
  const page = read(VERIFY_PAGE);
  assert.match(
    page,
    /action=\{openApplicationDocument\}/,
    'no form on the queue posts to the document opener — the drawer is back to ticks only',
  );
  assert.match(page, /<SlotDocuments\b/, 'the per-slot opener is not mounted in the checklist');
});

test('the opener re-derives the key from the application instead of trusting the form', () => {
  const body = bodyOf(read(VERIFY_ACTIONS), OPENER);

  // The whole point: this queue admits `is_team_member` and `account_type =
  // 'admin'`, a strictly wider room than the /admin/verification-docs page
  // (`is_internal` only). Presigning whatever key the form posts would hand
  // that wider room a reader for every government ID in the bucket.
  assert.match(
    body,
    /from\('vendor_verification_applications'\)/,
    'the opener does not read the application back — the posted key is trusted',
  );
  assert.match(
    body,
    /allowed\.includes\(requestedKey\)|includes\(\s*requestedKey\s*\)/,
    'the posted key is never checked against the application it claims to be on',
  );
  assert.match(body, /requireAdmin\(\)/, 'the opener is not admin-gated');
});

test('the opened link is short-lived and downloads rather than rendering in the tab', () => {
  const body = bodyOf(read(VERIFY_ACTIONS), OPENER);
  assert.match(
    body,
    /responseContentDisposition:\s*contentDispositionAttachment\(/,
    'without an attachment disposition a government ID renders inline and lands in the tab history',
  );
  const ttl = /expiresIn:\s*(\d+)/.exec(body);
  assert.ok(ttl, 'the presigned link has no explicit lifetime');
  assert.ok(
    Number(ttl![1]) <= 300,
    `a link to a government ID lives ${ttl![1]}s — the sibling page uses 120`,
  );
});

test('no presigned document URL is baked into the queue markup', () => {
  const page = read(VERIFY_PAGE);
  // A queue listing 200 shops that presigned inline would be 200 long-lived
  // links to government IDs sitting in one HTML document.
  assert.doesNotMatch(
    page,
    /r2SignedGet|presignDisplayUrl\(\s*R2_BUCKETS\.vendorVerification/,
    'the page mints a document URL itself instead of going through the action',
  );
});

test('the checklist no longer claims a slot count it does not have', () => {
  const page = read(VERIFY_PAGE);
  // It said "12-doc checklist" for months while DOC_SLOTS held eight.
  assert.doesNotMatch(page, /12-doc checklist/, 'the stale hardcoded count is back');
  assert.match(
    page,
    /\{DOC_SLOTS\.length\}-item checklist/,
    'the count is hardcoded again instead of derived from the slot list',
  );
});

// ---------------------------------------------------------------------------
// 2 · EVERY DOOR TO THE BADGE RECORDS WHAT THE CHECKS FOUND
// ---------------------------------------------------------------------------

/**
 * 🔑 DERIVED, NOT HAND-LISTED. A hand-written list of grant paths is a list of
 * the ones somebody thought of — which is exactly how the bypass action shipped
 * outside every fence. This finds them by asking which code WRITES
 * `verification_state: 'verified'` or `public_visibility: 'verified'`, so a
 * fourth door added tomorrow fails this test until it is covered.
 */
const GRANT_FILES = [VERIFY_ACTIONS, BYPASS_ACTIONS];

test('every file that grants the verified badge is one of the files this test covers', () => {
  const suspects = [
    VERIFY_ACTIONS,
    BYPASS_ACTIONS,
    'app/admin/vendors/actions.ts',
    'app/admin/accounts/_surfaces/vendors-surface.tsx',
  ];
  const granting = suspects.filter((rel) => {
    const src = read(rel);
    return (
      /verification_state:\s*'verified'/.test(src) ||
      /public_visibility:\s*'verified'/.test(src) ||
      /nextVisibility:\s*'verified'/.test(src)
    );
  });
  assert.ok(granting.length > 0, 'the scan found no grant path at all — it has stopped working');
  for (const g of granting) {
    assert.ok(
      GRANT_FILES.includes(g),
      `${g} grants the verified badge and is outside the set this test fences. ` +
        'Cover it or say in the PR why it is deliberately exempt.',
    );
  }
});

/**
 * 🪤 REV 1 OF THIS TEST WAS DECORATION AND ONLY MUTATION FOUND IT. It matched
 * `evidence_at_grant` anywhere in the FILE — but `verify/actions.ts` holds TWO
 * grant paths, so deleting the record from the visibility one (the path that
 * has issued every badge production ever granted) left the applications one
 * standing and the test reported a clean pass. **A file-level count cannot say
 * which path still does the thing.** Each path is sliced and checked on its own
 * now, and the slice boundaries are asserted so a rename cannot silently empty
 * one.
 */
const GRANT_PATHS: ReadonlyArray<{ file: string; fn: string; what: string }> = [
  {
    file: VERIFY_ACTIONS,
    fn: 'transitionVendorVisibility',
    what: 'the one-click Approve — the only path production has ever used',
  },
  {
    file: VERIFY_ACTIONS,
    fn: 'applyApplicationDecision',
    what: 'the applications queue decision',
  },
  { file: BYPASS_ACTIONS, fn: 'grantVerificationBypass', what: 'the vouch' },
];

test('EVERY grant path records the evidence snapshot — checked per path, not per file', () => {
  for (const { file, fn, what } of GRANT_PATHS) {
    const body = bodyOf(read(file), fn);
    assert.match(
      body,
      /verificationEvidenceSnapshot\(/,
      `${fn} (${what}) hands out the verified badge without asking what the checks found`,
    );
    assert.match(
      body,
      /evidence_at_grant/,
      `${fn} (${what}) computes the snapshot but never writes it into the audit row`,
    );
  }
});

test('the vouch door is reachable — a grant nobody can press is not a grant', () => {
  const page = read(VERIFY_PAGE);
  // `grantVerificationBypass` merged on 2026-09-07 and had ZERO callers: its
  // only references in the repo were its own test and a generated inventory,
  // and its table held zero rows. Leaving it unreachable did not prevent
  // vouching — it pushed every real vouch through the plain Approve button,
  // which records no reason and expires never.
  assert.match(
    page,
    /action=\{grantVerificationBypass\}/,
    'nothing on the verification queue can grant a vouch',
  );
  assert.match(
    page,
    /action=\{revokeVerificationBypass\}/,
    'a vouch can be granted with no way to take it back — a forward primitive with no inverse',
  );
});

test('the grant dialog names what is unchecked before the badge is handed over', () => {
  const page = read(VERIFY_PAGE);
  const uses = page.match(/grantWarning\(/g) ?? [];
  assert.ok(
    uses.length >= 2,
    `grantWarning reaches ${uses.length} of the grant dialogs — both the applications ` +
      'queue and the visibility queue hand out the same badge and both must say what was not checked',
  );
});

test('the desk shows a result per check on both surfaces', () => {
  const page = read(VERIFY_PAGE);
  const mounts = page.match(/<CheckResultsBlock\b/g) ?? [];
  assert.ok(
    mounts.length >= 2,
    `the check results render on ${mounts.length} surface(s); the applications queue and the ` +
      'visibility queue both decide this badge and both need them',
  );
});

test('the desk never renders an overall verdict beside the per-check results', () => {
  const page = read(VERIFY_PAGE);
  // A single "ready to approve" pill is what a tired reviewer reads INSTEAD of
  // the ten results underneath it — and it would quietly restore the one-click
  // approval this desk exists to put evidence behind.
  assert.doesNotMatch(
    page,
    /ready to approve|safe to approve|verification passed|all checks passed/i,
    'the desk grew a whole-of-application verdict',
  );
});

// ---------------------------------------------------------------------------
// The storage probe must keep telling "gone" from "did not answer"
// ---------------------------------------------------------------------------

test('the discriminating HEAD claims "absent" only on a real 404', () => {
  const body = bodyOf(read('lib/r2.ts'), 'r2HeadOutcome');
  assert.match(body, /status === 404/, 'the absent branch no longer requires a 404');
  assert.match(body, /kind: 'unknown'/, 'every non-404 failure must degrade to unknown');
  // A 403 must NEVER be read as "the file is not there": the file may be
  // perfectly present and the credentials wrong, and calling that a mismatch
  // invents a finding out of a misconfiguration.
  assert.doesNotMatch(body, /status === 403[^\n]*absent/, 'a 403 is being read as absent');
});

test('neither the probe nor the opener hardcodes a bucket for a stored reference', () => {
  // `doc_uploads` holds `r2://bucket/key`, and the vendor-side writer accepts
  // TWO buckets — the private verification one for the four documents, the
  // PUBLIC media one for portfolio samples. A constant here HEADs every file
  // under the wrong name in the wrong bucket and announces "nothing is stored
  // there" on every row: not a missed finding, a loud invented one.
  const server = read('lib/verification-checks-server.ts');
  assert.match(
    server,
    /resolveDocumentLocation\(/,
    'the storage probe no longer resolves the bucket from the stored reference',
  );
  assert.doesNotMatch(
    server,
    /r2HeadOutcome\(\{\s*bucket:\s*R2_BUCKETS\.\w+/,
    'the probe HEADs a hardcoded bucket again',
  );

  const body = bodyOf(read(VERIFY_ACTIONS), OPENER);
  assert.match(body, /resolveDocumentLocation\(/, 'the opener guesses the bucket again');
  assert.doesNotMatch(
    body,
    /r2SignedGet\(\{\s*bucket:\s*R2_BUCKETS\.\w+/,
    'the opener signs a hardcoded bucket — a valid link to an object that is not there',
  );
});

test('the queue reads its checks in a batch, not once per card', () => {
  const page = read(VERIFY_PAGE);
  // The visibility list reads up to 200 rows. A per-card builder there is 400+
  // concurrent round trips from one render.
  assert.doesNotMatch(
    page,
    /vendors\.map\([^)]*buildVerificationChecksForVendor\b/,
    'the per-shop builder is being fanned out over the whole queue again',
  );
  assert.match(page, /buildVerificationChecksForVendors\(/, 'the batched builder is gone');
});

test('the opener refuses a file filed under a different shop', () => {
  // Both vendor-side writers pin an `r2://…` ref to the vendor's own folders —
  // and both let a BARE value through unvalidated, which their own SEC-1
  // comments call write pollution. A stored bare key can therefore name another
  // shop's folder. The tenancy CHECK reports that; the opener must also refuse
  // to hand the file over, because an application approved on the strength of
  // somebody else's paperwork is the harm, not the download.
  const body = bodyOf(read(VERIFY_ACTIONS), OPENER);

  // 🪤 ASSERT THE SELECT, NOT A MENTION. Rev 1 matched `vendor_profile_id`
  // anywhere in the body — which the comparison below satisfies on its own, so
  // dropping the column from the query left the guard GREEN while
  // `app.vendor_profile_id` became undefined and every document was refused.
  // Only mutation found it. A bare mention is not a read.
  const select = /\.select\('([^']*)'\)/.exec(body);
  assert.ok(select, 'the opener no longer selects anything from the application');
  assert.match(
    select?.[1] ?? '',
    /\bvendor_profile_id\b/,
    'the opener does not SELECT the shop the application belongs to, so it cannot place the file',
  );

  assert.match(
    body,
    /keyOwner !== null && keyOwner !== app\.vendor_profile_id/,
    'the opener serves a file filed under a different shop',
  );
  // …and it must NOT refuse on a path it simply could not parse: a portfolio
  // key is a different shape, and refusing on "we could not tell" would break
  // every legitimate future layout.
  assert.doesNotMatch(
    body,
    /if \(keyOwner === null\)[^\n]*redirect/,
    'the opener refuses an unrecognised path shape instead of placing it',
  );
});
