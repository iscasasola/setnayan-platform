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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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
  const after = code.slice(at, at + 1600);
  assert.ok(after.includes('<ShareButton'), 'the Share button left the action row');
  assert.match(after, /<SaveVendorButton[\s\S]*?label="Add to your event"[\s\S]*?className="button-secondary/, 'Add to your event is not a ghost beside Inquire');
  assert.doesNotMatch(after.slice(0, after.indexOf('<ShareButton')), /button-primary/, 'a second filled button sits beside Inquire');
});

// 13 Nov 2026, owner verbatim "Yes, only one": exactly ONE page-level Inquire control on every shop page — no section-bar
// tab, no Inquire section or form at the foot, no hero button. A service card's "Inquire about this" (inside its details
// sheet) is the same action with that card picked, not a second page-level door.
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
