/**
 * vendor-free-preview-link.test.ts — owner 2026-09-25, verbatim: "i noticed
 * that simple event has questions for suppliers. the simple event is only for
 * our own services."
 *
 * The admin "Onboarding content" editor's "Preview flow ↗" link always
 * pointed at `/onboarding/[type]`. A vendor-free type with its own clean
 * onboarding page (`onboarding_href`, e.g. Simple Event's
 * `/onboarding/simple`) is now redirected AWAY from that URL by the live route
 * (see `../../../../onboarding/[type]/vendor-free-onboarding-gate.test.ts`),
 * so previewing `/onboarding/simple_event` would just bounce — the admin's own
 * preview link must follow the same `onboarding_href` the couple-facing picker
 * uses. The editor's category picker (vendor-category "adds") is also hidden
 * for a vendor-free type, since nothing it configures could ever surface —
 * the live wizard never asks a question sized for a category on a type with
 * no vendor marketplace.
 *
 * ⚠ SOURCE-LEVEL, same posture as the sibling onboarding gate suites: an
 * async admin Server Component with several Supabase reads.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, 'page.tsx');
const src = () => stripComments(readFileSync(PAGE, 'utf8'));

test('the vocab read includes onboarding_href', () => {
  assert.match(
    src(),
    /\.select\(['"]event_type, label_en, emoji, onboarding_href['"]\)/,
    'the preview link needs onboarding_href on the vocab row it already reads',
  );
});

test('"Preview flow" follows onboarding_href when the type has one', () => {
  assert.match(
    src(),
    /href=\{vocab\.onboarding_href \|\| `\/onboarding\/\$\{eventType\}`\}/,
    'must prefer the type\'s own onboarding_href over the generic ' +
      '/onboarding/[type] URL, so the link never previews a page the live ' +
      'route immediately redirects away from',
  );
});

test('vendor-category options are hidden for a vendor-free type, gated on the profile flag', () => {
  const s = src();
  assert.match(
    s,
    /profile\.marketplaceEnabled === false\s*\n?\s*\?\s*\[\]/,
    'categoryOptions must be [] when marketplaceEnabled is false — gated on ' +
      'the profile column, never on the type name',
  );
  assert.doesNotMatch(
    s,
    /eventType === ['"]simple_event['"]/,
    'must never key the category-options gate on the literal type name',
  );
});
