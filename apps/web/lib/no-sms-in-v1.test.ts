import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

/**
 * NO SMS IN V1 — email-only via Resend.
 *
 * 🔴 THIS RULE HAD NOTHING BEHIND IT. It is one of the locked decisions in
 * `CLAUDE.md`, and on 2026-09-07 it was tested the only way a rule can be
 * tested: by breaking it. An SMS sender was added to `lib/` and the FULL unit
 * suite — 13,619 tests — went green. Nothing anywhere objected.
 *
 * 🔑 A RULE NOBODY CHECKS IS A SENTENCE, NOT A CONSTRAINT. The same sweep found
 * two documents' worth of rules in that state, and four registers that had gone
 * stale precisely because prose cannot fail. This file is the counterpart the
 * rule never had.
 *
 * ── WHAT IT BANS ────────────────────────────────────────────────────────────
 *   1 · An SMS provider in either package.json. Zero are present today, so this
 *       starts green and only a deliberate addition turns it red.
 *   2 · An SMS-sending symbol in shipped source. Also zero today.
 *
 * ⚠ IT DOES NOT BAN THE WORD "SMS". Copy that explains we do NOT send texts is
 * legitimate and appears on marketing surfaces; banning the noun would fire on
 * the sentence saying the feature is absent — the exact defect
 * `lint-one-comment-stripper` exists to prevent elsewhere. Comments are
 * stripped first for the same reason.
 *
 * ⚠ AND IT IS SCOPED TO SENDING. Receiving a phone number (guest contact
 * details, vendor profiles) is not sending a text and is not policed here.
 *
 * WHEN V1 ENDS AND SMS IS GENUINELY ADDED: delete this file in the same commit
 * that adds the provider, and strike the rule from `CLAUDE.md`. Do not weaken
 * the pattern to get green.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const ROOT = join(WEB, '..', '..');

/** Providers that exist to send a text message. */
const SMS_PROVIDERS = /"(twilio|nexmo|@vonage\/[a-z-]+|messagebird|plivo|semaphore[a-z-]*|@aws-sdk\/client-sns)"/i;

/** A symbol whose job is to send one. */
const SMS_SENDER = /\b(sendSms|sendSMS|sendTextMessage|smsClient|SmsProvider)\b/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

test('no SMS provider is a dependency', () => {
  for (const pkg of [join(ROOT, 'package.json'), join(WEB, 'package.json')]) {
    const src = readFileSync(pkg, 'utf8');
    const hit = SMS_PROVIDERS.exec(src);
    assert.equal(
      hit,
      null,
      `${relative(ROOT, pkg)} depends on ${hit?.[0]} — an SMS provider. ` +
        'CLAUDE.md locks V1 to email-only via Resend. If that decision has changed, ' +
        'delete this guard in the same commit and strike the rule from CLAUDE.md.',
    );
  }
});

test('no shipped module sends a text message', () => {
  const offenders: string[] = [];
  for (const f of [...walk(join(WEB, 'lib')), ...walk(join(WEB, 'app'))]) {
    const code = stripComments(readFileSync(f, 'utf8'));
    const hit = SMS_SENDER.exec(code);
    if (hit) offenders.push(`${relative(WEB, f)} — ${hit[0]}`);
  }
  assert.deepEqual(
    offenders,
    [],
    `These modules send SMS, which V1 does not do:\n  ${offenders.join('\n  ')}\n` +
      'Email-only via Resend is a locked decision in CLAUDE.md.',
  );
});

test('the guard is scanning a real tree — it cannot silently check nothing', () => {
  const files = [...walk(join(WEB, 'lib')), ...walk(join(WEB, 'app'))];
  assert.ok(
    files.length > 500,
    `Only ${files.length} source files walked. A guard pointed at the wrong root reads ` +
      'nothing and passes forever.',
  );
});
