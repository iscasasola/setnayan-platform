/**
 * the-invite-step-counts-what-is-true.test.ts
 *
 * 🚨 WHAT WENT WRONG. The guest list's progress ribbon has four steps, three of
 * which count real rows and move as the couple works: guests to review, guests
 * to seat, guests who arrived. The fourth read **"N to send"** and could never
 * fall, because it counted `guests.invitation_sent_at IS NULL` and **nothing
 * anywhere writes that column** — not this repo, not a migration, not any
 * function in the production schema. All three were checked; 0 of 35 live
 * guests are stamped.
 *
 * 🔑 IT WAS NOT AN OVERSIGHT IN THE WRITE PATH — THE FEATURE DOES NOT EXIST.
 * This product has no per-guest send to stamp. The Invite stage hands out ONE
 * link for everybody; the save-the-date fan-out has its own separate column,
 * and this one's migration describes it as "the later formal RSVP invitation",
 * which was never built. So stamping the column would have been a lie in the
 * other direction: it would have claimed we sent something to each guest.
 *
 * 🔑 THE FAMILY THIS BELONGS TO — a gate with no handle, in reverse. Elsewhere
 * a column had no WRITER so a feature was silently inert; here a column had no
 * writer so a NUMBER was silently permanent. Both look completely fine on
 * screen, both typecheck, and neither logs anything. **A count over a column
 * nobody writes is not a measurement, it is a constant wearing a number's
 * clothes.**
 *
 * WHAT IT SAYS NOW. The one thing that stage genuinely has is binary: can the
 * shared link be handed out, or does it open to "Link not found"? The page
 * already knows without another read — `fetchJoinUrl` asks `sharedJoinLinkState`
 * and returns null when the event has no address, is still private, or its
 * token was revoked.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const REPO = join(WEB, '..', '..');

const DEAD_COLUMN = 'invitation_sent_at';

function strip(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function walk(dir: string, exts: string[], out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '.git') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, exts, out);
    else if (exts.some((e) => entry.endsWith(e)) && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

/**
 * 🪤 SCOPED TO THE QUERY CHAIN, NOT THE FILE — AND THAT IS NOT A DETAIL.
 * `event_moderators` and `event_sponsors` each have their OWN column of this
 * exact name and both are legitimately written. A file-level check was the
 * first cut of the writer arm below and it reported
 * `dashboard/[eventId]/sponsors/actions.ts`: that file writes
 * `event_sponsors.invitation_sent_at` on line 239 and, ninety lines later,
 * happens to read `.from('guests')` for something unrelated. Two different
 * queries, one file, one confident false alarm.
 *
 * A guard that cries wolf teaches you to skim past the one time it is right,
 * so every scan here walks forward from `.from('guests')` to the end of that
 * chain and looks only inside it.
 */
function guestsChains(): { file: string; chain: string }[] {
  const out: { file: string; chain: string }[] = [];
  for (const file of walk(join(WEB, 'app'), ['.ts', '.tsx']).concat(
    walk(join(WEB, 'lib'), ['.ts']),
  )) {
    const code = strip(readFileSync(file, 'utf8'));
    for (const m of code.matchAll(/\.from\((['"])guests\1\)[\s\S]{0,600}?(?=\.from\(|;)/g)) {
      out.push({ file: relative(WEB, file), chain: m[0] });
    }
  }
  return out;
}

test('nothing filters the guest list on a column nothing writes', () => {
  const chains = guestsChains();
  assert.ok(chains.length > 0, 'No .from(\'guests\') query found at all — this guard is scanning nothing.');
  const hits = [...new Set(chains.filter((c) => c.chain.includes(DEAD_COLUMN)).map((c) => c.file))];
  assert.deepEqual(
    hits,
    [],
    `A query filters guests on ${DEAD_COLUMN}, which has no writer anywhere — ` +
      'so whatever it feeds is a constant, not a measurement. If a per-guest ' +
      'send is being built, write the column in the same PR and delete this ' +
      `test with a sentence saying so. Files: ${hits.join(', ')}`,
  );
});

test('the column still has no writer — if that changes, this test is what tells you', () => {
  // A WRITE is the column as an OBJECT KEY inside a guests-table chain
  // (`.update({ invitation_sent_at: … })`). A read is the same name inside a
  // select string or a `.is(…)` filter, which is a quoted argument, not a key.
  const writers = [
    ...new Set(
      guestsChains()
        .filter((c) => new RegExp(`\\b${DEAD_COLUMN}\\s*:`).test(c.chain))
        .map((c) => c.file),
    ),
  ];

  const migrations = join(REPO, 'supabase', 'migrations');
  const sqlWriters = walk(migrations, ['.sql'])
    .filter((f) =>
      /UPDATE\s+(public\.)?guests[\s\S]{0,400}?SET[\s\S]{0,400}?invitation_sent_at/i.test(
        readFileSync(f, 'utf8'),
      ),
    )
    .map((f) => relative(REPO, f));

  assert.deepEqual(
    [...writers, ...sqlWriters],
    [],
    'Something now writes guests.invitation_sent_at. That is good news — it ' +
      'means a per-guest send exists. Re-point the Invite step at it and ' +
      'replace this test. Do NOT just delete it: the whole defect was a number ' +
      'nobody could explain.',
  );
});

test('the Invite step reports the link, not a phantom count', () => {
  const rel = 'app/dashboard/[eventId]/guests/_components/mobile-guest-carousel.tsx';
  const code = strip(readFileSync(join(WEB, rel), 'utf8'));

  const step = code.match(/\{\s*key:\s*'invite'[\s\S]*?\},/);
  assert.ok(step, `${rel} no longer defines an 'invite' step in the ribbon.`);

  assert.ok(
    /inviteLinkReady/.test(step![0]),
    `The Invite step no longer reports whether the link works: ${step![0]}`,
  );
  assert.ok(
    !/\bunsent\b/.test(step![0]),
    `The Invite step is badging "unsent" again — the count that could never ` +
      `fall: ${step![0]}`,
  );
});

test('an unmeasured link never paints a warning', () => {
  const rel = 'app/dashboard/[eventId]/guests/_components/mobile-guest-carousel.tsx';
  const code = strip(readFileSync(join(WEB, rel), 'utf8'));
  assert.match(
    code,
    /inviteLinkReady\s*=\s*true\s*,/,
    'inviteLinkReady must default TRUE. A caller that has not measured must ' +
      'not paint "link not working" over a link that is probably fine — ' +
      'absence of a measurement is not a fault. (The opposite direction is ' +
      'chosen elsewhere on purpose, e.g. canOpenShop fails closed, because ' +
      'there being wrong is permanent.)',
  );
});
