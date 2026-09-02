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
    `expected at least 2 messages hrefs (the unconditional Message link + the pending-pricing nudge), found ${messagesHrefs.length}.`,
  );
  for (const href of messagesHrefs) {
    assert.doesNotMatch(
      href,
      /vendorMarketplaceId/,
      `a messages link still keys off vendorMarketplaceId, which is NULL for off-platform suppliers: ${href}`,
    );
  }
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

function hrefsFor(vendor: { contact_email: string | null; vendor_id: string }, eventId: string) {
  const body = extractReachLinksExpr();
  // Deliberately evaluating the real extracted source, not a hand-copied
  // reimplementation that could silently drift from it.
  const fn = new Function(
    'vendor',
    'eventId',
    'encodeURIComponent',
    `${body}\nreturn { messagesHref, workspaceHref };`,
  );
  return fn(vendor, eventId, encodeURIComponent) as { messagesHref: string; workspaceHref: string };
}

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
