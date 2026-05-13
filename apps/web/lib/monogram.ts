export type MonogramConfig = {
  text: string;       // e.g., "M & J"
  color: string;      // terracotta or whatever the couple picked
  bg?: string;        // monogram badge background; defaults to cream
};

const DEFAULT_BG = '#FAF7F2'; // cream

/**
 * Derive a default monogram label from an event's display name.
 *   "Maria & Juan"          → "M & J"
 *   "Maria and Juan"        → "M & J"
 *   "Maria & Juan (Demo)"   → "M & J"
 *   "Aira-Boy"              → "A & B"
 *   "Setnayan"              → "S"
 *
 * Couples can override via events.monogram_text in the Branding section.
 */
export function deriveMonogram(displayName: string | null | undefined): string {
  if (!displayName) return 'S';
  // Strip parenthetical annotations like "(Demo)" first.
  const cleaned = displayName.replace(/\s*\([^)]*\)\s*/g, '').trim();
  // Split on "&", "and" (case-insensitive), or hyphens.
  const parts = cleaned
    .split(/\s*(?:&|and|\+|\/|-)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    const a = parts[0]?.charAt(0)?.toUpperCase() ?? 'S';
    const b = parts[1]?.charAt(0)?.toUpperCase() ?? 'S';
    return `${a} & ${b}`;
  }
  return (parts[0]?.charAt(0) ?? 'S').toUpperCase();
}

export function resolveMonogram(event: {
  display_name: string | null;
  monogram_text: string | null;
  monogram_color: string | null;
}): MonogramConfig {
  return {
    text: (event.monogram_text?.trim() || deriveMonogram(event.display_name)).slice(0, 12),
    color: event.monogram_color ?? '#C97B4B',
    bg: DEFAULT_BG,
  };
}

/**
 * Build the SVG fragment that composites a monogram into the center of a QR
 * code rendered in module-unit coordinates. The QR generator we use
 * (`qrcode` npm) emits an SVG whose viewBox is in module units (e.g., 41×41
 * for a level-H QR encoding a ~80-char URL).
 *
 * The badge covers ~7×7 modules ≈ 3% of the pattern area — well under the
 * 25% coverage limit that level H (~30% redundancy) can reconstruct.
 */
export function monogramOverlaySvg(opts: {
  viewBoxSize: number;
  monogram: MonogramConfig;
}): string {
  const { viewBoxSize, monogram } = opts;
  const cx = viewBoxSize / 2;
  const cy = viewBoxSize / 2;

  // Badge sizing in module units.
  const padR = Math.max(3, viewBoxSize * 0.08); // outer rounded-rect padding radius
  const circleR = Math.max(2.5, viewBoxSize * 0.135);
  // Font sizing scales with text length so "A & B" and "MJB" both fit.
  const textLen = monogram.text.length;
  const fontSize = textLen <= 1
    ? circleR * 1.4
    : textLen <= 3
      ? circleR * 0.95
      : textLen <= 5
        ? circleR * 0.7
        : circleR * 0.55;

  const safeText = escapeXml(monogram.text);
  const fill = escapeAttr(monogram.bg ?? DEFAULT_BG);
  const stroke = escapeAttr(monogram.color);

  // Layered: rounded-rect clearance (cream) → circle border (terracotta) → text.
  return `
    <rect x="${cx - padR}" y="${cy - padR}" width="${padR * 2}" height="${padR * 2}" rx="${padR * 0.35}" fill="${fill}" />
    <circle cx="${cx}" cy="${cy}" r="${circleR}" fill="${fill}" stroke="${stroke}" stroke-width="${Math.max(0.5, viewBoxSize * 0.018)}" />
    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-family="ui-serif, Georgia, serif" font-style="italic" font-weight="600" font-size="${fontSize}" fill="${stroke}">${safeText}</text>
  `;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;');
}

/**
 * Inject the monogram overlay just before `</svg>` in a QR SVG string.
 * Returns the original string if no `</svg>` is found (defensive).
 */
export function compositeMonogram(qrSvg: string, monogram: MonogramConfig): string {
  const viewBoxMatch = qrSvg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  const size = viewBoxMatch?.[1] ? parseFloat(viewBoxMatch[1]) : 33;
  const overlay = monogramOverlaySvg({ viewBoxSize: size, monogram });
  if (!qrSvg.includes('</svg>')) return qrSvg;
  return qrSvg.replace('</svg>', `${overlay}</svg>`);
}
