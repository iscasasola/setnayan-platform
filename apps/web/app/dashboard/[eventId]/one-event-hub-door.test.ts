import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addOnHref, appStoreDetailHref, ADD_ONS } from '@/lib/add-ons-catalog';

/**
 * one-event-hub-door.test.ts — the Event Hub is ONE page reached two ways.
 *
 * ─── THE RULING THIS HOLDS ───────────────────────────────────────────────
 * Owner, 2026-09-02, verbatim: *"do not use 2. i look at the roles of each. if
 * it is the same then adjust. Like in papic. when they enter an event, the menu
 * of papic description page becomes the control center of papic. i think that
 * should be the same for events hub."*
 *
 * The roles WERE the same and had been measured: `/website` declared
 * `metadata.title = 'Event Hub'` and called itself the calm landing for the
 * couple's public site; the catalog card keyed `landing-page` is labelled
 * "Event Hub" with the CTA "Open your Event Hub"; the event menu's own row
 * wears the word too. One name, one promise, one role, two doors.
 *
 * ─── WHY A GUARD AND NOT A COMMENT ───────────────────────────────────────
 * This exact collision was flagged for the owner in EH3 (see
 * `customer-nav-config.ts`) and survived in the tree for as long as it did
 * because nothing failed while it was true. A second surface re-claiming the
 * name is a silent regression: both pages render, neither 404s, and what a
 * person meets is one word offered twice. Nothing throws. So it is asserted.
 *
 * 🔑 ASKED OF THE REAL RESOLVERS, NEVER A COPY. The card's destination comes
 * from `appStoreDetailHref`/`addOnHref`, so a change to the catalog reaches
 * this test; re-typing `/launch` here would pin a string instead of a route.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(HERE, '..', '..');
const EVT = 'S89E-TESTEVENT';

/** Every `page.tsx` under `app/`, so no surface is out of the window. */
function everyPage(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) everyPage(full, out);
    else if (entry.name === 'page.tsx') out.push(full);
  }
  return out;
}

test('exactly ONE surface in the whole app declares the name "Event Hub"', () => {
  const pages = everyPage(APP_DIR);
  /*
    The window is every page in the app, not the two files this change touched.
    A guard scoped to the files under edit cannot see the surface somebody adds
    next month, which is the only way this defect ever comes back.
  */
  assert.ok(pages.length > 100, `only ${pages.length} pages found — the walk is not reaching them`);

  const claimants = pages.filter((p) =>
    /export const metadata\s*=\s*\{[^}]*title:\s*'Event Hub'/.test(fs.readFileSync(p, 'utf8')),
  );

  assert.equal(
    claimants.length,
    1,
    claimants.length === 0
      ? 'NO surface declares "Event Hub" — the controller lost its own name'
      : `${claimants.length} surfaces declare "Event Hub": ` +
        `${claimants.map((c) => path.relative(APP_DIR, c)).join(' · ')}. ` +
        'One word, two doors, is the defect the 2026-09-02 ruling closed.',
  );

  assert.equal(
    path.relative(APP_DIR, claimants[0]!),
    path.join('dashboard', '[eventId]', 'launch', 'page.tsx'),
    'the name moved off the controller — it belongs to the page that IS the control centre',
  );
});

test('the product card and the event-menu slot are the same door', () => {
  // Both entrances resolve through the catalog, so this fails if either is
  // repointed alone. The menu row's own href is pinned in
  // `studio-rows-are-lit.test.ts`, against the nav builder that produces it.
  assert.equal(addOnHref('landing-page', EVT), `/dashboard/${EVT}/launch`);
  assert.equal(appStoreDetailHref('landing-page', EVT), `/dashboard/${EVT}/launch`);

  // The card must still BE a card. Retiring the entry instead of repointing it
  // would leave raw slugs on the surfaces that read this catalog.
  const entry = ADD_ONS.find((a) => a.key === 'landing-page');
  assert.ok(entry, 'the landing-page entry was deleted rather than repointed');
  assert.equal(entry!.label, 'Event Hub');
  assert.ok(entry!.opensDirect, 'the card must open its surface, not an /about page');
});

test('the old /website hub keeps its route and lands on the controller', () => {
  /*
    Deleting the route would 404 what still points at it — the Website Pro
    band, the Papic crew page, guest-columns, the invite step, `/event-page`'s
    redirect, and every couple's bookmark. The stub is the shipped shape from
    `website/launch/page.tsx` (retired 2026-07-25).
  */
  const stub = fs.readFileSync(
    path.join(APP_DIR, 'dashboard', '[eventId]', 'website', 'page.tsx'),
    'utf8',
  );
  assert.match(stub, /redirect\(`\/dashboard\/\$\{eventId\}\/launch`\)/,
    '/website must redirect to the controller');
  assert.doesNotMatch(stub, /export const metadata/,
    '/website re-declared metadata — only the controller may carry the name');
});

test('every /website child route survived the merge', () => {
  /*
    ⛔ The children are the controller's doors, not casualties. Breaking one is
    a defect, not a simplification — so the whole set is enumerated rather than
    spot-checked, and a child that disappears fails here by name.
  */
  const CHILDREN = [
    'editor', 'editorial', 'our-story', 'privacy', 'hero-photo', 'colors',
    'dress-code', 'what-to-bring', 'widgets', 'site-chrome', 'living-hero',
    'photo-moments', 'our-photos', 'special-message', 'stories',
  ];
  const websiteDir = path.join(APP_DIR, 'dashboard', '[eventId]', 'website');
  for (const child of CHILDREN) {
    assert.ok(
      fs.existsSync(path.join(websiteDir, child, 'page.tsx')),
      `/website/${child} lost its page — it is one of the controller's doors`,
    );
  }
});
