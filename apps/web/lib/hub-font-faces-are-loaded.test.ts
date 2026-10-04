/**
 * hub-font-faces-are-loaded.test.ts — THE TEXT TAB OFFERS ONLY WHAT IS LOADED.
 *
 * The Maker's Text tab offers Weight, B and I per face from `HUB_FONT_FACES`
 * (`lib/hub-fonts.ts`). A weight the app never loads is faked by the browser
 * (smeared, not bold), so a table that runs ahead of the loaders is a control
 * that draws the wrong thing. This test READS the two loader files and holds
 * the table to exactly what they load — every weight, every italic, both ways.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HUB_FONTS, HUB_FONT_FACES } from './hub-fonts';

const WEB = join(__dirname, '..');

/** `--css-var` → the weights and the italic its `localFont({...})` block loads. */
function loadedFaces(): Map<string, { weights: Set<number>; italic: boolean }> {
  const out = new Map<string, { weights: Set<number>; italic: boolean }>();
  for (const file of ['app/layout.tsx', 'app/_fonts/choice-faces.ts']) {
    const src = readFileSync(join(WEB, file), 'utf8');
    for (const block of src.split('localFont(').slice(1)) {
      const variable = /variable:\s*'([^']+)'/.exec(block)?.[1];
      if (!variable) continue;
      const body = block.slice(0, block.indexOf(`variable: '${variable}'`));
      const weights = new Set<number>();
      let italic = false;
      // A static file names one weight ('400'); a variable file a range ('400 700'),
      // which loads every hundred inside it (2026-10-04: Lora, Libre Baskerville,
      // Josefin Sans are variable, and stay whole — their names are reserved).
      for (const m of body.matchAll(/weight:\s*'(\d+)(?:\s+(\d+))?',\s*style:\s*'(normal|italic)'/g)) {
        if (m[3] === 'italic') {
          italic = true;
          continue;
        }
        const lo = Number(m[1]);
        const hi = m[2] ? Number(m[2]) : lo;
        for (let w = lo; w <= hi; w += 100) weights.add(w);
      }
      out.set(variable, { weights, italic });
    }
  }
  return out;
}

test('every face in the Text tab offers exactly the weights and italic its loader loads', () => {
  const loaded = loadedFaces();
  assert.ok(loaded.size >= 30, `read the loaders (found ${loaded.size} faces)`);
  for (const f of HUB_FONTS) {
    const real = loaded.get(f.cssVar);
    assert.ok(real, `${f.key}: its variable ${f.cssVar} is loaded by a localFont() block`);
    assert.deepEqual(
      [...HUB_FONT_FACES[f.key].weights].sort((a, b) => a - b),
      [...real!.weights].sort((a, b) => a - b),
      `${f.key}: the weights offered are the weights loaded`,
    );
    assert.equal(HUB_FONT_FACES[f.key].italic, real!.italic, `${f.key}: italic is offered only where an italic is loaded`);
  }
});
