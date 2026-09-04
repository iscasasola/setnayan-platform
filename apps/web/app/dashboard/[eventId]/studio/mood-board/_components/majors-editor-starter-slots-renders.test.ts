/**
 * majors-editor-starter-slots-renders.test.ts — the majors start EMPTY, not
 * pre-filled, and every filled one stays deletable (MB3, carried over by
 * MB5 when the majors editor MOVED from `<PaletteEditor>`'s Reception
 * section into `<MajorsEditor>` inside `<ThemeCard>` — section 00, per the
 * one-directional rule).
 *
 * The owner's correction, verbatim: "why can't i delete the first 3 colors.
 * it is a requirement to have at least 3. but start with blank." Three is
 * the STRUCTURAL minimum (`PALETTE_LIMITS.reception.min`); three real hex
 * colors nobody chose is the defect. This is `palette-editor-starter-slots-
 * renders.test.ts`'s ORIGINAL guard, relocated to its new home and reworded
 * — not weakened, not deleted (CLAUDE.md: never weaken a check to go green).
 *
 * `<MajorsEditor>` renders nothing outside a `<PaletteBoardProvider>` (see
 * its own comment), so this renders `<ThemeCard>` wrapped in one — the real
 * composition `page.tsx` uses.
 *
 * 🪤 `globalThis.React` set before the dynamic import — see
 * `app/_components/byline-renders-as-a-door.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { emptyReading } from '@/lib/theme-text-intent';

(globalThis as unknown as { React: unknown }).React = React;

type ProviderMod = typeof import('./palette-board-context');
type CardMod = typeof import('./theme-card');
type ToastMod = typeof import('@/app/_components/toast/toast-provider');

async function paint(initial: Record<string, string[]>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PaletteBoardProvider }: ProviderMod = await import('./palette-board-context');
  const { ThemeCard }: CardMod = await import('./theme-card');
  const { ToastProvider }: ToastMod = await import('@/app/_components/toast/toast-provider');

  return renderToStaticMarkup(
    React.createElement(
      ToastProvider,
      null,
      React.createElement(
        PaletteBoardProvider,
        { eventId: 'E1', initial: initial as never, saveAction: async () => {} },
        React.createElement(ThemeCard, {
          eventId: 'E1',
          initialName: null,
          initialDescription: null,
          palette: initial as never,
          receptionDesign: {},
          saveAction: async () => {},
          readAction: async () => emptyReading(),
          applyIntentAction: async () => ({
            filledPaletteRoles: [],
            filledReceptionZones: [],
            styleFamily: null,
            nothingToFill: true,
          }),
        }),
      ),
    ),
  );
}

/** The majors editor only, out of the full card's HTML — everything between
 *  its own heading and the next control theme-card.tsx renders right after
 *  it ("Read my description"), rather than a div-depth guess that could
 *  close early on the first nested swatch wrapper. */
function majorsSection(html: string): string {
  const m = /Your main colors([\s\S]*?)Read my description/.exec(html);
  assert.ok(m?.[1], 'the majors editor must render at all');
  return m[1];
}

test('⭐ THE GUARD · a fresh board shows three EMPTY major-color slots, none removable', () => {
  return paint({}).then((html) => {
    const section = majorsSection(html);
    const addEmpty = section.match(/not yet chosen/g) ?? [];
    assert.equal(addEmpty.length, 3, 'three starter slots — the structural minimum, none pre-filled');
    assert.doesNotMatch(section, /Remove /, 'nothing chosen yet, so nothing offers to be removed');
    assert.match(section, /0 \/ 3.{1,2}5/, 'the honest count reads 0, not a seeded 3 or 5');
  });
});

test('a major color the couple HAS set renders removable, and shrinks the empty count', () => {
  return paint({ reception: ['#7A1F2B'] }).then((html) => {
    const section = majorsSection(html);
    assert.match(section, /Remove /, 'a real choice always carries a working remove control');
    const addEmpty = section.match(/not yet chosen/g) ?? [];
    assert.equal(addEmpty.length, 2, 'one filled, two still empty — never re-seeded back to zero');
  });
});

test('once three or more are chosen, the empty starter slots are gone for good', () => {
  return paint({ reception: ['#7A1F2B', '#C5A059', '#1E2229'] }).then((html) => {
    const section = majorsSection(html);
    assert.doesNotMatch(section, /not yet chosen/, 'no phantom empty slots once the minimum is met');
    assert.equal((section.match(/Remove /g) ?? []).length, 3, 'all three stay independently removable');
  });
});
