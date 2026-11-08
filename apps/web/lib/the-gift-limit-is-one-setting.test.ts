/**
 * 🎁 THE GIFT LIMIT IS ONE SETTING — guard (THE ONE BUILD, lane C2; owner v112 answer, 8 Nov 2026: "Gift limit · % of
 * the booking fee", default 40, set in Admin › Gifts; spec plans/supplier_one_build_2026-11-08 §5.3, B2 §5 guard 1).
 *
 * The gift percentage used to be a constant typed in TS (`GIFT_SHARE_OF_FEE_PCT`), in SQL (`c_share_pct CONSTANT`)
 * and in rendered copy ("40% of …"). Now it is `platform_settings.gift_limit_pct`. A copy that still TYPES the number
 * tells a supplier 40% while the admin has set 25 — so:
 *   1. the old constant is gone from every source file;
 *   2. the ruled default lives in ONE place (`lib/setnayan-gift.ts`) and is read by the reader, the save and the
 *      sizing — nowhere else in app code;
 *   3. no rendered string in the gift surfaces types a gift %; the remaining typed strings in OTHER lanes' files are
 *      listed below and the list can only SHRINK (an entry whose file no longer types it fails, so it is removed);
 *   4. the LATEST SQL definition of setnayan_gift_for_fee(BIGINT) reads gift_limit_pct;
 *   5. the admin save is audited and clears the settings tag.
 *
 * Sabotage (run 2026-11-08): type "40%" back into quote-shop-gifts.tsx's limit line → test 3 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(import.meta.dirname, '..');
const REPO = join(WEB, '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}
const SOURCES = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib')), ...walk(join(WEB, 'components'))].map((p) =>
  relative(WEB, p),
);

/** Comments stripped (the ONE stripper) so a docblock that explains the history ("used to be 40%") is not a rendered string. */
const code = (src: string): string => stripComments(src);

/**
 * A typed gift percentage in code: the ruled default typed as a literal ("40%" / "40 %") whose surroundings (±300
 * characters, comments stripped) talk about a gift or Papic. A booking-fee rate ("5% booking fee") is not one.
 */
const TYPED_GIFT_PCT = {
  test(src: string): boolean {
    for (const m of src.matchAll(/\b40\s?%/g)) {
      const at = m.index ?? 0;
      const lineStart = src.lastIndexOf('\n', at) + 1;
      const line = src.slice(lineStart, src.indexOf('\n', at) === -1 ? undefined : src.indexOf('\n', at));
      if (/gradient\(|\b(?:circle|ellipse) at\b/.test(line)) continue; // a CSS position, not a share
      const near = src.slice(Math.max(0, at - 300), at + 300);
      if (/gift|papic/i.test(near)) return true;
    }
    return false;
  },
};

/**
 * ⏳ OTHER LANES' FILES that still type the share (C2 asked their owners to read `limitPct`; spec §9 #12 gives the
 * three service files to C4). This list may only SHRINK — an entry whose file no longer types a gift % fails test 3b
 * and must be deleted here.
 */
const STILL_TYPED_ELSEWHERE: ReadonlyArray<{ file: string; owner: string }> = [
  { file: 'app/vendor-dashboard/services/_components/services-manager.tsx', owner: 'C4' },
  { file: 'lib/gift-pick.ts', owner: 'C4 (card maker gift copy) — via the controller' },
  { file: 'lib/package-gift.ts', owner: 'C4 (packages) — via the controller' },
  { file: 'app/vendor-dashboard/services/_components/service-wizard.tsx', owner: 'C4' },
];

test('1 · the old constant GIFT_SHARE_OF_FEE_PCT is gone from every source file', () => {
  const left = SOURCES.filter((f) => /\bGIFT_SHARE_OF_FEE_PCT\b/.test(code(read(f))));
  assert.deepEqual(left, [], `still names the retired constant: ${left.join(', ')}`);
});

test('2 · the ruled default is named only where a value must fall back to it', () => {
  const allowed = new Set([
    'lib/setnayan-gift.ts', // its home
    'lib/gift-limit-settings.server.ts', // the reader's fallback
    'app/admin/gifts/gift-limit-actions.ts', // the save's "before" when the row has no value
    'app/dev/supplier-chat-lab/page.tsx', // a dev lab fixture
    'app/dev/supplier-plan-lab/page.tsx', // a dev lab fixture
  ]);
  const users = SOURCES.filter((f) => /\bGIFT_LIMIT_PCT_DEFAULT\b/.test(code(read(f))));
  const stray = users.filter((f) => !allowed.has(f));
  assert.deepEqual(stray, [], `names the default instead of the live limitPct: ${stray.join(', ')}`);
  assert.ok(users.includes('lib/gift-limit-settings.server.ts'), 'the reader must fall back to the ruled default');
});

test('3 · no gift surface in this lane types a gift % — the live limitPct is rendered', () => {
  const surfaces = [
    'app/_components/quote-shop-gifts.tsx',
    'app/admin/gifts/_components/shop-gifts-ledger.tsx',
    'app/admin/gifts/_components/gift-limit-form.tsx',
    'lib/papic-on-a-quote.ts',
    'lib/shop-gifts.ts',
  ];
  for (const f of surfaces) {
    assert.ok(!TYPED_GIFT_PCT.test(code(read(f))), `${f} types a gift percentage — render the live limitPct`);
  }
  assert.match(read('app/_components/quote-shop-gifts.tsx'), /\{basis\.limitPct\}%/, 'the limit line renders basis.limitPct');
  assert.match(read('app/admin/gifts/_components/shop-gifts-ledger.tsx'), /\{giftLimitPct\}%/);
});

test('3b · the list of other lanes still typing it only shrinks', () => {
  for (const { file, owner } of STILL_TYPED_ELSEWHERE) {
    assert.ok(
      TYPED_GIFT_PCT.test(code(read(file))),
      `${file} (${owner}) no longer types a gift % — delete it from STILL_TYPED_ELSEWHERE`,
    );
  }
  // lib/ugat/graph.ts holds documentation claims about the schema (controller-only, never rendered).
  const typed = SOURCES.filter((f) => f !== 'lib/ugat/graph.ts' && TYPED_GIFT_PCT.test(code(read(f))));
  const listed = new Set(STILL_TYPED_ELSEWHERE.map((e) => e.file));
  const unlisted = typed.filter((f) => !listed.has(f));
  assert.deepEqual(unlisted, [], `a NEW typed gift % appeared: ${unlisted.join(', ')} — read limitPct instead`);
});

test('4 · the LATEST setnayan_gift_for_fee(BIGINT) reads platform_settings.gift_limit_pct', () => {
  const dir = join(REPO, 'supabase', 'migrations');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const latest = files.filter((f) =>
    /CREATE OR REPLACE FUNCTION public\.setnayan_gift_for_fee\(p_fee_centavos BIGINT\)/.test(readFileSync(join(dir, f), 'utf8')),
  );
  const last = latest[latest.length - 1]!;
  const sql = readFileSync(join(dir, last), 'utf8');
  const body = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.setnayan_gift_for_fee(p_fee_centavos BIGINT)'));
  assert.match(body.slice(0, body.indexOf('$$;')), /gift_limit_pct/, `${last} re-types the share`);
  assert.doesNotMatch(body.slice(0, body.indexOf('$$;')), /c_share_pct\s+CONSTANT/);
});

test('5 · the admin save is the one writer: admin-gated, audited, clears the settings tag', () => {
  const src = read('app/admin/gifts/gift-limit-actions.ts');
  assert.match(src, /requireAdminAction\(\)/);
  assert.match(src, /action: 'gift_limit_pct_edit'/);
  assert.match(src, /revalidateTag\(GLOBAL_SETTINGS_TAGS\.platformSettings\)/);
  assert.match(src, /Number\.isInteger\(pct\) \|\| pct < 0 \|\| pct > 100/);
  const writers = SOURCES.filter((f) => /gift_limit_pct\s*:/.test(code(read(f))) && /\.update\(/.test(read(f)));
  assert.deepEqual(writers, ['app/admin/gifts/gift-limit-actions.ts'], `writers of gift_limit_pct: ${writers.join(', ')}`);
});
