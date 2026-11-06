/**
 * GUARD — WhatsApp · Viber · Messenger are ONE set of choices, and opening one is not a send.
 *
 * Owner 2026-10-26: *"Viber/Whatsapp invite buttons. we need to allow the invite to work seamlessly
 * with messaging apps."* House rule (owner 2026-09-28): a set of choices is ONE dropdown or one
 * compact sheet, never a pill row. What this holds, each a property of the source:
 *
 *   ⓵ ONE CHOICE PER SURFACE. The guest card's Invite sheet draws the apps as rows of ONE group
 *     (`data-invite-apps`), made by ONE `.map` — never a hand-written button per app; the send run
 *     and the accepted-request card draw them as ONE `PickMenu`. No pill (`rounded-full`) app button.
 *   ⓶ ONE SPELLER. No component spells `wa.me` / `viber://` / `fb-messenger` itself — every link is
 *     `inviteAppPlan`'s (lib/invite-app-links.ts, executed by its own test).
 *   ⓷ OPENING AN APP IS NOT A SEND. Neither surface's `viaApp` stamps Sent ✓; the line it leaves
 *     offers Mark as sent; the lib never touches `invitation_sent_at`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => stripComments(readFileSync(join(HERE, ...p), 'utf8'));
const CELL = read('guest-invite-cell.tsx');
const SEND = read('send-invite.tsx');
const LIB = read('..', '..', '..', '..', '..', 'lib', 'invite-app-links.ts');

/** The body of `function <name>(…) {…}` — walks past the params first. */
function bodyOf(src: string, name: string): string {
  const at = src.search(new RegExp(`function ${name}\\(`));
  assert.ok(at >= 0, `${name} is gone — this guard is pinning a ghost`);
  let parens = 0;
  let afterParams = -1;
  for (let i = src.indexOf('(', at); i < src.length; i += 1) {
    if (src[i] === '(') parens += 1;
    else if (src[i] === ')' && --parens === 0) {
      afterParams = i;
      break;
    }
  }
  const open = src.indexOf('{', afterParams);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error(`unbalanced braces in ${name}`);
}

test('⓵ the card’s Invite sheet: the apps are rows of ONE group, made by ONE map', () => {
  const cell = bodyOf(CELL, 'GuestInviteCell');
  assert.equal((cell.match(/data-invite-apps=""/g) ?? []).length, 1, 'the apps are not ONE group in the Invite sheet');
  assert.match(cell, /data-invite-apps="">\s*\{appRows\}\s*<\/div>/, 'the app group holds something other than the one list');
  // One map over the apps makes every row; a second hand-written app button would be a second shape.
  assert.match(cell, /const appRows = \(\['whatsapp', 'viber', 'messenger'\] as const\)\.map\(/);
  assert.equal((cell.match(/data-invite-app=\{app\}/g) ?? []).length, 1, 'more than one place draws an app row');
  assert.doesNotMatch(cell, /data-invite-app="(?:whatsapp|viber|messenger)"/, 'an app row is hand-written outside the one map');
  // The rows wear the sheet's own row style, never a pill.
  const rows = cell.slice(cell.indexOf('const appRows'), cell.indexOf('const copyLinkRow'));
  assert.match(rows, /className=\{step\}/, 'the app rows are not the sheet’s rows');
  assert.doesNotMatch(rows, /rounded-full/, 'an app choice is drawn as a pill');
  // "More apps…" on a phone is the one share row — the shipped share, not a second sender.
  assert.match(cell, /data-guest-invite-share=""[\s\S]{0,700}INVITE_APP_NAMES\.more/);
});

test('⓵ the send run and the accepted-request card: the apps are ONE PickMenu', () => {
  const send = bodyOf(SEND, 'SendInviteActions');
  assert.equal((send.match(/<PickMenu\b/g) ?? []).length, 1, 'Send invite draws the apps as something other than ONE dropdown');
  assert.match(send, /data-send-invite-apps="">\s*<PickMenu/, 'the dropdown lost its handle');
  assert.match(send, /options=\{\(\['whatsapp', 'viber', 'messenger'\] as const\)\.map\(/);
  assert.match(send, /onPick=\{viaApp\}/);
  // Drawn once, in both widths (the run's full-width phone buttons, the card's row).
  assert.equal((send.match(/\{appMenu\}/g) ?? []).length, 1);
});

test('⓶ no component spells an app link itself — lib/invite-app-links.ts is the one speller', () => {
  for (const [name, src] of [['guest-invite-cell.tsx', CELL], ['send-invite.tsx', SEND]] as const) {
    assert.doesNotMatch(src, /wa\.me|api\.whatsapp|viber:\/\/|fb-messenger|messenger\.com/, `${name} spells an app link itself`);
    assert.match(src, /inviteAppPlan\(/, `${name} no longer asks the one plan what a tap does`);
    assert.match(src, /runInviteAppPlan\(/, `${name} opens apps its own way`);
  }
  assert.match(bodyOf(LIB, 'inviteAppPlan'), /whatsAppInviteUrl\(text\)/);
  assert.match(bodyOf(LIB, 'whatsAppInviteUrl'), /encodeURIComponent\(text\)/, 'the WhatsApp message is not URL-encoded');
  assert.match(bodyOf(LIB, 'viberInviteUrl'), /encodeURIComponent\(text\)/, 'the Viber message is not URL-encoded');
});

test('⓷ opening an app is not a send — it never stamps, and it offers Mark as sent', () => {
  for (const [name, src] of [['guest-invite-cell.tsx', CELL], ['send-invite.tsx', SEND]] as const) {
    const via = bodyOf(src, 'viaApp');
    assert.doesNotMatch(via, /\bmark\(|setGuestInvitationSent\(/, `${name}: opening an app stamps Sent ✓ — we only opened it`);
    assert.match(via, /kind: 'app'/, `${name}: an app tap no longer says what happened`);
    // The only path in viaApp that can stamp is the shipped share ('More apps…'), which stamps on 'shared' alone.
    assert.match(via, /if \(plan\.kind === 'share'\) return (?:share|send)\(\);/);
  }
  // The line an app leaves offers Mark as sent where it is not sent yet.
  assert.match(CELL, /said\?\.kind === 'app'[\s\S]{0,600}touch && !sentAt[\s\S]{0,300}mark\(true\)[\s\S]{0,400}Mark as sent/);
  assert.match(SEND, /said\?\.kind === 'app'[\s\S]{0,400}sentAt \? null[\s\S]{0,200}Mark as sent[\s\S]{0,60}mark\(true\)/);
  assert.doesNotMatch(LIB, /invitation_sent_at|setGuestInvitationSent|from '@\/app\//, 'the link builder reaches for the Sent ✓ writer');
});
