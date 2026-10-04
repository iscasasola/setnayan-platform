/**
 * EACH GUEST PAGE HAS ONE MAIN ACTION, AND EVERY CONTROL HAS ONE PLACE.
 *
 * Owner, 2026-10-03, after browsing his live guest Event Hub on his phone:
 * *"on the event hub. the places of the different information is still not
 * fixed. too many buttons. too much going on."* — read with the DECISION_LOG
 * rows "THE GUEST PATHWAY — ONE BUTTON AT A TIME", "THE GUEST LANDING BEFORE
 * THE REPLY HAS ONE BUTTON" and BUILD_PROMPTS rule 13 (no grey explainer
 * captions; 3+ choices are one dropdown, never a pill row).
 *
 * RENDERED where the piece can be mounted without the app behind it (the
 * Welcome's one action, Me, Me's section, the plus-ones); the page bodies that
 * are server components with the database behind them are read as source,
 * comments stripped, the way `the-landing-before-the-reply-has-one-button`
 * does. Each failure names the duplicate it caught.
 *
 *   Welcome     — ONE control under the mark (RSVP / You're going / Show your
 *                 ticket), no account card, no second "change your reply";
 *   Me          — the name once, ONE sign-out, ONE Save to my account, no
 *                 heading over the guest's own name, no explainer captions;
 *   Landing     — ONE main action after the reply ("Save my ticket"); no
 *                 "Your guests", no "Copy my link", no routine Save (all Me's);
 *   The 3D room — one door (Everything else), not a card AND a row;
 *   Save the Date film — one "See our page" and one "Add to calendar" per beat;
 *   Post Event  — no phase ribbon repeating the footer, no link to itself;
 *   The host's own hub — "Preview ▾" is ONE dropdown, not a pill row.
 *
 * 🪤 `globalThis.React` before the DYNAMIC imports (tsconfig `jsx: preserve`),
 * and `server-only` stubbed — the same two traps `the-reply-is-a-sheet.test.ts`
 * names.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}
// A phone on which "Save to my account" really signs in (prod: Google on).
process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED = 'true';

const read = (rel: string) => stripComments(readFileSync(join(__dirname, rel), 'utf8'));
/** Every pressable thing in a fragment of HTML. */
const controls = (html: string) => html.match(/<(a|button|summary)\b/g) ?? [];
/** The accented, "do this" controls. */
const primaries = (html: string) => html.match(/class="[^"]*(?:button-primary|bg-mulberry)[^"]*"/g) ?? [];

test('Welcome · the action under the mark is ONE control, the one main action, in every state', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ArrivalActionRow } = await import('./_components/arrival-action');
  const { resolveArrivalAction } = await import('@/lib/arrival-action');
  const cases = [
    { rsvpStatus: 'pending' as const, today: '2026-09-20' },
    { rsvpStatus: 'attending' as const, today: '2026-09-20' },
    { rsvpStatus: 'declined' as const, today: '2026-09-20' },
    { rsvpStatus: 'attending' as const, today: '2026-12-18', hasPass: true },
    { rsvpStatus: 'attending' as const, today: '2026-12-19' },
  ];
  for (const c of cases) {
    const action = resolveArrivalAction({ slug: 'ana-ben', eventDate: '2026-12-18', ...c });
    const html = renderToStaticMarkup(React.createElement(ArrivalActionRow, { action }));
    assert.equal(controls(html).length, 1, `${c.rsvpStatus}@${c.today}: ${controls(html).length} controls under the mark`);
    assert.equal(primaries(html).length, 1, `${c.rsvpStatus}@${c.today}: not exactly one main action`);
    assert.doesNotMatch(html, />\s*Change\s*</, `${c.rsvpStatus}@${c.today}: a "Change" beside the status is back`);
    assert.doesNotMatch(html, /opens the door and finds your table/, 'the day-of explainer line is back');
  }
});

test('Welcome · no account card, and the reply sheet has ONE door per state', () => {
  const body = read('_components/site-body.tsx');
  assert.equal(body.split('<ArrivalActionRow').length - 1, 1, 'the Welcome action is mounted more than once');
  assert.doesNotMatch(body, /<GuestAccountCard\b|<SaveToAccount\b/, '"Save to my account" has a second home on the Welcome');
  // The reply section's own line stands down whenever another door opens the sheet.
  assert.match(
    body,
    /\{actionOpensReply\(arrivalAction\) \|\|\s*\(tabs\.on && \(guest\.rsvp_status === 'attending' \|\| guest\.rsvp_status === 'declined'\)\) \? null : \(\s*<a\s+href="#your-details"/,
  );
  // …and Me's "Change your reply" stands down while the Welcome's action is that door.
  const me = body.slice(body.indexOf("group('me'"));
  assert.match(me.slice(0, me.indexOf('data-me-change-reply')), /&& !actionOpensReply\(arrivalAction\) \? \(\s*<a\s+href="#your-details"\s*$/);
  // The face-data controls sit with Me's Face tagging row on a tabbed page.
  assert.match(body, /\{tabs\.on \? null : group\('home', guest\.photo_source === 'selfie' \? \(\s*<FaceDataNotice/);
  assert.match(me, /\{guest\.photo_source === 'selfie' \? \(\s*<FaceDataNotice/);
});

test('Me · the name once, no second sign-out, ONE Save to my account, ONE main action', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { GuestMe } = await import('./_components/guest-me');
  const html = renderToStaticMarkup(
    React.createElement(GuestMe, {
      name: 'Ana Reyes',
      slug: 'ana',
      eventId: 'e-1',
      guestId: 'g-ana',
      askMeal: true,
      askDietary: true,
      askPlusOnes: true,
      eventName: 'Indalecio & Claire',
      guests: [{ guestId: 'p1', name: 'Lola Nena', inviteUrl: 'https://x/ana?invite=t1' }],
      passes: {},
      account: { kind: 'offer' },
      personalLink: 'https://x/ana?invite=t0',
      userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/128 Mobile Safari/537.36',
      termsCarried: true,
    }),
  );
  assert.equal((html.match(/Ana Reyes/g) ?? []).length, 1, 'the guest’s name is said twice');
  assert.doesNotMatch(html, /\/sign-out"/, 'Me carries a second sign-out ("Not you? Switch") again');
  assert.equal((html.match(/>Save to my account</g) ?? []).length, 1, '"Save to my account" is not drawn exactly once');
  assert.equal((html.match(/Send their invite/g) ?? []).length, 1, 'one plus-one, one "Send their invite"');
  assert.equal(primaries(html).length, 1, `Me has ${primaries(html).length} main actions`);
  assert.doesNotMatch(html, /Each name gets their own/, 'the grey line explaining the plus-ones is back');
});

test('Me · the section adds no heading over the guest’s name, no explainer, and no idle buttons', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { GuestMeSection } = await import('./_components/guest-hub-bar');
  const quiet = renderToStaticMarkup(
    React.createElement(GuestMeSection, { meSlot: React.createElement('p', null, 'me'), photosHref: null, galleryCount: 0, asTab: true }),
  );
  assert.equal(controls(quiet).length, 0, `Me's section draws ${controls(quiet).length} controls of its own with the ticket on the page`);
  assert.doesNotMatch(quiet, /Your invitation|shows up under Photos of you/, 'the heading or the explainer is back');
  // Once the page itself stops drawing the photos, ONE link to them.
  const after = renderToStaticMarkup(
    React.createElement(GuestMeSection, { meSlot: null, photosHref: '/papic/me/tok', galleryCount: 3, asTab: true }),
  );
  assert.equal((after.match(/Photos of you/g) ?? []).length, 1);
  // page.tsx decides that once, from the phase — never "always".
  const page = read('page.tsx');
  assert.match(page, /const photosLeftThePage = eventIsPast && dayOfPhase !== 'live' && dayOfPhase !== 'post';/);
  assert.match(page, /photosHref=\{photosLeftThePage \?/);
  assert.match(page, /mePhotosHref=\{photosLeftThePage \?/);
});

test('Landing · after the reply ONE main action, and nothing that Me already holds', () => {
  const enter = read('invite/enter/page.tsx');
  const after = enter.slice(enter.indexOf("if (unreplied && ticket !== 'full') {"));
  const body = after.slice(after.indexOf('\n  }\n') + 5);
  for (const gone of ['<YourGuests', '<CopyMyLink']) {
    assert.ok(!body.includes(gone), `the landing draws ${gone} again — Me already does`);
  }
  // The one main action of the ticket section — "Save my ticket" (or its Safari hand-off).
  const ticket = body.slice(body.indexOf("{ticket === 'full' ? ("), body.indexOf("ticket === 'faded' ? ("));
  assert.equal((ticket.match(/variant="primary"|className="button-primary/g) ?? []).length, 2, 'the ticket is not Save (or its Safari twin) alone');
  // Outside the ticket and the reply-gated "Reply" (unreachable after a reply),
  // no other main action: "Open the invitation" is the soft pill.
  const rest = body.slice(body.indexOf('data-landing="how"'));
  assert.doesNotMatch(rest, /button-primary|variant="primary"/, 'a second main action under the ticket');
  // Save comes back only to finish a Terms refusal.
  assert.match(body, /search\.keep === 'terms' \? \(\s*<SaveToAccount/);
});

test('The 3D room · one quiet line, on The Day’s Welcome — not a card AND a row', () => {
  // Owner 2026-10-04 (DECISION_LOG "STORY-TAB PLACEMENT CORRECTED AND
  // APPROVED"): "Walk the room in 3D" on Welcome on the day; "Everything else"
  // is gone. The doorway strip draws it as a quiet line, never a DoorCard.
  const strip = read('_components/guest-doorway-strip.tsx');
  assert.equal((strip.match(/Walk the room in 3D/g) ?? []).length, 1, 'the strip draws the 3D room more than once');
  assert.doesNotMatch(strip, /<DoorCard[^>]*venueWalk/, 'the 3D room is a card again');
  assert.match(strip, /\{venueWalk \? \(\s*<p className="text-center" data-venue-walk="">/, 'the 3D room is not the quiet line');
});

test('Save the Date film · one "See our page" and one "Add to calendar" per beat', () => {
  const film = read('_components/save-the-date-film.tsx');
  assert.match(film, /\{canExit && started && !preview && idx !== closeIdx \?/, 'the chip "See our page" shows beside the closing beat’s own button');
  assert.match(film, /\{started && !preview && idx !== closeIdx && \(content\.icsHref \|\| content\.gcalUrl\) \?/, 'the chip "Add to calendar" shows beside the closing beat’s own button');
  assert.match(film, /\{canExit && idx === closeIdx \?/, 'the closing beat lost its own "See our page"');
});

test('Post Event · no phase ribbon repeating the footer, and no link to its own address', () => {
  const ed = read('_components/editorial/editorial-content.tsx');
  assert.doesNotMatch(ed, /PhaseRibbon|aria-label="Site phases"/, 'the phase ribbon is back over the story');
  assert.doesNotMatch(ed, /href=\{`\/\$\{slug\}`\}/, 'a link from the story to its own address is back');
  assert.equal((ed.match(/href=\{`\/\$\{slug\}\/hub`\}/g) ?? []).length, 1, 'the Day’s link is drawn more than once');
});

test('The host’s own hub · "Preview ▾" is ONE dropdown, not a pill row', () => {
  const ribbon = read('_components/owner-ribbon.tsx');
  // 👁 PR-10: the ONE dropdown also holds See as (one preview mechanism with the Maker).
  assert.match(ribbon, /<OwnerPhaseMenu links=\{model\.phaseLinks\} seeAs=\{model\.seeAsLinks\} \/>/);
  assert.doesNotMatch(ribbon, /phaseLinks\.map\(/, 'the phase pills are back');
  assert.match(read('_components/owner-phase-menu.tsx'), /<PickMenu\b/, 'the preview is not the shared dropdown');
  const body = read('_components/site-body.tsx');
  assert.ok(!body.includes('This is your event page'), 'the host’s explaining paragraph is back under the ribbon');
});
