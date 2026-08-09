/**
 * GUARD — every server rejection must name the step that owns the field.
 *
 * Owner 2026-08-10 restructured onboarding into four steps, one question each.
 * The wizard holds all four on ONE always-mounted form and nothing is written
 * until the final submit — so if the server rejects a field and does not say
 * WHICH step it belongs to, the wizard remounts at step 1 and **silently
 * discards everything typed on later steps**.
 *
 * 🔑 THE COST OF GETTING THIS WRONG QUADRUPLED WITH THE RESTRUCTURE. Under two
 * steps a mis-pointed rejection threw away one screen. Under four, a step-4
 * rejection landing on step 1 throws away three — including the map pin, which
 * is the most effortful thing on the whole flow.
 *
 * It is guarded by reading the source rather than by running the action because
 * `becomeVendor` calls `redirect()`, which throws a Next.js control-flow signal;
 * asserting on that is asserting on a framework internal. The mapping is a flat,
 * literal fact in the file — the right shape to read directly.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ACTIONS = readFileSync('app/open-shop/actions.ts', 'utf8');
const WIZARD = readFileSync('app/open-shop/_components/open-shop-wizard.tsx', 'utf8');
const PAGE = readFileSync('app/open-shop/page.tsx', 'utf8');

/** Which step each shared error string belongs to. */
const OWNS: Record<string, number> = {
  shopName: 1,
  logo: 1,
  slugShape: 1,
  slugTaken: 1,
  service: 2,
  contactName: 3,
  contactPhone: 3,
  contactEmail: 3,
  locationCity: 4,
};

test('META: every error the action redirects with is accounted for here', () => {
  // Without this, a NEW rejection could be added with no step and this suite
  // would keep passing — it would simply never look at it.
  const used = new Set(
    [...ACTIONS.matchAll(/OPEN_SHOP_ERRORS\.([A-Za-z]+)/g)].map((m) => m[1]!),
  );
  const unmapped = [...used].filter((k) => !(k in OWNS));
  assert.deepEqual(
    unmapped,
    [],
    `these rejections have no step in this test: ${unmapped.join(', ')} — add them, ` +
      'or a vendor gets bounced to step 1 and loses everything they typed after it',
  );
});

test('each rejection carries the step that owns its field', () => {
  const wrong: string[] = [];
  for (const [key, step] of Object.entries(OWNS)) {
    const re = new RegExp(
      `redirect\\(\\s*'/open-shop\\?([^']*)'\\s*\\+\\s*encodeURIComponent\\(OPEN_SHOP_ERRORS\\.${key}\\)`,
    );
    const m = re.exec(ACTIONS);
    if (!m) continue; // not every string is used on a redirect path
    const qs = m[1]!;
    if (!qs.includes(`step=${step}`)) {
      wrong.push(`${key}: expected step=${step}, redirect carries "${qs}"`);
    }
  }
  assert.deepEqual(
    wrong,
    [],
    'a rejection points at the wrong step — the vendor lands on a screen that ' +
      'does not contain the field being complained about, and loses the ones ' +
      `after it:\n  ${wrong.join('\n  ')}`,
  );
});

test('the page accepts every step the action can send', () => {
  // The other half: the action can emit step=4, but if the page only parses
  // '1' | '2' it silently falls back to 1 and the redirect achieves nothing.
  for (const n of ['1', '2', '3', '4']) {
    assert.ok(
      PAGE.includes(`'${n}'`),
      `page.tsx does not parse step=${n} — the action's redirect would fall back to step 1`,
    );
  }
});

test('the wizard renders exactly four panels, and only the last one submits', () => {
  for (const n of [1, 2, 3, 4]) {
    assert.ok(
      WIZARD.includes(`step === ${n} ? 'space-y-4' : 'hidden'`),
      `panel for step ${n} is missing`,
    );
  }
  assert.ok(!WIZARD.includes('step === 5'), 'a fifth panel appeared without updating TOTAL_STEPS');
  // A SubmitButton on an earlier step would post a half-filled form. It must sit
  // in the `step < TOTAL_STEPS ? … : …` false branch — i.e. after the Continue.
  const cont = WIZARD.indexOf('step < TOTAL_STEPS');
  const submit = WIZARD.indexOf('<SubmitButton');
  assert.ok(cont !== -1 && submit > cont, 'the submit button is not gated behind the last step');
});

test('the removed chrome has not crept back', () => {
  // Owner: "remove these kind of details: (less is more)". Comments are stripped
  // first — the tombstones naming what was removed must not fail their own rule.
  // JSX comments, /* block */ comments AND /** docblocks */ all come out. The
  // tombstones deliberately NAME what was removed; a rule that failed on its own
  // explanation would push the next person to delete the explanation.
  const visible = WIZARD.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  for (const gone of ['Free during launch', 'How couples reach you', 'Step {step} of']) {
    assert.ok(!visible.includes(gone), `"${gone}" is back on the form`);
  }
  assert.ok(!/from 'lucide-react';[\s\S]{0,80}Store/.test(WIZARD), 'the shop icon is back');
});
