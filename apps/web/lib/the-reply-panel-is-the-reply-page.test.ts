/**
 * 🖥 ON A DESKTOP THE GUEST'S REPLY OPENS THE ONE REPLY PAGE IN THE SIDE PANEL — AND NOWHERE ELSE DOES ANYTHING CHANGE
 * (DECISION_LOG 2026-10-19 "FIVE CONTROLLER RECOMMENDATIONS APPROVED" (3); `lib/guest-reply-panel.ts`,
 * `app/[slug]/_components/reply-panel.tsx`). Held five ways:
 *
 *   1 · ONE REPLY FORM — the panel draws no form of its own: no reply card, no save, no input. It frames the address
 *       the Reply pressed asked for (the reply page itself); the guest page hands it no other (only the lab does).
 *       Sabotage: `RsvpWidget` mounted in the panel → red.
 *   2 · GATE OFF → THE LINK — the panel is mounted only in the branch that writes the desk style (`guestDesk`), and a
 *       press is taken only at the desk's width with no key held. Sabotage: the panel mounted outside `guestDesk` →
 *       red; the width check dropped → red.
 *   3 · EVERY REPLY DOOR THE REAL GUEST PAGE DRAWS is one the panel takes (`SiteBody`, drawn with no database).
 *   4 · A SAVED REPLY IS THE SAVE'S OWN OUTCOME — the keywords the panel acts on are exactly the ones `submitRsvp`
 *       lands the thank-you on, and the Event Hub has words for each; the refusals stay on the reply page. And the
 *       THANK-YOU DOOR STAYS IN THE PANEL (controller 2026-10-19 — the QR ticket, "Save to my account", the plus-ones'
 *       invites): the invitation behind is read again, the panel is not closed. Sabotage: an outcome dropped from
 *       `REPLY_PANEL_OUTCOMES` → red; a saved reply that closes the panel → red.
 *   5 · THE PANEL IS THE SYSTEM SHEET'S — the shared `Sheet`, which the desk style makes the 440-px right panel.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
/* FIRST: this import installs the seam the real page is drawn through. */
import { renderSiteBodyFixture } from '@/lib/site-body-fixture-render';
import { stripComments } from './strip-comments';
import { GUEST_DESK_FROM_PX, GUEST_HUB_DESKTOP_CSS, GUEST_SHEETS } from './guest-hub-desktop';
import { inviteEnterPath, inviteReplyPath } from './invite-arrival';
import { REPLY_PANEL_MEDIA, REPLY_PANEL_OUTCOMES, opensInReplyPanel, repliedHref, replyPanelStep } from './guest-reply-panel';

const WEB = join(__dirname, '..');
const read = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));
const PANEL = 'app/[slug]/_components/reply-panel.tsx';
const ORIGIN = 'https://setnayan.com';
const REPLY = inviteReplyPath('maria-and-jose');
const THANKS = inviteEnterPath('maria-and-jose');
const press = (over: Partial<Parameters<typeof opensInReplyPanel>[0]> = {}) =>
  opensInReplyPanel({ href: REPLY, origin: ORIGIN, replyPath: REPLY, wide: true, button: 0, modified: false, target: null, download: false, ...over });

test('1 · one reply form — the panel frames the reply page and draws no form of its own', () => {
  const panel = read(PANEL);
  for (const [re, what] of [
    [/RsvpWidget|rsvp-widget/, 'the reply card'],
    [/submitInviteReply|submitRsvp|\/actions['"]/, 'a save'],
    [/<form\b|<input\b|<textarea\b|<select\b/, 'a form'],
    [/RsvpSheet|rsvp-sheet/, 'the retired reply sheet'],
  ] as const) {
    assert.doesNotMatch(panel, re, `the panel draws ${what} — a second reply form`);
  }
  assert.equal(panel.match(/<iframe\b/g)?.length, 1, 'the panel does not frame one page');
  assert.match(panel, /<iframe[\s\S]{0,80}?src=\{src\}/, 'the frame is not the address the press asked for');
  /* The address is the pressed Reply's own (or the lab's stand-in), and nothing else sets it but a close. */
  assert.match(panel, /setSrc\(frameHref \?\? `\$\{url\.pathname\}\$\{url\.search\}\$\{url\.hash\}`\)/);
  for (const m of panel.match(/setSrc\([^)]*\)/g) ?? []) {
    assert.ok(m === 'setSrc(null)' || m.startsWith('setSrc(frameHref ?? '), `the frame is set to something else: ${m}`);
  }
  /* The guest page hands the panel the reply page's path and the thank-you's — never a frame of its own choosing. */
  const page = read('app/[slug]/page.tsx');
  const mounts = page.match(/<ReplyPanel\b[^>]*\/>/g) ?? [];
  assert.equal(mounts.length, 1, 'the guest page mounts the panel more than once (or not at all)');
  assert.match(mounts[0]!, /replyPath=\{inviteReplyPath\(event\.slug \?\? slug\)\}/);
  assert.match(mounts[0]!, /thanksPath=\{inviteEnterPath\(event\.slug \?\? slug\)\}/);
  assert.doesNotMatch(mounts[0]!, /frameHref/, 'the guest page frames something other than the reply page');
});

test('2 · gate off → the link: the panel is the desk branch’s, and a press is taken only at the desk’s width', () => {
  const page = read('app/[slug]/page.tsx');
  const at = page.indexOf('return guestDesk ? (');
  assert.ok(at > 0, 'the desk branch moved');
  const branch = page.slice(at, page.indexOf(') : (', at));
  assert.match(branch, /<style data-guest-desk="">\{GUEST_HUB_DESKTOP_CSS\}<\/style>/);
  assert.match(branch, /<ReplyPanel\b/, 'the panel is not in the branch that writes the desk style');
  assert.equal(page.match(/<ReplyPanel\b/g)?.length, 1, 'the panel is mounted outside the desk gate');

  /* The desk's one line, in both places. */
  assert.equal(REPLY_PANEL_MEDIA, `(min-width: ${GUEST_DESK_FROM_PX}px)`);
  assert.equal(GUEST_DESK_FROM_PX, 1024);
  const panel = read(PANEL);
  assert.match(panel, /wide: window\.matchMedia\(REPLY_PANEL_MEDIA\)\.matches,/, 'the press is taken at any width');
  assert.match(panel, /if \(!take\) return;\s*e\.preventDefault\(\);/, 'a press the panel does not take is stopped');

  assert.equal(press(), true, 'a desktop Reply does not open the panel');
  assert.equal(press({ href: '/Maria-And-Jose/invite/reply#plus-ones' }), true, 'Me’s “add names” door is missed');
  assert.equal(press({ href: `${ORIGIN}${REPLY}?k=abc` }), true, 'the re-entry Reply is missed');
  assert.equal(press({ wide: false }), false, 'a phone’s Reply opens the panel');
  assert.equal(press({ modified: true }), false, '⌘-click is taken from the browser');
  assert.equal(press({ button: 1 }), false, 'a middle click is taken');
  assert.equal(press({ target: '_blank' }), false, 'a new-tab link is taken');
  assert.equal(press({ download: true }), false);
  assert.equal(press({ href: '/maria-and-jose/invite/enter' }), false, 'another door opens the panel');
  assert.equal(press({ href: 'https://example.com/maria-and-jose/invite/reply' }), false, 'another site opens the panel');
});

test('3 · every reply door the real guest page draws is one the panel takes', async () => {
  const html = await renderSiteBodyFixture();
  const doors = [...html.matchAll(/href="([^"]*\/invite\/reply[^"]*)"/g)].map((m) => m[1]!.replace(/&amp;/g, '&'));
  assert.ok(doors.length >= 1, 'the page draws no door to the reply page');
  for (const href of doors) assert.equal(press({ href }), true, `a Reply door the panel misses: ${href}`);
});

test('4 · a saved reply is the save’s own outcome — and the refusals stay on the reply page', () => {
  const actions = read('app/[slug]/actions.ts');
  const decl = actions.match(/const outcome = ([^;]+);/);
  assert.ok(decl, 'the save’s outcome moved');
  const saved = [...decl![1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(saved, [...REPLY_PANEL_OUTCOMES].sort(), 'the panel closes on other words than the save lands on');
  assert.match(actions, /if \(toInvite && ev\?\.slug\) redirect\(`\$\{inviteEnterPath\(ev\.slug\)\}\?rsvp=\$\{outcome\}`\);/);
  const hub = read('app/[slug]/page.tsx');
  for (const o of REPLY_PANEL_OUTCOMES) assert.match(hub, new RegExp(`search\\.rsvp === '${o}'`), `the Event Hub has no words for "${o}"`);

  const at = { origin: ORIGIN, replyPath: REPLY, thanksPath: THANKS, framePath: REPLY };
  for (const o of REPLY_PANEL_OUTCOMES) assert.deepEqual(replyPanelStep(`${ORIGIN}${THANKS}?rsvp=${o}`, at), { kind: 'replied', outcome: o });
  /* Once saved, the door stays — with its outcome, or after it puts its own address back. */
  for (const href of [`${ORIGIN}${THANKS}?rsvp=ok`, `${ORIGIN}${THANKS}`, `${ORIGIN}${THANKS}?k=abc`]) {
    assert.deepEqual(replyPanelStep(href, { ...at, saved: true }), { kind: 'stay' }, `the thank-you door leaves the panel: ${href}`);
  }
  assert.deepEqual(replyPanelStep(`${ORIGIN}/maria-and-jose`, { ...at, saved: true }), { kind: 'leave', href: '/maria-and-jose' }, 'the door’s own way on');
  for (const refusal of ['error', 'terms', 'choose', 'mobile', 'window']) {
    assert.deepEqual(replyPanelStep(`${ORIGIN}${REPLY}?rsvp=${refusal}`, at), { kind: 'stay' }, `"${refusal}" closes the panel`);
  }
  assert.deepEqual(replyPanelStep('about:blank', at), { kind: 'stay' });
  assert.deepEqual(replyPanelStep(`${ORIGIN}${THANKS}`, at), { kind: 'leave', href: THANKS }, 'the reply page’s own link to the invitation');
  assert.deepEqual(replyPanelStep(`${ORIGIN}/maria-and-jose?x=1#me`, at), { kind: 'leave', href: '/maria-and-jose?x=1#me' });
  assert.equal(repliedHref(`${ORIGIN}/maria-and-jose?tab=details#rsvp`, 'ok'), '/maria-and-jose?tab=details&rsvp=ok#rsvp');
  assert.equal(repliedHref(`${ORIGIN}/maria-and-jose?rsvp=error`, 'details'), '/maria-and-jose?rsvp=details');
  const panel = read(PANEL);
  /* The saved reply reads the invitation again and keeps the panel open on the door: no close in that branch. */
  const replied = panel.match(/if \(step\.kind === 'replied'\) \{([\s\S]*?)\n {6}\}/);
  assert.ok(replied, 'the saved-reply branch moved');
  assert.match(replied![1]!, /saved = true;\s*router\.replace\(repliedHref\(window\.location\.href, step\.outcome\), \{ scroll: false \}\);/, 'a saved reply reloads the page, or loses its place');
  assert.doesNotMatch(replied![1]!, /close\(|setSrc|done = true/, 'a saved reply closes the panel — the thank-you door is lost');
  assert.match(panel, /replyPanelStep\(href, \{ \.\.\.at, saved \}\)/, 'the panel forgets the reply was saved');
  assert.match(panel, /if \(step\.kind === 'stay' \|\| step\.kind === 'replied'\) \{/, 'the door is not kept (or not dressed) in the panel');
  assert.equal(panel.match(/repliedHref\(/g)?.length, 1, 'the invitation is read again somewhere else too');
  /* The frame's own moves are given back before it goes, or the guest's next Back is a dead press (walked 2026-10-19). */
  assert.match(panel, /const extra = window\.history\.length - opened\.current;[\s\S]{0,400}?window\.history\.go\(-extra\);/, 'the frame’s history entries outlive it');
  assert.equal(panel.match(/setSrc\(null\)/g)?.length, 1, 'a close that does not give the frame’s history back');
});

test('5 · the panel is the system sheet’s — the shared Sheet, the 440-px right panel on the desk', () => {
  const panel = read(PANEL);
  assert.match(panel, /import \{ Sheet \} from '@\/app\/_components\/sheet';/);
  assert.match(panel, /<Sheet open=\{src !== null\} onClose=\{\(\) => close\(\)\}/);
  assert.ok(GUEST_HUB_DESKTOP_CSS.includes(`${GUEST_SHEETS.shared}{width:440px!important`), 'the shared Sheet is not the 440-px panel on the desk');
  /* Esc inside the framed form closes it too (a key pressed in a frame never reaches this document). */
  assert.match(panel, /win\.addEventListener\('keydown', \(k\) => \{\s*if \(k\.key === 'Escape' && !k\.defaultPrevented\) close\(\);/);
});
