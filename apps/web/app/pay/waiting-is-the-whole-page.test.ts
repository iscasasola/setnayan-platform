/**
 * waiting-is-the-whole-page.test.ts
 *
 * Owner, 2026-08-28, on the pay page after sending his proof: *"After I paid, it
 * should say we are currently verifying your purchase. kindly wait within 24
 * hours. (1) and (2) must not show anymore."*
 *
 * 🔴 WHY THIS IS NOT TIDINESS. The page kept rendering "Scan the code with your
 * GCash or bank app" and "Pay this exact amount", with a live QR and an "I've
 * paid" button, UNDERNEATH a notice saying we were checking his payment. It was
 * telling somebody who had already paid to pay. **The worst outcome of that
 * sentence is that they pay twice**, into a rail we reconcile by hand.
 *
 * ⚖ AND IT MUST COME BACK BY ITSELF. A refused proof (`needsBetterProof`) puts
 * `waiting` back to false, so the code, the amount and the form all return for
 * the person we just asked for a clearer picture. A one-way door here would
 * strand somebody mid-payment with no way to finish.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const web = process.cwd();
const PAGE = readFileSync(join(web, 'app/pay/[reference]/page.tsx'), 'utf8');
const stripComments = (src: string) =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
const SRC = stripComments(PAGE);

test('one name decides it, built from the proof state and the post-form redirect', () => {
  assert.match(
    SRC,
    /const waiting = proofSent \|\| \(search\.sent === '1' && !needsBetterProof\)/,
    'the waiting state must cover the redirect arm too, or the page flickers back '
      + 'to "pay now" for the seconds before the proof row is readable',
  );
});

test('🔴 every instruction to pay is gone while we are checking', () => {
  // The three-step "What happens next" list.
  assert.match(
    SRC,
    /\{!waiting && \([\s\S]{0,200}?What happens next/,
    'the scan/screenshot/activates steps must not render while we are checking',
  );
  // The whole pay panel — the QR, the channel tabs and the "I've paid" button.
  assert.match(
    SRC,
    /\{!waiting && \(\s*<PayPanel/,
    'the QR and the proof form must not render while we are checking',
  );
});

test('the notice says what he asked it to say', () => {
  assert.match(SRC, /We&rsquo;re verifying your purchase/, 'the words he gave');
  assert.match(SRC, /up to 24 hours/, 'and the window');
  assert.match(SRC, /\{waiting && \(/, 'shown only in that state');
});

test('what survives is what a waiting person still needs', () => {
  // Not an empty page: the reference is the number they will quote if they have
  // to ask us about it, and the amount is what they will check it against.
  assert.match(SRC, /payable\.reference/, 'the reference must stay readable');
  assert.match(SRC, /peso\(payable\.amountPhp\)/, 'and so must the amount');
});

test('🪤 the panel is not merely told the proof is in — it is not rendered', () => {
  // Passing proofSent to a mounted panel still draws step 2's heading, the
  // channel tabs and the sticky "Back to the code" bar. The fix is the mount.
  assert.doesNotMatch(
    SRC,
    /proofSent=\{proofSent \|\| \(search\.sent/,
    'the old wiring rendered the pay card and merely swapped its last section',
  );
  assert.match(SRC, /proofSent=\{false\}/, 'inside !waiting the proof is by definition not in');
});
