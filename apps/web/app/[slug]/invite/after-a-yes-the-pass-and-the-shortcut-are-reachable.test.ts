/**
 * AFTER A YES, THE GUEST CAN SAVE THEIR PASS AND ADD THE EVENT TO THEIR HOME SCREEN — IN TODAY'S REPLY FLOW.
 *
 * Owner, 2026-10-21 (DECISION_LOG "AFTER THE REPLY: SAVE YOUR PASS · ADD THIS EVENT TO YOUR HOME SCREEN"):
 * *"on their RSVP. do we let them save their QR code after they reply. their digital pass? and also teach them to add a
 * shortcut icon for this event via Safari/Chrome (if they are on safari/chrome)"*.
 *
 * Both already lived on ONE screen — the thank-you door (`invite/enter`): "Save my ticket" (the pass PNG through the
 * phone's share sheet, a download otherwise) and the 2026-10-03 shortcut line. A control on a screen nobody reaches is
 * no control, and the reply flow has moved since (the QR opens the invitation; its Reply button opens the reply page;
 * on a desktop that page sits in a side panel). So this guard walks the WHOLE chain, link by link, and executes every
 * decision on it:
 *
 *   1 · every guest door to a reply is the reply PAGE — the Event Hub's own reply sheet (which saves straight back to
 *       the Event Hub, where neither control lives) is drawn only on the Maker's canvas;
 *   2 · the reply page saves through `submitInviteReply`, which asks for the arrival's return, and the save lands on
 *       the thank-you door; on a desktop the thank-you stays in the side panel;
 *   3 · on the thank-you, after a Yes the pass is drawn with its Save; after a No there is no pass to save;
 *   4 · the Save hands the PNG to the share sheet ("Save Image" → Photos), and downloads it where there is none;
 *   5 · the shortcut line shows after a Yes in Safari / Chrome, and never after a No, inside the store app, or inside a
 *       chat app's browser (no "Add to Home Screen" there);
 *   6 · neither is on the screen before the reply.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { INVITE_RETURN, inviteEnterPath, inviteReplyPath, isInviteReturn } from '@/lib/invite-arrival';
import { replyPanelStep } from '@/lib/guest-reply-panel';
import { landingTicketOf } from '@/lib/guest-landing';
import { handPassCards } from '@/lib/save-pass-cards';
import { shortcutLineShows } from '@/lib/home-screen-shortcut';
import { isStoreShellSignals } from '@/lib/store-shell';

const APP = join(__dirname, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));

const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';
const STORE_APP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 SetnayanApp';
const MESSENGER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/480.0]';
const INSTAGRAM = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36 Instagram 350.0.0';

test('1 · every guest door to a reply is the reply page — the Event Hub’s own sheet is the Maker canvas’s only', () => {
  const BODY = read('[slug]/_components/site-body.tsx');
  assert.match(BODY, /const replyDoor = inviteReplyPath\(event\.slug \?\? ''\);/, 'the Event Hub’s reply door is not the reply page');
  assert.match(
    BODY,
    /const replySheetDrawn = plan\.rsvpShouldRender && isEditorCanvas;/,
    'the Event Hub’s own reply sheet is drawn for a guest — its save lands on the Event Hub, with no pass and no shortcut',
  );
  assert.match(BODY, /\{replySheetDrawn \? \(\s*<RsvpSheet\b/, 'the reply sheet is mounted on some other condition');
});

test('2 · the reply page’s save asks for the arrival’s return and lands on the thank-you (in the side panel on a desktop)', () => {
  const REPLY = read('[slug]/invite/reply/page.tsx');
  assert.match(REPLY, /doorAction=\{submitInviteReply\.bind\(null, event\.event_id as string, guest\.guest_id as string\)\}/, 'the reply page saves some other way');

  const DOOR = read('[slug]/invite/actions.ts');
  const door = DOOR.slice(DOOR.indexOf('export async function submitInviteReply('));
  assert.match(door, /formData\.set\('return_to', INVITE_RETURN\);/, 'the reply page no longer asks for the thank-you');
  assert.match(door, /return submitRsvp\(eventId, guestId, formData\);/, 'the reply page’s save is not the one save');
  assert.equal(isInviteReturn(INVITE_RETURN), true);

  const ACTIONS = read('[slug]/actions.ts');
  const save = ACTIONS.slice(ACTIONS.indexOf('export async function submitRsvp('));
  assert.match(save, /const toInvite = isInviteReturn\(formData\.get\('return_to'\)\);/);
  assert.match(save, /const outcome = answerRefused \? 'refused' : replyLocked \? 'details' : 'ok';/);
  assert.match(save, /if \(toInvite && ev\?\.slug\) redirect\(`\$\{inviteEnterPath\(ev\.slug\)\}\?rsvp=\$\{outcome\}`\);/, 'a saved reply no longer lands on the thank-you');

  // 🖥 On a desktop the reply page is framed in the side panel: the saved reply's thank-you STAYS in it.
  const at = { origin: 'https://setnayan.com', replyPath: inviteReplyPath('m-j'), thanksPath: inviteEnterPath('m-j'), framePath: '/x' };
  assert.deepEqual(replyPanelStep(`https://setnayan.com${inviteEnterPath('m-j')}?rsvp=ok`, at), { kind: 'replied', outcome: 'ok' });
  assert.deepEqual(replyPanelStep(`https://setnayan.com${inviteEnterPath('m-j')}`, { ...at, saved: true }), { kind: 'stay' });
});

test('3 · on the thank-you, after a Yes the pass is drawn with its Save — after a No there is no pass to save', () => {
  assert.equal(landingTicketOf({ reply: 'yes', eligibility: 'pass' }), 'full');
  assert.equal(landingTicketOf({ reply: 'no', eligibility: 'pass' }), 'none');
  assert.equal(landingTicketOf({ reply: 'yes', eligibility: 'cannotCome' }), 'none');

  const ENTER = read('[slug]/invite/enter/page.tsx');
  assert.match(ENTER, /const ticket = landingTicketOf\(\{ reply, eligibility: passCard,/);
  const at = ENTER.indexOf("{ticket === 'full' ? (\n          <section");
  assert.ok(at > -1, 'the pass section moved — re-point this guard');
  const pass = ENTER.slice(at, ENTER.indexOf('data-landing="how"', at));
  assert.match(pass, /<TicketPicture src=\{PASS_CARD_ROUTE\}/, 'the pass shown is not the file the Save hands over');
  // 🎟 Their own card FIRST, then each +1 ticket they hold — "Save all tickets" (owner 2026-10-25, RSVP seats-first:
  // the after-Send pass step of scenarios B · C). With no +1 ticket the list is their own card alone, as before.
  assert.match(pass, /<SavePassCardButton\s+hrefs=\{\[PASS_CARD_ROUTE, \.\.\.plusOneCardHrefs\]\}/, 'the pass lost its Save');
  // Inside a chat app on an iPhone the Save opens the same page in Safari first (approved ticket flow, 2026-09-29).
  assert.match(pass, /safariSave \? \(\s*<a href=\{safariSave\}/);
  // A new or changed pass pops up first, with the same Save — after a Yes only.
  assert.match(ENTER, /\{ticket === 'full' && !canvas \? \(\s*<TicketPopup\b/);
});

test('4 · the Save hands the PNG to the share sheet, and downloads it where there is none', async () => {
  const file = new File([new Uint8Array([137, 80, 78, 71])], 'Teresita-pass.png', { type: 'image/png' });
  const shared: unknown[] = [];
  const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const doc = Object.getOwnPropertyDescriptor(globalThis, 'document');
  try {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { share: async (d: unknown) => void shared.push(d), canShare: (d: { files?: File[] }) => Boolean(d.files?.length) },
    });
    assert.deepEqual(await handPassCards([file]), { k: 'saved' });
    assert.equal(shared.length, 1, 'the phone’s share sheet was not opened');
    assert.deepEqual((shared[0] as { files: File[] }).files, [file], 'the share sheet was not handed the pass picture');

    // No share sheet (a desktop): one download of the same file.
    const clicked: string[] = [];
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        body: { appendChild() {} },
        createElement: () => ({ href: '', download: '', click() { clicked.push(this.download); }, remove() {} }),
      },
    });
    const created = URL.createObjectURL;
    URL.createObjectURL = () => 'blob:x';
    try {
      assert.deepEqual(await handPassCards([file]), { k: 'saved' });
    } finally {
      URL.createObjectURL = created;
    }
    assert.deepEqual(clicked, ['Teresita-pass.png'], 'without a share sheet the pass was not downloaded');
  } finally {
    if (nav) Object.defineProperty(globalThis, 'navigator', nav);
    else delete (globalThis as { navigator?: unknown }).navigator;
    if (doc) Object.defineProperty(globalThis, 'document', doc);
    else delete (globalThis as { document?: unknown }).document;
  }
});

test('5 · the shortcut line: after a Yes in Safari / Chrome — never after a No, in the store app or a chat app’s browser', () => {
  const shows = (reply: 'yes' | 'no' | 'unreplied', ua: string) =>
    shortcutLineShows({ reply, userAgent: ua, storeShell: isStoreShellSignals(ua, null) });
  assert.equal(shows('yes', SAFARI), true, 'iPhone Safari after a Yes is not taught the shortcut');
  assert.equal(shows('yes', CHROME), true, 'Android Chrome after a Yes is not taught the shortcut');
  assert.equal(shows('no', SAFARI), false, 'the shortcut is taught after a No');
  assert.equal(shows('unreplied', CHROME), false, 'the shortcut is taught before a reply');
  assert.equal(shows('yes', STORE_APP), false, 'the store app is taught a menu it does not have');
  assert.equal(shortcutLineShows({ reply: 'yes', userAgent: SAFARI, storeShell: true }), false, 'the store app (by its cookie) is taught the shortcut');
  assert.equal(shows('yes', MESSENGER), false, 'Messenger’s browser is taught a menu it does not have');
  assert.equal(shows('yes', INSTAGRAM), false, 'Instagram’s browser is taught a menu it does not have');

  const ENTER = read('[slug]/invite/enter/page.tsx');
  assert.match(ENTER, /const shortcutShows = shortcutLineShows\(\{ reply, userAgent, storeShell: await isStoreShellRequest\(\) \}\);/);
  assert.equal((ENTER.match(/<ShortcutLine\b/g) ?? []).length, 1);
  assert.match(ENTER, /\{shortcutShows \? <ShortcutLine userAgent=\{userAgent\} \/> : null\}/, 'the line is mounted past its decision');
});

test('6 · neither is on the screen before the reply', () => {
  const ENTER = read('[slug]/invite/enter/page.tsx');
  const preReply = ENTER.slice(ENTER.indexOf("if (unreplied && ticket !== 'full') {"), ENTER.indexOf('<TicketPopup'));
  assert.ok(preReply.length > 100, 'the before-the-reply render moved — this check is blind');
  assert.doesNotMatch(preReply, /SavePassCardButton|ShortcutLine/, 'a Save or the shortcut is on the screen before the reply');
  const LANDING = read('[slug]/invite/_components/landing-pre-reply.tsx');
  assert.doesNotMatch(LANDING, /SavePassCardButton|ShortcutLine/, 'the before-the-reply landing carries a Save or the shortcut');
});
