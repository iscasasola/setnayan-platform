/**
 * 🔣 ONE ICON PER TOPIC, EVERYWHERE (Supplier Build 3 · lane B; DECISION_LOG 🔣 2026-11-09).
 *
 * Owner: a topic wears ONE glyph — its tab's — on the tab, the pin, the chat card and the Details row (payment = the
 * Payment tab's, quote = Quotation's, call time / meeting / schedule = Schedule's, form = Forms', photos saved =
 * Inspiration's heart, guest count / date / people = Details', access = the chain, Files = the paperclip). The map is
 * `lib/topic-icons.ts` `TOPIC_ICON`; every part that draws a topic reads it.
 *
 * What would silently undo it: a pin, card, blocker or tab importing a topic glyph straight from lucide — it then
 * drifts the day someone changes the map (the Files tab wore FolderOpen while the chat wore Paperclip until this lane).
 * So the chat's topic parts may import from lucide ONLY glyphs that are not a topic (chevrons, ✕, send…), and a topic
 * glyph appears in them only through `TOPIC_ICON`.
 *
 * Sabotage check: put `Wallet` back into `chat-pins.tsx`'s lucide import → test 1 fails naming the file and glyph.
 *
 * Run: cd apps/web && npx tsx --test lib/one-icon-per-topic.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CHAT_TOPICS, TOPIC_ICON } from './topic-icons';

const WEB = join(__dirname, '..');

/** Every part that draws a topic's icon. */
const TOPIC_PARTS = [
  'app/_components/chat/chat-pins.tsx',
  'app/_components/chat/chat-blocker.tsx',
  'app/_components/chat/chat-step-card.tsx',
  'app/_components/chat/meeting-step-card.tsx',
  'app/_components/chat/plus-draft.tsx',
  'app/vendor-dashboard/messages/[threadId]/_components/thread-tools-sheet.tsx',
  'app/vendor-dashboard/clients/[eventId]/_components/picked-client-shell.tsx',
  'app/vendor-dashboard/clients/[eventId]/_pages/files.tsx',
];

/** The glyphs a topic owns — and the near-twins that would read as a second icon for one (FolderOpen for Files…). */
const TOPIC_GLYPHS = new Set([
  'Info',
  'MessageSquare',
  'CalendarDays',
  'CalendarClock',
  'ReceiptText',
  'Receipt',
  'Wallet',
  'ClipboardList',
  'ListChecks',
  'Paperclip',
  'FolderOpen',
  'Folder',
  'Heart',
  'Link2',
  'Link',
  'Hash',
  'LayoutDashboard',
  'Flag',
  'Users',
  'Bell',
  'Clock',
  'Clock3',
]);

function lucideImports(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'lucide-react'/g)) {
    for (const raw of m[1]!.split(',')) {
      const name = raw.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]!.trim();
      if (name && !/^type\b/.test(raw.trim())) out.push(name);
    }
  }
  return out;
}

test('1 · no topic part imports a topic glyph from lucide — it reads TOPIC_ICON', () => {
  const bad: string[] = [];
  for (const rel of TOPIC_PARTS) {
    const src = readFileSync(join(WEB, rel), 'utf8');
    for (const name of lucideImports(src)) if (TOPIC_GLYPHS.has(name)) bad.push(`${rel} imports ${name}`);
  }
  assert.deepEqual(bad, [], 'a topic glyph must come from TOPIC_ICON (lib/topic-icons.ts)');
});

test('1b · and every one of those parts names its topic — through TOPIC_ICON or the card frame\'s `topic` prop', () => {
  for (const rel of TOPIC_PARTS) {
    const src = readFileSync(join(WEB, rel), 'utf8');
    assert.match(src, /TOPIC_ICON|\btopic=/, rel);
  }
  // The frame itself turns `topic` into the glyph, so a card cannot pick one.
  const frame = readFileSync(join(WEB, 'app/_components/chat/chat-step-card.tsx'), 'utf8');
  assert.match(frame, /TOPIC_ICON\[topic\]/);
});

test('2 · the map has one distinct glyph per topic and the rulings it names', () => {
  const glyphs = CHAT_TOPICS.map((t) => TOPIC_ICON[t]);
  assert.equal(new Set(glyphs).size, glyphs.length, 'two topics share a glyph');
  const name = (t: (typeof CHAT_TOPICS)[number]) => (TOPIC_ICON[t] as { displayName?: string }).displayName;
  assert.equal(name('files'), 'Paperclip');
  assert.equal(name('access'), 'Link2');
  assert.equal(name('inspiration'), 'Heart');
});

test('2b · sabotage: the import check catches a topic glyph slipped back in', () => {
  const src = "import { ChevronDown, Wallet, type LucideIcon } from 'lucide-react';";
  assert.deepEqual(lucideImports(src).filter((n) => TOPIC_GLYPHS.has(n)), ['Wallet']);
  assert.deepEqual(lucideImports("import { X, type LucideIcon } from 'lucide-react';"), ['X']);
});
