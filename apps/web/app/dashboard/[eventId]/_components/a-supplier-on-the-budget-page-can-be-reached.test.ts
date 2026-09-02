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
 * This is a source-shape guard, not a render test — the component is a
 * server component with server-action props that a render harness in this
 * repo does not stand up. It censuses the FILE, so a regression back to one
 * link, or back to the dead `?vendor=` param, fails without needing a DOM.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(__dirname, 'vendor-itemization-card.tsx');

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

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
