/**
 * GUARD — the top of the funnel stays non-sectarian.
 *
 * ─── WHAT THIS FILE USED TO BE, AND WHY IT SHRANK ────────────────────────
 * Until 2026-08-13 this pinned the owner-approved § 5 Filipino-USP copy on the
 * ELN cinematic homepage — the hero kicker, both headline lines, the hero
 * sub-line, the manifesto (including the **samahan clause**) and the Alaala
 * dock copy — line by line, against `HomeReskin.tsx` and `pillars.tsx`.
 *
 * The owner retired that page completely (`DECISION_LOG.md` 2026-08-13), and
 * both files are deleted. Those assertions no longer have a subject.
 *
 * 🔑 **THIS GUARD IS WHY THE COPY LOSS WAS NOTICED AT ALL.** The ruling was
 * about a LAYOUT; nobody said out loud that deleting the page also deletes
 * owner-approved brand copy that exists nowhere else. Deleting the page turned
 * this file red with `ENOENT`, and that is the only reason anyone looked.
 * **A guard going red because its subject vanished is a finding, not noise.**
 *
 * 📄 The retired copy is preserved verbatim — with the open owner question of
 * whether the manifesto should appear on the new front door — in the corpus at
 * `RETIRED_ELN_HOMEPAGE_COPY_2026-08-13.md`. It is NOT lost, and it is NOT
 * silently re-added: putting a section on a locked, approved design is the
 * owner's call, not engineering's.
 *
 * ─── WHAT SURVIVES HERE, AND WHY ─────────────────────────────────────────
 * One rule in the old file was never about that page: **§ 5 keeps faith-
 * specific rites on the deeper pages only — never in the hero.** That is a
 * standing product rule about the TOP OF THE FUNNEL, and the funnel still has a
 * top; it just has a different page at it now. So the rule moved to the front
 * door rather than being retired with the layout it happened to be written
 * against.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');

/** The front door's shell — the top bar, the hero line and the rail copy. */
const FRONT_DOOR_SHELL = 'app/_components/frontdoor/front-door-shell.tsx';

const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/** Strip comments so a docblock can never satisfy — or trip — an assertion. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * Owner's § 5 rule, verbatim: "binyag · kumpil · kasal · aqiqah … **Never in
 * the hero.**" Faith-specific rites belong on the deeper pages, where somebody
 * has already chosen to look for them — not on the first screen every visitor
 * meets, whatever their faith.
 */
const FAITH_RITES = /\b(binyag|kumpil|kasal|aqiqah|bautismo|christening)\b/i;

test('ANCHOR — the front door shell was really read', () => {
  const src = read(FRONT_DOOR_SHELL);
  assert.ok(
    src.length > 3000,
    `front-door-shell.tsx read as ${src.length} chars — too short to be the real shell, ` +
      'so the scan below would prove nothing',
  );
});

test('the top of the funnel stays non-sectarian (§ 5: never in the hero)', () => {
  // Scoped to the VISIBLE strings in the shell rather than the whole file, so
  // this asserts the owner's rule about the first screen and does not pretend
  // to police every word in the app.
  const src = stripComments(read(FRONT_DOOR_SHELL));

  const hit = FAITH_RITES.exec(src);
  assert.equal(
    hit,
    null,
    `The front door names the rite "${hit?.[0]}". § 5 keeps faith-specific rites on ` +
      'the deeper pages only — never on the first screen every visitor meets. ' +
      'The marketplace has eleven faith-specific ceremony venues and they are a ' +
      'genuine asset; they belong where somebody has already chosen to look.',
  );
});

test('the brand tagline survived the homepage swap', () => {
  // The one piece of § 5 copy that DID carry across. Pinned so the next
  // redesign does not quietly drop it the way the manifesto was nearly dropped.
  const src = read(FRONT_DOOR_SHELL);
  assert.match(
    src,
    /Set na/,
    'The "Set na ’yan" brand line is gone from the front door. It is the ' +
      'brand-origin phrase and the last § 5 copy still on the first screen — ' +
      'see RETIRED_ELN_HOMEPAGE_COPY_2026-08-13.md for what already left with ' +
      'the cinematic page.',
  );
});
