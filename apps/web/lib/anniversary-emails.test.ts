/**
 * THE ANNIVERSARY MAIL KNOWS WHAT KIND OF DAY IT IS TALKING ABOUT.
 *
 * Both builders were hardcoded wedding copy — *'you said "I do."'*, *"your
 * wedding"*, *"Your first wedding anniversary … worth celebrating"* — and
 * nothing upstream filtered by event type. A year after a wake, that is what a
 * bereaved family was in line to receive.
 *
 * 🛡 EVERY ASSERTION HERE WAS MUTATION-CHECKED: each rule was broken on
 * purpose, the OCCURRENCE COUNT printed before and after to prove the sabotage
 * landed, and the test confirmed RED before being trusted. This repo has had
 * guards pass while the thing they guard was gone; an unmeasured mutation
 * proves nothing.
 *
 * ── WHAT THIS FILE ASSERTS, AND WHAT IT DELIBERATELY DOES NOT ───────────────
 * It asserts the RULES that must hold for ANY event word: the wedding arm is
 * byte-identical, no other arm speaks a wedding word, the article is right, and
 * the solemn register is refused outright.
 *
 * ⚠ IT IS NOT A CENSUS OF THE LIVE EVENT WORDS, AND CANNOT BE. `event_word`
 * lives in an admin-editable JSONB column: measured 2026-08-27, production's
 * `corporate` row reads 'corporate event' while the migration that seeded it
 * says 'event'. A list in this file would be a list of what somebody once
 * seeded, not of what people read. The census belongs where the real rows are —
 * tests/db/anniversary-mail-knows-the-occasion.db.test.ts renders the sentence
 * for every seeded type against the replayed schema.
 *
 * 🔑 THE WORD LIST BELOW IS DERIVED, AND IT TOOK TWO SPELLINGS TO GET RIGHT.
 * The seeds are written two ways — JSON (`"event_word":"trip"`) and SQL
 * (`'event_word', 'wake'`) — and a scan that knew only the first found 12 words
 * and silently missed four, including 'wake', the one word this whole change is
 * about. Matching one spelling is not a survey. Both are read, and a FLOOR
 * fails the test if the scan stops matching.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildAnniversaryEmail,
  buildAnniversaryHeadsupEmail,
  type AnniversaryWords,
} from './anniversary-emails-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(HERE, '..', '..', '..', 'supabase', 'migrations');

/** Both spellings the seeds use. See the docblock — one of them is not enough. */
const JSON_WORD = /"event_word"\s*:\s*"([^"]+)"/g;
const SQL_WORD = /'event_word'\s*,\s*'([^']+)'/g;

function seededEventWords(): string[] {
  const found = new Set<string>();
  for (const file of readdirSync(MIGRATIONS)) {
    if (!file.endsWith('.sql')) continue;
    const src = readFileSync(join(MIGRATIONS, file), 'utf8');
    for (const re of [JSON_WORD, SQL_WORD]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) found.add(m[1]!);
    }
  }
  return [...found].sort();
}

const SEEDED_WORDS = seededEventWords();
const WORD_FLOOR = 14;

/**
 * Words chosen to break the sentence rather than to describe the product: a
 * vowel start (the article), a multi-word noun, and the empty string an
 * admin can save into that box.
 */
const ADVERSARIAL_WORDS = ['anniversary', 'event', 'corporate event', 'open house', ''];

const celebratory = (eventWord: string): AnniversaryWords => ({ eventWord, solemn: false });
const solemn = (eventWord: string): AnniversaryWords => ({ eventWord, solemn: true });

const base = { coupleName: 'Maria & Jose', eventName: 'Maria & Jose', ctaHref: 'https://x.test/y' };

/**
 * THE SHARED EMAIL CHROME IS NOT THIS MODULE'S COPY — and it says "wedding".
 *
 * `renderBrandedEmail` closes every branded email with
 * *"Setnayan · Filipino wedding planning + verified vendors"*. That is the
 * COMPANY'S OWN TAGLINE, not a claim about the reader's event, and whether
 * Setnayan still describes itself that way now it serves seventeen event types
 * is a positioning call and the owner's — the same reasoning by which the door
 * guard pardons "couples planning their…" rather than rewriting it.
 *
 * ⚖ Surfaced, not silently skipped, and not silently rewritten. It is billed
 * below so it stays visible, and the bill is checked so a pardon nobody needs
 * cannot lie around.
 *
 * 🔴 SEPARATELY, AND WORTH A LOOK: the line under it reads "You're receiving
 * this because you started a Papic gallery for your event" on EVERY branded
 * email, directly beneath each email's own true reason line. That is shared
 * chrome across many senders, so it is reported rather than changed here.
 */
const SHARED_CHROME_PARDON = 'Setnayan · Filipino wedding planning + verified vendors';

/** Every rendered surface of the email as one string — subject, text, html. */
const rendered = (e: { subject: string; text: string; html: string } | null): string =>
  e ? `${e.subject}\n${e.text}\n${e.html}`.split(SHARED_CHROME_PARDON).join('') : '';

test('the seeded-word scan still matches — a scan that finds nothing reads like a pass', () => {
  console.log(`seeded event words (${SEEDED_WORDS.length}): ${SEEDED_WORDS.join(', ')}`);
  assert.ok(
    SEEDED_WORDS.length >= WORD_FLOOR,
    `Only ${SEEDED_WORDS.length} event words found in the migrations (floor ` +
      `${WORD_FLOOR}). Fix the derivation, never the floor — a sweep that has ` +
      'stopped matching finds no offenders and reports a clean pass.',
  );
  assert.ok(
    SEEDED_WORDS.includes('wake'),
    "'wake' is seeded by the funeral migration in the SQL spelling. If it is " +
      'missing, the scan has gone back to reading one spelling.',
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   1 · A WEDDING READS BYTE-IDENTICALLY TO WHAT SHIPPED
   ══════════════════════════════════════════════════════════════════════════ */

const WEDDING_DIGEST_FROZEN = [
  'Hi Maria & Jose,',
  '',
  '3 years ago today, you said "I do." We hope this finds you smiling at the memory.',
  '',
  'Every photo, every clip, every moment from your wedding is still waiting for you on Setnayan. Take a few minutes today to scroll back through it — relive your day exactly as it happened.',
  '',
  'Relive your day:',
  'https://x.test/y',
  '',
  "Here's to many more. 💛",
  '',
  "— Set na 'yan.",
  '',
  'You\'re receiving this because you celebrated your wedding with Setnayan. To stop anniversary reminders, reply with "unsubscribe" or email support@setnayan.com.',
].join('\n');

const WEDDING_HEADSUP_FROZEN =
  'Your first wedding anniversary is about 6 weeks away. A whole year already — worth celebrating.';

test('the wedding arm is frozen — this literal is never edited to match a change', () => {
  const e = buildAnniversaryEmail({
    ...base,
    yearsAgo: 3,
    eventType: 'wedding',
    words: celebratory('wedding'),
  });
  assert.ok(e, 'a wedding must still receive its anniversary mail');
  assert.equal(e.subject, '3 years ago today 💛');
  assert.equal(
    e.text,
    WEDDING_DIGEST_FROZEN,
    'A wedding is the only arm anyone in production has ever received. If this ' +
      'fails, what a real couple reads has moved — restore the copy, do not ' +
      'update the literal.',
  );
});

test('the wedding heads-up sentence is frozen too', () => {
  const e = buildAnniversaryHeadsupEmail({
    ...base,
    eventType: 'wedding',
    words: celebratory('wedding'),
  });
  assert.ok(e);
  assert.equal(e.subject, 'Your 1st anniversary is coming up 💛');
  assert.ok(
    e.text.includes(WEDDING_HEADSUP_FROZEN),
    `wedding heads-up copy moved. Got:\n${e.text}`,
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   2 · NO SOLEMN EVENT IS EVER RENDERED AT ALL
   ══════════════════════════════════════════════════════════════════════════ */

test('a wake gets NOTHING from either builder — not gentler copy, nothing', () => {
  for (const word of ['wake', 'memorial', 'funeral']) {
    assert.equal(
      buildAnniversaryEmail({ ...base, yearsAgo: 1, eventType: 'funeral', words: solemn(word) }),
      null,
      `the digest rendered something for a solemn '${word}'`,
    );
    assert.equal(
      buildAnniversaryHeadsupEmail({ ...base, eventType: 'funeral', words: solemn(word) }),
      null,
      `the heads-up rendered something for a solemn '${word}'`,
    );
  }
});

test('the refusal is keyed on the REGISTER, not on the type key', () => {
  // A type nobody has named yet, carrying the solemn register, must be refused
  // — the register is the ruling, the key is just where the row is filed.
  assert.equal(
    buildAnniversaryEmail({
      ...base,
      yearsAgo: 1,
      eventType: 'some_future_type',
      words: solemn('remembrance'),
    }),
    null,
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   3 · NO OTHER EVENT TYPE IS TOLD IT HAD A WEDDING
   ══════════════════════════════════════════════════════════════════════════ */

/** Plurals included — a sibling guard spelt these singular and went blind. */
const WEDDING_WORD = /\b(weddings?|brides?|grooms?|married|I do)\b/i;

test('the shared-chrome pardon is a BILL — the line it pardons still exists', () => {
  const e = buildAnniversaryEmail({
    ...base,
    yearsAgo: 1,
    eventType: 'birthday',
    words: celebratory('birthday'),
  });
  assert.ok(e);
  assert.ok(
    e.html.includes(SHARED_CHROME_PARDON),
    'the shared email footer no longer carries this line — delete the pardon ' +
      'rather than leaving standing permission lying around.',
  );
});

test('PRINT THE FINISHED SENTENCE for every word, and none of them says wedding', () => {
  const words = [...new Set([...SEEDED_WORDS, ...ADVERSARIAL_WORDS])].filter(
    // 'wedding' has its own frozen arm above. 'wake' is the solemn word and can
    // never reach a celebratory render — its refusal is asserted in §2, and
    // printing "you had a wake worth remembering" here would only mislead.
    (w) => w !== 'wedding' && w !== 'wake',
  );
  const offenders: string[] = [];
  for (const w of words) {
    const digest = buildAnniversaryEmail({
      ...base,
      yearsAgo: 1,
      eventType: 'birthday',
      words: celebratory(w),
    });
    const headsup = buildAnniversaryHeadsupEmail({
      ...base,
      eventType: 'birthday',
      words: celebratory(w),
    });
    assert.ok(digest && headsup, `builder refused a celebratory '${w}'`);

    // 🔑 READ THE SENTENCE. #4900 shipped "a event" and "a anniversary" and its
    // author found them only by rendering every type, never by reading code.
    const line = digest.text.split('\n')[2]!;
    const headsupLine = headsup.text.split('\n')[2]!;
    console.log(`  [${w || '(blank)'}] ${line}`);
    console.log(`  [${w || '(blank)'}] ${headsupLine}`);

    for (const surface of [rendered(digest), rendered(headsup)]) {
      const m = surface.match(WEDDING_WORD);
      if (m) offenders.push(`${w || '(blank)'} → "${m[0]}"`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'a non-wedding event was told it had a wedding:\n' + offenders.join('\n'),
  );
});

test('the article is a call, not a concatenation — no "a event", no "a anniversary"', () => {
  const bad: string[] = [];
  for (const w of [...new Set([...SEEDED_WORDS, ...ADVERSARIAL_WORDS])]) {
    const e = buildAnniversaryEmail({
      ...base,
      yearsAgo: 1,
      eventType: 'birthday',
      words: celebratory(w),
    });
    const text = rendered(e);
    // "a" followed by a vowel-initial noun, or "an" followed by a consonant.
    if (/\ba (?=[aeiou])/i.test(text)) bad.push(`"a" before a vowel for '${w}': ${text.split('\n')[2]}`);
    if (/\ban (?![aeiou])/i.test(text)) bad.push(`"an" before a consonant for '${w}'`);
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

test('a blank event word still renders a sentence, never "your ."', () => {
  const e = buildAnniversaryEmail({
    ...base,
    yearsAgo: 1,
    eventType: 'birthday',
    words: celebratory('   '),
  });
  assert.ok(e);
  assert.ok(
    e.text.includes('your event'),
    `an admin can save a blank event word; the sentence must still read. Got:\n${e.text}`,
  );
  assert.ok(!/\byour \./.test(e.text), 'rendered "your ." from a blank noun');
});

/* ══════════════════════════════════════════════════════════════════════════
   4 · THE HEADS-UP DOES NOT SAY "your first birthday anniversary"
   ══════════════════════════════════════════════════════════════════════════ */

test('a non-wedding heads-up rebuilds the sentence rather than swapping the noun', () => {
  const e = buildAnniversaryHeadsupEmail({
    ...base,
    eventType: 'birthday',
    words: celebratory('birthday'),
  });
  assert.ok(e);
  assert.ok(
    !/first birthday anniversary/i.test(e.text),
    'a naive noun swap produces "your first birthday anniversary" — a ' +
      "birthday's anniversary is just a birthday. " +
      `Got:\n${e.text}`,
  );
  assert.ok(
    e.text.includes('it will be a year since your birthday'),
    `heads-up sentence lost its shape:\n${e.text}`,
  );
});

test('the countdown phrase is capitalised where it starts the sentence', () => {
  const one = buildAnniversaryHeadsupEmail({
    ...base,
    eventType: 'birthday',
    words: celebratory('birthday'),
    weeksAway: 1,
  });
  assert.ok(one);
  assert.ok(one.text.includes('About a week from now'), `got:\n${one.text}`);
  assert.ok(!one.text.includes('about a week from now'), 'lower-case sentence start');
});

/* ══════════════════════════════════════════════════════════════════════════
   5 · THE BELT THE SQL GATE DELIBERATELY DOES NOT CARRY
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * A SOLEMN TYPE WHOSE ROW HAS LOST ITS `register` KEY STILL RESOLVES SOLEMN.
 *
 * The selector's allow-list cannot catch that case — a row that exists and does
 * not say 'solemn' passes it — and the only SQL belt available would hardcode
 * an event-type key, which the owner renamed on 2026-08-27. So the belt lives
 * here instead, in the resolver's own fallback, and this asserts it is real
 * rather than assumed. The db test states the same boundary from the other side.
 *
 * 🔑 IT FINDS THE SOLEMN PROFILE BY ITS REGISTER, NEVER BY ITS NAME — not the
 * export name, not the type key. Both are being renamed this week; the register
 * is the property that means something. A floor fails the test if the search
 * finds none, so a rename that removed the solemn profile entirely cannot read
 * as a pass.
 */
test('a solemn type whose row omits the register still resolves solemn (the code belt)', async () => {
  const mod: Record<string, unknown> = await import('./event-type-profile');
  const solemnProfiles = Object.entries(mod)
    .filter(([, v]) => {
      const t = (v as { terminology?: { register?: string } } | null)?.terminology;
      return t?.register === 'solemn';
    })
    .map(([name, v]) => ({ name, profile: v as { eventType: string } }));

  console.log(
    `  solemn code profiles found: ${solemnProfiles
      .map((p) => `${p.name} (event_type=${p.profile.eventType})`)
      .join(', ') || '(none)'}`,
  );
  assert.ok(
    solemnProfiles.length >= 1,
    'no exported profile carries the solemn register. Either the solemn event ' +
      'type lost its code fallback — in which case a row that drops its ' +
      '`register` key now resolves CELEBRATORY and the anniversary mail has no ' +
      'belt at all — or this search has stopped matching. Fix the cause, not ' +
      'the floor.',
  );

  const { toProfile } = mod as {
    toProfile: (row: Record<string, unknown>) => { terminology: { register: string } };
  };
  for (const { name, profile } of solemnProfiles) {
    const stripped = toProfile({
      event_type: profile.eventType,
      // A row that exists and carries words but NO register — exactly what the
      // admin editor's rebuild-from-form bug used to save.
      terminology: { event_word: 'wake' },
      enabled_surfaces: null,
      marketplace_enabled: null,
      event_class: null,
      layer_mode: null,
      multi_day: null,
      onboarding_flow_key: null,
      role_set_key: null,
      template_pack_key: null,
      monogram_set_key: null,
      reveal_pack_key: null,
      budget_taxonomy_key: null,
      schedule_seed_key: null,
      statutory_pack_key: null,
    });
    assert.equal(
      stripped.terminology.register,
      'solemn',
      `${name}: a row with no register key resolved '${stripped.terminology.register}'. ` +
        'That is the belt the anniversary selector relies on instead of ' +
        'hardcoding an event-type key.',
    );
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   6 · THE JOB CLAIMS THE ONCE-A-YEAR LOCK ONLY ONCE IT WILL SEND
   ══════════════════════════════════════════════════════════════════════════ */

test('the occasion is resolved BEFORE the anniversary lock is claimed', () => {
  const src = readFileSync(join(HERE, 'daily-email-jobs.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  for (const logTable of ['anniversary_email_log', 'anniversary_headsup_log']) {
    const claimAt = src.indexOf(`.from('${logTable}')`);
    assert.ok(claimAt > 0, `could not find the ${logTable} claim — has the job moved?`);
    const resolveAt = src.lastIndexOf('anniversaryWordsFor(c.event_type)', claimAt);
    assert.ok(
      resolveAt > 0 && resolveAt < claimAt,
      `${logTable} is claimed before the occasion is resolved. The lock is ` +
        'once a YEAR: claiming it and then declining to send burns that ' +
        "event's whole anniversary instead of retrying tomorrow.",
    );
  }
});
