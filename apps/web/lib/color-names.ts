/**
 * Shared color-naming library. Every hex color in the Mood Board (palette
 * swatches, theme meta, concept PDF, vendor view) should show a real name,
 * not a bare hex code.
 *
 * Two layers, checked in priority order:
 *   1. WEDDING_NAMES — a curated set of names a couple actually recognizes
 *      for wedding/decor colors (elegant, Filipino-relevant where the color
 *      calls for it), matched first within a tight distance so a couple's
 *      blush pink reads as "Blush", not the generic CSS "Pink".
 *   2. CSS_NAMES — the 140 standard CSS Color Module named colors (sourced
 *      2026-09-02 from https://www.w3.org/TR/css-color-4/#named-colors,
 *      cross-checked against bahamas10/css-color-names), which guarantees
 *      EVERY possible hex resolves to some real, recognized name — the
 *      "complete" fallback layer. This is deliberately NOT the ~30k-entry
 *      crowdsourced meodai/color-names list: that dataset's names (e.g.
 *      "1989 Miami Hotline") don't fit a wedding platform's tone. Standard
 *      CSS names are safe, professional, and cover the full hue/lightness
 *      spectrum.
 *
 * Pure, deterministic, no AI call — same architecture as the rest of the
 * Setnayan-AI derivation layer (see apps/web/lib/setnayan-ai-cockpit.ts).
 */

export type NamedColor = { name: string; hex: string };

// Curated, wedding/décor-relevant names — checked first, tighter match radius.
export const WEDDING_NAMES: NamedColor[] = [
  { name: 'Ivory', hex: '#FFFFF0' },
  { name: 'Cream', hex: '#FAF7F2' },
  { name: 'Blush', hex: '#F4C2C2' },
  { name: 'Dusty Rose', hex: '#C9A0A0' },
  { name: 'Rose', hex: '#BE185D' },
  { name: 'Burgundy', hex: '#7A1F2B' },
  { name: 'Terracotta', hex: '#C97B4B' },
  { name: 'Rust', hex: '#824A2A' },
  { name: 'Champagne Gold', hex: '#C5A059' },
  { name: 'Gold', hex: '#D4AF37' },
  { name: 'Mustard', hex: '#D97706' },
  { name: 'Sage', hex: '#8A9A6B' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Forest Green', hex: '#3A5746' },
  { name: 'Sky Blue', hex: '#7DB8D9' },
  { name: 'Navy', hex: '#1E2540' },
  { name: 'Slate', hex: '#3A5766' },
  { name: 'Lavender', hex: '#C9B8D9' },
  { name: 'Plum', hex: '#5C2542' },
  { name: 'Charcoal', hex: '#1E2229' },
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Silver', hex: '#CFD3D6' },
  { name: 'Peach', hex: '#F0B27A' },
  { name: 'Coral', hex: '#E8735A' },
  // Filipino-relevant additions (owner directive 2026-09-02).
  { name: 'Piña Cream', hex: '#F2E8D5' },
  { name: 'Capiz Pearl', hex: '#EAE6DA' },
  { name: 'Sampaguita White', hex: '#FBFBF3' },
  { name: 'Narra Brown', hex: '#6B4226' },
  { name: 'Banana Leaf Green', hex: '#4C6B3F' },
  { name: 'Waling-Waling Purple', hex: '#8E4B8C' },
  { name: 'Bamboo Tan', hex: '#C7A76C' },
];

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  const hex6 = m?.[1];
  if (!hex6) return null;
  const n = parseInt(hex6, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function distSq(a: [number, number, number], b: [number, number, number]): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

/** Nearest match in a candidate table, by RGB Euclidean distance. */
function nearestIn(rgb: [number, number, number], table: NamedColor[]): { name: string; d: number } | null {
  let best: { name: string; d: number } | null = null;
  for (const nc of table) {
    const ncRgb = hexToRgb(nc.hex);
    if (!ncRgb) continue;
    const d = distSq(rgb, ncRgb);
    if (!best || d < best.d) best = { name: nc.name, d };
  }
  return best;
}

// Squared-distance radius (out of a max possible ~195075 for pure black↔white)
// within which a WEDDING_NAMES match wins over the CSS fallback — tuned so a
// couple's actual blush/terracotta/sage picks resolve to the evocative name,
// while an unrelated hex still falls through to a real CSS name rather than
// being force-fit to the nearest wedding term.
const WEDDING_NAME_RADIUS_SQ = 2400;

/**
 * Nearest color name for any hex — ALWAYS returns a real name (never null)
 * for a valid 6-digit hex, since CSS_NAMES guarantees full coverage.
 * Returns null only for an invalid/unparseable hex.
 */
export function nearestColorName(hex: string): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const weddingMatch = nearestIn(rgb, WEDDING_NAMES);
  if (weddingMatch && weddingMatch.d <= WEDDING_NAME_RADIUS_SQ) return weddingMatch.name;
  const cssMatch = nearestIn(rgb, CSS_NAMES);
  return cssMatch?.name ?? weddingMatch?.name ?? null;
}

// The 140 standard CSS Color Module named colors — the complete fallback.
export const CSS_NAMES: NamedColor[] = [
  { name: 'Alice Blue', hex: '#F0F8FF' },
  { name: 'Antique White', hex: '#FAEBD7' },
  { name: 'Aqua', hex: '#00FFFF' },
  { name: 'Aquamarine', hex: '#7FFFD4' },
  { name: 'Azure', hex: '#F0FFFF' },
  { name: 'Beige', hex: '#F5F5DC' },
  { name: 'Bisque', hex: '#FFE4C4' },
  { name: 'Black', hex: '#000000' },
  { name: 'Blanched Almond', hex: '#FFEBCD' },
  { name: 'Blue', hex: '#0000FF' },
  { name: 'Blue Violet', hex: '#8A2BE2' },
  { name: 'Brown', hex: '#A52A2A' },
  { name: 'Burly Wood', hex: '#DEB887' },
  { name: 'Cadet Blue', hex: '#5F9EA0' },
  { name: 'Chartreuse', hex: '#7FFF00' },
  { name: 'Chocolate', hex: '#D2691E' },
  { name: 'Coral', hex: '#FF7F50' },
  { name: 'Cornflower Blue', hex: '#6495ED' },
  { name: 'Cornsilk', hex: '#FFF8DC' },
  { name: 'Crimson', hex: '#DC143C' },
  { name: 'Dark Blue', hex: '#00008B' },
  { name: 'Dark Cyan', hex: '#008B8B' },
  { name: 'Dark Goldenrod', hex: '#B8860B' },
  { name: 'Dark Gray', hex: '#A9A9A9' },
  { name: 'Dark Green', hex: '#006400' },
  { name: 'Dark Khaki', hex: '#BDB76B' },
  { name: 'Dark Magenta', hex: '#8B008B' },
  { name: 'Dark Olive Green', hex: '#556B2F' },
  { name: 'Dark Orange', hex: '#FF8C00' },
  { name: 'Dark Orchid', hex: '#9932CC' },
  { name: 'Dark Red', hex: '#8B0000' },
  { name: 'Dark Salmon', hex: '#E9967A' },
  { name: 'Dark Sea Green', hex: '#8FBC8F' },
  { name: 'Dark Slate Blue', hex: '#483D8B' },
  { name: 'Dark Slate Gray', hex: '#2F4F4F' },
  { name: 'Dark Turquoise', hex: '#00CED1' },
  { name: 'Dark Violet', hex: '#9400D3' },
  { name: 'Deep Pink', hex: '#FF1493' },
  { name: 'Deep Sky Blue', hex: '#00BFFF' },
  { name: 'Dim Gray', hex: '#696969' },
  { name: 'Dodger Blue', hex: '#1E90FF' },
  { name: 'Firebrick', hex: '#B22222' },
  { name: 'Floral White', hex: '#FFFAF0' },
  { name: 'Forest Green', hex: '#228B22' },
  { name: 'Fuchsia', hex: '#FF00FF' },
  { name: 'Gainsboro', hex: '#DCDCDC' },
  { name: 'Ghost White', hex: '#F8F8FF' },
  { name: 'Gold', hex: '#FFD700' },
  { name: 'Goldenrod', hex: '#DAA520' },
  { name: 'Gray', hex: '#808080' },
  { name: 'Green', hex: '#008000' },
  { name: 'Green Yellow', hex: '#ADFF2F' },
  { name: 'Honeydew', hex: '#F0FFF0' },
  { name: 'Hot Pink', hex: '#FF69B4' },
  { name: 'Indian Red', hex: '#CD5C5C' },
  { name: 'Indigo', hex: '#4B0082' },
  { name: 'Ivory', hex: '#FFFFF0' },
  { name: 'Khaki', hex: '#F0E68C' },
  { name: 'Lavender', hex: '#E6E6FA' },
  { name: 'Lavender Blush', hex: '#FFF0F5' },
  { name: 'Lawn Green', hex: '#7CFC00' },
  { name: 'Lemon Chiffon', hex: '#FFFACD' },
  { name: 'Light Blue', hex: '#ADD8E6' },
  { name: 'Light Coral', hex: '#F08080' },
  { name: 'Light Cyan', hex: '#E0FFFF' },
  { name: 'Light Goldenrod Yellow', hex: '#FAFAD2' },
  { name: 'Light Gray', hex: '#D3D3D3' },
  { name: 'Light Green', hex: '#90EE90' },
  { name: 'Light Pink', hex: '#FFB6C1' },
  { name: 'Light Salmon', hex: '#FFA07A' },
  { name: 'Light Sea Green', hex: '#20B2AA' },
  { name: 'Light Sky Blue', hex: '#87CEFA' },
  { name: 'Light Slate Gray', hex: '#778899' },
  { name: 'Light Steel Blue', hex: '#B0C4DE' },
  { name: 'Light Yellow', hex: '#FFFFE0' },
  { name: 'Lime', hex: '#00FF00' },
  { name: 'Lime Green', hex: '#32CD32' },
  { name: 'Linen', hex: '#FAF0E6' },
  { name: 'Maroon', hex: '#800000' },
  { name: 'Medium Aquamarine', hex: '#66CDAA' },
  { name: 'Medium Blue', hex: '#0000CD' },
  { name: 'Medium Orchid', hex: '#BA55D3' },
  { name: 'Medium Purple', hex: '#9370DB' },
  { name: 'Medium Sea Green', hex: '#3CB371' },
  { name: 'Medium Slate Blue', hex: '#7B68EE' },
  { name: 'Medium Spring Green', hex: '#00FA9A' },
  { name: 'Medium Turquoise', hex: '#48D1CC' },
  { name: 'Medium Violet Red', hex: '#C71585' },
  { name: 'Midnight Blue', hex: '#191970' },
  { name: 'Mint Cream', hex: '#F5FFFA' },
  { name: 'Misty Rose', hex: '#FFE4E1' },
  { name: 'Moccasin', hex: '#FFE4B5' },
  { name: 'Navajo White', hex: '#FFDEAD' },
  { name: 'Navy', hex: '#000080' },
  { name: 'Old Lace', hex: '#FDF5E6' },
  { name: 'Olive', hex: '#808000' },
  { name: 'Olive Drab', hex: '#6B8E23' },
  { name: 'Orange', hex: '#FFA500' },
  { name: 'Orange Red', hex: '#FF4500' },
  { name: 'Orchid', hex: '#DA70D6' },
  { name: 'Pale Goldenrod', hex: '#EEE8AA' },
  { name: 'Pale Green', hex: '#98FB98' },
  { name: 'Pale Turquoise', hex: '#AFEEEE' },
  { name: 'Pale Violet Red', hex: '#DB7093' },
  { name: 'Papaya Whip', hex: '#FFEFD5' },
  { name: 'Peach Puff', hex: '#FFDAB9' },
  { name: 'Peru', hex: '#CD853F' },
  { name: 'Pink', hex: '#FFC0CB' },
  { name: 'Plum', hex: '#DDA0DD' },
  { name: 'Powder Blue', hex: '#B0E0E6' },
  { name: 'Purple', hex: '#800080' },
  { name: 'Rebecca Purple', hex: '#663399' },
  { name: 'Red', hex: '#FF0000' },
  { name: 'Rosy Brown', hex: '#BC8F8F' },
  { name: 'Royal Blue', hex: '#4169E1' },
  { name: 'Saddle Brown', hex: '#8B4513' },
  { name: 'Salmon', hex: '#FA8072' },
  { name: 'Sandy Brown', hex: '#F4A460' },
  { name: 'Sea Green', hex: '#2E8B57' },
  { name: 'Seashell', hex: '#FFF5EE' },
  { name: 'Sienna', hex: '#A0522D' },
  { name: 'Silver', hex: '#C0C0C0' },
  { name: 'Sky Blue', hex: '#87CEEB' },
  { name: 'Slate Blue', hex: '#6A5ACD' },
  { name: 'Slate Gray', hex: '#708090' },
  { name: 'Snow', hex: '#FFFAFA' },
  { name: 'Spring Green', hex: '#00FF7F' },
  { name: 'Steel Blue', hex: '#4682B4' },
  { name: 'Tan', hex: '#D2B48C' },
  { name: 'Teal', hex: '#008080' },
  { name: 'Thistle', hex: '#D8BFD8' },
  { name: 'Tomato', hex: '#FF6347' },
  { name: 'Turquoise', hex: '#40E0D0' },
  { name: 'Violet', hex: '#EE82EE' },
  { name: 'Wheat', hex: '#F5DEB3' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'White Smoke', hex: '#F5F5F5' },
  { name: 'Yellow', hex: '#FFFF00' },
  { name: 'Yellow Green', hex: '#9ACD32' },
];
