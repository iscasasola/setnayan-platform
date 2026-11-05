/**
 * 🎨 EVERY COLOUR CARRIES ITS NAME (owner 2026-10-24, on the Me redraw: "the colors have names, so they can find the
 * color name easier") — a guest-page swatch's word is what it colours, then the colour's own name ("Gown · Garnet"),
 * from the Mood Board's own resolver (`nearestColorName` — curated wedding names first, CSS names second, never a code).
 * The name alone when the dot says nothing of its own, or says the same name.
 */
import { nearestColorName } from './color-names';

export function wordWithColourName(d: { hex: string; word: string }): string {
  const name = nearestColorName(d.hex);
  if (!name) return d.word;
  return d.word && d.word.toLowerCase() !== name.toLowerCase() ? `${d.word} · ${name}` : name;
}
