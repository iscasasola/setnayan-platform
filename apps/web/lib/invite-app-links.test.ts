/**
 * invite-app-links.test.ts — WhatsApp · Viber · Messenger · More apps… (owner 2026-10-26:
 * "Viber/Whatsapp invite buttons. we need to allow the invite to work seamlessly with messaging apps").
 *
 * Executes the pure plan for every app on a phone and a computer, the encoding of the guest's
 * personal link inside the message, and the executor's order (copy BEFORE the app opens; a refused
 * copy opens nothing). What a surface may claim afterwards — never "sent" — is held here too.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INVITE_APPS,
  INVITE_APP_NAMES,
  MESSENGER_APP_URL,
  MESSENGER_WEB_URL,
  inviteAppHint,
  inviteAppPlan,
  inviteAppSaid,
  runInviteAppPlan,
  viberInviteUrl,
  whatsAppInviteUrl,
  type InviteDevice,
} from './invite-app-links';

const PHONE: InviteDevice = { touch: true, share: true };
const PHONE_NO_SHEET: InviteDevice = { touch: true, share: false };
const COMPUTER: InviteDevice = { touch: false, share: false };
const COMPUTER_WITH_SHEET: InviteDevice = { touch: false, share: true };

// A real-shaped message: the guest's name, a line break, an ampersand, an emoji and their PERSONAL link,
// whose `?invite=` and `&` must survive the trip inside another URL's query.
const LINK = 'https://www.setnayan.com/maria-and-jose?invite=Ab3_xY-9&v=2';
const MESSAGE = `Hi Tita Rosa & family! 💌\nYou're invited — open your invitation:\n${LINK}`;

test('WhatsApp: wa.me with the whole message URL-encoded, on a phone AND a computer', () => {
  for (const device of [PHONE, PHONE_NO_SHEET, COMPUTER, COMPUTER_WITH_SHEET]) {
    const plan = inviteAppPlan('whatsapp', MESSAGE, device);
    assert.equal(plan.kind, 'open');
    assert.ok(plan.kind === 'open');
    assert.ok(plan.url.startsWith('https://wa.me/?text='), plan.url);
    // No recipient: nothing between `wa.me/` and `?text=`.
    assert.match(plan.url, /^https:\/\/wa\.me\/\?text=[^?&#\s]+$/);
    const back = new URL(plan.url).searchParams.get('text');
    assert.equal(back, MESSAGE, 'the message does not come back whole from the WhatsApp link');
  }
  assert.equal(whatsAppInviteUrl(MESSAGE), `https://wa.me/?text=${encodeURIComponent(MESSAGE)}`);
});

test('the personal link is encoded — its ? = & never leak into the outer query', () => {
  const url = whatsAppInviteUrl(MESSAGE);
  const query = url.slice('https://wa.me/?'.length);
  assert.equal(query.split('&').length, 1, 'the personal link’s & split the WhatsApp query in two');
  assert.ok(!query.slice('text='.length).includes('='), 'a raw = from the personal link reached the query');
  assert.ok(url.includes(encodeURIComponent(LINK)), 'the personal link is not in the link, encoded');
  assert.ok(!/\s/.test(url), 'a raw space or line break in the link');
});

test('Viber: viber://forward with the message on a phone; a COPY on a computer (no prefilled text there)', () => {
  const phone = inviteAppPlan('viber', MESSAGE, PHONE);
  assert.deepEqual(phone, { kind: 'open', url: `viber://forward?text=${encodeURIComponent(MESSAGE)}` });
  assert.equal(viberInviteUrl(MESSAGE), phone.kind === 'open' ? phone.url : '');
  assert.equal(new URL(viberInviteUrl(MESSAGE)).searchParams.get('text'), MESSAGE);
  for (const device of [COMPUTER, COMPUTER_WITH_SHEET]) {
    assert.deepEqual(inviteAppPlan('viber', MESSAGE, device), { kind: 'copy' }, 'a computer is handed a Viber link it cannot fill');
  }
  // …and the computer is TOLD why it was copied, never left guessing.
  assert.match(inviteAppSaid('viber', { kind: 'copy' }, 'Rosa'), /Viber on a computer can’t take a message from a link/);
  assert.match(inviteAppHint('viber', COMPUTER), /Copies/);
  assert.match(inviteAppHint('viber', PHONE), /Opens with the message/);
});

test('Messenger: copy, then open Messenger empty — the app on a phone, messenger.com on a computer', () => {
  assert.deepEqual(inviteAppPlan('messenger', MESSAGE, PHONE), { kind: 'copy-open', url: MESSENGER_APP_URL });
  assert.deepEqual(inviteAppPlan('messenger', MESSAGE, COMPUTER), { kind: 'copy-open', url: MESSENGER_WEB_URL });
  // Neither carries the message or a recipient — the unverified `fb-messenger://share?link=` is not used.
  assert.equal(MESSENGER_APP_URL, 'fb-messenger://');
  assert.equal(MESSENGER_WEB_URL, 'https://www.messenger.com/');
  assert.match(inviteAppSaid('messenger', { kind: 'copy-open', url: MESSENGER_APP_URL }, 'Rosa'), /Message copied\. Paste it to Rosa in Messenger/);
});

test('More apps…: the phone’s share sheet where there is one, otherwise a copy', () => {
  assert.deepEqual(inviteAppPlan('more', MESSAGE, PHONE), { kind: 'share' });
  assert.deepEqual(inviteAppPlan('more', MESSAGE, COMPUTER_WITH_SHEET), { kind: 'share' });
  assert.deepEqual(inviteAppPlan('more', MESSAGE, PHONE_NO_SHEET), { kind: 'copy' });
  assert.deepEqual(inviteAppPlan('more', MESSAGE, COMPUTER), { kind: 'copy' });
});

test('every app has a name and a one-line hint on both devices — and no line ever says it was sent', () => {
  assert.deepEqual([...INVITE_APPS], ['whatsapp', 'viber', 'messenger', 'more']);
  for (const app of INVITE_APPS) {
    assert.ok(INVITE_APP_NAMES[app].length > 0);
    for (const device of [PHONE, COMPUTER]) {
      const hint = inviteAppHint(app, device);
      assert.ok(hint.length > 0 && hint.length <= 32, `${app}’s hint is not one short line: "${hint}"`);
      const said = inviteAppSaid(app, inviteAppPlan(app, MESSAGE, device), 'Rosa');
      // "then mark it sent" is the offer; "Sent ✓" / "was sent" / "invited" would be a claim we cannot make.
      assert.doesNotMatch(said, /Sent ✓|\bwas sent\b|\bsent to\b|\binvited\b/i, `${app} claims a send: "${said}"`);
    }
  }
});

test('the executor: copy BEFORE the app opens; a refused copy opens nothing; phone same tab, computer new tab', async () => {
  const g = globalThis as unknown as Record<string, unknown>;
  const saved = { navigator: g.navigator, window: g.window };
  const log: string[] = [];
  let refuse = false;
  const win = {
    location: {
      set href(v: string) {
        log.push(`same-tab ${v}`);
      },
    },
    open: (u: string) => {
      log.push(`new-tab ${u}`);
      return { opener: 'x' };
    },
  };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      clipboard: {
        writeText: async (t: string) => {
          if (refuse) throw new Error('NotAllowed');
          log.push(`copy ${t.length}`);
        },
      },
    },
  });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
  try {
    assert.equal(await runInviteAppPlan({ kind: 'copy-open', url: MESSENGER_WEB_URL }, MESSAGE, false), 'done');
    assert.deepEqual(log, [`copy ${MESSAGE.length}`, `new-tab ${MESSENGER_WEB_URL}`], 'the copy must land before the tab steals focus');

    log.length = 0;
    const wa = whatsAppInviteUrl(MESSAGE);
    assert.equal(await runInviteAppPlan({ kind: 'open', url: wa }, MESSAGE, true), 'done');
    assert.deepEqual(log, [`same-tab ${wa}`], 'a phone opens the app in place, with nothing copied');

    log.length = 0;
    assert.equal(await runInviteAppPlan({ kind: 'copy' }, MESSAGE, false), 'done');
    assert.deepEqual(log, [`copy ${MESSAGE.length}`]);

    log.length = 0;
    refuse = true;
    assert.equal(await runInviteAppPlan({ kind: 'copy-open', url: MESSENGER_APP_URL }, MESSAGE, true), 'manual');
    assert.deepEqual(log, [], 'a refused copy still opened Messenger — the host would arrive with nothing to paste');
  } finally {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: saved.navigator });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: saved.window });
  }
});
