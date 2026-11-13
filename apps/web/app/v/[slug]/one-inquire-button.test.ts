/**
 * Guard: a vendor's public page never shows the same Inquire button twice.
 *
 * The bug (owner spotted it, 2026-08-06): the cinematic hero — the top-plan
 * full-bleed cover with the shop's name across it — carries its own Inquire
 * button. The action row a few centimetres below carried a second, identical
 * one. The block between them already suppresses the name and tagline when that
 * hero renders, precisely because the hero shows them; the BUTTON was missed.
 *
 * So the shops paying the most were the only ones with a duplicated call to
 * action, and nothing failed: both buttons worked and scrolled to the same
 * place. A visual duplicate has no natural detector — CI cannot see a page —
 * so it gets a structural one here.
 *
 * 13 Nov 2026 (owner, "Yes, one main button"; prototype public_pages_three_2026-11-13): the hero carries NO buttons on
 * any verified shop — Inquire is the ONE filled button, in the calling card, on every look. So the count is now one,
 * and nothing gates it on the hero. Add to your event sits beside it as a ghost; Lock lives only on package cards.
 *
 * 🔑 Share is deliberately NOT suppressed with it. The hero has no Share
 * button, so dropping the whole action row would leave a top-plan shop with no
 * way to be shared at all — trading a cosmetic duplicate for a lost feature.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(HERE, 'page.tsx'), 'utf8');

/** Source with comments removed, so assertions test CODE not the prose above. */
const code = src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('the page has exactly ONE Inquire button label — the calling card\'s', () => {
  // One. The hero's own Inquire was removed with the 13 Nov ruling (the card sits right under the hero). The Inquire
  // section's fallback ask (`'Inquire' : 'Ask a question'`) is a ternary, not a label line, and only renders when no
  // composer does. A second label line means a new Inquire was added without deciding how it sits beside this one.
  const count = (code.match(/^\s*Inquire\s*$/gm) ?? []).length;
  assert.equal(count, 1, `expected 1 Inquire button label (the calling card), found ${count}.`);
});

test('the hero carries no Inquire, and the card\'s Inquire is filled and ungated by the hero', () => {
  const hero = readFileSync(join(HERE, '_components', 'shop-hero.tsx'), 'utf8');
  assert.doesNotMatch(hero, /get-in-touch|Inquire</, 'a button came back onto the hero photo');
  assert.doesNotMatch(
    code,
    /\{cinematicHero \? null : \(\s*<a href="#get-in-touch"/,
    'the card\'s Inquire is gated on the hero again — a verified shop would have no Inquire at all',
  );
  assert.match(code, /<a href="#get-in-touch" className=\{SHOP_MAIN_INQUIRE_CLASS\} data-shop-main-inquire="">/);
});

test('Share and Add to your event sit beside the one Inquire, as ghosts', () => {
  const at = code.indexOf('data-shop-main-inquire=""');
  assert.ok(at > 0, 'could not locate the card\'s Inquire — update this test with the markup');
  const after = code.slice(at, at + 2600);
  assert.ok(after.includes('<ShareButton'), 'the Share button left the action row');
  assert.match(after, /<SaveVendorButton[\s\S]*?label="Add to your event"[\s\S]*?className="button-secondary/, 'Add to your event is not a ghost beside Inquire');
  assert.doesNotMatch(after.slice(0, after.indexOf('<ShareButton')), /button-primary/, 'a second filled button sits beside Inquire');
  // Order (prototype, owner 13 Nov): Inquire · Add to your event, then Check a date · Share.
  const add = after.indexOf('<SaveVendorButton');
  const date = after.indexOf('<CheckADateLink');
  const share = after.indexOf('<ShareButton');
  assert.ok(add > 0 && date > add && share > date, `the row order is not Inquire · Add · Check a date · Share (${add}, ${date}, ${share})`);
});

// 13 Nov 2026, owner verbatim "Yes, only one": exactly ONE page-level Inquire control on every shop page — no section-bar
// tab, no Inquire section or form at the foot, no hero button. A service card's details sheet says "Choose this service"
// and opens the same pop-up with that card picked — the same action, never a second Inquire.
test('exactly one page-level Inquire control per shop page', () => {
  assert.equal((code.match(/href="#get-in-touch"/g) ?? []).length, 1, 'a second link into the Inquire pop-up on the page');
  assert.doesNotMatch(code, /<InquiryComposer\b|<AnonInquiryComposer\b/, 'an inline Inquire form came back at the foot');
  assert.doesNotMatch(code, /label: 'Inquire'/, 'the section bar grew an Inquire tab');
  assert.doesNotMatch(code, /id="shop-inquire"/, 'an Inquire section came back');
  const panel = readFileSync(join(HERE, '_components', 'shop-can-do-panel.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(panel, /Inquire/, 'the "can\'t do" panel labels the chat "Inquire"');
  const bar = readFileSync(join(HERE, '_components', 'shop-section-bar.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(bar, /get-in-touch|Inquire</, 'the section bar carries its own Inquire');
  // In reach on a phone: the same element floats; it is never copied.
  const cols = readFileSync(join(HERE, '_components', 'shop-columns.ts'), 'utf8');
  assert.match(cols, /SHOP_MAIN_INQUIRE_CLASS =\s*'button-primary[^']*max-md:fixed[^']*'/);
  // The service card's own Inquire reaches the same pop-up, card picked.
  assert.match(code, /inquireMode=\{canMessage \? 'anchor' : 'none'\}/);
});

// 13 Nov 2026 (coordinator, owner "only one"): the WORD "Inquire" is one visible control per shop page. Walk every .tsx
// the page renders (its import tree) and count visible "Inquire" text — a JSX text node or a string literal that starts
// with it. The page's own main button is the only one; the phone float is that same element, never a copy. A card with
// no price reads "Price on request" (lib/service-card-view-model.ts), and the details sheet reads "Choose this service".
test('the word "Inquire" is ONE visible control across everything the shop page renders', () => {
  const WEB = join(HERE, '..', '..', '..');
  const resolve = (spec: string, from: string): string | null => {
    const base = spec.startsWith('@/') ? join(WEB, spec.slice(2)) : spec.startsWith('.') ? normalize(join(dirname(from), spec)) : null;
    if (!base) return null;
    for (const ext of ['.tsx', '/index.tsx']) if (existsSync(base + ext)) return base + ext;
    return null;
  };
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const seen = new Set<string>();
  const todo: Array<[string, number]> = [[join(HERE, 'page.tsx'), 0]];
  const hits: string[] = [];
  while (todo.length > 0) {
    const [file, depth] = todo.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const raw = readFileSync(file, 'utf8');
    if (depth < 5) {
      for (const m of raw.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
        const next = resolve(m[1]!, file);
        if (next && !next.includes('.test.') && !seen.has(next)) todo.push([next, depth + 1]);
      }
    }
    const code = strip(raw);
    for (const m of code.matchAll(/(?:['"`]|>)\s*Inquire\b/g)) {
      hits.push(`${file.slice(WEB.length + 1)}:${code.slice(0, m.index).split('\n').length}`);
    }
  }
  assert.ok(seen.size > 20, `the import walk found only ${seen.size} files — the resolver broke`);
  assert.deepEqual(
    hits.map((h) => h.replace(/:\d+$/, '')),
    ['app/v/[slug]/page.tsx'],
    `expected the word "Inquire" once (the main button), found: ${hits.join(', ')}`,
  );
  const card = strip(readFileSync(join(WEB, 'lib', 'service-card-view-model.ts'), 'utf8'));
  assert.doesNotMatch(card, /'Inquire'/, 'a card with no price says "Inquire" — a second Inquire on the page');
  const sheet = strip(readFileSync(join(HERE, '_components', 'service-details-sheet.tsx'), 'utf8'));
  // Three: the couple's two doors ('focus' button · 'anchor' link) and the shop's own Preview of that same button
  // (added on main by #7554 as "Inquire about this · Preview" — a preview of the couple's button reads what it reads).
  assert.equal((sheet.match(/Choose this service/g) ?? []).length, 3, 'the details sheet button no longer reads "Choose this service"');
});
