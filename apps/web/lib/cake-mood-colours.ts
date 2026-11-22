/**
 * 🎂🎨 The couple's own Mood Board colours, as "Design your cake" lists them FIRST (ruling 6 · drawing §02): the Cake
 * part (it follows Neutral until the couple sets it), then the five main colours — Dominant · Supporting · Accent ·
 * Neutral · Accent 2. Named with the board's own namer. Server-side only in practice (the colour-name table stays out of
 * the couple's first load); pure, so it is tested.
 */
import { CAKE_LANE_PARTS, MAIN_COLOUR_SLOTS, lanePartColour } from './colour-access';
import { nearestColorName } from './color-names';
import type { RolePalette } from './mood-board';
import type { MoodCakeColour } from './cake-maker';

const HEX = /^#[0-9a-fA-F]{6}$/;

export function moodCakeColours(palette: RolePalette): MoodCakeColour[] {
  const mainFive = (palette.reception ?? []).filter((h) => HEX.test(h)).slice(0, 5);
  const cakeSet = Boolean(palette.room_dressing?.cake);
  // An empty board shows no "From your Mood Board" — never the theme's stand-ins dressed up as theirs.
  if (mainFive.length === 0 && !cakeSet) return [];
  const out: MoodCakeColour[] = [];
  const seen = new Set<string>();
  const push = (hex: string, slot: string, setByYou: boolean) => {
    const h = hex.toLowerCase();
    if (!HEX.test(h) || seen.has(h)) return;
    seen.add(h);
    out.push({ hex: h, name: nearestColorName(h) ?? 'Colour', slot, setByYou });
  };
  for (const part of CAKE_LANE_PARTS) {
    const c = lanePartColour(part, mainFive, palette);
    push(c.hex, part.label, c.setByYou);
  }
  mainFive.forEach((hex, i) => push(hex, MAIN_COLOUR_SLOTS[i] ?? 'Colour', true));
  return out;
}
