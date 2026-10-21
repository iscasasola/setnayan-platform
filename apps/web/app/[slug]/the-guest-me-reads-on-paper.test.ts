/**
 * THE GUEST'S ME READS ON PAPER, NAMES READ AS NAMES, ONE +1 IS ONE TICKET
 * (owner 2026-10-21, "Yes to all" on `Setnayan/prototypes/guest_page_fixes_2_4_2026-10-21.html`
 * and its three questions; DECISION_LOG row of that day).
 *
 * The owner, on Pam's Me: *"Text sits straight on the cover photo (unreadable) · a +1's name prints as typed
 * ("pamela labriaga") · too many controls for one +1: Save all tickets · Send their invite · Show pamela's ticket ·
 * Save pamela's ticket."*
 *
 *   2 · EVERY TOPIC ON ME IS ONE OF THE HUB'S SCENE CARDS — `.sn-hub-cards > section`, the card the scenes above Me
 *       already wear, hairline and shadow kept (owner's answer 1). Rendered, not read: Me's root is the card column and
 *       every child it draws is a section (a bare child would be words on the photo again); the record note is the
 *       same card on Me, and a plain line at the foot of a page that is one scroll.
 *   3 · A NAME IS SHOWN CASED, NEVER REWRITTEN — `displayPersonName` on the Me name line, Your guests, the Save and
 *       the sheet's words, the invite message's greeting, the ticket PNG, the printed batches, the plus-one's door and
 *       the couple's Guest list (owner's answer 2). The table itself is `lib/person-name-case.test.ts`.
 *   4 · A NAMED +1 WITH A TICKET IS THE SHIPPED `TicketRow` — two pressables (the ticket, which opens big, and ONE
 *       Send), no "Show …'s ticket", no Save in the row; "Save all tickets" from two tickets up (owner's answer 3).
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

const APP = join(__dirname, '..');
const WEB = join(APP, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** The direct children of the first element in `html`, as their opening tags — a tiny depth walk, enough for React's static markup. */
function topChildren(html: string): string[] {
  const VOID = /^(?:img|input|br|hr|meta|link|source|area|wbr)$/i;
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
  const out: string[] = [];
  let depth = 0;
  for (const m of html.matchAll(re)) {
    const [whole, close, tag, , self] = m;
    if (close) { depth--; continue; }
    if (depth === 1) out.push(whole);
    if (!self && !VOID.test(tag!)) depth++;
  }
  return out;
}

const PAM = {
  name: 'pam reyes',
  slug: 'ana',
  eventId: 'e-1',
  guestId: 'g-pam',
  askMeal: false,
  askDietary: false,
  askPlusOnes: true,
  eventName: 'Indalecio & Claire',
  guests: [
    { guestId: 'p1', name: 'pamela labriaga', inviteUrl: 'https://x/ana?invite=t1' },
    { guestId: 'p2', name: 'jose de los santos', inviteUrl: 'https://x/ana?invite=t2' },
  ],
  passCards: { own: '/api/guest/pass-card', plusOnes: { p1: '/api/guest/pass-card?guest=p1', p2: '/api/guest/pass-card?guest=p2' } },
  account: { kind: 'linked' as const, accountEmail: 'pam@example.com' },
  personalLink: 'https://x/ana?invite=t0',
  userAgent: null,
  termsCarried: true,
  faceTagging: { on: false, open: false, faceMode: 'mode_a' as const, wish: true, turnOff: async () => {} },
};

test('2 · Me is the Hub’s card column, and every topic it draws is one of its cards', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { GuestMe } = await import('./_components/guest-me');
  const html = renderToStaticMarkup(React.createElement(GuestMe, PAM));
  assert.match(html, /^<div class="sn-hub-cards space-y-4" data-guest-me="true">/, `Me is no longer drawn as the Hub’s card column: ${html.slice(0, 120)}`);
  const kids = topChildren(html);
  assert.ok(kids.length >= 3, `Me drew ${kids.length} topics — the fixture should draw guests, face tagging and Save`);
  for (const k of kids) assert.match(k, /^<section\b/, `a topic on Me is not a card (words on the photo again): ${k}`);
  // The four drawn topics, in the prototype's order (celebrants draw nothing without actions).
  const order = ['data-me-card="guests"', 'data-face-tagging-row', 'data-me-card="account"'];
  const at = order.map((o) => html.indexOf(o));
  assert.ok(at.every((x) => x > -1) && at.join() === [...at].sort((a, b) => a - b).join(), `the topics moved: ${at.join(', ')}`);
  // The card is the hub's own rule, hairline and shadow kept (owner's answer 1) — no Me-only CSS.
  const css = readFileSync(join(WEB, 'app', 'globals.css'), 'utf8');
  const rule = /\.sn-hub-cards > section,\s*\.sn-hub-cards > div > section,[\s\S]*?\{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.match(rule, /border: 1px solid rgb\(var\(--color-ink\) \/ 0\.08\);/, 'the scene card lost its hairline');
  assert.match(rule, /background: rgb\(var\(--color-cream\) \/ 1\);/, 'the scene card is not the page’s paper (dark would break)');
  assert.doesNotMatch(css, /data-guest-me|data-me-card/, 'Me got CSS of its own — it wears the hub’s card, nothing new');
});

test('2 · the record note is a card on Me (its one mount), a plain line at the foot', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ScanTrailForm } = await import('./_components/scan-trail-notice');
  const props = { sentence: 'We keep a record.', optedOut: false, toggle: async () => {} };
  const card = renderToStaticMarkup(React.createElement(ScanTrailForm, { ...props, card: true }));
  assert.match(card, /^<div class="sn-hub-cards[^"]*" data-me-card="record"><section><form/, 'on Me the record note is not a scene card');
  const line = renderToStaticMarkup(React.createElement(ScanTrailForm, props));
  assert.match(line, /^<form/, 'at the foot of a one-scroll page the note became a card');
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.match(body, /<ScanTrailNotice eventId=\{event\.event_id\} guestId=\{guest\.guest_id\} preview=\{isEditorCanvas\} card=\{tabs\.on\} \/>/, 'the note is not a card exactly where Me draws it (a tabbed page)');
});

test('3 · Me prints every name cased — the typed name never reaches the screen', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { GuestMe } = await import('./_components/guest-me');
  const html = renderToStaticMarkup(React.createElement(GuestMe, PAM));
  assert.doesNotMatch(html, /pamela labriaga|jose de los santos|pam reyes|pamela’s/, 'a typed name is printed as typed');
  assert.match(html, />Pam Reyes</, 'Me’s own name line is not cased');
  assert.match(html, />Pamela Labriaga</);
  assert.match(html, />Jose de los Santos</, 'a particle was capitalised ("De Los") or the name was not cased');
  assert.match(html, /aria-label="Pamela’s ticket — Show this at the door"/);
  // The invite message greets the shown name: Send is handed the cased name, and the builder takes its first word.
  const yg = read('app/[slug]/_components/your-guests.tsx');
  assert.match(yg, /<SendTheirInvite name=\{shown\}/, 'Send their invite is handed the typed name');
  assert.match(yg, /const shown = g\.name \? displayPersonName\(g\.name\) : null;/);
  const { buildGuestInviteMessage } = await import('@/lib/guest-invite-message');
  assert.match(buildGuestInviteMessage({ hostsName: 'Indalecio & Claire', guestName: 'Pamela Labriaga', inviteUrl: 'https://x', voice: 'guest' }) ?? '', /^Hi Pamela!/);
});

test('3 · the ticket PNG, the printed batches, the plus-one’s door and the couple’s list show the same cased name', async () => {
  const { passCardGuestName } = await import('@/lib/pass-card.server');
  const none = { name_prefix: null, middle_name: null, name_suffix: null, display_name: null };
  assert.equal(passCardGuestName({ ...none, first_name: 'jose', last_name: 'de los santos' }), 'Jose de los Santos', 'the saved ticket prints the typed name');
  assert.equal(passCardGuestName({ ...none, first_name: 'Ana', last_name: 'MJ Reyes' }), 'Ana MJ Reyes', 'a name typed with capitals was changed');
  const print = read('lib/print-set.server.ts');
  assert.equal((print.match(/displayPersonName\(ticketName\(g, style\)\)/g) ?? []).length, 2, 'a printed batch / the Prints name list prints the typed name');
  assert.equal((print.match(/\bticketName\(g, style\)/g) ?? []).length, 2, 'a new ticketName print site skips displayPersonName');
  const door = read('app/[slug]/welcome/page.tsx');
  assert.match(door, /const primaryName =\s*displayPersonName\(/, 'the plus-one’s door says "from maria"');
  assert.match(door, /const formalName = missing\.name \? null : displayPersonName\(composeFormalName\(row\)\) \|\| null;/);
  assert.match(read('app/[slug]/welcome/_components/plus-one-door.tsx'), /const wholeName = displayPersonName\(composeFormalName\(row\)\);/);
  const list = read('app/dashboard/[eventId]/guests/_components/guests-screen.tsx');
  assert.match(list, /const name = plusWords\?\.name \?\? displayPersonName\(guestNameAsGiven\(g\) \?\? guestDisplayName\(g\)\);/, 'the Guest list row prints the typed name');
  assert.match(read('app/dashboard/[eventId]/guests/_components/guest-card-body.tsx'), /return plusOneOf\?\.name \?\? displayPersonName\(guestDisplayName\(guest\)\);/, 'the guest card’s title prints the typed name');
  assert.match(read('app/dashboard/[eventId]/guests/_components/guest-map-canvas.tsx'), /const name = words\?\.name \?\? displayPersonName\(guestDisplayName\(g\)\);/, 'the Guest map prints the typed name');
});

test('4 · a named +1 with a ticket is ONE TicketRow: the ticket (opens big) and ONE Send — nothing else to press', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { YourGuests } = await import('./_components/your-guests');
  const one = { guestId: 'p1', name: 'pamela labriaga', inviteUrl: 'https://x/ana?invite=t1' };
  const html = renderToStaticMarkup(
    React.createElement(YourGuests, {
      guests: [one],
      eventName: 'Indalecio & Claire',
      addNamesHref: '/ana/invite/reply#plus-ones',
      passCards: { own: '/api/guest/pass-card', plusOnes: { p1: '/api/guest/pass-card?guest=p1' } },
    }),
  );
  const row = html.slice(html.indexOf('data-plus-one-ticket'));
  assert.ok(row.length > 20 && html.includes('data-ticket-row=""'), 'the +1 is not drawn as the shipped TicketRow');
  const pressables = row.match(/<(?:button|a)\b/g) ?? [];
  assert.equal(pressables.length, 2, `one +1 has ${pressables.length} things to press (the ticket + one Send)`);
  assert.match(row, /data-ticket-show=""[^>]*><img src="\/api\/guest\/pass-card\?guest=p1"/, 'the ticket is not what opens');
  assert.match(row, />Send their invite</);
  assert.doesNotMatch(html, /<details|Show [^<]*’s ticket|Save Pamela’s/, 'a second drawing of the QR, or a Save, is back in the row');
  // Save all from two tickets up (Pam's own + one +1 — owner: "two is multiple").
  assert.match(html, /data-save-pass-card="2"[\s\S]*Save all tickets/, 'Save all tickets is not offered for two tickets');
  // …and no ticket, no Save all, no tap: a named +1 without a ticket is the name and Send.
  const bare = renderToStaticMarkup(React.createElement(YourGuests, { guests: [one], eventName: 'x', addNamesHref: '/r' }));
  assert.doesNotMatch(bare, /Save all tickets|data-ticket-show/);
  assert.equal((bare.match(/<(?:button|a)\b/g) ?? []).length, 1, 'a +1 with no ticket has more than Send');
  // The sheet the ticket opens is the guest page's ONE sheet — the My QR pop-up's frame, Save inside it.
  const show = read('app/[slug]/_components/ticket-show.tsx');
  assert.match(show, /import \{ GuestSheet \} from '\.\/guest-sheet';/);
  assert.match(read('app/[slug]/_components/guest-hub-bar.tsx'), /<GuestSheet titleId="guest-qr-title"/, 'My QR no longer opens the same sheet');
  assert.match(show, /<GuestSheet\b[^>]*title=\{PASS_CARD_WORDS\.showAtDoor\}[\s\S]*<SavePassCardButton hrefs=\{\[href\]\} label=\{saveLabel\} \/>/);
});
