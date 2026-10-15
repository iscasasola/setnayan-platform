/**
 * an-icon-node-is-never-drawn-as-a-type.test.ts — the live Maker crash of 2026-10-15 (`lib/icon-is-a-component.ts`).
 *
 * THE CLAIM: a button's `icon` that is a NODE — an element, or the React LAZY a production RSC payload makes of a server
 * component's element inside a prop — is drawn as a node, never as a component type. Only a function or a
 * `forwardRef` / `memo` object is drawn as `<Icon … />`.
 *
 * WHAT IT FEEDS: the exact shape the owner's page received for Studio › Prints' pass-card zip — a `react.lazy` whose
 * value is the `<span data-paid-mark="unlocked">` element (captured from React's #306 throw on a production build
 * replaying cale-ice's real rows). Before the fix, `ActionButton` asked `isValidElement(icon)` (false for a lazy),
 * drew it as a type, and the server threw "Element type is invalid … got: object" — this test renders that through
 * the real `ActionButton` and `PrintSaveButton` and asserts it does not throw and that the mark is on the page.
 *
 * SABOTAGE (seen RED, then restored): `renderIcon` put back to `if (isValidElement(icon)) return icon;` → tests 2 and 3
 * fail with "Element type is invalid … got: object".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { iconIsAComponent } from './icon-is-a-component';

/* The neighbouring render tests' harness: `"jsx": "preserve"`, so React is global before the dynamic imports. */
(globalThis as { React?: typeof React }).React = React;

/** What the live page received: a lazy (as the RSC client makes it) whose value is the paid-mark element. */
function liveLazyMark() {
  const el = React.createElement(
    'span',
    { 'data-paid-mark': 'unlocked', className: 'inline-flex shrink-0 items-center text-terracotta-700' },
    React.createElement('span', { role: 'img', 'aria-label': 'Unlocked — Event Hub Pro is yours' }),
  );
  return React.lazy(() => Promise.resolve({ default: el as unknown as React.ComponentType }));
}

async function render(node: React.ReactElement): Promise<string> {
  const { prerenderToNodeStream } = await import('react-dom/static');
  const { prelude } = await prerenderToNodeStream(node, { onError: (e) => { throw e; } });
  let html = '';
  for await (const chunk of prelude) html += chunk.toString();
  return html;
}

test('1 · only a function, a forwardRef or a memo is a component; an element, a lazy or a string is a node', async () => {
  const { Gem } = await import('lucide-react');
  assert.equal(iconIsAComponent(Gem), true, 'a lucide icon (forwardRef) is a component');
  assert.equal(iconIsAComponent(() => null), true);
  assert.equal(iconIsAComponent(React.memo(() => null)), true);
  assert.equal(iconIsAComponent(React.createElement('span')), false, 'an element is a node');
  assert.equal(iconIsAComponent(liveLazyMark()), false, 'the lazy the live page received is a node');
  assert.equal(iconIsAComponent('★'), false);
  assert.equal(iconIsAComponent(null), false);
});

test('2 · ActionButton draws the live lazy mark as a node — no "Element type is invalid"', async () => {
  const { ActionButton } = await import('../components/action-button');
  const html = await render(
    React.createElement(ActionButton, { tone: 'neutral', icon: liveLazyMark() as unknown as React.ReactElement, label: 'Download all', href: '/x' }),
  );
  assert.match(html, /data-paid-mark="unlocked"/, 'the Pro mark is drawn');
  assert.match(html, /Download all/);
});

test('3 · the pass-card zip row (PrintSaveButton, variant action) opens with the live lazy mark', async () => {
  const { PrintSaveButton } = await import('../app/dashboard/[eventId]/launch/_components/print-save-button');
  const html = await render(
    React.createElement(PrintSaveButton, {
      href: '/api/hub-print/passes.zip?event=x',
      file: 'pass-cards.zip',
      variant: 'action',
      icon: liveLazyMark() as unknown as React.ReactElement,
      label: 'Download all',
    } as React.ComponentProps<typeof PrintSaveButton>),
  );
  assert.match(html, /data-paid-mark="unlocked"/);
});

test('4 · a lucide component icon is still drawn as an icon', async () => {
  const { ActionButton } = await import('../components/action-button');
  const { Download } = await import('lucide-react');
  const html = await render(React.createElement(ActionButton, { tone: 'neutral', icon: Download, label: 'Save', href: '/x' }));
  assert.match(html, /<svg[^>]*aria-hidden="true"/);
});
