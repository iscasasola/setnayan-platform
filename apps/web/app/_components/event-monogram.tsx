import {
  deriveMonogram,
  resolveMonogram,
  resolveMonogramDesign,
  monogramFrameAssetUrl,
} from '@/lib/monogram';
import { MonogramMark, type MonogramMarkStyle } from '@/app/_components/monogram-mark';

/**
 * Circular monogram badge — iteration 0000 § event switcher (locked 2026-05-15).
 *
 * Renders the per-event monogram as the left-anchor of the dashboard chrome.
 * The text falls back to the derived monogram from `display_name` when the
 * couple has not set `events.monogram_text` yet (V1 scope is text-only — SVG
 * upload arrives with the Monogram Hero upgrade in iteration 0004).
 *
 * The pure presentational shape — no Link, no long-press — keeps it reusable
 * from both the outer dashboard chrome and the per-event header.
 */

type Event = {
  display_name: string | null;
  monogram_text: string | null;
  monogram_color: string | null;
  // Onboarding free-monogram design (owner-locked 2026-06-03). When present,
  // the badge renders the couple's chosen font + ink instead of the legacy
  // serif-italic + color. Optional — older / non-onboarding events have neither.
  monogram_frame_key?: string | null;
  monogram_font_key?: string | null;
  // Lockup style (bar · script · duo · framed · infinity) — owner 2026-06-04.
  // Authoritative when present; resolveMonogramDesign falls back to frame+font.
  monogram_style?: string | null;
};

type Size = 'sm' | 'md' | 'lg';

const SIZE_TOKENS: Record<Size, { box: string; text: string; px: number }> = {
  sm: { box: 'h-7 w-7', text: 'text-[10px]', px: 28 },
  md: { box: 'h-9 w-9', text: 'text-xs', px: 36 },
  lg: { box: 'h-11 w-11', text: 'text-sm', px: 44 },
};

/**
 * Pull the two lockup initials out of a resolved monogram label. The label is
 * "A & B" for couples (deriveMonogram / monogram_text), or a single "S" for
 * one-name events. Returns ['', ''] when there isn't a clean pair so the caller
 * can fall back to the letters-forward badge.
 */
function splitInitials(text: string): [string, string] {
  const parts = text.split('&').map((s) => s.trim()).filter(Boolean);
  const a = (parts[0]?.charAt(0) ?? '').toUpperCase();
  const b = (parts[1]?.charAt(0) ?? '').toUpperCase();
  return [a, b];
}

export function EventMonogram({
  event,
  size = 'md',
  className,
}: {
  event: Event;
  size?: Size;
  className?: string;
}) {
  const { text, color } = resolveMonogram({
    display_name: event.display_name,
    monogram_text: event.monogram_text,
    monogram_color: event.monogram_color,
  });
  // When the couple designed a monogram in onboarding, render their REAL created
  // mark so the switcher logo IS the onboarding monogram: the `framed` lockup
  // draws its gold filigree frame + initials (below); the four type-only lockups
  // render letters-forward in the chosen font + ink. Otherwise keep the legacy
  // serif-italic + color badge so older / non-onboarding events are unchanged.
  const design = resolveMonogramDesign({
    monogram_frame_key: event.monogram_frame_key,
    monogram_font_key: event.monogram_font_key,
    monogram_style: event.monogram_style,
  });
  const ink = design?.color ?? color;
  const { box, text: textSize, px } = SIZE_TOKENS[size];

  // Type-only lockup (bar · duo · script · infinity) → draw the couple's REAL
  // chosen mark, not just their initials in a font (owner 2026-06-13, reversing
  // the 2026-06-03 letters-forward lock). Needs BOTH initials — a single-name
  // event ("S") has no second glyph for the lockup, so it falls through to the
  // letters-forward badge below. `framed` is deliberately NOT a mark style: its
  // ornate gold ring is illegible at chrome size, so it keeps the framed branch.
  const markStyle: MonogramMarkStyle | null =
    design?.style === 'bar' ||
    design?.style === 'duo' ||
    design?.style === 'script' ||
    design?.style === 'infinity'
      ? design.style
      : null;
  if (markStyle && design) {
    const [ia, ib] = splitInitials(text);
    if (ia && ib) {
      return (
        <MonogramMark
          style={markStyle}
          a={ia}
          b={ib}
          fontFamily={design.fontFamily}
          fontStyle={design.fontStyle}
          letterSpacing={design.letterSpacing}
          color={ink}
          px={px}
          className={`shrink-0 ${box} ${className ?? ''}`}
          title={text}
        />
      );
    }
  }

  // Framed — the couple's REAL onboarding monogram: the gold frame webp + their
  // initials in the chosen font + ink, exactly like the onboarding medallion,
  // scaled to chrome size (owner "what the monogram looks like on the
  // onboarding" 2026-06-03). The frame IS the shape → no border/circle.
  if (design?.frameKey) {
    return (
      <span
        aria-hidden
        className={`relative inline-flex shrink-0 items-center justify-center ${box} ${
          className ?? ''
        }`
          .replace(/\s+/g, ' ')
          .trim()}
        style={{
          backgroundImage: `url(${monogramFrameAssetUrl(design.frameKey)})`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
        }}
      >
        <span
          style={{
            color: ink,
            fontFamily: design.fontFamily,
            fontStyle: design.fontStyle,
            letterSpacing: design.letterSpacing,
            fontSize: `${Math.max(7, Math.round(px * 0.28))}px`,
            lineHeight: 1,
            whiteSpace: 'nowrap',
            fontWeight: 600,
          }}
        >
          {text}
        </span>
      </span>
    );
  }

  // Letters-forward (a design with no frame) or legacy (no design): a bordered
  // cream circle with the initials in the chosen / fallback face.
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full border bg-cream font-semibold ${
        design ? '' : 'font-serif italic'
      } ${box} ${textSize} ${className ?? ''}`
        .replace(/\s+/g, ' ')
        .trim()}
      style={{
        color: ink,
        borderColor: ink,
        ...(design
          ? {
              fontFamily: design.fontFamily,
              fontStyle: design.fontStyle,
              letterSpacing: design.letterSpacing,
            }
          : {}),
      }}
    >
      {text}
    </span>
  );
}

/**
 * Empty-state "+" monogram — iteration 0000 § event switcher. Rendered when
 * the user has zero events and is therefore on the create-event empty state.
 */
export function EmptyEventMonogram({
  size = 'md',
  className,
}: {
  size?: Size;
  className?: string;
}) {
  const { box, text } = SIZE_TOKENS[size];
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-terracotta/50 bg-cream font-semibold text-terracotta ${box} ${text} ${
        className ?? ''
      }`.trim()}
    >
      +
    </span>
  );
}

// Re-export deriveMonogram so callers don't have to import from two places
// when they just want the default label.
export { deriveMonogram };
