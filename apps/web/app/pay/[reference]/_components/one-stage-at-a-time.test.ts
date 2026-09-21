/**
 * ONE STAGE AT A TIME — and the proof form is not in the room before its turn.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚖ OWNER RULING, 2026-09-20: `/pay` is step by step, not one long scroll.
 * Measured that day: three `section.sn-tile` blocks rendered together, ~2,039px
 * tall, numbered like steps — including the proof-upload form for a payment
 * nobody had made yet.
 *
 * 🔑 THIS MOUNTS THE PANEL AND READS THE EMITTED HTML, because the whole point
 * of the ruling is about what is ON SCREEN. A resolver returning stage 2
 * changes nothing until something renders differently, and the repo has been
 * bitten by exactly that gap before (`hub-stage-renders.test.ts`).
 *
 * 🪤 `globalThis.React` IS SET BEFORE THE DYNAMIC IMPORTS AND IS NOT TIDINESS
 * TO BE REMOVED. tsconfig sets `"jsx": "preserve"` for Next, so `tsx` compiles
 * these components to the CLASSIC runtime — bare `React.createElement` with no
 * import of its own — and a static import would hoist above the assignment.
 * Precedent: `app/dashboard/[eventId]/launch/_components/hub-stage-renders.test.ts`.
 * ────────────────────────────────────────────────────────────────────────────
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { stripComments } from '@/lib/strip-comments';
import {
  FIRST_STAGE,
  PAY_STAGES,
  PROOF_STAGE,
  nextStage,
  parseStage,
  prevStage,
  shouldMountProof,
  stageHref,
  type PayStage,
} from '@/lib/pay-stages';

(globalThis as unknown as { React: unknown }).React = React;

/* ── `server-only` shim ──────────────────────────────────────────────────────
 * The panel imports `submitPaymentProof` from `../actions`, whose module graph
 * opens with `import 'server-only'` — a module Next supplies to the BUNDLER
 * that does not exist in node_modules, so a static import here dies with
 * MODULE_NOT_FOUND before one assertion runs. The import is a bundler
 * assertion with no runtime behaviour, and the real boundary is enforced
 * separately by `scripts/lint-server-only-boundary.mjs`, so resolving it to an
 * empty module is faithful rather than a shortcut. Same shim and same
 * reasoning as `app/[slug]/_components/editorial/recap-voice.test.ts`.
 *
 * 🪤 Registered at MODULE SCOPE with every component import kept DYNAMIC — a
 * static one hoists above this block and the shim never runs. */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_pay_stages__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return STUB;
    return original.call(this, request, ...rest);
  };
}


const RAIL = {
  mintedUrl: 'data:image/png;base64,MINTED',
  staticUrl: 'https://example.test/static.png',
  number: '09171234567',
  name: 'Setnayan',
  enabled: true,
};

async function paint(stage: PayStage, extra: Record<string, unknown> = {}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PayPanel } = await import('./pay-panel');
  return renderToStaticMarkup(
    React.createElement(PayPanel, {
      rechecked: false,
      setup: false,
      proofSent: false,
      resubmitNotice: null,
      requiresReference: true,
      amountPhp: 837.5,
      reference: 'SN9B7485DD',
      orderId: 'order-1',
      gcash: RAIL,
      bdo: RAIL,
      activatesLine: 'It switches on as soon as our team confirms the payment.',
      summary: React.createElement('div', null, 'SUMMARY-MARKER'),
      initialStage: stage,
      carryQuery: {},
      ...extra,
    } as never),
  );
}

/** A `<div hidden>` in the emitted markup — the stages that are not current. */
function hiddenCount(html: string): number {
  return (html.match(/<div hidden=""/g) ?? []).length;
}

// ── THE RULES, EXECUTED ─────────────────────────────────────────────────────

test('the stage comes from the address, and a bad one lands at the start', () => {
  assert.equal(parseStage('2'), 2);
  assert.equal(parseStage('3'), 3);
  assert.equal(parseStage(['3']), 3);
  // ⚠ A stale link, a typo or a truncated share must not 404 on a page whose
  // whole job is letting money reach us.
  for (const junk of [undefined, '', '0', '4', '-1', 'two', '3x']) {
    assert.equal(parseStage(junk), FIRST_STAGE, `${String(junk)} did not fall back`);
  }
});

test('back and forward stop at the ends instead of running off them', () => {
  assert.equal(nextStage(1), 2);
  assert.equal(nextStage(2), 3);
  assert.equal(nextStage(3), 3);
  assert.equal(prevStage(3), 2);
  assert.equal(prevStage(2), 1);
  assert.equal(prevStage(1), 1);
});

test('a stage link keeps every other parameter the page was opened with', () => {
  // ⚠ `?setup=1` is what makes this the last step of setting a celebration up.
  // Dropping it on a Continue link silently removes the "remove these extras"
  // door and the set-up discount framing.
  const href = stageHref('SN9B7485DD', 2, {
    setup: '1',
    recheck: 'Check your reference',
    error: undefined,
    sent: '',
  });
  assert.match(href, /^\/pay\/SN9B7485DD\?/);
  const q = new URL(href, 'https://x.test').searchParams;
  assert.equal(q.get('setup'), '1');
  assert.equal(q.get('recheck'), 'Check your reference');
  assert.equal(q.get('step'), '2');
  // Absent and empty are not carried as empty strings.
  assert.equal(q.get('error'), null);
  assert.equal(q.get('sent'), null);
  // Stage 1 is the bare address, so the canonical link has no `?step=1` on it.
  assert.equal(stageHref('SN9B7485DD', 1, {}), '/pay/SN9B7485DD');
  // An old `step` in the carried query never wins over the one asked for.
  assert.equal(stageHref('R', 3, { step: '1' }), '/pay/R?step=3');
});

test('the proof form is absent before its stage and never unmounted after', () => {
  assert.equal(shouldMountProof(1, false), false);
  assert.equal(shouldMountProof(2, false), false);
  assert.equal(shouldMountProof(3, false), true);
  // 🔑 THE HALF THAT PROTECTS WHAT THEY TYPED. Going back to re-read the code
  // must not empty the picked file and the digits, and a file input plus React
  // state both die on unmount with nothing on screen to say so.
  assert.equal(shouldMountProof(2, true), true);
  assert.equal(shouldMountProof(1, true), true);
});

// ── THE PIXELS ──────────────────────────────────────────────────────────────

test('exactly one stage is on screen at a time', async () => {
  for (const stage of [1, 2, 3] as const) {
    const html = await paint(stage);
    // Stage 1 and 2 are always mounted; stage 3 only from its own stage. So
    // the number of stages PRESENT is 2 before the proof stage and 3 at it,
    // and every one of them except the current must carry `hidden`.
    const present = stage === PROOF_STAGE ? 3 : 2;
    assert.equal(
      hiddenCount(html),
      present - 1,
      `at stage ${stage}, ${hiddenCount(html)} of ${present} stages are hidden — one and only one must be visible`,
    );
  }
});

test('the upload is not in the document until the proof stage', async () => {
  for (const stage of [1, 2] as const) {
    const html = await paint(stage);
    assert.doesNotMatch(
      html,
      /reference_last6/,
      `the reference field is in the document at stage ${stage}`,
    );
    // ⚠ ANCHORED ON THE DROPZONE'S OWN LABEL, NOT ON `name="screenshot_ref"`.
    // `<FileUpload>` mirrors its value into a hidden input that only EXISTS
    // once a file has been uploaded — so a `screenshot_ref` check is absent at
    // every stage, including its own, and would have passed here while proving
    // nothing. Measured before this line was written.
    assert.doesNotMatch(
      html,
      /Your payment screenshot/,
      `the screenshot upload is in the document at stage ${stage}`,
    );
    assert.doesNotMatch(html, /type="file"/, `a file input is in the document at stage ${stage}`);
  }
  const atProof = await paint(PROOF_STAGE);
  assert.match(atProof, /reference_last6/, 'the reference field never arrives');
  assert.match(atProof, /Your payment screenshot/, 'the screenshot upload never arrives');
  assert.match(atProof, /type="file"/, 'there is no file input on the proof stage');
});

test('the summary is the server’s, and it is stage one', async () => {
  const html = await paint(1);
  assert.match(html, /SUMMARY-MARKER/, 'stage 1 does not render the summary it was handed');
  // …and it is still there, merely hidden, when they move on — so coming back
  // to check the figure costs nothing.
  assert.match(await paint(3), /SUMMARY-MARKER/);
});

test('every advance control is a real link, so JavaScript is not required', async () => {
  for (const stage of [1, 2] as const) {
    const html = await paint(stage);
    const target = nextStage(stage);
    // 🪤 THE SPACE BEFORE `href` IS LOad-BEARING — measured. Without it this
    // assertion passes on `data-href="…"`, because that string CONTAINS
    // `href="…"`. A sabotage renaming the attribute (so the control needs
    // JavaScript, which is the whole thing being guarded) went undetected.
    assert.match(
      html,
      new RegExp(`\\shref="/pay/SN9B7485DD\\?step=${target}"`),
      `stage ${stage} offers no plain link to stage ${target}`,
    );
  }
  // And back, from every stage that has one behind it.
  const two = await paint(2);
  assert.match(two, /\shref="\/pay\/SN9B7485DD"/, 'stage 2 offers no plain link back to stage 1');
  const three = await paint(3);
  assert.match(three, /\shref="\/pay\/SN9B7485DD\?step=2"/, 'the proof stage offers no way back');
});

test('the manual fallback and the typed-amount line survived the split', async () => {
  const pay = await paint(2);
  // The route for anyone whose wallet refuses the code. Counted, because
  // "it is still in the file" is not "it is still on the paying stage".
  /**
   * ✏️ THE WORDS MOVED WITH THE COMPONENT (2026-09-20). Stage 2 used to write
   * its own "or send manually to"; it now renders the shared rails, whose
   * divider reads "or send to our number" (or "or transfer manually" on BDO).
   * Both spellings are accepted because the PROPERTY is a route that does not
   * need the camera — and the line below, which asserts the account number is
   * actually on the stage, is the half that proves the route exists at all.
   */
  assert.match(
    pay,
    /or send manually to|or send to our number|or transfer manually/,
    'the manual account fallback left stage 2',
  );
  assert.match(pay, /09171234567/, 'the account number left stage 2');
  assert.match(pay, /₱10/, 'the transfer-fee warning left stage 2');
  // The honest line about what the code carries — one resolver, still here.
  assert.match(pay, /carries ₱837\.50|carries no amount/, 'the QR truth line left stage 2');
  // And nobody is forced through three taps for a number: stage 1 offers them.
  const first = await paint(1);
  assert.match(first, /Show all the payment details/, 'the shortcut to the details is gone');
  assert.match(first, /09171234567/, 'stage 1 does not offer the account number');
});

test('the 24-hour promise did not fall out of the flow', async () => {
  const proof = await paint(PROOF_STAGE);
  assert.match(proof, /24\s*hours/, 'the "we confirm within 24 hours" promise is gone');
});

test('the page reads the stage out of the address', () => {
  const page = stripComments(
    readFileSync(join(process.cwd(), 'app', 'pay', '[reference]', 'page.tsx'), 'utf8'),
  );
  assert.match(page, /parseStage\(search\.step\)/, 'the server no longer paints the asked-for stage');
  assert.match(page, /carryQuery=\{\{/, 'the other query parameters are not carried');
});

test('META: the stage list is three, and only the last has no way onward', () => {
  // A fourth stage added with no advance label would strand somebody on it.
  assert.equal(PAY_STAGES.length, 3);
  for (const { n, advance, title } of PAY_STAGES) {
    assert.ok(title.trim().length > 0, `stage ${n} has no title`);
    if (n === PROOF_STAGE) assert.equal(advance, null);
    else assert.ok(advance && advance.trim().length > 0, `stage ${n} has no way onward`);
  }
});
