/**
 * the-tappable-mark-is-the-accent.test.ts — THE SMALL MARK THAT SAYS "YOU CAN TAP THIS" IS THE APP'S ACCENT.
 *
 * Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9), on a list row's grey arrow: *"teracota?"*; earlier, on the
 * dropdown: *"Chevron should be teracota color?"*. ⇒ the arrow at the end of a row, ⋯ and the back arrow wear the
 * accent; grey is for what is off or cannot be used.
 *
 * SHARED PIECES ONLY, AND NAMED. The app has no one source for these marks yet: `PageMasthead` draws neither a back
 * arrow nor a ⋯, `.sn-row` is a surface with no arrow of its own, and most pages place their own. So this holds the
 * marks that ARE drawn in a shared component, one line each in `TAPPABLE_MARKS` — a later builder EXTENDS the list
 * as a page's mark moves into a shared piece; it is never a repo-wide rule.
 *
 * Never a guest page: every file here is drawn on a dashboard only (`--sn-accent` is the app's colour, not the
 * couple's — the guests' Event Hub wears its own).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** A shared piece's mark: the icon element (by its lucide name) and what it says. `count` = how many the file draws. */
const TAPPABLE_MARKS: readonly { file: string; icon: string; count: number; what: string }[] = [
  { file: 'app/_components/back-button.tsx', icon: 'ArrowLeft', count: 1, what: 'the back arrow of BackButton' },
  { file: 'app/_components/chat/thread-list-card.tsx', icon: 'ArrowRight', count: 1, what: 'the arrow at the end of a conversation row' },
  { file: 'app/_components/contracts/contract-card.tsx', icon: 'ArrowRight', count: 1, what: 'the arrow at the end of a contract row' },
  { file: 'app/_components/chat-thread-menu.tsx', icon: 'MoreVertical', count: 1, what: 'a conversation’s ⋮ menu' },
  { file: 'app/_components/app-store/layout.tsx', icon: 'ArrowLeft', count: 1, what: 'the back arrow of a Studio service page' },
  { file: 'app/_components/app-store/layout.tsx', icon: 'ChevronRight', count: 1, what: 'the arrow at the end of a Studio service row' },
];

/** Every `<Icon … />` of one name in a file, as source. */
const iconsIn = (src: string, icon: string): string[] => [...src.matchAll(new RegExp(`<${icon}\\b[^>]*?/>`, 'g'))].map((m) => m[0]);

test('the tappable mark in each shared piece wears the accent — not a grey, not the gold, not a colour of its own', () => {
  for (const { file, icon, count, what } of TAPPABLE_MARKS) {
    const found = iconsIn(read(file), icon);
    assert.equal(found.length, count, `${file} draws ${found.length} <${icon}> — ${what} moved or was removed; fix this list`);
    for (const el of found) {
      const cls = /className="([^"]*)"/.exec(el)?.[1]?.split(/\s+/) ?? [];
      assert.ok(cls.includes('text-sn-accent'), `${file}: ${what} is not the accent — ${el.replace(/\s+/g, ' ')}`);
      const others = cls.filter((c) => /(?:^|:)text-/.test(c) && c !== 'text-sn-accent');
      assert.deepEqual(others, [], `${file}: ${what} carries a second colour (${others.join(' ')})`);
      assert.doesNotMatch(el, /mulberry|#[0-9a-fA-F]{3,8}\b|stroke="(?!currentColor)/, `${file}: ${what} writes the accent by hand`);
    }
  }
});

test('none of those shared pieces is drawn on a guest page', () => {
  const walk = (rel: string): string[] =>
    readdirSync(join(WEB, rel)).flatMap((name) => {
      const child = `${rel}/${name}`;
      if (statSync(join(WEB, child)).isDirectory()) return walk(child);
      return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [child] : [];
    });
  const guest = walk('app/[slug]').map((f) => [f, read(f)] as const);
  assert.ok(guest.length >= 100, `anti-vacuity: only ${guest.length} guest files were read`);
  for (const file of new Set(TAPPABLE_MARKS.map((m) => m.file))) {
    /* `app/_components/chat/thread-list-card.tsx` is imported as `…/_components/chat/thread-list-card`. */
    const stem = file.replace(/^app\//, '').replace(/\.tsx$/, '');
    const importers = guest.filter(([, src]) => new RegExp(`from ['"][^'"]*${stem.replace(/[/.]/g, '\\$&')}['"]`).test(src)).map(([f]) => f);
    assert.deepEqual(importers, [], `${file} is drawn on a guest page — its mark would wear the app’s colour inside the couple’s Event Hub`);
  }
});
