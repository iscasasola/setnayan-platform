/**
 * REGRESSION GUARD — the service-details wave must stay DARK until the owner
 * flips `NEXT_PUBLIC_SERVICE_DETAILS_ENABLED`.
 *
 * WHY A STRUCTURAL TEST. This package tests with `node:test` and has no
 * DOM/RTL, so these components cannot be rendered here. But the failure worth
 * catching is not "does the sheet open" — it is the one this repo has hit
 * before: a flag-dark surface that is only dark by CONVENTION, so a later edit
 * quietly makes it live in production and no test goes red (see
 * `feedback_verify_the_consumer_not_just_tests` — hardcoding a flag true breaks
 * NO test). The three claims below are exactly the ones that make "flag off ⇒
 * byte-identical" true, so they are pinned as source facts.
 *
 * IF YOU ARE HERE BECAUSE THIS TEST FAILED: the flag is not decoration. With it
 * off, the public vendor profile's service card must be the same static `<div>`
 * it has always been — no wrapper button, no affordance, no dialog mounted.
 * (The inquiry composer this once also pinned was retired 2026-11-13.) Restore the guard rather than deleting the assertion.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// `ServiceCardView` moved to `app/_components/service-card-view.tsx` (2026-09-08)
// so the vendor's card list could render the identical card. Read BOTH: the
// gallery still owns the grouping/filtering, the view owns the card itself, and
// every claim below is about one or the other.
const gallery =
  readFileSync(join(here, 'services-gallery.tsx'), 'utf8') +
  readFileSync(join(here, '../../../_components/service-card-view.tsx'), 'utf8');
// 2026-11-12 ONE SERVICE CARD (owner: "Yes, build it"): the card itself is drawn by the one face; the view only maps
// data in and decides the DOOR. The face and its client door button are read too, so the gate is pinned end to end.
const face =
  readFileSync(join(here, '../../../_components/service-face.tsx'), 'utf8') +
  readFileSync(join(here, '../../../_components/service-face-door.tsx'), 'utf8');
// `toServiceCard` — and the conditional spread that keeps details-only keys out
// of the flag-OFF payload — moved to `lib/service-card-view-model.ts` on
// 2026-09-08. Read both: the page still owns the section, the builder owns the
// payload shape.
const page =
  readFileSync(join(here, '..', 'page.tsx'), 'utf8') +
  readFileSync(join(here, '../../../../lib/service-card-view-model.ts'), 'utf8');
const action = readFileSync(join(here, '..', 'inquiry-actions.ts'), 'utf8');
const lockModal = readFileSync(
  join(here, '..', '..', '..', '_components', 'vendor-packages', 'lock-modal.tsx'),
  'utf8',
);

test('the gallery defaults the flag OFF — a caller that forgets it gets today', () => {
  assert.match(
    gallery,
    /detailsEnabled = false/,
    'ServicesGallery must default detailsEnabled to false',
  );
});

test('ServiceCardView is flag-gated, and OFF is a card with NO control on it', () => {
  assert.match(
    gallery,
    /function ServiceCardView\(\{[\s\S]{0,200}?detailsEnabled/,
    'ServiceCardView must take detailsEnabled',
  );
  // 2026-11-12: the shipped text-first card (its class string, its clip) was retired by the owner for the one face —
  // so "byte-identical" became "no control": with the flag OFF the view hands the face NO door at all.
  assert.match(
    gallery,
    /const door: ServiceFaceDoor \| undefined = !detailsEnabled\s*\?\s*undefined/,
    'with the flag OFF the card must get no door',
  );
  assert.match(gallery, /door=\{door\}/, 'the view must hand the face exactly the gated door');
  // The clip is not on the small card any more (it lives in the Service card grown).
  assert.doesNotMatch(gallery.slice(gallery.indexOf('export function ServiceCardView')), /<video\b/);
});

test('the doorway, the affordance and the sheet are ALL behind the flag', () => {
  // The door is either a LINK (an address) or the client BUTTON (a callback) — both only when the view handed one in,
  // and the view hands one in only behind detailsEnabled (pinned above).
  assert.match(face, /\{door && 'href' in door \? \(\s*<Link/, 'the stretched doorway LINK must only render for a door');
  assert.match(face, /\) : door \? \(\s*<ServiceFaceDoorButton/, 'the stretched doorway button must only render for a door');
  // Neither control may exist anywhere else in the card.
  assert.equal(
    (face.match(/absolute inset-0 rounded-2xl/g) ?? []).length,
    2,
    'a third full-card control appeared, or one lost its gate',
  );
  // No separate "View details" affordance any more — the whole face is the door (owner 12 Nov).
  assert.doesNotMatch(gallery + face, /View details\s*</, 'a visible View details affordance came back');
  // The dialog itself — mounted only when the flag is on AND a card is open.
  assert.match(
    gallery,
    /\{detailsEnabled && openCard \? \(\s*<ServiceDetailsSheet/,
    'the details sheet must be behind detailsEnabled',
  );
});

// 13 Nov 2026 (owner, "Yes, only one"): the inline InquiryComposer — the only listener on the service-inquiry focus
// bus — was retired with the shop page's second Inquire, and its file deleted. Its own claims (activeServices[0]
// default, a listener only with per-service context) went with it. What must stay true: the page never asks the grown
// card for 'focus', because with no listener that button would do nothing — worse than no button.
test('the page never hands the details sheet a focus mode no composer listens to', () => {
  assert.doesNotMatch(page, /inquireMode=\{[^}]*'focus'/, "the page passes 'focus' but nothing listens on the focus bus");
});

test('the flag-OFF card payload carries NEITHER details-only key', () => {
  // "Byte-identical when off" has to cover the serialized RSC payload the
  // browser downloads, not just the rendered DOM. A conditional SPREAD is the
  // only shape that keeps the keys absent; `publicId: …` / `inclusionsFull: []`
  // defaults would ship two extra keys per card to every anonymous visitor.
  assert.match(
    page,
    /\.\.\.\(detailsEnabled\s*\n?\s*\?\s*\{\s*\n?\s*publicId: row\.public_id,/,
    'publicId + inclusionsFull must be behind a conditional spread',
  );
  // …and neither may appear unconditionally in the returned card literal.
  assert.doesNotMatch(
    page,
    /\n {4}publicId: row\.public_id,/,
    'publicId must not be serialized at the top level of the card literal',
  );
  assert.doesNotMatch(
    page,
    /\n {4}inclusionsFull:/,
    'inclusionsFull must not be serialized at the top level of the card literal',
  );
});

test('the package ask-target comes from the package anchor — NEVER services[0]', () => {
  // Falling back to the vendor's first active service files a hotel's wedding
  // package under whatever card happens to be first, and that wrong interest
  // seed then feeds the vendor's read of the couple, the shortlist and the
  // build. A missing doorway is better than a wrong signal.
  assert.match(
    page,
    /const match = activeServices\.find\(\s*\n?\s*\(s\) => s\.category === pkg\.primary_canonical_service,\s*\n?\s*\);/,
    'the ask target must resolve from pkg.primary_canonical_service',
  );
  assert.doesNotMatch(
    page,
    /\?\?\s*\n?\s*activeServices\[0\]\s*\n?\s*\?\?\s*\n?\s*null;/,
    'the activeServices[0] fallback must stay deleted',
  );
});

test('🪞 the option-row note the message mirrors is still the one on screen', () => {
  // `lib/package-picks-summary.ts` renders `+₱delta` iff `delta > 0`, mirroring
  // this JSX. If the modal's rule changes, the message silently starts saying
  // something the screen does not — so the replicated condition is pinned here.
  assert.match(
    lockModal,
    /\{!selectable \|\| opt\.price_delta_centavos > 0 \? \(/,
    'the option row must still annotate only on !selectable OR a positive delta',
  );
  assert.match(
    lockModal,
    /`\+\$\{formatCentavosPhp\(opt\.price_delta_centavos\)\}`/,
    'the option row must still print +₱<delta> for a priced option',
  );
});

test('🚨 the build message reports delivery — it is never assumed', () => {
  // The regression this pins: the picks send was wrapped in a swallow-all
  // try/catch while `startServiceInquiry` returned { status: 'ok' } regardless,
  // so a couple whose pre-accept follow-up allowance was spent was told "your
  // build is in the message" and then waited on a quote nobody received.
  assert.match(
    action,
    /import \{ sendChatMessageCore \} from '@\/lib\/chat-send';/,
    'the build path must use the core (a discriminated result), not the throwing action',
  );
  assert.match(
    action,
    /status: 'ok_build_not_sent'/,
    'a build that did not post must NOT be reported as ok',
  );
  assert.match(
    action,
    /buildDelivery = await postThreadMessage\(/,
    'the append path must capture the send outcome',
  );
  assert.doesNotMatch(
    action,
    /await sendChatMessage\(msg\);/,
    'the throw-and-swallow send must stay deleted',
  );
  // …and the modal must have a state that is NOT "sent" to render it into.
  assert.match(
    lockModal,
    /\{ kind: 'not_sent'; threadHref: string; message: string \}/,
    'the modal must carry a distinct not-sent state',
  );
  assert.match(
    lockModal,
    /result\.status === 'ok_build_not_sent'/,
    'the modal must handle the not-sent status explicitly',
  );
});

test('the lock modal shows nothing new until the page hands it an ask target', () => {
  assert.match(
    lockModal,
    /ask = null,/,
    'the ask prop must default to null so the modal is byte-identical today',
  );
  assert.match(
    lockModal,
    /\{ask \?/,
    'the secondary action must be behind the ask prop',
  );
  // The message must never carry a number this modal did not already show.
  assert.match(
    lockModal,
    /bookingTotalCentavos: totals\?\.bookingTotalCentavos \?\? null/,
    'the picks summary must reuse the modal’s own displayed total',
  );
  assert.match(
    lockModal,
    /surchargeCentavos,/,
    'the picks summary must reuse the modal’s own "Upgrades picked" figure',
  );
});

/**
 * ── AND THE SHOP'S OWN PAGE NEVER HARDCODES THE FLAG ───────────────────────
 * `ServiceCardView` can now be a doorway WITHOUT the flag (the marketplace's
 * link half, which navigates to an address that already exists and opens no
 * sheet). That makes it newly possible to switch the /v/[slug] sheet on by
 * accident — `detailsEnabled` there must stay the value the SERVER read from
 * `serviceDetailsEnabled()`, never a literal.
 */
test('the shop page passes the FLAG down, never a hardcoded true', () => {
  const galleryOnly = readFileSync(join(here, 'services-gallery.tsx'), 'utf8');
  assert.match(
    galleryOnly,
    /detailsEnabled=\{detailsEnabled\}/,
    'the gallery stopped passing its own detailsEnabled to the card',
  );
  assert.ok(
    !/detailsEnabled(=\{true\}|\s*=\s*true\b)/.test(galleryOnly) &&
      !/<ServiceCardView[^>]*\bdetailsEnabled\b\s*(\/?>|\n)/.test(galleryOnly),
    'the shop page hardcodes the details flag ON — the sheet would go live ' +
      'without the owner flipping NEXT_PUBLIC_SERVICE_DETAILS_ENABLED',
  );
  const pageOnly = readFileSync(join(here, '..', 'page.tsx'), 'utf8');
  assert.ok(
    !/detailsEnabled=\{true\}/.test(pageOnly),
    'the shop page hardcodes detailsEnabled true',
  );
});
