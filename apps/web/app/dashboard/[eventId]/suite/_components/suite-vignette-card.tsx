import Link from 'next/link';
import { type LucideIcon } from 'lucide-react';
import type { RowPill } from '../../studio/_components/studio-app-row';
import { ServiceTags } from '../../studio/_components/service-tags';
import styles from './suite-vignette.module.css';

/**
 * SuiteVignetteCard — Suite PR-2 (Whats_Next_Suite_AI_Pricing §2): each
 * sellable feature renders as an ANIMATED VIGNETTE of its outcome — a small
 * CSS-only stage that shows what the feature DOES (Pakanta's song playing,
 * the LED mark glowing, the couple's website hero, …) — instead of the plain
 * StudioAppRow. Personalized where cheaply derivable: the couple's display
 * name, monogram initials, and event date are already one select away on the
 * Suite page, so the browser hero wears THEIR names and the LED wall glows
 * with THEIR initials.
 *
 * Server component — zero client JS. All motion is CSS keyframes in the
 * colocated suite-vignette.module.css (transform/opacity only); the universal
 * `prefers-reduced-motion: reduce` block in globals.css freezes every scene
 * to a still poster frame. The stage is aria-hidden decoration — the real
 * content (label · blurb · price pill · CTA) is plain text below it.
 *
 * Suite-only: /studio keeps its StudioAppRow untouched (PR-2 contract).
 */

/** Cheaply-derivable personalization already available on the Suite page. */
export type VignettePersona = {
  /** The event's display name — "Maria & Juan". Falls back to 'Your day'. */
  names: string;
  /** The lockup label — "M & J" (monogram_text override or derived). */
  initials: string;
  /** Formatted event date ("March 14, 2027"), or null while it settles. */
  dateLabel: string | null;
};

type Props = {
  /** Catalog key — picks the vignette scene; unknown keys get the fallback. */
  vignette: string;
  href: string;
  label: string;
  blurb: string;
  cta: string;
  Icon: LucideIcon;
  /** The feature's poster gradient — the stage backdrop. */
  gradient: string;
  pill: RowPill;
  persona: VignettePersona;
  /** Browse/filter chips shown under the blurb. */
  tags?: readonly string[];
};

/** Pill tone classes — mirrors StudioAppRow's PillEl so price/status reads
 *  identically across the row and card idioms. */
const PILL_CLS: Record<NonNullable<RowPill>['tone'], string> = {
  price: 'bg-ink/[0.06] text-mulberry',
  free: 'bg-ink/[0.06] text-mulberry',
  trial: 'bg-terracotta/10 text-terracotta-700',
  active: 'bg-success-100 text-success-900',
  pending: 'border border-warn-300/60 bg-warn-50 text-warn-900',
  soon: 'bg-ink/5 text-ink/45',
};

/** The animated scene for a catalog key. Every scene is pure decoration
 *  (aria-hidden on the stage) built from divs + one inline SVG — no images,
 *  no client JS, no new deps. */
function Scene({ vignette, persona }: { vignette: string; persona: VignettePersona }) {
  switch (vignette) {
    case 'setnayan-ai':
      // Vendor matches sliding to the top of the couple's list.
      return (
        <>
          <span className={styles.aiSpark} />
          <div className={styles.aiRow} />
          <div className={styles.aiRow} />
          <div className={styles.aiRow} />
        </>
      );
    case 'website-pro':
      // Their website hero — names + date — with the premium sheen passing.
      return (
        <div className={styles.browser}>
          <div className={styles.browserBar}>
            <i />
            <i />
            <i />
          </div>
          <div className={styles.browserBody}>
            <span className={styles.browserNames}>{persona.names}</span>
            {persona.dateLabel ? (
              <span className={styles.browserDate}>{persona.dateLabel}</span>
            ) : null}
            <span className={styles.sheen} />
          </div>
        </div>
      );
    case 'editorial-pro':
      // The front page composing itself under their masthead.
      return (
        <div className={styles.paper}>
          <span className={styles.masthead}>{persona.names}</span>
          <div className={styles.edBody}>
            <span className={styles.edPhoto} />
            <span className={styles.edLines}>
              <i />
              <i />
              <i />
            </span>
          </div>
        </div>
      );
    case 'pakanta':
      // Their song, playing.
      return (
        <>
          <span className={styles.songTitle}>♪ {persona.names}</span>
          <div className={styles.eq}>
            {Array.from({ length: 10 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
        </>
      );
    case 'custom-qr-guest':
      // A guest QR wearing their mark at the centre.
      return (
        <div className={styles.qrCard}>
          <div className={styles.qrGrid}>
            {Array.from({ length: 25 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
          <span className={styles.qrBadge}>
            <span>{persona.initials}</span>
          </span>
        </div>
      );
    case 'papic':
      // Candids landing in the gallery as guests shoot.
      return (
        <>
          <div className={styles.snap}>
            <i />
          </div>
          <div className={styles.snap}>
            <i />
          </div>
          <div className={styles.snap}>
            <i />
          </div>
        </>
      );
    case 'patiktok':
      // A vertical reel, mid-play.
      return (
        <div className={styles.phone}>
          <span className={styles.reelGlow} />
          <span className={styles.reelBar}>
            <i />
          </span>
          <span className={styles.playTri} />
        </div>
      );
    case 'led':
      // Their mark, twenty feet tall on the stage screen.
      return (
        <>
          <div className={styles.mark}>
            <span className={styles.ledMark}>{persona.initials}</span>
          </div>
          <span className={styles.stageLine} />
          <div className={styles.crowd}>
            {Array.from({ length: 7 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
        </>
      );
    case 'indoor-blueprint':
      // Door to table — the guided path drawing itself.
      return (
        <>
          <span className={styles.bpGrid} />
          <svg className={styles.bpSvg} viewBox="0 0 100 60" aria-hidden>
            <rect className={styles.bpDoor} x="4" y="46" width="10" height="10" />
            <path className={styles.bpPath} d="M9 46 V30 H48 V14 H82" />
            <circle className={styles.bpTable} cx="86" cy="14" r="8" />
            <circle className={styles.bpSeat} cx="86" cy="14" r="2.5" />
          </svg>
        </>
      );
    default:
      // Fallback — their initials under a drifting gold ambience.
      return (
        <>
          <span className={styles.glow} />
          <div className={styles.mark}>
            <span className="text-3xl">{persona.initials}</span>
          </div>
        </>
      );
  }
}

export function SuiteVignetteCard({
  vignette,
  href,
  label,
  blurb,
  cta,
  Icon,
  gradient,
  pill,
  persona,
  tags,
}: Props) {
  return (
    <li data-reveal-item className="list-none">
      <Link href={href} className={styles.card}>
        {/* The vignette stage — decorative; everything real is below. */}
        <div aria-hidden className={styles.stage} style={{ background: gradient }}>
          <Scene vignette={vignette} persona={persona} />
          {/* Feature icon anchor — bottom-left, same iconography as the rows. */}
          <span className="absolute bottom-3 left-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-ink/35 text-cream ring-1 ring-white/25 backdrop-blur-sm">
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </span>
        </div>

        <div className="space-y-1 p-4">
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-0 truncate text-[15px] font-semibold text-ink">{label}</span>
            {pill ? (
              <span
                className={`shrink-0 rounded-full px-3 py-0.5 text-xs font-bold tracking-tight ${PILL_CLS[pill.tone]}`}
              >
                {pill.text}
              </span>
            ) : null}
          </div>
          <p className="line-clamp-2 text-[13px] leading-snug text-ink/60">{blurb}</p>
          <ServiceTags tags={tags} className="pt-1" />
          <p className="pt-0.5 text-[13px] font-medium text-terracotta-700">
            {cta} <span aria-hidden>›</span>
          </p>
        </div>
      </Link>
    </li>
  );
}
