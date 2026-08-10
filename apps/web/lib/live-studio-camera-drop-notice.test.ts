/**
 * ⚠ SOMEBODY IS TOLD WHEN A CAMERA IS SILENTLY DROPPED.
 *
 * THE BUG. `provisionRoamBroadcasts` counts every camera channel it refuses
 * because the Setnayan pool channel's `concurrent_cap` was already full
 * (`skippedOverCap`) — and its ONE caller, `goLivePanood`, called it with the
 * result discarded on the floor. A host could name six camera channels, print
 * six QR codes, hand them to six people, press Go live, get a green success, and
 * two of those operators would never appear on air. Nothing threw. Nothing
 * logged. Nobody was told. The number existed the whole time.
 *
 * ⭐ THE SECOND WAY (2026-08-08). The first fix bound the result and then read
 * ONE field off it — `.notice` — which only ever describes the CAP path. The
 * other way a camera goes missing is a YouTube refusal, which sets `.detail`
 * and **breaks the provisioning loop**: every remaining zone is neither created,
 * nor reused, nor counted in `skippedOverCap`, so `.notice` is null and the host
 * gets the same plain green tick. Worse, the guard here asserted on the source
 * text `notice = provisioned.notice;` — it PINNED THE DEFECT IN. That assertion
 * is gone; § 2b stubs a ProvisionResult and exercises the real function.
 *
 * WHAT THIS GUARDS, AND WHY IT IS SHAPED LIKE THIS. A number COMPUTED and
 * discarded is exactly the defect, so asserting that `skippedOverCap` is
 * calculated would pass on the broken code. Every assertion below follows the
 * value along the only path that ends in a human reading it:
 *
 *   1.  the pure sentence     — cameraDropNotice()        (behaviour)
 *   2.  onto the result       — provisionRoamBroadcasts   (source, comments stripped)
 *   2b. BOTH drop paths       — hostNoticeFromProvision() (behaviour · stubbed result)
 *   3.  out of the action     — goLivePanood              (source, comments stripped)
 *   4.  onto the two screens  — GoLiveCard · TransportRow (source, comments stripped)
 *
 * Hops 2–4 are source assertions because the wiring cannot be exercised here:
 * `provisionRoamBroadcasts`'s loop dynamically imports `live-studio-channel-grants`
 * and `panood-youtube`, both of which carry `import 'server-only'` and do not
 * resolve under `tsx --test`; `goLivePanood` is a `'use server'` module over
 * `next/navigation`; and the two screens are React islands. What CAN break
 * silently in a future edit is the wiring, so the wiring is what is pinned.
 *
 * ⚠ EVERY source assertion runs over `codeOf()` — comments stripped. This file's
 * subject is documented in prose at all four sites (that is the point of the
 * comments), and a whole-file grep would happily match the paragraph explaining
 * the bug and then pass forever on its own justification.
 *
 * Run: `npx tsx --test lib/live-studio-camera-drop-notice.test.ts`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  cameraDropNotice,
  hostNoticeFromProvision,
  type ProvisionResult,
} from './live-studio-roam-provision';

const HERE = dirname(fileURLToPath(import.meta.url));
const repoFile = (p: string) => readFileSync(resolve(HERE, '..', p), 'utf8');

/** Strip comments — see the header. The subject is the CODE, so it reads code. */
function codeOf(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/* ══════════════════════════════════════════════════════════════════════════════
   1 · THE SENTENCE ITSELF — behaviour
   ══════════════════════════════════════════════════════════════════════════════ */

test('nothing dropped → no banner at all', () => {
  assert.equal(cameraDropNotice({ skippedOverCap: 0, carried: 4, cap: 4 }), null);
  assert.equal(cameraDropNotice({ skippedOverCap: -3, carried: 4, cap: 4 }), null);
  assert.equal(cameraDropNotice({ skippedOverCap: Number.NaN, carried: 4, cap: 4 }), null);
});

test('the host is told HOW MANY were dropped, OUT OF HOW MANY, and the ceiling', () => {
  const notice = cameraDropNotice({ skippedOverCap: 2, carried: 4, cap: 4 });
  assert.ok(notice, 'a dropped camera must produce a sentence');
  // The three numbers a host can act on. 2 refused + 4 carried = 6 they set up.
  assert.match(notice, /\b2 of your 6 cameras\b/);
  assert.match(notice, /\b4 cameras at a time\b/);
  // Plain English, and no engineering vocabulary leaks to the couple.
  assert.ok(
    !/concurrent_cap|skippedOverCap|zone|roam|manifest/i.test(notice),
    'this is read by a couple on their wedding day, not by an engineer',
  );
});

test('one dropped camera reads as one, not as "1 cameras is/are"', () => {
  const one = cameraDropNotice({ skippedOverCap: 1, carried: 3, cap: 3 });
  assert.ok(one);
  assert.match(one, /\b1 of your 4 cameras is not being broadcast\b/);
  const many = cameraDropNotice({ skippedOverCap: 2, carried: 3, cap: 3 });
  assert.ok(many);
  assert.match(many, /\b2 of your 5 cameras are not being broadcast\b/);
});

test('the denominator is what the host SET UP, never inferred from the cap', () => {
  // A zone that already had a stream is counted as reused BEFORE the cap check,
  // so `carried` can legitimately sit above `cap`. Printing "cap + dropped" would
  // under-report the host's own cameras back to them.
  const notice = cameraDropNotice({ skippedOverCap: 1, carried: 5, cap: 4 });
  assert.ok(notice);
  assert.match(notice, /\b1 of your 6 cameras\b/);
  assert.match(notice, /\b4 cameras at a time\b/);
});

/* ══════════════════════════════════════════════════════════════════════════════
   2 · THE COUNT REACHES THE RESULT — it is no longer thrown away
   ══════════════════════════════════════════════════════════════════════════════ */

const PROVISION = 'lib/live-studio-roam-provision.ts';

test('provisionRoamBroadcasts CARRIES the sentence out on its result', () => {
  const src = repoFile(PROVISION);
  const fn = codeOf(src.slice(src.indexOf('export async function provisionRoamBroadcasts')));
  assert.match(
    fn,
    /notice: cameraDropNotice\(\{\s*skippedOverCap,\s*carried: created \+ reused,\s*cap,?\s*\}\)/,
    'the success result must build the sentence from the count — computing skippedOverCap and returning it as a bare number is the bug this file exists for',
  );
  // …and the field is on the TYPE, so a caller can actually reach it.
  const type = codeOf(src.slice(src.indexOf('export type ProvisionResult'), src.indexOf('function failure(')));
  assert.match(type, /notice: string \| null;/, 'ProvisionResult must declare the notice');
});

test('a failed provision reports no dropped cameras rather than a stale one', () => {
  const src = repoFile(PROVISION);
  const fn = codeOf(src.slice(src.indexOf('function failure('), src.indexOf('export async function provisionRoamBroadcasts')));
  assert.match(fn, /notice: null,/, 'a failure has no camera count to report');
});

/* ══════════════════════════════════════════════════════════════════════════════
   2b · ⭐ THE SECOND WAY A CAMERA GOES MISSING — behaviour, not source text
   ══════════════════════════════════════════════════════════════════════════════

   The first fix bound the provision result and then read ONE field off it. But
   provisioning loses cameras two ways:

     · THE CAP     → skippedOverCap → `notice`.                    Reported.
     · THE REFUSAL → a YouTube error sets `detail` and BREAKS THE
                     LOOP, so every remaining zone is neither
                     created, nor reused, nor counted anywhere,
                     and `notice` comes back NULL.                 Silent.

   So the shape below is stubbed and exercised — a `ProvisionResult` literal in,
   the host-visible sentence out. The old guard here asserted on the source text
   `notice = provisioned.notice;`, which pinned the NARROW READ in place: the
   defect was literally what the test required. Behaviour first, wiring second.
   ══════════════════════════════════════════════════════════════════════════════ */

/** A provisioning outcome, defaults = a clean multi-camera run. */
function provision(over: Partial<ProvisionResult> = {}): ProvisionResult {
  return {
    ok: true,
    channelPoolId: 7,
    created: 4,
    reused: 0,
    skippedOverCap: 0,
    published: 4,
    reason: null,
    detail: null,
    notStarted: 0,
    notice: null,
    ...over,
  };
}

/** Every reason that means "the host's cameras are off and it is not their doing". */
const SPEAKING_REASONS = ['no_channel_available', 'channel_not_connected', 'youtube_error'] as const;
/** Every reason that means "this host never set up multi-camera" — deliberate silence. */
const SILENT_REASONS = ['no_zones', 'flag_off'] as const;

test('a YouTube refusal mid-loop REACHES THE HOST — nothing was counted, so nothing was said', () => {
  // Exactly the break-the-loop shape: ok:false, a null notice because the
  // abandoned zones never incremented skippedOverCap, and notStarted carrying
  // what the loop walked away from.
  const notice = hostNoticeFromProvision(
    provision({
      ok: false,
      created: 1,
      reason: 'youtube_error',
      detail: 'YouTube refused a broadcast for "Reception".',
      notStarted: 3,
      notice: null,
    }),
  );
  assert.ok(notice, 'a failed provision must not come back as a plain green tick');
  assert.notEqual(notice.trim(), '');
  assert.match(notice, /\b3 cameras\b/, 'the host must learn HOW MANY did not make it');
});

test('BOTH ways at once are BOTH reported — neither sentence swallows the other', () => {
  const notice = hostNoticeFromProvision(
    provision({
      ok: false,
      reason: 'youtube_error',
      detail: 'YouTube refused a broadcast for "Reception".',
      notStarted: 1,
      notice: cameraDropNotice({ skippedOverCap: 2, carried: 4, cap: 4 }),
    }),
  );
  assert.ok(notice);
  assert.match(notice, /\b2 of your 6 cameras\b/, 'the cap drop must survive');
  assert.match(notice, /\b1 camera\b/, 'the refusal must survive');
});

test('a clean run still says NOTHING — a warning on a perfect broadcast is noise', () => {
  assert.equal(hostNoticeFromProvision(provision()), null);
});

test('an ok run never speaks, even carrying a stray detail or count', () => {
  assert.equal(
    hostNoticeFromProvision(provision({ ok: true, detail: 'bookkeeping note', notStarted: 2 })),
    null,
  );
});

test('"no camera channels yet" is NOT dressed up as a dropped camera', () => {
  // The roam flag is on for every host, and most have zero camera zones. Folding
  // this in would put a warning on every ordinary single-camera go-live, which is
  // how a host learns to skim past the banner that matters.
  for (const reason of SILENT_REASONS) {
    assert.equal(
      hostNoticeFromProvision(
        provision({ ok: false, created: 0, published: 0, reason, detail: 'anything at all', notStarted: 9, notice: null }),
      ),
      null,
      `${reason} must stay silent`,
    );
  }
});

test('a Setnayan-side provisioning failure IS the host’s business — their cameras are dark', () => {
  for (const reason of SPEAKING_REASONS) {
    const notice = hostNoticeFromProvision(
      provision({ ok: false, created: 0, published: 0, reason, detail: null, notStarted: 2, notice: null }),
    );
    assert.ok(notice, `${reason} must not be silent — every camera the host set up is off air`);
    assert.match(notice, /\S/);
  }
});

/* ──────────────────────────────────────────────────────────────────────────────
   2c · THE HOST NEVER READS ADMIN COPY
   ─────────────────────────────────────────────────────────────────────────────
   The FIRST repair of this bug folded `provisioned.detail` into the host's
   banner VERBATIM, reasoning that it was "already written host-safe". The type
   says otherwise one screen up — `detail` is documented "safe to show an ADMIN"
   — and two of the five real strings prove it: one sends the reader to
   "Admin → Live Studio channels", a screen a couple cannot open, and one names
   an environment flag. An impossible instruction is worse than the silence it
   replaced: silence leaves them asking, an instruction leaves them trying.

   ⚠ AND THE GUARD THAT WAS MEANT TO STOP THIS ASSERTED THE DEFECT INSTEAD. It
   required the host sentence to CONTAIN the admin text (`/Reception/`) and even
   to contain the machine token (`new RegExp(reason)` — i.e. the couple reads the
   words "no_channel_available"). A test that demands the bug will never report
   it. So this section asserts the PROPERTY, not the copy.

   🔑 THE ADMIN STRINGS ARE HARVESTED FROM SOURCE, NOT TYPED HERE. A hand-typed
   list is silent about whatever nobody typed into it — which is exactly how the
   third admin queue surface hid from its own guard the same week. A sixth
   `failure(...)` string added tomorrow is checked without anyone remembering to
   add it.
   ────────────────────────────────────────────────────────────────────────────── */

const PROVISION_SRC = repoFile('lib/live-studio-roam-provision.ts');

/** Every string literal handed to `failure(...)` — i.e. every real `detail`. */
function harvestAdminDetails(src: string): string[] {
  const code = codeOf(src);
  const out = new Set<string>();
  // failure('reason', '…detail…'   — the detail is the second argument.
  for (const m of code.matchAll(/\bfailure\(\s*'[a-z_]+'\s*,\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)) {
    if (m[2]) out.add(m[2]);
  }
  // The two youtubeError assignments, which become `detail` on the loop's result.
  for (const m of code.matchAll(/youtubeError\s*=\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)) {
    if (m[2]) out.add(m[2]);
  }
  return [...out];
}

const ADMIN_DETAILS = harvestAdminDetails(PROVISION_SRC);

test('the harvest actually finds the admin strings (a guard reading nothing passes everything)', () => {
  assert.ok(
    ADMIN_DETAILS.length >= 6,
    `expected to harvest every failure()/youtubeError string, found ${ADMIN_DETAILS.length}: ${JSON.stringify(ADMIN_DETAILS)}`,
  );
  // The two that prove `detail` is admin copy must be among them, or the
  // harvest has silently stopped matching the shape it is checking.
  assert.ok(
    ADMIN_DETAILS.some((d) => d.includes('Admin →')),
    'the "Admin → Live Studio channels" string must be harvested',
  );
  assert.ok(
    ADMIN_DETAILS.some((d) => d.includes('NEXT_PUBLIC_')),
    'the env-flag string must be harvested',
  );
});

test('NO admin detail — real or invented — can reach the host, under any reason', () => {
  const reasons = [...SPEAKING_REASONS, ...SILENT_REASONS] as const;
  for (const detail of ADMIN_DETAILS) {
    for (const reason of reasons) {
      for (const notStarted of [0, 1, 5]) {
        const notice = hostNoticeFromProvision(
          provision({ ok: false, created: 0, published: 0, reason, detail, notStarted, notice: null }),
        );
        if (notice === null) continue;
        assert.ok(
          !notice.includes(detail),
          `the host was shown admin copy under ${reason}: ${JSON.stringify(detail)}`,
        );
      }
    }
  }
});

test('host copy never names an admin screen, an env flag, a table or a machine reason', () => {
  const banned: Array<[RegExp, string]> = [
    [/Admin\s*→/, 'an admin screen the couple cannot open'],
    [/NEXT_PUBLIC_/, 'an environment flag'],
    [/live_studio_|_streams\b|channel_pool/, 'a database table or column'],
    [/\b(no_zones|flag_off|no_channel_available|channel_not_connected|youtube_error)\b/, 'a machine reason token'],
    [/\bnull\b|\bundefined\b|\bNaN\b/, 'a leaked non-value'],
  ];
  for (const reason of [...SPEAKING_REASONS, ...SILENT_REASONS] as const) {
    for (const notStarted of [0, 1, 2, 40]) {
      const notice = hostNoticeFromProvision(
        provision({ ok: false, created: 0, published: 0, reason, detail: ADMIN_DETAILS[0] ?? null, notStarted, notice: null }),
      );
      if (notice === null) continue;
      for (const [pattern, why] of banned) {
        assert.ok(!pattern.test(notice), `host copy under ${reason} contains ${why}: ${JSON.stringify(notice)}`);
      }
    }
  }
});

test('a failure is NEVER silent just because a count is missing or absurd', () => {
  // Silence is the whole bug. A zero, a negative, or a NaN count must degrade to
  // "Some cameras", never to no banner at all.
  for (const reason of SPEAKING_REASONS) {
    for (const notStarted of [0, -3, Number.NaN]) {
      const notice = hostNoticeFromProvision(
        provision({ ok: false, created: 0, published: 0, reason, detail: null, notStarted, notice: null }),
      );
      assert.ok(notice && notice.trim() !== '', `${reason} went silent at notStarted=${notStarted}`);
      assert.ok(!/\b-?\d+\b/.test(notice) || notStarted > 0, 'a number was claimed that we do not have');
    }
  }
});

test('one abandoned camera reads as one, not as "1 cameras"', () => {
  const notice = hostNoticeFromProvision(
    provision({ ok: false, reason: 'youtube_error', notStarted: 1, notice: null }),
  );
  assert.ok(notice);
  assert.match(notice, /\b1 camera\b/);
  assert.ok(!/\b1 cameras\b/.test(notice));
});

/* ──────────────────────────────────────────────────────────────────────────────
   2d · THE COUNT IS ACTUALLY CARRIED — every return site fills notStarted
   ─────────────────────────────────────────────────────────────────────────────
   `notStarted` is what makes the sentence true. If a return site leaves it at
   its default the banner still appears, but says "Some cameras" forever — the
   fix would look done and read vague. Checked against SOURCE because these are
   returns from a function that talks to YouTube.
   ────────────────────────────────────────────────────────────────────────────── */

test('the two post-zones failures abandon EVERY zone, and say so', () => {
  const code = codeOf(PROVISION_SRC);
  for (const reason of ['no_channel_available', 'channel_not_connected'] as const) {
    // Anchored on the CALL, not the first mention — the union declaration one
    // screen up mentions every reason and would match a scan that is not.
    const call = code.match(new RegExp(`failure\\(\\s*'${reason}'[\\s\\S]*?\\n\\s*\\);`));
    assert.ok(call, `${reason} must still be returned from failure()`);
    assert.match(call[0], /zones\.length/, `${reason} must report every zone as not started`);
  }
});

test('the break-the-loop return counts what the loop walked away from', () => {
  const code = codeOf(PROVISION_SRC);
  assert.match(
    code,
    /notStarted:\s*zones\.length\s*-\s*created\s*-\s*reused\s*-\s*skippedOverCap/,
    'the normal return must subtract what was handled from what was set up — that difference IS the abandoned cameras',
  );
  assert.match(
    code,
    /failure\('youtube_error',\s*youtubeError,\s*channel\.id,\s*zones\.length\s*-\s*skippedOverCap\)/,
    'the total-failure return must count every zone the cap did not already account for',
  );
});

/* ══════════════════════════════════════════════════════════════════════════════
   3 · THE SENTENCE LEAVES THE ACTION — goLivePanood folds BOTH ways in
   ══════════════════════════════════════════════════════════════════════════════ */

const ACTIONS = 'app/dashboard/[eventId]/studio/panood/setup/actions.ts';

test('goLivePanood keeps the provision result and returns the notice to the screen', () => {
  const src = repoFile(ACTIONS);
  const fn = codeOf(
    src.slice(src.indexOf('export async function goLivePanood'), src.indexOf('export async function endPanoodBroadcast')),
  );
  assert.match(
    fn,
    /const provisioned = await provisionRoamBroadcasts\(/,
    'the result must be BOUND — `await provisionRoamBroadcasts(...)` on its own line is how the count was lost',
  );
  // The WHOLE result goes through the folder, so both drop paths are worded.
  assert.match(
    fn,
    /notice = hostNoticeFromProvision\(provisioned\);/,
    'the whole result must go through the folder — every branch of hostNoticeFromProvision is exercised above',
  );
  // ⭐ THE REGRESSION. Reading one field back off the result is the defect this
  // section was rewritten for; the previous guard REQUIRED that exact line.
  assert.ok(
    !/notice\s*=\s*provisioned\.(notice|detail)\b/.test(fn),
    'reading a single field off the provision result is the discard, one level in',
  );
  assert.match(
    fn,
    /return \{ ok: true, notice \};/,
    'the success the host receives must carry the notice — a notice that stops at the server is the same silence',
  );
});

test('GoLiveResult can actually hold a notice — a success is not just {ok:true}', () => {
  const type = codeOf(repoFile(ACTIONS));
  assert.match(
    type,
    /export type GoLiveResult = \{ ok: true; notice\?: string \| null \} \| \{ error: string \};/,
    'the success shape must have somewhere to put it',
  );
});

/* ══════════════════════════════════════════════════════════════════════════════
   4 · THE COUNT IS SHOWN — both screens with a "Go live" button render it
   ══════════════════════════════════════════════════════════════════════════════ */

const SCREENS = [
  'app/dashboard/[eventId]/studio/panood/setup/go-live-card.tsx',
  'app/panood/control/[eventId]/transport-row.tsx',
];

for (const screen of SCREENS) {
  test(`${screen} READS the notice off the result and RENDERS it`, () => {
    const src = codeOf(repoFile(screen));

    // (a) read it off the action's reply — not just handle the error branch.
    assert.match(
      src,
      /setNotice\(result\.notice \?\? null\)/,
      'the success branch must take the notice; handling only `error` is how the count stayed invisible',
    );
    // (b) hold it in state the render can see.
    assert.match(src, /const \[notice, setNotice\] = useState<string \| null>\(null\)/);
    // (c) ⭐ THE ONE THAT MATTERS — the state variable is actually PAINTED. A
    //     notice stored in state and never rendered is the original defect with
    //     an extra step.
    assert.match(
      src,
      /\{notice \? \([\s\S]{0,800}<span>\{notice\}<\/span>/,
      'the notice must reach the DOM inside a branch guarded on the notice itself',
    );
    // (d) it is a WARNING, not an error — the broadcast did go out, and dressing
    //     a live show up as a failure sends a host hunting for something to retry.
    assert.match(src, /role="status"/);
    // (e) cleared before each press, so yesterday's banner cannot linger over a
    //     broadcast it is not about.
    assert.match(src, /setError\(null\);\s*setNotice\(null\);/);
  });
}
