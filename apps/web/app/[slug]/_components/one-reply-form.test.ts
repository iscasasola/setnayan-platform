/**
 * ONE REPLY FORM — EVERY REPLY DOOR OPENS THE REPLY PAGE; A GUEST IS NEVER SERVED THE REPLY SHEET.
 *
 * A guest's walk, 2026-10-11 (fault N10): two "reply" buttons, two forms with different rules. Me's button opened a
 * SHEET over the page ("Save RSVP", no Terms tick, sendable with no answer chosen); the top "RSVP" loaded the reply
 * PAGE ("Send my reply", a Terms tick, an answer required). Owner the same day ("ok all"): one form — the reply
 * page; the sheet is retired.
 *
 * WHAT IS HELD:
 *   (1) THE ACTION under the mark, in every reply state, goes to the reply page (`inviteReplyPath`) — never a
 *       fragment that raises a sheet.
 *   (2) THE REAL GUEST PAGE (`SiteBody`, drawn with no database) — not replied, and replied yes: no sheet on it (no
 *       `#your-details` panel, no dialog, no reply form, no answer inputs), no link to the sheet's anchor, and at
 *       least one door to `/…/invite/reply`.
 *   (3) ME's doors — "Reply to the invitation" on the ticket, "Change your reply" — are handed the reply page, on a
 *       tabbed page (site-body) and on a page that is one scroll (page.tsx).
 *   (4) THE ONE FORM KEEPS ITS RULES: the reply page's save asks for the Terms tick and refuses a reply with no
 *       answer chosen.
 *   (5) WHAT IS LEFT, AND ONLY THERE: the sheet is still drawn in the Maker's canvas (its own "RSVP page" opens the
 *       Event Hub with it up) — the same page drawn AS the canvas has it, a guest's never.
 *   (6) Signing in from the invitation lands an unanswered guest at the reply page too.
 *
 * SABOTAGE RUN 2026-10-11 (committed first, put back by `git checkout`): the sheet's gate widened back to
 * `plan.rsvpShouldRender` → (2) red; the action's default href put back to the sheet's anchor → (1) (2) red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
/* FIRST: this import installs the seam the real page is drawn through. */
import { renderSiteBodyFixture } from '@/lib/site-body-fixture-render';
import { siteBodyFixtureProps } from '@/lib/site-body-fixture';
import { stripComments } from '@/lib/strip-comments';
import { actionOpensReply, resolveArrivalAction } from '@/lib/arrival-action';
import { inviteReplyPath } from '@/lib/invite-arrival';
import { hashOpensSheet } from './rsvp-sheet-state';

const WEB = join(__dirname, '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const REPLY = inviteReplyPath('maria-and-jose');

/** What only the sheet (and the form inside it) puts on a page. */
const SHEET_MARKS: Array<[RegExp, string]> = [
  [/id="your-details"/, 'the sheet’s panel'],
  [/data-rsvp-sheet/, 'the sheet'],
  [/id="rsvp-sheet-heading"/, 'the sheet’s heading'],
  [/data-rsvp-form/, 'the reply card'],
  [/name="rsvp_status"/, 'the answer’s inputs'],
  [/role="dialog"/, 'a dialog'],
];

test('(1) the action under the mark goes to the reply page in every reply state', () => {
  for (const rsvpStatus of ['pending', 'maybe', 'attending', 'declined'] as const) {
    const a = resolveArrivalAction({ slug: 'maria-and-jose', rsvpStatus, eventDate: '2026-12-12', today: '2026-10-10' });
    assert.ok(a && actionOpensReply(a), `${rsvpStatus}: no action opens the reply`);
    assert.equal(a!.href, REPLY, `${rsvpStatus}: the action goes to ${a!.href}`);
    assert.equal(hashOpensSheet(a!.href), false, `${rsvpStatus}: the action raises the sheet`);
  }
});

test('(2) the real guest page has no sheet and no reply form on it — and a door to the reply page', async () => {
  const props = siteBodyFixtureProps();
  const replied = { ...props.identity, guest: { ...(props.identity as { guest: Record<string, unknown> }).guest, rsvp_status: 'attending' } } as typeof props.identity;
  for (const [who, html] of [
    ['a guest who has not replied', await renderSiteBodyFixture()],
    ['a guest who said yes', await renderSiteBodyFixture({ identity: replied })],
  ] as const) {
    assert.ok(html.length > 20_000, `${who}: an empty shell`);
    for (const [re, what] of SHEET_MARKS) assert.doesNotMatch(html, re, `${who}: the page draws ${what}`);
    assert.ok(!html.includes('#your-details'), `${who}: a door still points at the sheet’s anchor`);
    const doors = html.match(new RegExp(`href="${REPLY}"`, 'g')) ?? [];
    assert.ok(doors.length >= 1, `${who}: no door to the reply page`);
  }
});

test('(3) Me’s doors are handed the reply page — tabbed, and on a page that is one scroll', () => {
  const body = code('app/[slug]/_components/site-body.tsx');
  assert.match(body, /const replyDoor = inviteReplyPath\(event\.slug \?\? ''\);/);
  const me = body.slice(body.indexOf('data-me-stage'));
  assert.match(me, /meLeadsWithReply\(\{[\s\S]{0,260}?\}\)\s*\? replyDoor\s*: null,/, 'the ticket’s "Reply to the invitation" is not the reply page');
  assert.match(me, /<a\s+href=\{replyDoor\}\s+data-me-change-reply=""/, '"Change your reply" is not the reply page');
  assert.doesNotMatch(body, /REPLY_SHEET_ANCHOR|href="#your-details"/, 'a door in the guest tree names the sheet');
  const page = code('app/[slug]/page.tsx');
  assert.match(page, /\? inviteReplyPath\(event\.slug \?\? slug\)\s*: null,/, 'on a page that is one scroll, Me’s reply button is not the reply page');
  assert.doesNotMatch(page, /REPLY_SHEET_ANCHOR/);
});

test('(4) the one form keeps its rules: the Terms tick, and an answer', () => {
  const door = code('app/[slug]/invite/actions.ts');
  assert.match(door, /\?rsvp=terms/, 'the reply page’s save no longer asks for the Terms tick');
  const save = code('app/[slug]/actions.ts');
  assert.match(save, /\?rsvp=choose/, 'a reply with no answer chosen is saved');
  const reply = code('app/[slug]/invite/reply/page.tsx');
  for (const k of ['terms', 'choose', 'mobile']) assert.match(reply, new RegExp(`search\\.rsvp === '${k}'`), `the reply page swallows the "${k}" refusal`);
});

test('(5) what is left: the sheet is drawn in the Maker’s canvas only', async () => {
  const body = code('app/[slug]/_components/site-body.tsx');
  assert.match(body, /const replySheetDrawn = plan\.rsvpShouldRender && isEditorCanvas;/);
  assert.equal((body.match(/<RsvpSheet\b/g) ?? []).length, 1);
  assert.match(body, /\{replySheetDrawn \? \(\s*<RsvpSheet/);
  // The same page, drawn as the canvas has it: the sheet is there (anti-vacuity for (2), and the Maker's RSVP page).
  const canvas = await renderSiteBodyFixture({ isEditorCanvas: true });
  assert.match(canvas, /id="your-details"/, 'the Maker’s canvas lost the sheet its own RSVP page opens');
  assert.match(canvas, /name="rsvp_status"/);
  assert.match(code('lib/maker-made-once-pages.ts'), /editor=1&as=replied#your-details/, 'the Maker no longer opens the sheet — it can be deleted now');
});

test('(6) signing in from the invitation lands an unanswered guest at the reply page', () => {
  const connect = code('app/join/[eventId]/connect/route.ts');
  assert.match(connect, /seatAwaitsReply\(eventId, user\.id\)\)\) \{\s*dest = inviteReplyPath\(slug\);/);
  assert.doesNotMatch(connect, /your-details/);
});
