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

const ONE_LINE_TEXT = /(?:^|\s)(?:truncate|text-ellipsis|whitespace-nowrap|line-clamp-1)(?:\s|$)/;
const unescape = (c: string) => c.replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&#x27;/g, "'");

test('🔑 the muted line wraps between its pieces, never through the date', () => {
  const html = head('#customer');
  // The line is found by what it holds (the date), not by a marker a rewrite could drop: the row that holds the
  // pieces is the element the date's own <span> sits in, and every ancestor up to the head's <p> is checked too.
  const at = html.indexOf('December 12, 2026');
  assert.ok(at > 0, 'the date did not reach the head');
  const pAt = html.lastIndexOf('<p', at);
  assert.ok(pAt >= 0, 'the line is no longer inside a <p> — re-aim the scan');
  // the open-tag stack from the <p> down to the date (closed siblings — "Catering" — drop off the stack)
  const opening: string[] = [];
  for (const m of html.slice(pAt, at).matchAll(/<(\/?)([a-z]+)\b[^>]*>/g)) {
    if (m[1]) opening.pop();
    else opening.push(m[0]);
  }
  // the last opening tag is the date's own <span>; the one before it is the row that holds the pieces
  assert.ok(opening.length >= 2, 'the line has no row around its pieces');
  const classOfTag = (tag: string) => unescape((tag.match(/class="([^"]*)"/) ?? [])[1] ?? '');
  const row = classOfTag(opening[opening.length - 2]!);
  for (const tag of opening.slice(0, -1)) {
    const cls = classOfTag(tag);
    assert.doesNotMatch(cls, ONE_LINE_TEXT, `the line is forced onto one row again: "${cls}"`);
  }
  assert.doesNotMatch(row, /(?:^|\s)overflow-hidden(?:\s|$)/, 'the row that holds the pieces clips them');
  assert.match(row, /(?:^|\s)flex-wrap(?:\s|$)/, 'the line no longer wraps — a long service name pushes the date off the edge');
  assert.match(row, /\[&>\*\]:whitespace-nowrap/, 'each piece of the line may break inside itself ("December" / "12, 2026")');
});
