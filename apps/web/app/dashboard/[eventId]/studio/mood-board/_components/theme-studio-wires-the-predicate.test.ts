/**
 * theme-studio-wires-the-predicate.test.ts — the LINE JOINING the predicate
 * to the fork component is itself proven, not just each end of it.
 *
 * A peer oversight session sabotage-tested MB3 after merge review and found
 * the wiring unguarded: `page.tsx` used to compute `hasChosenMajors(palette)`
 * itself and hand the result down as a separate `alreadyChosenMajors`
 * boolean prop. Hard-coding that prop to `true` in `page.tsx` — the exact
 * regression this whole build session exists to prevent — left EVERY
 * existing test green: `lib/mood-board.test.ts` tests `hasChosenMajors`
 * directly, and `theme-path-fork-renders.test.ts` paints `<TemplateGallery>`
 * from a boolean it takes as a prop and never questions. Both ends were
 * pinned; the middle was not.
 *
 * The fix is structural, not just a guard: `<ThemeStudio>` now derives
 * `hasChosenMajors(palette)` ITSELF, from the same `palette` prop it already
 * threads to `<ThemeCard>` — see its own comment. There is no longer a
 * second call site that could disagree. This file proves that derivation by
 * rendering `<ThemeStudio>` (not `<TemplateGallery>` directly) with two
 * different PALETTES — never a hand-fed boolean — and reading which fork
 * state paints. A future regression back to a separately-computed,
 * independently-wrong boolean would have to reintroduce the exact prop this
 * file never passes.
 *
 * 🪤 `globalThis.React` set before the dynamic imports — see
 * `app/_components/byline-renders-as-a-door.test.ts` for why.
 *
 * SABOTAGE, PERFORMED AND UNDONE DURING VERIFICATION (see the session
 * report): replacing `theme-studio.tsx`'s
 * `const alreadyChosenMajors = hasChosenMajors(palette);` with
 * `const alreadyChosenMajors = false;` turned "an EMPTY palette..." green
 * (false positive luck) but turned "a palette with reception already set..."
 * red — the fork kept asking "how would you like to begin" to a couple who
 * had already chosen. Restored before commit.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;

type StudioMod = typeof import('./theme-studio');
type ToastMod = typeof import('@/app/_components/toast/toast-provider');
type IntentMod = typeof import('@/lib/theme-text-intent');

async function paintStudio(palette: Record<string, string[]>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ThemeStudio }: StudioMod = await import('./theme-studio');
  const { ToastProvider }: ToastMod = await import('@/app/_components/toast/toast-provider');
  const { emptyReading }: IntentMod = await import('@/lib/theme-text-intent');

  return renderToStaticMarkup(
    React.createElement(
      ToastProvider,
      null,
      React.createElement(ThemeStudio, {
        eventId: 'E1',
        initialName: null,
        initialDescription: null,
        palette: palette as never,
        receptionDesign: {},
        saveThemeAction: async () => {},
        readAction: async () => emptyReading(),
        applyIntentAction: async () => ({
          filledPaletteRoles: [],
          filledReceptionZones: [],
          styleFamily: null,
          nothingToFill: true,
        }),
        fetchTemplatesAction: async () => ({
          templates: [],
          total: 0,
          moodTotal: 0,
          offset: 0,
          limit: 0,
        }),
        applyTemplateAction: async () => ({
          mode: 'fill_empty' as const,
          filledPaletteRoles: [],
          filledReceptionZones: [],
          filledInspirationSlots: [],
          filledThemeName: false,
          filledThemeDescription: false,
          nothingToFill: true,
        }),
      }),
    ),
  );
}

test('⭐ THE GUARD · an EMPTY palette asks "how would you like to begin?" — through ThemeStudio, not a hand-fed boolean', async () => {
  const html = await paintStudio({});
  assert.match(html, /How would you like to begin/);
  assert.doesNotMatch(html, /You.?ve set your main colours/);
});

test('⭐ THE GUARD · a palette with reception already set skips straight past the fork — through ThemeStudio, not a hand-fed boolean', async () => {
  const html = await paintStudio({ reception: ['#7A1F2B'] });
  assert.doesNotMatch(
    html,
    /How would you like to begin/,
    'reception is non-empty — hasChosenMajors must read this as already chosen, derived from THIS palette',
  );
  assert.match(html, /You.?ve set your main colours/);
});

test('a palette with OTHER keys set but reception empty is still treated as unchosen', () => {
  // The exact defect `hasChosenMajors` replaces: a looser "any key at all"
  // check (the old `hasSavedPalette`) would have called this chosen.
  return paintStudio({ bride: ['#C98A94'], groom: ['#2E4433'] }).then((html) => {
    assert.match(html, /How would you like to begin/);
  });
});
