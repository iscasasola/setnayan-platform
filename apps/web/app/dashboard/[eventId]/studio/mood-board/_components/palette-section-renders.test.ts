/**
 * palette-section-renders.test.ts — section 02 actually renders live
 * derivation, honors touchedRoles, and its Reception mirror carries NO
 * interactive control at all (the one-directional rule, enforced by
 * construction — see `palette-section.tsx`'s `<ReceptionMirror>` and its
 * sibling guard in `mood-board-board-ops.test.ts`, which proves the same
 * rule at the reducer level).
 *
 * 🪤 `globalThis.React` set before the dynamic import — see
 * `app/_components/byline-renders-as-a-door.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;

type ProviderMod = typeof import('./palette-board-context');
type SectionMod = typeof import('./palette-section');

async function paint(initial: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PaletteBoardProvider }: ProviderMod = await import('./palette-board-context');
  const { PaletteSection }: SectionMod = await import('./palette-section');

  return renderToStaticMarkup(
    React.createElement(
      PaletteBoardProvider,
      { eventId: 'E1', initial: initial as never, saveAction: async () => {} },
      React.createElement(PaletteSection, {
        visibleKeys: ['ceremony', 'reception', 'bride', 'groom', 'guest'] as never,
      }),
    ),
  );
}

test('no majors chosen: derivable roles render an honest empty "pick a colour" control, never a fabricated swatch', () => {
  return paint({}).then((html) => {
    assert.match(html, /Bride/);
    assert.match(html, /Pick a Bride colour/);
  });
});

test('majors chosen: an untouched role shows a REAL derived swatch, not the empty state', () => {
  return paint({ reception: ['#7A1F2B', '#FAF7F2', '#D4AF37', '#302B1B', '#FFD8DD'] }).then((html) => {
    assert.doesNotMatch(html, /Pick a Bride colour/, 'Bride derives from the majors once they exist');
  });
});

test('a touched role keeps its own stored colour and is never silently re-derived', () => {
  return paint({
    reception: ['#7A1F2B', '#FAF7F2', '#D4AF37', '#302B1B', '#FFD8DD'],
    bride: ['#123456'],
    touched_roles: ['bride'],
  }).then((html) => {
    assert.match(html, /#123456/i);
    assert.match(html, /yours</, 'a touched role is labelled "yours"');
    assert.match(html, /Match my main colours/);
  });
});

test('🛑 THE ONE-DIRECTIONAL RULE, AT RENDER TIME · the Reception mirror carries no swatch-editing control at all', () => {
  return paint({ reception: ['#7A1F2B', '#FAF7F2', '#D4AF37'] }).then((html) => {
    const m = /Reception[\s\S]*?↑ Edit at 00/.exec(html);
    assert.ok(m, 'the mirror renders, with its edit-at-00 link');
    const mirror = m![0];
    assert.doesNotMatch(mirror, /aria-haspopup="dialog"/, 'no color-picker button inside the mirror');
    assert.doesNotMatch(mirror, /<input/, 'no native color input inside the mirror');
    assert.match(mirror, /href="#theme"/, 'the mirror only offers a jump to 00, never an edit');
  });
});

test('the reduced-derivation note appears only when the engine actually had to waive a rank\'s gates', () => {
  return paint({ reception: ['#7A1F2B', '#FAF7F2', '#D4AF37', '#302B1B', '#FFD8DD'] }).then((html) => {
    assert.doesNotMatch(html, /can only repeat them/, 'a healthy palette carries no reduced-derivation warning');
  });
});
