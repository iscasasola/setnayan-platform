/**
 * Guard: nothing user-facing may promise a photo lifetime the deletion sweep
 * does not honour.
 *
 * THE FACTS THIS PINS (owner, 2026-08-07): "6 months are initially kept as
 * original. they can sync with their google drive."
 *   · Full-resolution originals are held for SIX MONTHS from the event's FIRST
 *     capture, then dropped. The sweep runs unless deliberately disabled.
 *   · The compressed gallery stays online for good — that part IS forever.
 *   · Connecting Google Drive is the ONLY way a couple keeps originals past
 *     six months.
 *
 * WHY THIS EXISTS: four separate surfaces promised otherwise — a "5-year
 * backup" on the delivery panel (twice) and in its demo card, and "keep your
 * raws as long as you need" on the public features page. The live privacy
 * notice said five years. Every one of them pointed the same way: relax, you
 * have years. A couple who believes that downloads nothing and loses the good
 * version of their wedding at six months.
 *
 * ⚠ SCOPE MATTERS. The drop sweep reads photo_delivery_artifacts as well as the
 * Papic tables, so it covers VENDOR-DELIVERED albums too — not only Papic
 * captures. "That claim is about photographer delivery, so it's fine" is wrong
 * and was checked before writing this.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const ROOTS = [join(WEB, 'app'), join(WEB, 'lib')];

/** Every .ts/.tsx under the roots, skipping tests and generated output. */
function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Comment-stripped, so the assertions test COPY and not the notes explaining it. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/.*/g, '');
}

const FILES = ROOTS.flatMap((r) => sources(r));

/**
 * Phrases that promise a lifetime for the ORIGINALS which we do not honour.
 * Deliberately narrow: each was a real string that shipped. A broad pattern
 * here would fire on the compressed gallery, which genuinely IS forever, and a
 * guard that cries wolf teaches you to skim past the one time it is right.
 */
const FALSE_PROMISES: Array<{ re: RegExp; why: string }> = [
  { re: /\b5-year backup\b/i, why: 'we hold full-resolution originals for 6 months, not 5 years' },
  { re: /\bfive-year backup\b/i, why: 'we hold full-resolution originals for 6 months, not 5 years' },
  { re: /keep your raws as long as you need/i, why: 'originals are dropped at 6 months' },
  // The month count itself. It moved 3 → 6 on 2026-08-02 and a dormant buy card
  // kept the old number for five days, so pin the stale one by name.
  { re: /after 3 months we keep a[^.]{0,30}compressed/i, why: 'the clock is 6 months, not 3' },
];

/**
 * ⚠ REJECTED PATTERNS, and why — do not "helpfully" add them back.
 *
 * /originals?.{0,40}forever/ and /full-res.{0,40}forever/ looked right and
 * fired on FOUR files, THREE of them innocent: two were Pakanta's "An ORIGINAL
 * SONG for your wedding — yours, forever" (a song, not a photo) and one was an
 * internal log line about the drop being deferred. The single real hit was a
 * heading on the Keep Full-Res buy card — where "keep your full-res forever" is
 * exactly what that product does, so it was not a lie either.
 *
 * A 3-in-4 false-positive rate is worse than no guard: it teaches the next
 * reader to skim past the one time it is right. Narrow beats broad here.
 */

test('no user-facing copy promises a lifetime for the originals that we do not keep', () => {
  const hits: string[] = [];
  for (const f of FILES) {
    // 🚨 COLLAPSE WHITESPACE FIRST — THIS GUARD WAS BLIND FOR ITS WHOLE LIFE.
    //
    // The couple's Photo Delivery page said "your Setnayan-side 5-year backup
    // stays intact", and this test never fired, because JSX wrapped it as
    // "5-year\n              backup" and /\b5-year backup\b/ needs ONE space.
    // The phrase was in the banned list, the file was in FILES, and the guard
    // still could not see it. Prose in a JSX attribute or a <p> is wrapped by
    // the formatter at whatever column it likes, so ANY multi-word pattern here
    // is a coin flip until the source is normalised.
    //
    // 🔑 A guard whose pattern cannot survive the formatter is decoration. This
    // one read as protection for months and caught nothing.
    const src = code(f).replace(/\s+/g, ' ');
    for (const { re, why } of FALSE_PROMISES) {
      if (re.test(src)) hits.push(`${relative(WEB, f)} — ${re} (${why})`);
    }
  }
  assert.deepEqual(
    hits,
    [],
    `Copy promises a photo lifetime the deletion sweep does not honour:\n${hits.join('\n')}\n\n` +
      'Originals: 6 months from the first capture. Compressed gallery: forever. ' +
      'Google Drive is how a couple keeps originals past 6 months.',
  );
});

test('the full-res warning email never points at an account export', () => {
  // There is NO user-facing account export — no settings route, no action.
  // It was the safest-sounding of three options offered to a worried couple,
  // and it saved nothing.
  const email = code(join(WEB, 'lib', 'daily-email-jobs.ts'));
  assert.doesNotMatch(
    email,
    /account export/i,
    'the full-res warning email offers an "account export" to save originals — no such export ' +
      'exists, so it sends a worried couple to a dead end',
  );
});

test('the decline-Drive button does not use the word "keep"', () => {
  // Declining Drive is the branch where originals ARE dropped. A decline button
  // reading "keep my photos in Setnayan" named the opposite of what it does.
  const panel = code(
    join(WEB, 'app', 'dashboard', '[eventId]', 'studio', 'photo-delivery', '_components', 'photo-delivery-panel.tsx'),
  );
  const label = panel.match(/deferLabel="([^"]*)"/)?.[1];
  assert.ok(
    label !== undefined,
    'could not find the decline label — update this test with the markup',
  );
  assert.doesNotMatch(
    label,
    /\bkeep\b/i,
    `the decline-Drive button reads "${label}" — declining is exactly the path where the ` +
      'originals are dropped, so it must not promise to keep them',
  );
});

/* ── integration grants: no promised automation that does not exist ────────── */

/**
 * NOTHING MAY PROMISE THAT WE DELETE A CONNECTED ACCOUNT ON A SCHEDULE.
 *
 * WHY. The privacy notice told people in writing that their TikTok and Google
 * Drive connections are thrown away "30 days after the event ends" and that
 * "refresh tokens past their expiry are purged automatically". Neither happens.
 * There is no scheduled deletion of `oauth_grants` or `patiktok_oauth_grants`
 * anywhere: the retention sweep is chat-text only, and the refresh job only
 * refreshes.
 *
 * 🔑 THE SAME SENTENCE WAS ALREADY REMOVED ONCE. On 2026-07-27 the YouTube
 * section was rewritten and its own engineering note says, in capitals, "NEVER
 * PROMISE AN AUTOMATION THAT DOES NOT EXIST". The two sections either side of
 * that note kept the line for another eleven days. A note telling the next
 * author what not to do is not a guard — this is.
 *
 * ⚠ WHAT IS TRUE, AND WHAT THE COPY NOW SAYS: on disconnect we erase the stored
 * keys immediately (all four revoke paths, fixed 2026-08-07). That is a promise
 * about YOUR action, not a timer, and it is honoured.
 *
 * Comment-stripped via code(), so the note explaining this removal cannot
 * satisfy the guard it exists to enforce.
 */
const SCHEDULED_DELETION_PROMISES: ReadonlyArray<[RegExp, string]> = [
  [
    /purged automatically/i,
    'claims stored tokens are purged automatically — nothing purges on a schedule',
  ],
  [
    /30 days after the event ends/i,
    'promises a connection is deleted 30 days after the event — no such job exists',
  ],
];

test('no user-facing copy promises we delete a connected account on a timer', () => {
  // Self-check: if the file list is empty the assertions below pass for free.
  assert.ok(FILES.length >= 100, `scanned only ${FILES.length} sources — the roots are wrong`);

  const offenders: string[] = [];
  for (const file of FILES) {
    const src = code(file);
    for (const [pattern, why] of SCHEDULED_DELETION_PROMISES) {
      if (pattern.test(src)) {
        offenders.push(`${relative(WEB, file)} — ${why}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    'Copy promising scheduled deletion of an integration grant. We delete on ' +
      'DISCONNECT, immediately; we do not delete on a timer. Say what is ' +
      'guaranteed, not what sounds reassuring:\n  ' + offenders.join('\n  '),
  );
});

/**
 * THE PUBLIC NOTICE'S POST-EVENT FLOOR MUST MATCH THE CONSTANT THAT ENFORCES IT.
 *
 * 🔑 THIS IS A COPY-vs-CODE CHECK, NOT TWO HAND-TYPED THINGS. The month figure in
 * the privacy notice is DERIVED here from FULL_RES_POST_EVENT_GRACE_DAYS, so
 * moving the constant without touching the notice fails, and vice versa. A guard
 * comparing two hand-typed strings is not a guard — that is how `llms.txt`
 * drifted for three weeks with green CI.
 *
 * ── WHY THIS ONE MATTERS MORE THAN IT LOOKS ─────────────────────────────────
 * On 2026-08-07 the floor was raised 30 days → 3 months while shooting opened to
 * 6 months before the event. Left alone, the notice would have said we replace
 * originals after 30 days while the sweep actually held them for three months.
 * **Understating retention is a breach in the quieter direction**: RA 10173
 * storage limitation binds us to the period we DECLARE, nobody ever complains
 * about getting more than promised, and the notice is still false.
 *
 * It is also now the load-bearing number. A camera may open six months before the
 * event, so the earliest permitted photo's own six-month clock expires ON the
 * event day — this floor is the only thing preserving anything afterwards.
 */
test('the privacy notice states the REAL post-event floor', async () => {
  const { FULL_RES_POST_EVENT_GRACE_DAYS } = await import('./papic-fullres-drop-core');
  const notice = code(join(WEB, 'app/privacy/page.tsx'));

  // Self-check: an unreadable file would satisfy a "does not contain" assertion.
  assert.ok(notice.length > 2000, 'self-check: the privacy notice read as near-empty');

  const months = Math.round(FULL_RES_POST_EVENT_GRACE_DAYS / 30.44);
  assert.ok(months >= 1, `a floor of ${FULL_RES_POST_EVENT_GRACE_DAYS} days is not a whole month`);

  // Normalise the JSX: collapse whitespace and drop {' '} spacers so the phrase
  // reads as one line however it happens to be wrapped.
  const flat = notice.replace(/\{'\s*'\}/g, ' ').replace(/\s+/g, ' ');

  // NOTE the tag placement: the copy is `<strong>3 months</strong>`, so the unit
  // sits INSIDE the tag. A first draft put `months` after the closing tag and
  // failed — which is the only reason we know this assertion can fail at all.
  const stated = new RegExp(
    `never less than\\s*(?:<strong>)?\\s*${months}\\s*months?\\s*(?:</strong>)?\\s*after the event`,
    'i',
  );
  assert.match(
    flat,
    stated,
    `the notice must say the originals are held at least ${months} months after ` +
      `the event, because FULL_RES_POST_EVENT_GRACE_DAYS is ` +
      `${FULL_RES_POST_EVENT_GRACE_DAYS}. If you changed the constant, change ` +
      `the public notice in the SAME PR — holding data longer than the declared ` +
      `period is the RA 10173 problem, and it is silent.`,
  );
});
