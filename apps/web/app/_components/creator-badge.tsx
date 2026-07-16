/**
 * CreatorBadge — the visual seal for a public storyteller (owner sign-off,
 * 2026-07-16 build plan). NOT a loud "verified" checkmark: a compact, tasteful
 * GOLD pill in the atelier gold token (--m-orange #A9834B), a small four-point
 * star glyph + a Space Mono, uppercase, letter-spaced label. Luxurious-Filipino-
 * modern; reads on the light paper surfaces the /u profile + chapter pages use.
 *
 * The label is a single CONSTANT so the owner can flip 'Creator' → 'Kwentista'
 * (the council's Tagalog alternative) in one place without touching any surface.
 *
 * Self-contained inline styles (referencing the --m-* / --font-* CSS vars) so
 * the badge is portable across surfaces that don't share a stylesheet — the /u
 * header, the timeline cards, and the chapter-detail header all render it the
 * same way. Creator is USER-NATIVE (2026-07-16): render when the account has
 * published >=1 public chapter — a public storyteller (callers gate; there is no
 * is_creator flag).
 */

export const CREATOR_BADGE_LABEL = 'Creator';

type Size = 'sm' | 'md';

export function CreatorBadge({
  size = 'sm',
  className,
}: {
  size?: Size;
  className?: string;
}) {
  const md = size === 'md';
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.38em',
        padding: md ? '0.3em 0.72em' : '0.22em 0.6em',
        borderRadius: '999px',
        border:
          '1px solid color-mix(in srgb, var(--m-orange, #A9834B) 45%, transparent)',
        background:
          'color-mix(in srgb, var(--m-orange, #A9834B) 12%, transparent)',
        color: 'var(--m-orange-2, #8A6B39)',
        fontFamily:
          "var(--font-mono-marketing), var(--font-mono), 'JetBrains Mono', ui-monospace, monospace",
        fontSize: md ? '0.7rem' : '0.62rem',
        fontWeight: 600,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
      }}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        width={md ? 13 : 11}
        height={md ? 13 : 11}
        fill="var(--m-orange, #A9834B)"
        style={{ flex: '0 0 auto', display: 'block' }}
      >
        {/* Four-point sparkle — a soft star, not a checkmark. */}
        <path d="M12 1.6c.5 4.4 2.5 6.4 6.9 6.9 .4.05.4.55 0 .6-4.4.5-6.4 2.5-6.9 6.9-.05.4-.55.4-.6 0-.5-4.4-2.5-6.4-6.9-6.9-.4-.05-.4-.55 0-.6 4.4-.5 6.4-2.5 6.9-6.9.05-.4.55-.4.6 0Z" />
      </svg>
      <span>{CREATOR_BADGE_LABEL}</span>
    </span>
  );
}
