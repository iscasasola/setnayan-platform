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
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

function pageBody(): string {
  const whole = stripComments(
    readFileSync(join(process.cwd(), 'app/[slug]/pabuya/page.tsx'), 'utf8'),
  );
  /* 🪤 Collapse whitespace: this repo's stripComments pads comments with SPACES
     of the same length, so a character-measured window lands on blanks. */
  const start = whole.indexOf('export default async function');
  assert.ok(start > 0, 'the gifts page has no default export — this guard points at nothing');
  return whole.slice(start).replace(/\s+/g, ' ');
}

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
  return stripComments(
    readFileSync(join(process.cwd(), 'lib/pabuya-recognition.ts'), 'utf8'),
  ).replace(/\s+/g, ' ');
}

test('recognition is a session for THIS event, or a real host', () => {
  const src = recognitionRule();
  assert.ok(src.includes('readGuestSession'), 'no guest session is read, so an invited guest cannot be recognised');
  assert.match(
    src,
    /guestSession\?\.event_id === eventId/,
    'the session is not compared to THIS event — a session for another wedding would pass',
  );
  assert.ok(
    src.includes('isHostMemberType'),
    'host membership is not asked through isHostMemberType — existence was once mistaken for authority here',
  );
  // The page must actually REACH the rule; a helper nobody calls is a comment.
  assert.match(
    pageBody(),
    /viewerIsRecognised = await viewerIsRecognisedForEvent\(event\.event_id\)/,
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
  const whole = readFileSync(join(process.cwd(), 'app/[slug]/pabuya/page.tsx'), 'utf8');
  assert.match(
    whole,
    /Payment details are shown to invited guests/,
    'the explanation is gone — a card with no number and no sentence reads as a couple who filled the form in wrong',
  );
});
