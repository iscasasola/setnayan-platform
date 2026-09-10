/**
 * theme-path-fork-renders.test.ts — the two-path blank-start fork RENDERS,
 * not just resolves in a function somewhere.
 *
 * `<TemplateGallery>` (2026-09-03 mood-board redesign) already carries the
 * fork the MB3 brief calls for: "How would you like to begin?" — pick a
 * designed theme, or start with a genuinely blank board. What this file
 * proves is the thing a pure logic test cannot: that BOTH paths actually
 * paint, distinctly, from the same component, and that a couple who has
 * already chosen their majors (`hasChosenMajors`, lib/mood-board.ts) is never
 * asked "how would you like to begin" again — the MB3 fix for the fork
 * re-asking a question it had already answered.
 *
 * 🪤 `globalThis.React` IS SET BEFORE THE DYNAMIC IMPORTS — see
 * `app/_components/byline-renders-as-a-door.test.ts` for why this isn't a
 * hack to tidy away: tsconfig's `"jsx": "preserve"` means `tsx` compiles
 * these components to the classic runtime, which throws "React is not
 * defined" without this global, and the import must be dynamic because a
 * static one is hoisted above the assignment.
 *
 * SABOTAGE, PERFORMED AND UNDONE DURING MB3 VERIFICATION (not left in the
 * repo — see the session report): commenting out the `step === 'blank'`
 * branch turned "renders the blank-board path" red while every other test
 * here stayed green, and commenting out `step === 'intent'` turned "renders
 * the pick-a-theme path" red without touching the blank-path test. Restored
 * before commit. A guard that has never gone red is untested.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;

type GalleryMod = typeof import('./template-gallery');
type ToastMod = typeof import('@/app/_components/toast/toast-provider');

async function paintGallery(alreadyChosen: boolean): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { TemplateGallery }: GalleryMod = await import('./template-gallery');
  const { ToastProvider }: ToastMod = await import('@/app/_components/toast/toast-provider');

  return renderToStaticMarkup(
    React.createElement(
      ToastProvider,
      null,
      React.createElement(TemplateGallery, {
        eventId: 'E1',
        fetchAction: async () => ({ templates: [], total: 0, moodTotal: 0, offset: 0, limit: 0 }),
        applyAction: async () => ({
          mode: 'fill_empty' as const,
          filledPaletteRoles: [],
          filledReceptionZones: [],
          filledInspirationSlots: [],
          filledThemeName: false,
          filledThemeDescription: false,
          nothingToFill: true,
        }),
        jumpTo: null,
        alreadyChosen,
      }),
    ),
  );
}

test('⭐ PATH A · a fresh board is asked "how would you like to begin?" with both choices present', async () => {
  const html = await paintGallery(false);
  assert.match(html, /How would you like to begin/);
  assert.match(html, /Start from a designed theme/, 'the pick-a-theme choice paints');
  assert.match(html, /Start with a blank board/, 'the create-your-own choice paints, distinctly');
  assert.doesNotMatch(html, /You.?ve set your main colours/, 'not asked as if already begun');
});

test('⭐ PATH B · a fresh board loads nothing before either choice is made', async () => {
  const html = await paintGallery(false);
  assert.match(html, /Start with a blank board/, 'the create-your-own choice is present');
  assert.doesNotMatch(html, /themes match/, 'no results step has run — nothing was fetched yet');
  assert.doesNotMatch(html, /Apply/, 'no theme card, so no Apply button, before a choice is made');
});

test('⭐ THE GUARD · a couple who already chose their majors is never re-asked the fork', async () => {
  const html = await paintGallery(true);
  assert.doesNotMatch(
    html,
    /How would you like to begin/,
    'majors already chosen — re-asking is the six-defects class of dishonesty this predicate exists to close',
  );
  assert.match(html, /You.?ve set your main colours/);
  assert.match(html, /Browse designed themes anyway/, 'still one quiet way back in, never a dead end');
});

test('the two paths are genuinely distinct renders, not the same markup twice', async () => {
  const fresh = await paintGallery(false);
  const chosen = await paintGallery(true);
  assert.notEqual(fresh, chosen, 'a fresh board and an already-chosen board must not paint identically');
});
