import {
  tierForInquiriesDriven,
  CREATOR_TIER_LABEL,
} from '@/lib/creator-tiers';

/**
 * CreatorTierChip — the DECORATION-of-a-number band (Nano/Micro/Macro/Mega) that
 * renders next to the raw "inquiries driven" line on /u and the vendor Creators
 * browse cards (Creator Economy P3 · owner 2026-07-16).
 *
 * Deliberately DISTINCT from the gold Storyteller CreatorBadge: this is an
 * INK-toned outline pill (no gold, no sparkle star), so the two never read as
 * "one better seal." The Storyteller badge is IDENTITY (free, universal); this
 * chip is a rendering of proven influence, and it renders NOTHING below tier
 * (inquiriesDriven = 0 → tierForInquiriesDriven returns null → no chip), exactly
 * like the raw count it accompanies. Passing the same `inquiriesDriven` the
 * count uses keeps the two in lockstep — the chip can never appear without the
 * number.
 *
 * Self-contained inline styles referencing the --m-* / --font-* CSS vars so it's
 * portable across the /u header and the vendor dashboard (which don't share a
 * stylesheet), matching CreatorBadge's approach.
 */
export function CreatorTierChip({
  inquiriesDriven,
  size = 'sm',
  className,
}: {
  inquiriesDriven: number;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const tier = tierForInquiriesDriven(inquiriesDriven);
  if (!tier) return null; // no tier at 0 — Storyteller badge stands alone
  const md = size === 'md';
  return (
    <span
      className={className}
      title={`${CREATOR_TIER_LABEL[tier]} storyteller · ${inquiriesDriven} inquiries driven`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: md ? '0.24em 0.62em' : '0.18em 0.5em',
        borderRadius: 'var(--m-r-full, 999px)',
        border: '1px solid color-mix(in srgb, var(--m-ink, #26201b) 22%, transparent)',
        background: 'color-mix(in srgb, var(--m-ink, #26201b) 6%, transparent)',
        color: 'var(--m-slate, #55504a)',
        fontFamily:
          "var(--font-mono-marketing), var(--font-mono), 'JetBrains Mono', ui-monospace, monospace",
        fontSize: md ? '0.64rem' : '0.58rem',
        fontWeight: 600,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
      }}
    >
      {CREATOR_TIER_LABEL[tier]}
    </span>
  );
}
