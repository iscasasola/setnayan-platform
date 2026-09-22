/**
 * published-contacts-are-canonical.test.ts — no published surface may point a
 * person at somebody's personal mailbox.
 *
 * ── The defect ──────────────────────────────────────────────────────────────
 * The Data Protection Officer contact was the owner's personal Gmail, in 22
 * places across 10 published surfaces — /privacy (×6), /terms, /refunds,
 * /cookies, /acceptable-use, /privacy/google-access, the marketing footer, the
 * JSON-LD Organization block, lib/help.ts and lib/llms-txt.ts.
 *
 * Under RA 10173 that address is the endpoint a data subject uses to exercise
 * access, correction, blocking and erasure, and the one the NPC uses to reach
 * the controller. The repo's own compliance register had it open as a Tier-0
 * task (`lib/npc-filing-tasks.ts`, key `t0-3`): the canonical filing documents
 * said `dpo@setnayan.com`, the code said the Gmail. Owner ruled 2026-09-22.
 *
 * 🔑 WHY A GUARD RATHER THAN A CAREFUL EDIT. The same value had ALREADY drifted
 * in the other direction: `support@setnayan.com` is declared twice,
 * independently, in `anniversary-emails-core.ts` and `godchild-reminder-emails.ts`.
 * A string that lives in twenty-two places and is owned by none of them will be
 * wrong in some of them. Replacing a legal contact is also precisely the edit
 * that gets made quickly and reviewed by nobody.
 *
 * 🛡 The check asserts the PROPERTY — "no consumer-mail-host address is
 * published" — not the absence of one particular spelling. Banning the literal
 * `iscasasolaii@gmail.com` would pass the moment somebody pasted a different
 * personal address, which is the same mistake in a new costume.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { DPO_EMAIL, isPersonalMailbox, PERSONAL_MAIL_DOMAINS } from './contact-addresses';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');

/**
 * The surfaces a member of the public can actually reach. Deliberately NOT the
 * whole tree: a test fixture, an admin-only note describing where mail
 * dispatches, and the User-Agent string `lib/geo.ts` sends to an external API
 * are all legitimate uses of an operational address and are not published
 * legal contacts.
 */
const PUBLISHED_ROOTS = [
  'app/(shell)',
  'app/_components/marketing',
] as const;

const PUBLISHED_FILES = [
  'app/layout.tsx',
  'lib/help.ts',
  'lib/llms-txt.ts',
] as const;

const SOURCE_EXT = /\.(ts|tsx)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      walk(abs, out);
      continue;
    }
    if (SOURCE_EXT.test(entry) && !entry.endsWith('.test.ts') && !entry.endsWith('.test.tsx')) {
      out.push(abs);
    }
  }
  return out;
}

function publishedSources(): string[] {
  const files: string[] = [];
  for (const r of PUBLISHED_ROOTS) walk(join(WEB, r), files);
  for (const f of PUBLISHED_FILES) files.push(join(WEB, f));
  return files;
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

test('no published surface points a person at a personal mailbox', () => {
  const offenders: string[] = [];
  let scanned = 0;
  let addressesSeen = 0;

  for (const abs of publishedSources()) {
    scanned += 1;
    // Comments stripped: a docblock EXPLAINING that the old address was a
    // personal Gmail is the opposite of the defect and must not read as it.
    const code = stripComments(readFileSync(abs, 'utf8'));
    const rel = abs.slice(WEB.length + 1);
    for (const m of code.match(EMAIL_RE) ?? []) {
      addressesSeen += 1;
      if (isPersonalMailbox(m)) offenders.push(`${rel}  ${m}`);
    }
  }

  // Print what was searched: a zero that looked nowhere reads exactly like a
  // zero that looked everywhere.
  console.log(
    `[published-contacts] ${scanned} published sources, ${addressesSeen} addresses, ` +
      `${offenders.length} personal`,
  );
  assert.ok(scanned > 15, `only ${scanned} published sources walked — wrong cwd or moved folder?`);
  assert.ok(addressesSeen > 5, `only ${addressesSeen} addresses found — the matcher stopped working`);
  assert.deepEqual(
    offenders,
    [],
    'A published surface names a personal mailbox. Under RA 10173 the DPO contact is a ' +
      'legal endpoint, and a consumer-host address also publishes somebody’s private ' +
      `mail on a public page. Use DPO_EMAIL (${DPO_EMAIL}) from lib/contact-addresses.ts.\n  ` +
      offenders.join('\n  '),
  );
});

test('the DPO address is on our own domain, and the personal-domain list is real', () => {
  assert.ok(DPO_EMAIL.endsWith('@setnayan.com'), `DPO_EMAIL is ${DPO_EMAIL}`);
  assert.equal(isPersonalMailbox(DPO_EMAIL), false);
  // The matcher must actually match — a list that recognises nothing would make
  // the sweep above green forever.
  assert.equal(isPersonalMailbox('someone@gmail.com'), true);
  assert.equal(isPersonalMailbox('  SomeOne@GMAIL.com  '), true, 'case and space tolerant');
  assert.ok(PERSONAL_MAIL_DOMAINS.length >= 5);
});

test('/privacy still publishes a DPO contact at all — the fix must not delete it', () => {
  const src = readFileSync(join(WEB, 'app/(shell)/privacy/page.tsx'), 'utf8');
  const hits = (src.match(new RegExp(DPO_EMAIL.replace('.', '\\.'), 'g')) ?? []).length;
  console.log(`[published-contacts] /privacy names ${DPO_EMAIL} ${hits} time(s)`);
  assert.ok(
    hits >= 2,
    `privacy/page.tsx names the DPO address ${hits} time(s). Removing the contact is not a ` +
      'way to pass the check above — an unreachable controller is its own violation.',
  );
});
