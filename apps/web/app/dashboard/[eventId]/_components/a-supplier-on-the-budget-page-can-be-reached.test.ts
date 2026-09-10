/**
 * a-supplier-on-the-budget-page-can-be-reached.test.ts
 *
 * ── The defect this pins ───────────────────────────────────────────────────
 * `VendorItemizationCard` had exactly ONE outbound link in the whole file, and
 * it rendered only inside `LineItemSection` while
 * `priceSource === 'pending' && !hasVendorControlled` — once a vendor HAD
 * published pricing, "To adjust pricing, message the vendor in chat" was
 * plain text with no link at all. And that one link built
 * `?vendor=${vendorMarketplaceId ?? ''}` — for an off-platform supplier
 * (`marketplace_vendor_id` is NULL) that resolves to a bare `?vendor=`, a
 * param the messages page never even reads (it reads `prefill_vendor_email`).
 *
 * The fix adds an unconditional `SupplierReachLinks` row (Message + Open
 * workspace) rendered outside `<details>`/`<summary>` on both the 'card' and
 * 'embed' variants, and repoints the contextual pending-pricing link at the
 * param the messages page actually consumes.
 *
 * Most of this file is a source-shape guard, not a render test — the parent
 * component is a server component with server-action props that a render
 * harness in this repo does not stand up. It censuses the FILE, so a
 * regression back to one link, or back to the dead `?vendor=` param, fails
 * without needing a DOM.
 *
 * ── ⚠ THE PREFILL REACHES NOBODY TODAY, AND THAT IS NOT THIS FIX'S BUG ─────
 * `event_vendors.contact_email` is `TEXT` with no `NOT NULL` and no default
 * (`20260513100000_iteration_0006_vendors.sql`), and measured live on
 * 2026-09-02: all 45 `event_vendors` rows in production have it NULL or
 * blank. So the "prefill from contact_email" behaviour below degrades to the
 * bare messages index for every current row — that is the fallback working
 * as designed, not a defect this PR introduces or should paper over.
 * Suppliers shipping with no `contact_email` is a separate, upstream defect
 * with its own owner.
 *
 * `SupplierReachLinks` cannot be imported directly to test it: the file it
 * lives in transitively pulls in `budget/actions.ts` → `notification-emit.ts`
 * → the `server-only` package, which throws outside a Next.js server render.
 * So the null-case test below extracts the REAL `messagesHref`/`workspaceHref`
 * expressions out of the source text and evaluates them — the exact code that
 * ships, not a hand-copied re-implementation that could silently drift from it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const FILE = join(__dirname, 'vendor-itemization-card.tsx');

function source(): string {
  return stripComments(readFileSync(FILE, 'utf8'));
}

test('SupplierReachLinks exists and renders at least two outbound links', () => {
  const src = source();
  const compStart = src.indexOf('function SupplierReachLinks');
  assert.ok(
    compStart >= 0,
    'SupplierReachLinks was renamed or removed — the shape moved; teach this guard the new one rather than deleting it.',
  );
  const nextFn = src.indexOf('\nfunction ', compStart + 1);
  const body = src.slice(compStart, nextFn > 0 ? nextFn : src.length);
  const linkCount = (body.match(/<Link\b/g) ?? []).length;
  assert.ok(
    linkCount >= 2,
    `SupplierReachLinks renders ${linkCount} <Link> elements, expected at least 2 (Message + Open workspace).`,
  );
});

test('SupplierReachLinks is mounted unconditionally on BOTH variants, outside the disclosure', () => {
  const src = source();
  const mounts = (src.match(/\{reachLinks\}/g) ?? []).length;
  assert.equal(
    mounts,
    2,
    `expected {reachLinks} mounted exactly twice — once in the 'embed' return, once in the 'card' return before <details> — found ${mounts}. ` +
      `Nesting it inside <summary> fights the disclosure's own click-to-toggle behavior; keep it outside <details>.`,
  );

  const detailsIndex = src.indexOf('<details');
  const reachBeforeDetails = src.slice(0, detailsIndex).lastIndexOf('{reachLinks}');
  assert.ok(
    reachBeforeDetails >= 0 && reachBeforeDetails < detailsIndex,
    'the card-variant {reachLinks} must render before <details> opens, not inside <summary> or the collapsed history.',
  );
});

test('no outbound supplier link builds the dead `?vendor=` param', () => {
  const src = source();
  assert.doesNotMatch(
    src,
    /\?vendor=\$\{/,
    'a link is building `?vendor=${...}` again — the messages page never reads `vendor`, only `prefill_vendor_email`. ' +
      'An off-platform supplier (marketplace_vendor_id is NULL) resolves this to a bare `?vendor=` that goes nowhere.',
  );
});

test('every messages link keys off `prefill_vendor_email`, not a marketplace-only id', () => {
  const src = source();
  const messagesHrefs = [...src.matchAll(/\/messages[^`\n]*`/g)].map((m) => m[0]);
  assert.ok(
    messagesHrefs.length >= 2,
    `expected at least 2 messages hrefs (SupplierReachLinks' prefilled and bare fallbacks), found ${messagesHrefs.length}.`,
  );
  for (const href of messagesHrefs) {
    assert.doesNotMatch(
      href,
      /vendorMarketplaceId/,
      `a messages link still keys off vendorMarketplaceId, which is NULL for off-platform suppliers: ${href}`,
    );
  }
});

/* 💬 N2 item 2 (2026-09-11). The pending-pricing nudge rendered only for a
   supplier ON Setnayan ('pending' needs a marketplace id), and since 2026-09-10
   such a supplier's copied address is never prefilled — so "Ask them for
   pricing" could only ever land on the bare Messages LIST. It is the shipped
   thread opener now, the same one "Message" uses. */
test('"Ask them for pricing" opens the conversation — it never lands on the Messages list', () => {
  const src = source();
  const at = src.indexOf('function LineItemSection');
  assert.ok(at >= 0, 'LineItemSection was renamed or removed — teach this guard the new shape.');
  const next = src.indexOf('\nfunction ', at + 1);
  const body = src.slice(at, next > 0 ? next : src.length);

  // ANCHOR: the nudge still exists, or every assertion below passes over nothing.
  const label = body.indexOf('label="Ask them for pricing"');
  assert.ok(label >= 0, 'the "Ask them for pricing" nudge is gone — re-anchor this guard');
  const opener = body.lastIndexOf('<ContactShortlistVendorButton', label);
  assert.ok(
    opener >= 0 && body.slice(opener, label).indexOf('/>') === -1,
    '"Ask them for pricing" is no longer the thread opener',
  );
  assert.equal(
    (body.match(/\/messages/g) ?? []).length,
    0,
    'LineItemSection links to the Messages list again — for a supplier on Setnayan that ' +
      'can never prefill, so the couple is dropped on a list instead of the conversation.',
  );
  assert.equal(
    (src.match(/vendorContactEmail/g) ?? []).length,
    0,
    'the dead prefill prop is back — a Setnayan shop\'s address has no business reaching this section',
  );
});

test('the workspace link addresses the real per-vendor route', () => {
  const src = source();
  assert.match(
    src,
    /\/vendors\/\$\{vendor\.vendor_id\}\/workspace/,
    'the workspace link must point at /dashboard/[eventId]/vendors/[vendorId]/workspace — the route that actually ' +
      'exists (apps/web/app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx) — not the near-identical ' +
      '[eventVendorId] path segment, which holds only a loading.tsx and no page.',
  );
});

// ---------------------------------------------------------------------------
// BEHAVIORAL — extract the REAL `messagesHref`/`workspaceHref` statements
// from `SupplierReachLinks` and evaluate them, so the null-contact_email
// case (which is EVERY event_vendors row in production today, measured live
// 2026-09-02) is checked against what the shipped expression actually
// computes, not against a string pattern.
// ---------------------------------------------------------------------------

function extractReachLinksExpr(): string {
  const src = source();
  const start = src.indexOf('function SupplierReachLinks');
  assert.ok(start >= 0, 'SupplierReachLinks not found — see the earlier "exists" test for the real message.');
  const bodyStart = src.indexOf('{', src.indexOf(')', start));
  const returnIdx = src.indexOf('return (', bodyStart);
  assert.ok(returnIdx > bodyStart, 'SupplierReachLinks body shape changed — could not find its `return (`.');
  return src.slice(bodyStart + 1, returnIdx);
}

function hrefsFor(
  vendor: { contact_email: string | null; vendor_id: string; marketplace_vendor_id?: string | null },
  eventId: string,
  variant: 'card' | 'embed' = 'card',
) {
  const body = extractReachLinksExpr();
  // Deliberately evaluating the real extracted source, not a hand-copied
  // reimplementation that could silently drift from it.
  const fn = new Function(
    'vendor',
    'eventId',
    'variant',
    'encodeURIComponent',
    `${body}\nreturn { messagesHref, workspaceHref, canOpenThread };`,
  );
  return fn(vendor, eventId, variant, encodeURIComponent) as {
    messagesHref: string;
    workspaceHref: string;
    canOpenThread: boolean;
  };
}

/* ⚠ THESE THREE PINS ARE KEPT AND RE-AIMED, NOT DELETED (2026-09-09).
   They were written on 2026-09-02 to hold the fallback href steady, and they
   still do — but the fallback is no longer what a marketplace supplier gets.
   "Message" on the budget card now OPENS THAT SUPPLIER'S CONVERSATION instead
   of landing on the list with a form to submit; `messagesHref` survives for the
   two cases that genuinely cannot open a thread. */
test('a supplier ON SETNAYAN gets the thread opener, not a link to the list', () => {
  const { canOpenThread } = hrefsFor(
    { contact_email: null, vendor_id: 'S89VEN-0000000001', marketplace_vendor_id: 'S89VPR-1' },
    'S89EVT-0000000001',
  );
  assert.equal(
    canOpenThread,
    true,
    'the budget card must open the conversation for a supplier who can be messaged',
  );
});

test('an OFF-PLATFORM supplier keeps the plain link — it cannot be messaged here', () => {
  const { canOpenThread } = hrefsFor(
    { contact_email: null, vendor_id: 'S89VEN-0000000001', marketplace_vendor_id: null },
    'S89EVT-0000000001',
  );
  assert.equal(canOpenThread, false, 'a hand-typed supplier has no thread to open');
});

test('the workspace embed does NOT grow a second opener', () => {
  // The workspace already ships a thread deep-link and the conversation itself.
  const { canOpenThread } = hrefsFor(
    { contact_email: null, vendor_id: 'S89VEN-0000000001', marketplace_vendor_id: 'S89VPR-1' },
    'S89EVT-0000000001',
    'embed',
  );
  assert.equal(canOpenThread, false, 'the embed variant must not duplicate the workspace’s own opener');
});

test('a supplier with NO contact_email links to the bare messages index — no query string at all', () => {
  const { messagesHref } = hrefsFor(
    { contact_email: null, vendor_id: 'S89VEN-0000000001' },
    'S89EVT-0000000001',
  );
  assert.equal(
    messagesHref,
    '/dashboard/S89EVT-0000000001/messages',
    'a supplier with no contact_email must fall back to the plain messages index, with no query string at all. ' +
      'This is the case that actually ships today — measured live 2026-09-02, all 45 event_vendors rows have ' +
      'contact_email NULL or blank.',
  );
});

test('a supplier WITH contact_email prefills the messages form', () => {
  const { messagesHref } = hrefsFor(
    { contact_email: 'vendor@example.com', vendor_id: 'S89VEN-0000000001' },
    'S89EVT-0000000001',
  );
  assert.equal(
    messagesHref,
    '/dashboard/S89EVT-0000000001/messages?prefill_vendor_email=vendor%40example.com',
    'once a supplier has a contact_email, the link should prefill the messages compose form with it.',
  );
});

test('the workspace link always resolves, independent of contact_email', () => {
  const { workspaceHref } = hrefsFor(
    { contact_email: null, vendor_id: 'S89VEN-0000000001' },
    'S89EVT-0000000001',
  );
  assert.equal(workspaceHref, '/dashboard/S89EVT-0000000001/vendors/S89VEN-0000000001/workspace');
});

test("a supplier ON SETNAYAN never has its address pre-filled — the lock copied the SHOP's email into the row", () => {
  // Owner 2026-09-10: "our goal is to let them integrate their event with the
  // vendor they find. not to let them communicate outside the app". A package
  // lock copies a Setnayan shop's own email into `event_vendors.contact_email`,
  // and the Messages page prints a prefill in plain sight. So a shop on
  // Setnayan gets the bare index here (its real way in is the thread opener).
  const { messagesHref } = hrefsFor(
    { contact_email: 'shop-owner@example.com', vendor_id: 'S89VEN-0000000001', marketplace_vendor_id: 'S89VPR-1' },
    'S89EVT-0000000001',
  );
  assert.equal(messagesHref, '/dashboard/S89EVT-0000000001/messages');
  assert.ok(!messagesHref.includes('shop-owner'), "the shop's copied address reached the Messages box");
});
