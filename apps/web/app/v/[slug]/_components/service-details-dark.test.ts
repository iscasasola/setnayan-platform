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
 * it has always been — no wrapper button, no affordance, no dialog mounted, and
 * the inquiry composer must keep opening on `activeServices[0]` with no window
 * listener attached. Restore the guard rather than deleting the assertion.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const gallery = readFileSync(join(here, 'services-gallery.tsx'), 'utf8');
const composer = readFileSync(join(here, 'inquiry-composer.tsx'), 'utf8');
const page = readFileSync(join(here, '..', 'page.tsx'), 'utf8');
const action = readFileSync(join(here, '..', 'inquiry-actions.ts'), 'utf8');
const lockModal = readFileSync(
  join(here, '..', '..', '..', '_components', 'vendor-packages', 'lock-modal.tsx'),
  'utf8',
);

/** The class string the shipped card has always carried. */
const SHIPPED_CARD_CLASSES =
  "'flex h-full flex-col rounded-xl border border-ink/10 bg-cream p-4'";

test('the gallery defaults the flag OFF — a caller that forgets it gets today', () => {
  assert.match(
    gallery,
    /detailsEnabled = false/,
    'ServicesGallery must default detailsEnabled to false',
  );
});

test('ServiceCardView is flag-gated, and OFF is the byte-identical static div', () => {
  assert.match(
    gallery,
    /function ServiceCardView\(\{[\s\S]{0,200}?detailsEnabled/,
    'ServiceCardView must take detailsEnabled',
  );
  // The OFF branch is the literal class string that ships today. Written as an
  // explicit literal (not a conditional suffix) precisely so this can be pinned.
  assert.ok(
    gallery.includes(SHIPPED_CARD_CLASSES),
    'the flag-OFF card must keep the exact shipped class string',
  );
  // The clip is lifted above the stretched overlay ONLY when the flag is on —
  // otherwise its class string must be untouched too.
  assert.ok(
    gallery.includes("'mt-2 max-h-44 w-full rounded-lg bg-ink/5 object-cover'"),
    'the flag-OFF clip must keep the exact shipped class string',
  );
});

test('the doorway, the affordance and the sheet are ALL behind the flag', () => {
  // The stretched overlay button.
  assert.match(
    gallery,
    /\{detailsEnabled \? \(\s*<button/,
    'the stretched doorway button must be behind detailsEnabled',
  );
  // The visible "View details" affordance.
  assert.match(
    gallery,
    /\{detailsEnabled \? \(\s*<p/,
    'the View details affordance must be behind detailsEnabled',
  );
  // The dialog itself — mounted only when the flag is on AND a card is open.
  assert.match(
    gallery,
    /\{detailsEnabled && openCard \? \(\s*<ServiceDetailsSheet/,
    'the details sheet must be behind detailsEnabled',
  );
});

test('the composer keeps activeServices[0] until the server hands it per-service context', () => {
  assert.match(
    composer,
    /serviceDetails = \[\]/,
    'serviceDetails must default to [] so the shipped call sites are unchanged',
  );
  // No per-service context ⇒ no window listener at all.
  assert.match(
    composer,
    /if \(detailById\.size === 0\) return;\s*\n\s*return onServiceInquiryFocus\(/,
    'the focus bus must not be subscribed when there is no per-service context',
  );
  // And the focused service can only ever be one the SERVER serialized.
  assert.match(
    composer,
    /const detail = detailById\.get\(id\);\s*\n\s*if \(!detail\) return;/,
    'an unknown service id from the bus must be ignored, never trusted',
  );
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
