/**
 * visibility-control-is-singular.test.ts
 *
 * The controller's phone-check of the Event Hub Maker (2026-09-26) found the
 * Schedule scene's sheet carrying TWO controls that both look like they show
 * or hide the section: the eye ("Visible" / "Hidden") and the Auto · Shown ·
 * Hidden chip row — both rendered on every row of `SectionsPanel`, the exact
 * component the Maker's per-scene sheet embeds (`only={widgetId}`, Format tab).
 *
 * They are not cosmetic duplicates — `lib/invitation-widgets.ts`'s
 * `openBrowseSectionVisible` reads ONE of them per event, decided by
 * `events.website_open_browse` (the couple's own "Open browsing" toggle):
 * `mode` when it is on, the eye's `is_visible` when it is off. Showing both
 * meant one of them did nothing when pressed, silently, depending on a flag
 * neither control displayed.
 *
 * MOUNTS the real component (not a source grep — `read-a-tools-usage-line`-
 * style false confidence is exactly what a render proves against) and reads
 * the emitted HTML for both values of that flag, on the couple's own
 * "Schedule" scene from the controller's report.
 *
 * `globalThis.React` + dynamic imports: tsconfig's `"jsx": "preserve"` compiles
 * this file's own React tree with the classic runtime. Precedent:
 * `app/_components/byline-renders-as-a-door.test.ts`,
 * `app/dashboard/[eventId]/launch/_components/hub-stage-renders.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;

type Mod = typeof import('./sections-panel');
type Row = import('@/lib/invitation-widgets').InvitationWidgetRow;

const noop = async () => {};

function row(overrides: Partial<Row> = {}): Row {
  return {
    widget_id: 'w1',
    event_id: 'e1',
    widget_type: 'schedule',
    display_order: 0,
    is_visible: true,
    is_always_on: false,
    tier: 'basic',
    config_json: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    mode: 'auto',
    audience: 'public',
    ...overrides,
  };
}

async function paint(opts: { openBrowse: boolean; row?: Partial<Row> }): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SectionsPanel }: Mod = await import('./sections-panel');
  return renderToStaticMarkup(
    React.createElement(SectionsPanel, {
      eventId: 'e1',
      rows: [row(opts.row)],
      contentMap: { schedule: true },
      toggleAction: noop,
      moveUpAction: noop,
      moveDownAction: noop,
      setModeAction: noop,
      only: 'w1',
      openBrowse: opts.openBrowse,
    }),
  );
}

/** Which of the two controls' own markers are on the page. */
function controlsOn(html: string): string[] {
  return [...html.matchAll(/data-visibility-control="(eye|mode)"/g)].map((m) => m[1] as string);
}

test('⭐ open browsing ON — the Schedule sheet shows the mode chips, never the eye', async () => {
  const html = await paint({ openBrowse: true });
  assert.deepEqual(controlsOn(html), ['mode'], 'exactly one control, and it is the one the render actually reads');
  assert.doesNotMatch(html, /Visible|Hidden</, 'no eye label leaking in from the other control');
  assert.match(html, />auto<|>shown<|>hidden</, 'the three-state chips are there');
});

test('⭐ open browsing OFF — the Schedule sheet shows the eye, never the dead mode chips', async () => {
  const html = await paint({ openBrowse: false });
  assert.deepEqual(controlsOn(html), ['eye'], 'exactly one control, and it is the one the render actually reads');
  assert.doesNotMatch(html, />auto<|>shown<|>hidden</, 'no chip row that would post writes nobody reads');
});

test('⛔ THE GUARD · never both, never neither — for every mode value and every row state', async () => {
  const combos: Array<{ openBrowse: boolean; row: Partial<Row> }> = [
    { openBrowse: true, row: { mode: 'auto' } },
    { openBrowse: true, row: { mode: 'shown' } },
    { openBrowse: true, row: { mode: 'hidden', is_visible: false } },
    { openBrowse: false, row: { is_visible: true } },
    { openBrowse: false, row: { is_visible: false } },
  ];
  for (const c of combos) {
    const html = await paint(c);
    assert.equal(
      controlsOn(html).length,
      1,
      `openBrowse=${c.openBrowse} row=${JSON.stringify(c.row)} rendered ${controlsOn(html).length} visibility controls`,
    );
  }
});

test('⛔ the default (no openBrowse passed) still renders exactly one control', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SectionsPanel }: Mod = await import('./sections-panel');
  const html = renderToStaticMarkup(
    React.createElement(SectionsPanel, {
      eventId: 'e1',
      rows: [row()],
      contentMap: { schedule: true },
      toggleAction: noop,
      moveUpAction: noop,
      moveDownAction: noop,
      setModeAction: noop,
      only: 'w1',
      // openBrowse intentionally omitted — a caller that forgets to wire it
      // must still get ONE control, not both.
    }),
  );
  assert.equal(controlsOn(html).length, 1, 'a forgotten prop must not double the controls');
});
