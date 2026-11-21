/**
 * 💳 Step 1 of /pay/<ref> never promises the BDO route while Maya is the pay stage (controller 22 Nov, live on
 * SN1E342727): no "Scan the code", no "Upload the screenshot", no "as soon as our team confirms", no transfer note.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BDO_UPLOAD_STEP, MAYA_NEXT_STEPS, payNextSteps } from '@/lib/pay-next-steps';

const bdo = {
  scanStep: 'Scan the code with your GCash or bank app — the amount fills in for you.',
  note: 'Put SN1E342727 in the transfer note — it is how we match your payment to your account.',
  activates: 'It switches on as soon as our team confirms the payment.',
};

test('Maya open: the Maya route, and none of the BDO-only lines', () => {
  const n = payNextSteps({ maya: true, isVendorPlan: false, bdo });
  assert.deepEqual(n.steps, [MAYA_NEXT_STEPS.pay, MAYA_NEXT_STEPS.back, MAYA_NEXT_STEPS.activates]);
  assert.equal(n.note, null, 'no transfer note on the Maya route');
  const all = n.steps.join(' ');
  for (const bdoOnly of [/scan the code/i, /upload the screenshot/i, /our team confirms/i, /transfer note/i]) {
    assert.doesNotMatch(all, bdoOnly);
  }
  assert.equal(payNextSteps({ maya: true, isVendorPlan: true, bdo }).steps[2], MAYA_NEXT_STEPS.activatesPlan);
});

test('Maya closed (off, no keys, busy, above the ceiling): the shipped BDO words, untouched', () => {
  const n = payNextSteps({ maya: false, isVendorPlan: false, bdo });
  assert.deepEqual(n.steps, [bdo.scanStep, BDO_UPLOAD_STEP, bdo.activates]);
  assert.equal(n.note, bdo.note);
});

test('the page decides step 1 with the SAME mayaOpen it hands the pay panel', () => {
  const src = readFileSync(join(process.cwd(), 'app/pay/[reference]/page.tsx'), 'utf8');
  assert.match(src, /summary=\{summaryFor\(mayaOpen\)\}/, 'the pay panel gets step 1 for the route mayaOpen picked');
  assert.match(src, /data-pay-maya-checking-page="">\s*\{summaryFor\(true\)\}/, 'back from Maya: the Maya words');
  assert.doesNotMatch(src, /<Step n=\{2\}>Upload the screenshot/, 'the upload line is not typed into the page any more');
  assert.doesNotMatch(src, /\{words\.note\}/, 'the transfer note is drawn only through payNextSteps');
});
