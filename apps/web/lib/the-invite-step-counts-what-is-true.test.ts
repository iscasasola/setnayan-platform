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
 *
 * ── ✅ AMENDED 2026-09-16 — THE FEATURE NOW EXISTS ──────────────────────────
 * This file's first test used to assert that **nothing writes the column**, and
 * it left instructions for whoever changed that. They have been followed. The
 * per-guest send was built: `markGuestInvitationSent` in
 * `app/dashboard/[eventId]/invitation/actions.ts`, driven by a modal that copies
 * ONE message carrying THAT guest's own invitation link.
 *
 * ⚠ WHY IT WAS BUILT: measured on a real event, **75 of 77 guests have no email
 * and no mobile**. V1 sends no SMS, so those invitations travel by Viber or by
 * hand, and nothing recorded that — "who still needs theirs?" was unanswerable.
 *
 * 🔑 SO THE ASSERTION IS INVERTED, NOT DELETED. It now pins **exactly one
 * writer**, because the failure this file exists to prevent has a twin: a
 * SECOND writer — a fan-out that stamps every row at once, say — would make the
 * number fall without anybody handing anything to anybody, which is the same
 * lie pointing the other way.
 *
 * ⚠ AND THE INVITE STEP IN THE GUEST-LIST RIBBON IS DELIBERATELY UNCHANGED. It
 * still reports whether the shared link works, because that is still what THAT
 * stage does. The count of who has been handed their own invitation lives on
 * the invitation page, where the sending happens. Two surfaces, two honest
 * answers; the second test below still holds the first one.
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

test('the count says MARKED, never "sent" — Setnayan delivers none of these', () => {
  /*
    ⚖ THIS TEST REPLACES "nothing filters the guest list on a column nothing
    writes". That one existed because a number was fed by a column with no
    writer. The writer now exists, so a count is legitimate — and the risk moves
    one step along: the count is of what the COUPLE RECORDED BY HAND, and the
    product must not let it drift into claiming a delivery it never performed.

    🔑 V1 SENDS NOTHING HERE. No SMS, no Viber integration; the couple copies a
    message and pastes it themselves. A pill reading "40 sent" would be the
    product taking credit for forty acts it did not perform and cannot verify —
    the same species of false claim as the frozen number, wearing better clothes.
  */
  const page = strip(
    readFileSync(join(WEB, 'app', 'dashboard', '[eventId]', 'invitation', 'page.tsx'), 'utf8'),
  ).replace(/\s+/g, ' ');

  assert.match(page, /invitationsMarked/, 'the invitation page no longer counts what was marked');

  /* ⚠ SLICE THE WHOLE SUMMARY, NOT ONE PHRASE. The block has THREE branches —
     none marked, all marked, some marked — and an earlier version of this test
     matched a single phrase, so rewording two branches out of three left it
     GREEN. Face every branch at once. */
  const start = page.indexOf('{invitationsMarked === 0 ?');
  assert.ok(start > 0, 'the summary block is gone — the count no longer renders');
  const end = page.indexOf('</p>', start);
  assert.ok(end > start, 'the summary block has no end tag; the slice would run to the file end');
  const summary = page.slice(start, end);

  /* The forbidden word is the confident one. "Mark sent" on a BUTTON is the
     couple's own verb for their own act and is fine — it is not in this slice.
     A COUNT that reports "N sent" is the PRODUCT asserting a delivery it never
     performed. \bsent\b does not match "Send", which the copy legitimately uses
     to point at the control. */
  assert.doesNotMatch(summary, /\bsent\b/i,
    'the count must not use the verb "sent" — Setnayan delivers none of these; ' +
      'the couple copies a message and pastes it themselves');
  assert.match(summary, /marked/,
    'the count must say what it actually knows: that the couple MARKED it');
});

test('the column has EXACTLY ONE writer — zero froze the number, two would fake it', () => {
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

  /* ⚖ EXACTLY ONE WRITER, AND IT IS THE PER-GUEST ONE.
     Zero writers is the original defect: a number that can never fall.
     TWO writers is the same defect pointing the other way — a fan-out that
     stamps every row at once makes the number fall without anybody handing
     anything to anybody. Both are "a constant wearing a number's clothes". */
  const EXPECTED_WRITER = 'app/dashboard/[eventId]/invitation/actions.ts';
  assert.deepEqual(
    [...writers, ...sqlWriters].sort(),
    [EXPECTED_WRITER],
    'guests.invitation_sent_at must have exactly one writer — the per-guest ' +
      '"Mark sent" on the invitation page. A new writer here means something ' +
      'else is stamping invitations; a missing one means the count on the ' +
      'invitation page is frozen again, which is the defect this file is for.',
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
