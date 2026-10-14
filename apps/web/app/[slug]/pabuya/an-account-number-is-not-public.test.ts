/**
 * A PAYMENT IDENTIFIER IS SHOWN TO INVITED GUESTS, NOT TO THE INTERNET.
 *
 * ── 🔴 WHAT WAS PUBLIC ─────────────────────────────────────────────────────
 * The gifts page is reachable by anyone holding the link — deliberately, so a
 * relative abroad can send a gift. On 2026-09-15 a fetch with **no session at
 * all** returned a live couple's bank account name and number in the page body.
 * The owner, shown that: **"gate the account number."**
 *
 * ── WHAT THIS PINS ─────────────────────────────────────────────────────────
 * 1. The number is withheld from an unrecognised reader — and so is the QR,
 *    because a bank QR ENCODES the account it stands for. Gating the digits and
 *    printing the code beside them is a gate with a window next to it.
 * 2. Recognition is a guest session FOR THIS EVENT, or a host asked through
 *    `isHostMemberType` — never a bare `Boolean(row)`, which once waved a
 *    `guest`-typed member into a private site.
 * 3. The page SAYS something is withheld. A bank card with no number, no QR and
 *    no sentence reads as a couple who filled the form in wrong; that sentence
 *    is the difference between a gate and a bug.
 *
 * ⚖ EVERY METHOD, AND IT TOOK TWO RULINGS. The first — "gate the account
 * number" — was about the bank, and the code gated only the bank: widening a
 * disclosure rule past what was asked is how the next person inherits a decision
 * nobody made. The owner then ruled on the rest himself: "gate the gcash number
 * too." A wallet handle is a mobile number; being changeable in an app makes it
 * recoverable, not public.
 *
 * 🏠 2026-10-14 — THE GIFTS PAGE IS NOW TWO PLACES, AND THIS GUARD FOLLOWED IT.
 * E-Gifts is drawn on the Welcome page too, in place of its door (owner: "can't
 * we just have it there instead of a button?"). So the page's content moved into
 * ONE reader (`_lib/gift-page.server.ts`), ONE pure rule (`_lib/gift-cards.ts`)
 * and ONE body (`_components/gift-page-body.tsx`), and "the page" below is those
 * three with the route itself. Every pin is the one that was here, retargeted —
 * and the rule is now EXECUTED (test 0), and the Welcome is held to the SAME
 * reader (the last test).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

/** The gifts page's content, wherever it is drawn: the route, its one reader, its one rule, its one body. */
const GIFT_PAGE_FILES = [
  'app/[slug]/pabuya/page.tsx',
  'app/[slug]/pabuya/_lib/gift-page.server.ts',
  'app/[slug]/pabuya/_lib/gift-cards.ts',
  'app/[slug]/pabuya/_components/gift-page-body.tsx',
] as const;

function pageBody(): string {
  const route = stripComments(
    readFileSync(join(process.cwd(), 'app/[slug]/pabuya/page.tsx'), 'utf8'),
  );
  /* 🪤 Collapse whitespace: this repo's stripComments pads comments with SPACES
     of the same length, so a character-measured window lands on blanks. */
  const start = route.indexOf('export default async function');
  assert.ok(start > 0, 'the gifts page has no default export — this guard points at nothing');
  const rest = GIFT_PAGE_FILES.slice(1).map((f) => stripComments(readFileSync(join(process.cwd(), f), 'utf8')));
  return [route.slice(start), ...rest].join('\n').replace(/\s+/g, ' ');
}

test('0 · 🔒 the rule, EXECUTED: an unrecognised reader gets no number and no QR, and is told why', async () => {
  const { giftCardsFor } = await import('./_lib/gift-cards');
  const methods = [
    { method_kind: 'bank', label: 'BPI', account_name: 'Maria Santos', handle: '1234 5678 90', note: null, qrDisplayUrl: '/api/pabuya/qr/S89E-1' },
    { method_kind: 'gcash', label: 'GCash', account_name: 'Maria S.', handle: '0917 123 4567', note: null, qrDisplayUrl: null },
    /* QR-only: the row whose withholding once went unsaid. */
    { method_kind: 'maya', label: 'Maya', account_name: null, handle: null, note: null, qrDisplayUrl: '/api/pabuya/qr/S89E-3' },
  ];
  const stranger = giftCardsFor(methods, false);
  assert.equal(stranger.cards.length, 3, 'a way to give was dropped instead of shown without its number');
  for (const c of stranger.cards) {
    assert.equal(c.handle, null, `${c.label}: the number reached a reader the event does not recognise`);
    assert.equal(c.qrUrl, null, `${c.label}: the QR reached a reader the event does not recognise`);
  }
  assert.deepEqual(stranger.cards.map((c) => c.accountName), ['Maria Santos', 'Maria S.', null], 'the account NAME is what a stranger may see');
  assert.equal(stranger.identifiersWithheld, true);
  assert.equal(giftCardsFor([methods[2]!], false).identifiersWithheld, true, 'a QR-only way withheld without a word');
  const guest = giftCardsFor(methods, true);
  assert.deepEqual(guest.cards.map((c) => c.handle), ['1234 5678 90', '0917 123 4567', null]);
  assert.deepEqual(guest.cards.map((c) => c.qrUrl), ['/api/pabuya/qr/S89E-1', null, '/api/pabuya/qr/S89E-3']);
  assert.equal(guest.identifiersWithheld, false);
});

test('🔒 EVERY payment identifier and its QR are withheld from an unrecognised reader', () => {
  const src = pageBody();
  assert.match(
    src,
    /withhold\s*\?\s*null\s*:\s*m\.handle/,
    'the account number is no longer withheld — it is readable by anyone with the link',
  );
  assert.match(
    src,
    /withhold\s*\?\s*null\s*:\s*m\.qrDisplayUrl/,
    'the QR is no longer withheld — a bank QR encodes the very account the number was hidden to protect',
  );
  assert.match(
    src,
    /const withhold = !viewerIsRecognised/,
    'the withholding condition changed shape — re-read it before assuming it still holds',
  );
});

/*
  🔑 THE RULE MOVED ON 2026-09-16 AND THIS GUARD FOLLOWED IT — every assertion
  below is the one that was here before, retargeted, not relaxed.

  It moved because the QR stopped being a presigned URL this page minted
  per-reader and became a permanent route (`/api/pabuya/qr/[publicId]`). That
  is a SECOND door onto the same identifiers, and the danger of a rule written
  inline in one page is precisely that the other door can ask a weaker question
  while this file stays green. `lib/pabuya-recognition.ts` is now the only
  definition and BOTH doors import it — which is also what makes it checkable
  in one place.
*/
function recognitionRule(): string {
  /* 🔑 THE RULE MOVED AGAIN ON 2026-09-17, AND THIS GUARD FOLLOWED IT — for the
     reason this guard exists. `pabuya-recognition.ts` is `server-only`, so
     everything here could only ever be a regex over its prose; the DECISION now
     lives in the pure `pabuya-recognition-rule.ts`, where
     `pabuya-recognition-rule.test.ts` EXECUTES 15 combinations of it. Both
     files are read: the rule for its content, the server module for the fact
     that it still gathers the facts and decides nothing. */
  return stripComments(
    readFileSync(join(process.cwd(), 'lib/pabuya-recognition-rule.ts'), 'utf8') +
      '\n' +
      readFileSync(join(process.cwd(), 'lib/pabuya-recognition.ts'), 'utf8'),
  ).replace(/\s+/g, ' ');
}

test('recognition is a session for THIS event, or a real host', () => {
  const src = recognitionRule();
  assert.ok(src.includes('readGuestSession'), 'no guest session is read, so an invited guest cannot be recognised');
  assert.match(
    src,
    /facts\.guestSessionEventId === facts\.eventId/,
    'the session is not compared to THIS event — a session for another wedding would pass',
  );
  assert.ok(
    src.includes('isHostMemberType'),
    'host membership is not asked through isHostMemberType — existence was once mistaken for authority here',
  );
  // The page must actually REACH the rule; a helper nobody calls is a comment.
  /* (2026-10-14) asked beside the page's other reads, in its one reader — the THIRD answer is the rule's. */
  assert.match(
    pageBody(),
    /const \[methods, wishRead, viewerIsRecognised, stored, words\] = await Promise\.all\(\[ fetchEgiftMethods\(admin, event\.event_id, \{ enabledOnly: true, \}\), readGuestWishList\(admin, event\.event_id, reader\?\.guest_id \?\? null\), viewerIsRecognisedForEvent\(event\.event_id\),/,
    'the gifts page no longer asks the shared recognition rule',
  );
});

test('🔒 the permanent QR route asks the SAME question the page asks', () => {
  const route = stripComments(
    readFileSync(join(process.cwd(), 'app/api/pabuya/qr/[publicId]/route.ts'), 'utf8'),
  ).replace(/\s+/g, ' ');
  assert.ok(
    route.includes('viewerIsRecognisedForEvent'),
    'the QR route does not ask for recognition — a passer-by could fetch the bank QR the page withholds',
  );
  assert.match(
    route,
    /if \(!\(await viewerIsRecognisedForEvent\([^)]*\)\)\) \{ return new NextResponse/,
    'recognition is computed but not enforced — a value nobody branches on is not a gate',
  );
  assert.ok(
    route.includes('!method.is_enabled'),
    'a retired (hidden) destination must 404 — its row still holds the old account',
  );
});

test('🔒 the EVENT HUB names rails only — never an identifier, never couple text', () => {
  /*
    The hub's gifts doorway gained a footline naming WHICH wallets are accepted
    ("GCASH · BANK TRANSFER"). That is a second surface describing the same
    methods, so it needs its own ceiling — the gifts page's gate does not reach
    here, and the hub deliberately does not branch on who is reading.

    ⚖ What is allowed: the CLOSED vocabulary from egift-kinds.ts, keyed by the
    CHECK-constrained `method_kind`. There is no value in it a couple can author.
    ⚖ What is not: `handle`, `account_name`, `qrDisplayUrl`, `qr_r2_key`, and the
    couple's own free-text `label` — author-controlled, so it could carry the
    number the ruling withholds.
  */
  const hub = stripComments(
    readFileSync(join(process.cwd(), 'app/[slug]/hub/page.tsx'), 'utf8'),
  );

  assert.match(
    hub,
    /egiftKindMeta\(m\.method_kind\)\.defaultLabel/,
    'the hub no longer derives its rail names from the closed vocabulary',
  );

  for (const banned of ['.handle', '.account_name', '.qrDisplayUrl', '.qr_r2_key']) {
    assert.ok(
      !hub.includes(banned),
      `the hub now reads ${banned} off an e-gift row — that is an identifier on a second surface`,
    );
  }
  // The couple's own label, read off an egift row, is the subtle one.
  assert.ok(
    !/\bm\.label\b/.test(hub),
    'the hub prints the couple-authored label — author-controlled text, so it can carry anything',
  );
  assert.ok(
    !hub.includes('<PabuyaCardList'),
    'the full gift card was mounted on the hub — that is the gifts page, re-drawn',
  );
});

test('🔑 the page says something is withheld, so a gate cannot read as a bug', () => {
  const src = pageBody();
  assert.ok(src.includes('identifiersWithheld'), 'nothing tracks whether anything was withheld');
  const whole = GIFT_PAGE_FILES.map((f) => readFileSync(join(process.cwd(), f), 'utf8')).join('\n');
  assert.match(
    whole,
    /Payment details are shown to invited guests/,
    'the explanation is gone — a card with no number and no sentence reads as a couple who filled the form in wrong',
  );
});

// ── THE WISH LIST'S SEND SHEET IS A SECOND PLACE THE WAYS ARE DRAWN ─────────
//
// Owner 2026-10-08 (E-Gifts › Wish list): tapping a wish opens "Send for the
// Air fryer" with the couple's own ways to give inside it. A second drawing of
// the methods is a second door onto the identifiers — so it is fed the page's
// OWN `cards` (already withheld from a reader the event does not recognise),
// never the rows; and the sheet says that something is withheld, as the page
// does.
test('🔒 the wish list’s send sheet withholds identifiers exactly as the page does', () => {
  const src = pageBody();
  const mounts = src.match(/<PabuyaCardList methods=\{(\w+)\}/g) ?? [];
  assert.equal(mounts.length, 2, 'the page draws the ways to give some other number of times than two (the page, the send sheet)');
  for (const m of mounts) assert.match(m, /methods=\{cards\}/, `a list of ways is drawn from something other than the withheld cards: ${m}`);
  assert.match(src, /<PabuyaCardList methods=\{cards\} idScope="wish-send-handle" \/> \{identifiersWithheld \? \(/, 'the send sheet does not say that something is withheld');

  const list = stripComments(readFileSync(join(process.cwd(), 'app/[slug]/pabuya/_components/wish-list.tsx'), 'utf8'));
  assert.doesNotMatch(list, /fetchEgiftMethods|event_egift_methods|qrDisplayUrl|\bhandle\b/, 'the wish list reads a payment identifier itself');
  assert.match(list, /ways: ReactNode;/, 'the sheet no longer takes the page’s ready-drawn ways');
});

// ── 🏠 THE WELCOME PAGE DRAWS E-GIFTS ITSELF NOW — THROUGH THE SAME DOOR, THE SAME READER ─────────
//
// Owner 2026-10-14: E-Gifts on Welcome is the content, not a button. A second
// place the ways to give are drawn is a second door onto the identifiers, so it
// must ask (1) the door's own gate — the rule `resolveGuestDoorways` applies,
// gated on what the gift page itself demands — before it reads anything, and
// (2) the gift page's ONE reader, which withholds through the ONE rule above.
// It may never read a method itself, nor draw the cards some other way.
test('🔒 the Welcome page’s E-Gifts goes through the gift page’s own gate and reader — never one of its own', () => {
  const flat = (f: string) => stripComments(readFileSync(join(process.cwd(), f), 'utf8')).replace(/\s+/g, ' ');
  const BODY = flat('app/[slug]/_components/site-body.tsx');
  /* (1) Only where the door would stand — `doorways.pabuya` — and only through the gift page's reader. */
  assert.match(BODY, /const giftsOnWelcome = doorways\.pabuya !== null && \(/);
  assert.match(BODY, /const giftPage = giftsOnWelcome \? loadGiftPage\(createAdminClient\(\), event\)\.catch\(/);
  assert.equal((BODY.match(/loadGiftPage\(/g) ?? []).length, 1, 'the body reads the gift content some second way');
  assert.doesNotMatch(BODY, /fetchEgiftMethods|readEgiftMethods|event_egift_methods|giftCardsFor|PabuyaCardList/, 'the event page reads or draws a way to give itself');
  /* Every Welcome that carries the gate carries the content — and nothing else hands it over. */
  const gated = (BODY.match(/giftHref=\{doorways\.pabuya\}/g) ?? []).length;
  assert.ok(gated >= 4, `anti-vacuity: ${gated} Welcomes carry the gift gate`);
  assert.equal((BODY.match(/giftContent=\{giftPage\}/g) ?? []).length, gated, 'a Welcome with the gift gate draws the door instead of E-Gifts, or one without it reads E-Gifts');
  assert.equal((BODY.match(/giftContent=/g) ?? []).length, gated);
  /* (2) The page and the Welcome share the reader; the reader withholds through the one rule. */
  const READER = flat('app/[slug]/pabuya/_lib/gift-page.server.ts');
  assert.match(READER, /viewerIsRecognisedForEvent\(event\.event_id\)/);
  assert.match(READER, /const \{ cards, identifiersWithheld, howToSend \} = giftCardsFor\(methods, viewerIsRecognised\);/);
  assert.match(READER, /fetchEgiftMethods\(admin, event\.event_id, \{ enabledOnly: true, \}\)/, 'the reader fetches more than the ENABLED ways');
  assert.match(flat('app/[slug]/pabuya/page.tsx'), /const content = await loadGiftPage\(admin, event\);/);
  /* The Welcome's block draws only what the reader handed it, with the gift page's own body. */
  const INLINE = flat('app/[slug]/_components/welcome-gifts-content.tsx');
  assert.match(INLINE, /<GiftPageBody content=\{read\} wishLimit=\{WELCOME_WISH_LIMIT\} \/>/);
  assert.doesNotMatch(INLINE, /fetchEgiftMethods|giftCardsFor|PabuyaCardList|createAdminClient/);
  const DRAW = flat('app/[slug]/pabuya/_components/gift-page-body.tsx');
  assert.doesNotMatch(DRAW, /fetchEgiftMethods|giftCardsFor|qrDisplayUrl|createAdminClient|viewerIsRecognised/, 'the body decides what a reader sees');
});

test('🔒 the Welcome page’s E-Gifts, DRAWN for a reader the event does not recognise: no number, no QR, and the reason', async () => {
  const React = await import('react');
  /* The components are compiled with the classic runtime here (as every render test in this tree sets it). */
  (globalThis as unknown as { React: unknown }).React = React;
  const { prerenderToNodeStream } = await import('react-dom/static');
  const { GuestWelcome } = await import('../_components/guest-welcome');
  const { giftCardsFor } = await import('./_lib/gift-cards');
  const { eventWordsFor } = await import('../_lib/event-words');
  const words = await eventWordsFor('wedding');
  const methods = [
    { method_kind: 'bank', label: 'BPI', account_name: 'Maria Santos', handle: '1234 5678 90', note: null, qrDisplayUrl: '/api/pabuya/qr/S89E-1' },
    { method_kind: 'gcash', label: 'GCash', account_name: 'Maria S.', handle: '0917 123 4567', note: null, qrDisplayUrl: null },
  ];
  const html = async (recognised: boolean, giftHref: string | null = '/maria-and-jose/pabuya') => {
    const content = {
      eventId: 'e', words, hostName: 'Maria & Jose', displayName: 'Maria & Jose', hostPossessive: 'Maria & Jose’s',
      message: null, registryHref: null, wishes: [], wishShape: 'rows' as const,
      ...giftCardsFor(methods, recognised),
      reader: { eventId: 'e', giverName: '', recognised },
    };
    const { prelude } = await prerenderToNodeStream(
      React.createElement(GuestWelcome, { parts: ['gifts'], words, look: null, reminders: null, giftHref, giftContent: Promise.resolve(content) }),
    );
    let out = '';
    for await (const chunk of prelude) out += String(chunk);
    return out;
  };
  const stranger = await html(false);
  assert.ok(stranger.includes('data-welcome-gifts') && stranger.includes('Maria Santos'), 'anti-vacuity: the ways to give are drawn on Welcome');
  assert.ok(!stranger.includes('data-gift-door'), 'the Welcome still draws the door, not E-Gifts');
  for (const id of ['1234 5678 90', '0917 123 4567', '/api/pabuya/qr/S89E-1']) assert.ok(!stranger.includes(id), `${id} reached a reader the event does not recognise`);
  assert.ok(stranger.includes('Payment details are shown to invited guests'), 'the withholding is not said');
  const guest = await html(true);
  assert.ok(guest.includes('1234 5678 90') && guest.includes('/api/pabuya/qr/S89E-1'), 'a recognised guest lost the numbers');
  /* No gift gate → nothing at all, even with content handed in: the Welcome never draws a gift page the door would not open. */
  assert.ok(!(await html(true, null)).includes('data-welcome-gifts'));
});
