/**
 * palette-editor-starter-slots-renders.test.ts — the majors start EMPTY, not
 * pre-filled, and every filled one stays deletable (MB3, 2026-09-03).
 *
 * The owner's correction, verbatim: "why can't i delete the first 3 colors.
 * it is a requirement to have at least 3. but start with blank." Three is
 * the STRUCTURAL minimum (`PALETTE_LIMITS.reception.min`); three real hex
 * colors nobody chose is the defect. This proves the render, not just the
 * data: a fresh board shows three empty "not yet chosen" slots with no
 * remove control on any of them (nothing to remove), and a slot that has
 * been given a color renders with a working "Remove color" control — the
 * owner's exact regression, caught here if it recurs.
 *
 * `PaletteFamily` isn't exported — `<PaletteEditor>` is the real caller and
 * the real surface a couple sees, so this renders the whole editor and reads
 * the Reception section out of the emitted HTML, the same "read the render,
 * not the source" approach as `hub-stage-renders.test.ts`.
 *
 * 🪤 `globalThis.React` set before the dynamic import — see
 * `app/_components/byline-renders-as-a-door.test.ts`.
 *
 * SABOTAGE, PERFORMED AND UNDONE DURING MB3 VERIFICATION (see the session
 * report): reverting `starterSlots={{ reception: PALETTE_LIMITS.reception.min }}`
 * to no `starterSlots` prop at all turned the "starts with three empty slots"
 * test red (a fresh board rendered zero add-affordances for Reception) while
 * the filled-slot test stayed green — proving the two tests watch different
 * code paths, not the same one twice. Restored before commit.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;

type EditorMod = typeof import('./palette-editor');

async function paint(initial: Record<string, string[]>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PaletteEditor }: EditorMod = await import('./palette-editor');
  return renderToStaticMarkup(
    React.createElement(PaletteEditor, {
      eventId: 'E1',
      initial: initial as never,
      visibleKeys: ['ceremony', 'reception', 'bride', 'groom'] as never,
      saveAction: async () => {},
    }),
  );
}

/** The Reception section only, out of the full editor's HTML. */
function receptionSection(html: string): string {
  const m = /<h3[^>]*>Reception palette<\/h3>([\s\S]*?)<\/section>/.exec(html);
  assert.ok(m?.[1], 'the Reception palette section must render at all');
  return m[1];
}

test('⭐ THE GUARD · a fresh board shows three EMPTY Reception slots, none removable', () => {
  return paint({}).then((html) => {
    const section = receptionSection(html);
    const addEmpty = section.match(/not yet chosen/g) ?? [];
    assert.equal(addEmpty.length, 3, 'three starter slots — the structural minimum, none pre-filled');
    assert.doesNotMatch(section, /Remove color/, 'nothing chosen yet, so nothing offers to be removed');
    assert.match(section, /0 \/ 3.{1,2}5/, 'the honest count reads 0, not a seeded 3 or 5');
  });
});

test('a Reception color the couple HAS set renders removable, and shrinks the empty count', () => {
  return paint({ reception: ['#7A1F2B'] }).then((html) => {
    const section = receptionSection(html);
    assert.match(section, /Remove color #7A1F2B/, 'a real choice always carries a working remove control');
    const addEmpty = section.match(/not yet chosen/g) ?? [];
    assert.equal(addEmpty.length, 2, 'one filled, two still empty — never re-seeded back to zero');
  });
});

test('once three or more are chosen, the empty starter slots are gone for good — the normal "Add color" returns', () => {
  return paint({ reception: ['#7A1F2B', '#C5A059', '#1E2229'] }).then((html) => {
    const section = receptionSection(html);
    assert.doesNotMatch(section, /not yet chosen/, 'no phantom empty slots once the minimum is met');
    assert.match(section, /Add color/, 'the ordinary add-affordance, toward the max of 5');
    assert.equal((section.match(/Remove color/g) ?? []).length, 3, 'all three stay independently removable');
  });
});

test('a different family (Couple) is unaffected — no starter slots invented for keys that never asked for one', () => {
  return paint({}).then((html) => {
    const m = /<h3[^>]*>Bride<\/h3>([\s\S]*?)<\/section>/.exec(html);
    assert.ok(m?.[1], 'the Bride section renders');
    assert.doesNotMatch(m[1], /not yet chosen/, 'Bride keeps its original single "Add color" behavior');
  });
});
