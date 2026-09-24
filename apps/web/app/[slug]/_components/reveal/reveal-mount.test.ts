/**
 * ALL REVEAL IS PAID (owner 2026-09-24) — rendered, not just decided.
 *
 * `RevealMount` is the synchronous half of `RevealOverlayServer`, the ONE mount
 * both guest doors (the Event Hub in site-body.tsx and the invite door in
 * invite/page.tsx) go through. This renders it with the admin master toggle ON
 * and a house default set — exactly prod's Reveal Studio row on 2026-09-24 —
 * and asserts a free couple's page carries NO reveal overlay element at all.
 *
 * Why the element tree and not HTML: RevealOverlay renders nothing on the
 * server by design (progressive enhancement), so HTML from a server render is
 * empty whether or not the overlay is mounted — a string check here could not
 * fail. Whether the overlay ELEMENT is in the tree is the thing that decides
 * whether a guest's browser runs it.
 *
 * Run: `pnpm test:unit` (from apps/web)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { isValidElement, type ReactElement, type ReactNode } from 'react';

import { DEFAULT_REVEAL_CONFIG, type RevealStudioConfig } from '@/lib/reveal-config-pure';
import type { RevealMountProps } from './reveal-mount';

// 🪤 tsconfig `jsx: preserve` → tsx compiles JSX to `React.createElement`, so
// React must be global BEFORE the components are (dynamically) imported.
(globalThis as unknown as { React: unknown }).React = React;

async function load() {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { RevealMount } = await import('./reveal-mount');
  const overlayModule = await import('./reveal-overlay');
  // A `use client` module can land under `.default` when loaded by tsx.
  const RevealOverlay =
    (overlayModule as { RevealOverlay?: unknown }).RevealOverlay ??
    (overlayModule as { default?: { RevealOverlay?: unknown } }).default?.RevealOverlay;
  const overlaysIn = (node: ReactNode): ReactElement[] => {
    const found: ReactElement[] = [];
    const walk = (n: ReactNode): void => {
      if (Array.isArray(n)) {
        n.forEach(walk);
        return;
      }
      if (!isValidElement(n)) return;
      if (n.type === RevealOverlay) found.push(n);
      walk((n.props as { children?: ReactNode }).children);
    };
    walk(node);
    return found;
  };
  return { renderToStaticMarkup, RevealMount, RevealOverlay, overlaysIn };
}

// Prod's Reveal Studio row, 2026-09-24: master toggle ON, veil-sheer default.
const PROD_LIKE: RevealStudioConfig = {
  ...DEFAULT_REVEAL_CONFIG,
  enabled: true,
  defaultTemplate: 'veil-sheer',
};

function props(over: Partial<RevealMountProps>): RevealMountProps {
  return {
    enabled: true,
    monogram: 'A & J',
    config: PROD_LIKE,
    ownsPro: false,
    eventId: 'evt-1',
    isStaffPreview: false,
    eventTemplate: null,
    ...over,
  };
}

test('the overlay component resolves (else every assertion below is vacuous)', async () => {
  const { RevealOverlay } = await load();
  assert.equal(typeof RevealOverlay, 'function');
});

test("a free couple's page mounts no reveal — admin toggle ON, house default set", async () => {
  const { RevealMount, overlaysIn, renderToStaticMarkup } = await load();
  for (const eventTemplate of [null, 'veil-sheer', 'church-doors', 'four-flap'] as const) {
    const tree = RevealMount(props({ eventTemplate }));
    assert.equal(overlaysIn(tree).length, 0, `free couple, stored choice ${eventTemplate}`);
    // It still renders — the touch glow and the film are untouched by this.
    renderToStaticMarkup(tree);
  }
});

test('a Pro couple gets the overlay, told they own Pro', async () => {
  const { RevealMount, overlaysIn } = await load();
  const found = overlaysIn(RevealMount(props({ ownsPro: true })));
  assert.equal(found.length, 1, 'Pro couple → exactly one overlay mounted');
  assert.equal((found[0]!.props as { premiumUnlocked?: boolean }).premiumUnlocked, true);
});

test("a Pro couple's No Reveal mounts nothing", async () => {
  const { RevealMount, overlaysIn } = await load();
  assert.equal(overlaysIn(RevealMount(props({ ownsPro: true, eventTemplate: 'none' }))).length, 0);
});

test('outside the reveal phase nothing mounts, Pro or not', async () => {
  const { RevealMount, overlaysIn } = await load();
  assert.equal(overlaysIn(RevealMount(props({ ownsPro: true, enabled: false }))).length, 0);
});

test('a staff preview build keeps the overlay mounted so ?reveal= can demo', async () => {
  const { RevealMount, overlaysIn } = await load();
  assert.equal(overlaysIn(RevealMount(props({ isStaffPreview: true }))).length, 1);
});
