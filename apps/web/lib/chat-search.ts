/**
 * 🔎 SEARCH INSIDE ONE CHAT (Unichat part D, 20 Nov 2026; approved drawing `UNICHAT-LIVE-2026-11-19.html`: "the magnifier
 * in the header. ↑ ↓ step through '3 of 7'"). It looks through what the chat is SHOWING — the lines already on the
 * page, cards included, under whichever chip is picked — so it asks the server nothing and can never show a line the
 * reader may not see.
 *
 * The words found are tinted with the browser's own highlight (CSS Custom Highlight API): no node of the conversation
 * is touched, so React keeps owning every line. Where a browser has no such API the line holding the current match is
 * outlined instead (`CHAT_SEARCH_HIT`), and the count and the steps work the same.
 *
 * 🔒 lib/chat-search.test.ts
 */

import { formatCount } from '@/lib/format-number';

/** The attribute the line holding the current match wears — the fallback's outline, and the scroll target. */
export const CHAT_SEARCH_HIT = 'data-chat-search-hit';
export const CHAT_SEARCH_HIGHLIGHT = 'sn-chat-search';
export const CHAT_SEARCH_HIGHLIGHT_CURRENT = 'sn-chat-search-cur';

/** What is never searched: words only a screen reader hears, drawn-only glyphs, and the filter's own line. */
const SKIP = '.sr-only, [aria-hidden="true"], [data-chat-filter-line], [data-chat-jump-row], input, textarea, select, script, style';

/** Every place `q` starts in `text`, ignoring case; matches never overlap. An empty `q` finds nothing. */
export function matchesIn(text: string, q: string): number[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const hay = text.toLowerCase();
  const out: number[] = [];
  for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + needle.length)) out.push(at);
  return out;
}

/** The match the count names: `i` may run past either end — it wraps ("7 of 7" → ↓ → "1 of 7"). */
export function stepHit(i: number, n: number): number {
  return n <= 0 ? 0 : ((i % n) + n) % n;
}

/** "3 of 7" · "No matches" · nothing while the box is empty. */
export function searchCountLine(q: string, i: number, n: number): string {
  if (!q.trim()) return '';
  return n > 0 ? `${formatCount(stepHit(i, n) + 1)} of ${formatCount(n)}` : 'No matches';
}

/** Each match as a Range inside `root`, in reading order. */
export function findInChat(root: HTMLElement, q: string): Range[] {
  const needle = q.trim();
  if (!needle) return [];
  const out: Range[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement && !n.parentElement.closest(SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    for (const at of matchesIn(n.nodeValue ?? '', needle)) {
      const r = document.createRange();
      r.setStart(n, at);
      r.setEnd(n, at + needle.length);
      out.push(r);
    }
  }
  return out;
}

type HighlightRegistry = { set: (name: string, h: unknown) => void; delete: (name: string) => void };
function registry(): { reg: HighlightRegistry; make: (ranges: Range[]) => unknown } | null {
  if (typeof window === 'undefined' || typeof CSS === 'undefined') return null;
  const reg = (CSS as unknown as { highlights?: HighlightRegistry }).highlights;
  const H = (window as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
  return reg && H ? { reg, make: (ranges) => new H(...ranges) } : null;
}

/** Tint every match and the current one. Returns false where the browser cannot (the caller outlines the line). */
export function paintChatSearch(hits: readonly Range[], current: number): boolean {
  const r = registry();
  if (!r) return false;
  r.reg.set(CHAT_SEARCH_HIGHLIGHT, r.make(hits.filter((_, i) => i !== current)));
  const cur = hits[current];
  if (cur) r.reg.set(CHAT_SEARCH_HIGHLIGHT_CURRENT, r.make([cur]));
  else r.reg.delete(CHAT_SEARCH_HIGHLIGHT_CURRENT);
  return true;
}

export function clearChatSearch(): void {
  const r = registry();
  if (!r) return;
  r.reg.delete(CHAT_SEARCH_HIGHLIGHT);
  r.reg.delete(CHAT_SEARCH_HIGHLIGHT_CURRENT);
}

/**
 * 👀 "Seen · Claire, Liza" under your latest message — the names of those who read it while you looked (each said so on
 * this chat's own channel). No names known → the plain word, never an invented one. More than three → "+2".
 */
export function seenLine(word: string, names: readonly string[]): string {
  const known = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (known.length === 0) return word;
  const shown = known.slice(0, 3).join(', ');
  return `${word} · ${shown}${known.length > 3 ? ` +${known.length - 3}` : ''}`;
}
