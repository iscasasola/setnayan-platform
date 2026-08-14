/**
 * GUARD — the admin layout is a SCHEDULER, and re-chroming it must not
 * silently switch twelve background jobs off.
 *
 * `app/admin/layout.tsx` was rewritten on 2026-08-14 to wear the shared rail
 * (One Shell slice 3). The visible half of that swap is obvious. **The
 * invisible half is this file.**
 *
 * This repo is CRON-FREE: the Vercel crons were retired and their work now
 * rides on admin traffic through `after()`. There is NO SCHEDULER BEHIND ANY
 * OF THEM. Drop one line in a rewrite and nothing throws, nothing logs, no
 * test fails — the retention sweep simply stops running, the digest simply
 * stops sending, full-resolution photos simply stop being compressed. **The
 * only symptom is an absence**, which is this codebase's most expensive
 * recurring defect shape (the phantom column · the phantom enum value · the
 * phantom RPC argument · the blocked iframe · the unresolved `r2://`).
 *
 * Modelled on `app/home-carries-the-cron-free-jobs.test.ts`, which guards the
 * same class of loss on `/`. Two files, because they guard two different
 * layouts and two different job sets — not two guards on one rule.
 *
 * ⚠️ IF YOU ARE CHANGING THE ADMIN CHROME AND THIS TEST FAILS, the fix is to
 * carry the `after()` calls into the new layout — NOT to delete the test.
 *
 * ➕ ADDING A THIRTEENTH JOB? Add it to `JOBS` in the same commit. The count
 * assertion below is deliberate: a bare "each named job is present" check
 * cannot notice a job that was never named, and this list is exactly the kind
 * of list that quietly stops matching reality. Making an addition edit this
 * file is the price of that, and it is one line.
 *
 * 🛡 MUTATION-CHECKED. Each assertion was broken on purpose — a job deleted, a
 * job moved out of `after()`, a job added — and this file confirmed RED by
 * occurrence count before being trusted. An unmeasured mutation proves nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const LAYOUT = join(__dirname, 'layout.tsx');
const SRC = readFileSync(LAYOUT, 'utf8');

/**
 * Source with comments stripped, so a mention in a docblock can never satisfy
 * an assertion about code. On 2026-08-11 a check in this repo passed because a
 * COMMENT contained the string it was looking for — and the docblock directly
 * above these very calls names several of them.
 */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Every cron-free job that rides on admin traffic, and what stops if it goes. */
const JOBS = [
  { fn: 'runSocialFlush', what: 'the social auto-publish flush' },
  { fn: 'runAdminDigestFlush', what: 'the admin morning digest' },
  { fn: 'maybeRecomputeSpotlightAwards', what: 'the monthly Spotlight Awards recompute' },
  { fn: 'maybeRunFraudClusterSweep', what: 'the fake-inquiry identity-cluster sweep' },
  { fn: 'runSeoPeriodicJobs', what: 'the SEO health audit and the Search Console pull' },
  { fn: 'maybeRunRetentionSweep', what: 'the RA 10173 chat-retention purge' },
  { fn: 'maybeRunVendorDossierRetention', what: 'the 180-day Deep Search dossier purge' },
  { fn: 'maybeRunPapicFullResDrop', what: 'the Papic full-resolution compression sweep' },
  { fn: 'maybeRunPapicNsfwRescreen', what: 'the NSFW re-screen heal for dropped screens' },
  { fn: 'maybeRunDriveCopyRetry', what: 'the Google Drive copy retry' },
  { fn: 'maybeRunAnonDraftSweep', what: 'the abandoned anonymous-draft cleanup' },
  { fn: 'maybeRunPhotoDeliveryDrain', what: 'the stalled "Release to Drive" drainer' },
] as const;

test('ANCHOR — the layout source was actually read, and stripping left code behind', () => {
  // Every assertion below passes vacuously against an empty string.
  assert.ok(
    SRC.length > 4000,
    `app/admin/layout.tsx read as ${SRC.length} chars — too short to be the real layout`,
  );
  assert.ok(
    CODE.includes('export default async function AdminLayout'),
    'comment-stripping ate the code; the scan would prove nothing',
  );
});

for (const { fn, what } of JOBS) {
  test(`/admin still schedules ${fn} — ${what}`, () => {
    assert.ok(
      CODE.includes(fn),
      `app/admin/layout.tsx no longer references ${fn}.\n` +
        `That job replaced a RETIRED CRON — there is no scheduler behind it, so ` +
        `dropping it silently stops ${what}. Nothing will throw. Carry the after() ` +
        `call into the new layout rather than deleting this guard.`,
    );

    // Not just present — actually SCHEDULED. A leftover import, or a call moved
    // out of after() into dead code, must not satisfy this.
    const scheduled = new RegExp(String.raw`after\(\s*\(\s*\)\s*=>\s*[^)]*\b${fn}\b`);
    assert.ok(
      scheduled.test(CODE),
      `${fn} appears in app/admin/layout.tsx but is not inside an after(() => …) call. ` +
        `An import that nothing schedules is exactly the shape of this bug.`,
    );
  });
}

test('/admin schedules EXACTLY the jobs this file knows about', () => {
  /*
    THE COUNT IS THE HALF THE PER-JOB LOOP CANNOT DO. The loop above proves
    every job we know of survived; it is blind to a job that was added and then
    lost, because it was never on the list. Counting the `after()` calls closes
    that: a thirteenth job forces a line here, in the same commit, in front of
    a reviewer.

    Anchored on `after(` with a word boundary, not on the word "after" — the
    layout's prose contains "after" many times, and `\bafter\(` cannot match
    `runAfter(` or a comment.
  */
  const calls = CODE.match(/\bafter\(/g) ?? [];
  assert.equal(
    calls.length,
    JOBS.length,
    `app/admin/layout.tsx makes ${calls.length} after() calls but this guard knows ${JOBS.length} jobs.\n` +
      `  → FEWER: a cron-free job was dropped. Nothing throws; the work just stops.\n` +
      `  → MORE:  a job was added without being listed here, so the next rewrite ` +
      `can drop it silently. Add it to JOBS in this same commit.`,
  );
});
