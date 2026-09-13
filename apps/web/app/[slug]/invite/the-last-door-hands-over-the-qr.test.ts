/**
 * THE LAST DOOR HANDS OVER THE QR — and a guest who already answered can reach it.
 *
 * Owner, 2026-09-13: *"they get to see the QR Code so they can directly go to
 * the event hub with their custom QR. just to save the qr and of course they
 * have a button to proceed and see the event hub"*.
 *
 * Two things are guarded here, because they are two halves of one complaint:
 *
 *   A · door 03 shows the guest their OWN code, offers a way to KEEP it, and
 *       still hands them on to the Event Hub afterwards;
 *   B · a returning guest — who the 2026-09-10 ruling sends straight to the
 *       Reply door and never back through the reveal — has a visible way on
 *       from there without re-submitting the form. That is what "stuck" was.
 *
 * 🔒 AND THE THIRD THING, WHICH MATTERS MORE THAN EITHER: a QR is a CREDENTIAL.
 * It signs its holder in (`?invite={qr_token}`), which is why
 * `rotate-qr-actions.ts` exists. So the panel must be incapable of being asked
 * for somebody else's code — no id, no token, no search parameter reaches it.
 *
 * 🪤 WHY SOME SECTIONS READ SOURCE AND SOME RENDER. Both doors are server
 * components on a `server-only` import chain and cannot be rendered here; their
 * claims are read from source through the repo's one comment-stripper, so a
 * sentence sitting in a COMMENT can never satisfy a test (this file's own
 * subject is quoted in comments in both doors). The panel is pure presentation,
 * so it is RENDERED and asserted on real markup — including the save anchor,
 * which is the half a grep would be weakest at.
 *
 * 🪤 `globalThis.React` before the DYNAMIC import — tsconfig sets
 * `"jsx": "preserve"`, so components compile to bare `React.createElement` and a
 * static import would hoist above the assignment and throw. Same shape as
 * `the-arrival-says-what-opens.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { renderInvitationQrSvg, buildInvitationUrl } from '@/lib/qr';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', '..');
const WEB = join(APP, '..');
const read = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));
const readWeb = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const ENTER = read('[slug]/invite/enter/page.tsx');
const REPLY = read('[slug]/invite/reply/page.tsx');
const PANEL = read('[slug]/invite/_components/invite-qr-panel.tsx');
const JOIN_FLOW = read('join/[eventId]/_components/join-flow.tsx');

// ═══ A · the door hands the code over ══════════════════════════════════════

test('door 03 mounts the QR panel, and builds the image from the SESSION guest', () => {
  // 🪤 `\b`, NOT a bare substring. Measured: the first cut of this line matched
  // `<InviteQrPanel` and stayed GREEN when the mount was renamed to
  // `<InviteQrPanelX` — a component that does not exist, on a door that would
  // no longer build. The word boundary is what makes the sabotage go red.
  assert.match(ENTER, /<InviteQrPanel\b/, 'the last door no longer shows the guest their QR');
  assert.match(ENTER, /renderInvitationQrSvg\(/, 'the door no longer renders a code — a mount with nothing behind it');
  assert.match(ENTER, /qrToken: guest\.qr_token as string/, 'the code is no longer built from the guest row the session resolved');
  assert.match(
    ENTER,
    /\.select\('guest_id, role, email, entry_source, qr_token/,
    'the door stopped reading qr_token — the QR would be built from undefined',
  );
  // The image is handed DOWN, pre-rendered. A panel that could render its own
  // would need the token, and a token is what must never leave this page.
  assert.match(ENTER, /qrSvg=\{qrSvg\}/, 'the rendered code is no longer passed to the panel');
  assert.match(ENTER, /invitationUrl=\{invitationUrl\}/, 'the address under the code is no longer passed');
});

test('the proceed button survives the addition, unchanged and still phase-aware', () => {
  // The whole point of the owner's sentence is "…AND of course they have a
  // button to proceed". An addition that displaced the hand-off would be a
  // regression dressed as a feature.
  assert.match(ENTER, /href=\{`\/\$\{home\}`\}/, 'the Enter door no longer opens the Event Hub');
  assert.match(ENTER, /\{destinationWords\.cta\}/, 'the button label stopped coming from the phase');
  assert.match(ENTER, /\{destinationWords\.blurb\}/, 'the blurb stopped coming from the phase');
  assert.match(ENTER, /arrivalDestinationFor\(\{/, 'the door stopped asking the resolver');
  // …and the 90-day rule is still asked for, never restated (CLAUDE.md rule 7).
  assert.doesNotMatch(ENTER, /STD_THRESHOLD_DAYS|\b90\b/, 'the threshold has been copied into the door');
});

test('the door and the Event Hub encode the SAME code — one url builder, one renderer', () => {
  // Two surfaces drawing a guest's QR from two spellings of the url is how a
  // saved code stops matching the one the scanner expects.
  const loaders = readWeb('app/[slug]/_lib/loaders.ts');
  for (const [name, src] of [
    ['the Event Hub loader', loaders],
    ['the invite Enter door', ENTER],
  ] as const) {
    assert.match(src, /renderInvitationQrSvg\(/, `${name} no longer uses the shared renderer`);
    assert.match(src, /buildInvitationUrl\(/, `${name} no longer uses the shared url builder`);
  }
  assert.doesNotMatch(ENTER, /\?invite=/, 'the door is spelling the invitation url by hand instead of asking buildInvitationUrl');
});

// ═══ 🔒 the panel cannot be asked for somebody else's code ══════════════════

test('the panel takes an image and a url — never an id, a token or a parameter', () => {
  for (const forbidden of ['guestId', 'guest_id', 'qrToken', 'qr_token', 'searchParams', 'createAdminClient']) {
    assert.doesNotMatch(
      PANEL,
      new RegExp(forbidden),
      `the panel names ${forbidden} — it must be incapable of resolving a guest, so there is nothing to enumerate`,
    );
  }
});

test('the page that mounts it has already matched the cookie to THIS event', () => {
  // The gate is not new and is not being re-implemented — it is the one door 03
  // already had. This asserts the QR did not arrive on a page that lost it.
  assert.match(ENTER, /const session = await readGuestSession\(\);/, 'the Enter door no longer reads the guest session');
  assert.match(
    ENTER,
    /if \(!session \|\| session\.event_id !== event\.event_id\) redirect\(`\/\$\{home\}\/invite`\);/,
    'the session/event match is gone — a cookie for another event would be shown this event’s QR',
  );
  assert.match(ENTER, /\.eq\('guest_id', session\.guest_id\)/, 'the guest row is no longer keyed on the session');
  assert.match(ENTER, /\.eq\('event_id', event\.event_id\)/, 'the guest row is no longer scoped to this event');
  // Nothing in the door reads an id out of the URL.
  assert.doesNotMatch(ENTER, /search\.guest|params\.guestId/, 'a guest id is being taken from the URL');
});

test('the free guest download is used, never the gated branded-PNG route', () => {
  // /api/website/qr/guest/[guestId] needs a SUPABASE AUTH USER plus the paid
  // CUSTOM_QR_GUEST order. An invite-link guest holds a guest-session cookie and
  // usually no account at all, so pointing this door there would 401 every one
  // of them. Asserted on the route itself so the reason cannot rot silently.
  const branded = readWeb('app/api/website/qr/guest/[guestId]/route.ts');
  assert.match(branded, /supabase\.auth\.getUser\(\)/, 'the branded route stopped requiring an account — re-read this decision');
  assert.match(branded, /eventSkuActive\(/, 'the branded route stopped requiring the paid SKU — re-read this decision');
  assert.doesNotMatch(PANEL, /\/api\/website\/qr\/guest/, 'the door is pointing a cookie-only guest at the account-gated PNG');
  assert.doesNotMatch(ENTER, /\/api\/website\/qr\/guest/, 'the door is pointing a cookie-only guest at the account-gated PNG');
});

// ═══ the save is real, asserted on rendered markup ══════════════════════════

async function renderPanel() {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { InviteQrPanel } = await import('./_components/invite-qr-panel');
  const params = {
    appUrl: 'https://setnayan.com',
    slug: 'cale-ice',
    qrToken: 'tok-abc123',
    ownerSlug: null,
  };
  const qrSvg = await renderInvitationQrSvg(params);
  return {
    html: renderToStaticMarkup(
      React.createElement(InviteQrPanel as never, {
        qrSvg,
        invitationUrl: buildInvitationUrl(params),
        guestName: 'Ana Cruz',
        eventWord: 'wedding',
      } as never),
    ),
    url: buildInvitationUrl(params),
  };
}

/** The markup INSIDE the labelled QR container — never the whole document. */
function qrContainer(html: string): string {
  const i = html.indexOf('aria-label="Invitation QR code for Ana Cruz"');
  assert.notEqual(i, -1, 'the code is unlabelled to a screen reader, or the label was renamed');
  const j = html.indexOf('</div>', i);
  assert.notEqual(j, -1, 'the QR container never closes — update this test');
  return html.slice(i, j);
}

test('the panel draws a real scannable code, not an empty frame', async () => {
  // 🪤 A DOCUMENT-WIDE `/<svg/` IS BLIND HERE, and this file shipped that way
  // for one run. `GuestCodeKeepers` renders two lucide icons, which are also
  // `<svg>` with `<path>` inside — so replacing the QR's
  // `dangerouslySetInnerHTML` with an escaped attribute left the assertion
  // GREEN over a card showing no code at all. The window must face the sabotage.
  const { html } = await renderPanel();
  const box = qrContainer(html);
  assert.match(box, /<svg/, 'no SVG reached the QR container — the guest is looking at an empty frame');
  const modules = (box.match(/<path|<rect/g) ?? []).length;
  assert.ok(modules > 0, 'the QR container carries no modules — a blank square is not a QR');
});

test('the code is DERIVED from this guest’s token, not a fixed picture', async () => {
  // The strongest thing that can be asserted about an image without decoding
  // it: two guests must not be handed the same one. A hard-coded or cached
  // sample would pass every other test in this file.
  const base = { appUrl: 'https://setnayan.com', slug: 'cale-ice', ownerSlug: null };
  const a = await renderInvitationQrSvg({ ...base, qrToken: 'tok-abc123' });
  const b = await renderInvitationQrSvg({ ...base, qrToken: 'tok-zzz999' });
  assert.notEqual(a, b, 'two different guest tokens render the same QR — the code is not theirs');
});

test('the address the code encodes is printed under it, and it is THIS guest’s', async () => {
  const { html, url } = await renderPanel();
  assert.ok(html.includes(url), 'the url under the code is not the url the code encodes');
  assert.match(url, /\?invite=tok-abc123$/, 'the invitation url stopped carrying the guest’s own token');
});

test('"save the code" is a real download, not a button that does nothing', async () => {
  const { html } = await renderPanel();
  // 🪤 THE TRAP THE BRIEF NAMED. An inline SVG cannot be long-pressed and saved,
  // so the words alone would be another promise the screen does not keep. The
  // anchor is the delivery — and it must carry `download` AND point at the route
  // that sets `Content-Disposition: attachment` (the half that works in a
  // browser which ignores the attribute).
  assert.match(html, /href="\/api\/guest\/qr"/, 'the save no longer points at the guest download route');
  assert.match(html, /<a[^>]*href="\/api\/guest\/qr"[^>]*download/, 'the save anchor lost its download attribute');
  assert.doesNotMatch(html, /href="\/api\/guest\/qr[^"]+"/, 'an id, token or query was appended — the cookie is the whole credential');

  const route = readWeb('app/api/guest/qr/route.ts');
  assert.match(route, /Content-Disposition/, 'the route stopped naming the file — a browser ignoring `download` would render it instead');
  assert.match(route, /attachment; filename=/, 'the route no longer sends the PNG as an attachment');
  assert.match(route, /readGuestSession\(\)/, 'the download stopped authenticating on the cookie');
});

// ═══ B · a guest who already answered is not stuck ═════════════════════════

test('the Reply door gives an answered guest a way on, gated on having answered', () => {
  assert.match(REPLY, /const hasAnswered = /, 'the Reply door no longer distinguishes a guest who has replied');
  assert.match(REPLY, /rsvp_status[^\n]*!== 'pending'/, 'the way onward is no longer gated on an actual answer');
  assert.match(REPLY, /\{hasAnswered \? \(/, 'the block is rendered unconditionally, or not at all');
  assert.match(REPLY, /href=\{inviteEnterPath\(home\)\}/, 'the way onward does not lead to the door that holds the QR');
  // `home` is the DATABASE slug, never the route param — the open-redirect
  // lesson `[slug]/redeem` paid for on live prod (2026-08-06).
  assert.match(REPLY, /const home = event\.slug as string;/, 'the destination slug is no longer read from the database');
});

test('the way onward names the QR — a bare "continue" is what being stuck felt like', () => {
  const i = REPLY.indexOf('{hasAnswered ? (');
  assert.notEqual(i, -1, 'the answered-guest block is gone — update this test');
  const j = REPLY.indexOf('</DoorNotice>', i);
  assert.notEqual(j, -1, 'the answered-guest block no longer closes with a DoorNotice — update this test');
  const block = REPLY.slice(i, j).replace(/\s+/g, ' ');
  assert.match(block, /your QR/i, 'the link does not say it leads to their QR');
  assert.match(block, /\{words\.eventWord\}/, 'the link does not name the event in the couple’s own word');
});

test('the 2026-09-10 redirect is NOT weakened, and no reveal is replayed', () => {
  // ⛔ OWNER-LOCKED AND NOT BEING REVERSED. A returning guest goes to the Reply
  // door, not back through the arrival — they must not be made to type their
  // name again. The fix above is an ADDITION to where they land, never a change
  // to where they land.
  assert.match(JOIN_FLOW, /readGuestSession\(\)/, 'the returning-guest check is gone');
  assert.match(JOIN_FLOW, /redirect\(inviteReplyPath\(/, 'the 2026-09-10 redirect to the Reply door has been removed or repointed');
  // Door 03 is a hand-off, not a second reveal. If it ever mounted the reveal,
  // a guest arriving from the Reply link would be shown the opening again.
  assert.doesNotMatch(ENTER, /Reveal|reveal/, 'the Enter door now carries a reveal — a returning guest would replay the opening');
});
