/**
 * GUARD — the homepage is a SCHEDULER, and replacing it must not silently
 * switch three background jobs off.
 *
 * `app/page.tsx` is about to be replaced: the owner ruled on 2026-08-13 that
 * the new front door becomes `/` and the June cinematic homepage is retired
 * completely. The visible half of that swap is obvious. **The invisible half is
 * this file.**
 *
 * `/` runs three jobs on the back of its guaranteed public traffic, via
 * `after()`:
 *
 *   • `runAdminDigestFlush`          — the admin morning digest
 *   • `runDailyEmailJobs`            — anniversary digests · renewal reminders ·
 *                                      the Papic full-res drop warning
 *   • `maybeRunInterconnectionProbes` — the interconnection probes
 *
 * 🚨 **THESE REPLACED RETIRED CRONS. THERE IS NO SCHEDULER BEHIND THEM.** If a
 * port drops them, nothing throws, no test fails, no log line appears — the
 * emails simply stop being sent. Couples stop getting anniversary digests,
 * vendors stop getting renewal reminders, and nobody is warned before their
 * full-resolution photos are compressed. **The only symptom is an absence**,
 * which is this codebase's most expensive recurring defect shape (the phantom
 * column · the phantom enum value · the phantom RPC argument · the blocked
 * iframe · the unresolved `r2://`).
 *
 * `revalidate` is asserted for the same reason: these jobs only fire when the
 * page actually re-renders, so removing the revalidation window would throttle
 * them to almost never while leaving every call site intact.
 *
 * ⚠️ IF YOU ARE PORTING THE FRONT DOOR AND THIS TEST FAILS, the fix is to carry
 * the three `after()` calls into the new page — NOT to delete this test. If the
 * jobs are ever given a real scheduler, delete the guard in the SAME commit
 * that creates it, and say so here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PAGE = join(__dirname, 'page.tsx');
const SRC = readFileSync(PAGE, 'utf8');

/** Source with comments stripped, so a mention in a docblock can never satisfy
 *  an assertion about code. This is the difference between a guard and a
 *  decoration: on 2026-08-11 a check passed because a COMMENT contained the
 *  string it was looking for. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const JOBS = [
  {
    fn: 'runAdminDigestFlush',
    what: 'the admin morning digest',
  },
  {
    fn: 'runDailyEmailJobs',
    what: 'anniversary digests, renewal reminders and the Papic full-res drop warning',
  },
  {
    fn: 'maybeRunInterconnectionProbes',
    what: 'the interconnection probes',
  },
] as const;

test('ANCHOR — the page source was actually read', () => {
  // Every assertion below passes vacuously against an empty string.
  assert.ok(SRC.length > 2000, `app/page.tsx read as ${SRC.length} chars — too short to be the real page`);
  assert.ok(CODE.includes('export default'), 'comment-stripping ate the code; the scan would prove nothing');
});

for (const { fn, what } of JOBS) {
  test(`/ still schedules ${fn} — ${what}`, () => {
    assert.ok(
      CODE.includes(fn),
      `app/page.tsx no longer references ${fn}.\n` +
        `That job replaced a RETIRED CRON — there is no scheduler behind it, so ` +
        `dropping it silently stops ${what}. Nothing will throw. Carry the after() ` +
        `call into the new page rather than deleting this guard.`,
    );

    // Not just present — actually SCHEDULED. A leftover import, or a call that
    // was moved out of after() into dead code, must not satisfy this.
    const scheduled = new RegExp(String.raw`after\(\s*\(\s*\)\s*=>\s*[^)]*\b${fn}\b`);
    assert.ok(
      scheduled.test(CODE),
      `${fn} appears in app/page.tsx but is not inside an after(() => …) call. ` +
        `An import that nothing schedules is exactly the shape of this bug.`,
    );
  });
}

test('/ keeps a revalidation window, or the jobs almost never fire', () => {
  const m = CODE.match(/export\s+const\s+revalidate\s*=\s*(\d+)/);
  assert.ok(m, 'app/page.tsx no longer exports `revalidate`');
  const seconds = Number(m![1]);
  assert.ok(
    seconds > 0 && seconds <= 3600,
    `revalidate is ${seconds}s. These jobs only run when the page re-renders, ` +
      `so a very long (or zero/never) window throttles them to almost never while ` +
      `every call site still looks correct.`,
  );
});
