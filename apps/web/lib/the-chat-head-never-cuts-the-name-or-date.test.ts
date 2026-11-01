/**
 * 📏 THE CHAT HEAD NEVER CUTS THE NAME OR THE DATE (walk 2026-11-01, `/dev/supplier-chat-lab` at 390).
 *
 * The supplier's head carries a labelled "Customer" pill on a phone (it must keep its word —
 * `the-mobile-tools-trigger-is-labelled.test.ts`), and with it the head's name ended in "Ana's Wedding …" and the one
 * muted line was sliced mid-digit: "Catering · December 1". A supplier deciding whether they are free that day was
 * shown a date with its last digit missing.
 *
 * THE PROPERTY, read off the RENDERED head (`ChatThreadHead`, both sides mount it): the name and the line are never
 * clipped to one row — the name may take a second line, and the line wraps between its pieces, each piece kept whole.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatThreadHead } from '@/app/_components/chat/chat-thread-head';

// The component is written for Next's automatic JSX runtime; under tsx's classic transform it reads a global React.
(globalThis as unknown as { React: unknown }).React = React;
const h = React.createElement;

function head(nameHref?: string): string {
  return renderToStaticMarkup(
    h(ChatThreadHead, {
      back: h('a', { href: '#back' }, '‹'),
      name: "Ana's Wedding (Dec 12)",
      nameHref,
      initials: 'AM',
      line: h(React.Fragment, null, h('span', null, 'Catering'), h('span', null, 'December 12, 2026'), h('span', null, 'Planning for ~150 guests')),
      actions: h('button', { type: 'button' }, 'Customer'),
    }),
  );
}

function classOf(html: string, marker: string): string {
  const tag = html.match(new RegExp(`<[a-z]+[^>]*\\b${marker}=""[^>]*>`));
  assert.ok(tag, `the head no longer renders ${marker} — the scan is blind`);
  const cls = tag![0].match(/class="([^"]*)"/);
  assert.ok(cls, `${marker} has no class`);
  return cls![1]!;
}

const ONE_ROW_CLIP = /(?:^|\s)(?:truncate|text-ellipsis|whitespace-nowrap|overflow-hidden|line-clamp-1)(?:\s|$)/;

for (const [label, href] of [['plain name', undefined], ['name that opens the customer card', '#customer']] as const) {
  test(`🔑 the name is never cut to one row (${label})`, () => {
    const cls = classOf(head(href), 'data-chat-head-name');
    assert.doesNotMatch(cls, ONE_ROW_CLIP, `the name is clipped to one row again: "${cls}"`);
  });
}

test('🔑 the muted line wraps between its pieces, never through the date', () => {
  const html = head('#customer');
  // The line is found by what it holds (the date), not by a marker a rewrite could drop.
  const at = html.indexOf('December 12, 2026');
  assert.ok(at > 0, 'the date did not reach the head');
  const open = html.lastIndexOf('<p', at);
  assert.ok(open >= 0, 'the line is no longer a <p> — re-aim the scan');
  const tag = html.slice(open, html.indexOf('>', open) + 1);
  const cls = (tag.match(/class="([^"]*)"/) ?? [])[1] ?? '';
  assert.doesNotMatch(cls, ONE_ROW_CLIP, `the line is clipped to one row again: "${cls}"`);
  assert.match(cls, /(?:^|\s)flex-wrap(?:\s|$)/, 'the line no longer wraps — a long service name pushes the date off the edge');
  assert.match(cls.replace(/&amp;/g, '&').replace(/&gt;/g, '>'), /\[&>\*\]:whitespace-nowrap/, 'each piece of the line may break inside itself ("December" / "12, 2026")');
});
