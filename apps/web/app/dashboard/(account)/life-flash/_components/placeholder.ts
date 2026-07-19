/**
 * Life Story · deterministic placeholder "film stills" — shared by the reel
 * tiles and the flash layers for moments with no signed URL (fixtures, or a
 * signing miss). Never a broken image, never randomness.
 */

/** Deterministic hue pair from an id (FNV-1a hash → two hues). */
export function placeholderBackground(id: string): string {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hue1 = (h >>> 0) % 360;
  const hue2 = ((h >>> 12) % 360 | 0) % 360;
  return `linear-gradient(160deg, hsl(${hue1} 35% 30%), hsl(${hue2} 30% 16%))`;
}

/** A face-orb gradient from a person's name (memoriam faces go cool silver). */
export function orbBackground(name: string, memoriam: boolean): string {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hue = memoriam ? 222 : (h >>> 0) % 360;
  const sat = memoriam ? 18 : 58;
  return `radial-gradient(circle at 35% 30%, hsl(${hue} ${sat}% 58%), hsl(${hue} ${Math.max(sat - 6, 14)}% 32%))`;
}
