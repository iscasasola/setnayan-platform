/**
 * GUARD — every surface that shows a guest their code offers a way to keep it.
 *
 * 🪤 THE TRAP. Three separate screens draw the guest's invitation QR: the
 * invitation QR card on the event page, the My QR modal in the guest hub bar,
 * and the Me panel of the day-of hub. They were built at different times by
 * different hands, none of them imports the others, and all three independently
 * ended up showing a code with no way to save it — one of them while printing
 * the words "Save this to your phone."
 *
 * Adding the affordance to each by hand would be three chances to forget one,
 * and the fourth surface makes four. So the pair of buttons is ONE component
 * and this test asks the only question that catches the regression: does every
 * screen that renders a QR also render the keepers?
 *
 * ⚠ A NEW QR SURFACE FAILS THIS TEST ON PURPOSE. That is not noise — it is the
 * test asking whether the new screen leaves a guest looking at a code they
 * cannot take with them. Mount GuestCodeKeepers, or add a reasoned line here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SLUG_ROOT = resolve(HERE, '..');

/** Comments stripped — a guard must never pass on the prose explaining it. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/**
 * Surfaces that render a guest's personal invitation QR and are deliberately
 * NOT expected to carry the keepers. Each needs a reason, not just a path.
 */
const EXEMPT: Record<string, string> = {
  // The print sheet IS the keeping mechanism — it exists to be sent to a
  // printer. A "save the code" button on a page built for printing is noise.
  'print/print-sheet.tsx': 'the whole page is a printable artefact',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

test('every guest-facing QR surface renders GuestCodeKeepers', () => {
  const offenders: string[] = [];
  let surfacesChecked = 0;

  for (const file of walk(SLUG_ROOT)) {
    const rel = file.slice(SLUG_ROOT.length + 1);
    const code = stripComments(readFileSync(file, 'utf8'));

    // A guest's PERSONAL QR, specifically — the one built from their token.
    // The event's master QR is anonymous and has nothing to keep.
    const showsPersonalQr = code.includes('__html: qrSvg') && code.includes('invitationUrl');
    if (!showsPersonalQr) continue;

    if (rel in EXEMPT) continue;
    surfacesChecked += 1;
    // `<GuestCodeKeepers`, not `GuestCodeKeepers` — the bare identifier is
    // satisfied by the surviving import line, so deleting the JSX left this
    // guard green on all three surfaces when it was first mutation-tested.
    if (!code.includes('<GuestCodeKeepers')) offenders.push(rel);
  }

  // The count is asserted so this can never quietly become a test of nothing —
  // a refactor that renames qrSvg would otherwise sweep zero files and pass.
  assert.ok(
    surfacesChecked >= 3,
    `expected at least 3 guest QR surfaces, found ${surfacesChecked} — has the detection drifted?`,
  );
  assert.deepEqual(
    offenders,
    [],
    `these show a guest their code with no way to keep it: ${offenders.join(', ')}`,
  );
});

test('the invitation card no longer promises a save it cannot deliver', () => {
  const body = stripComments(readFileSync(resolve(SLUG_ROOT, '_components/site-body.tsx'), 'utf8'));
  const promises = body.includes('Save this to your phone');
  const delivers = body.includes('<GuestCodeKeepers');
  // Either the sentence goes or the button exists. Shipping the sentence alone
  // is the defect this whole change is about.
  assert.ok(
    !promises || delivers,
    'the card says "Save this to your phone" with no GuestCodeKeepers to make it true',
  );
});

test('the keepers point at the guest download route, and it takes no id', () => {
  const src = stripComments(
    readFileSync(resolve(SLUG_ROOT, '_components/guest-code-keepers.tsx'), 'utf8'),
  );
  assert.ok(src.includes('/api/guest/qr'), 'save must point at the guest-session route');
  assert.ok(
    !/\/api\/guest\/qr[^'"`\s]/.test(src),
    'no id, token or query may be appended — the cookie is the whole credential',
  );
  assert.ok(src.includes('download'), 'the link must carry the download attribute');
  // The paid branded PNG is a different file behind an ownership gate; pointing
  // a free guest button at it would 401 or 403 every guest who pressed it.
  assert.ok(
    !src.includes('/api/website/qr/guest'),
    'the guest button must not point at the gated branded-PNG route',
  );
});

test('a failed copy says so instead of looking like a success', () => {
  const src = stripComments(
    readFileSync(resolve(SLUG_ROOT, '_components/guest-code-keepers.tsx'), 'utf8'),
  );
  assert.ok(src.includes("'failed'"), 'the copy button must have a failure state');
  assert.ok(src.includes('role="alert"'), 'the failure must be announced, not silent');
});
