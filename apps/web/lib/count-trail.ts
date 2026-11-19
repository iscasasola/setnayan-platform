/**
 * 🔢 A COUNT IN A PICKER'S ROW — the real number, or the words "couldn’t count"; never a blank and never a 0 for a read
 * that failed (house rule: a failed read never shows as empty; walk W4/W5 18 Nov 2026, #7909 follow-up — the Memories
 * picker's counts drew nothing where a read had failed, the same as a section with no number at all).
 *
 * `undefined` = this row has no number by design (Memories: a total is never computed) → no trail.
 * `null`      = the number was asked for and the read failed → "couldn’t count".
 * Plain module (no 'use client') — the server page builds the Memories event rows with it.
 * 🔒 lib/the-memories-picker-counts-say-something.test.ts
 */
import { formatCount } from '@/lib/format-number';

export const COULD_NOT_COUNT = 'couldn’t count';

export type CountTrail = { text: string; tone: 'muted'; label?: string };

export function countTrail(n: number | null | undefined): CountTrail | undefined {
  if (n === undefined) return undefined;
  if (n === null || !Number.isFinite(n)) return { text: COULD_NOT_COUNT, tone: 'muted', label: '— not the same as none' };
  return { text: formatCount(n), tone: 'muted' };
}
