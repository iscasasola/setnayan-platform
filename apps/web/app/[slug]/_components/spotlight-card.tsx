import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { HomeSpotlight } from '@/lib/site-body-plan';
import { SITE_MENU_ANCHORS } from '../_lib/site-menu';

/**
 * Home's one signature spotlight under open-browse (OPEN-BROWSE PR7 — council
 * verdict 2026-07-22 §1.1 Home tab). The lifecycle phase decides what Home
 * leads with; `resolveSiteBodyPlan` computes the identity-aware pick
 * (lib/site-body-plan.ts `pickHomeSpotlight`). This renders ONLY on the
 * normal-body phases (rsvp / event) — the `save_the_date` and `editorial`
 * spotlights ARE the full-body moments (the STD film / the editorial cover),
 * so their `spotlight.kind` renders nothing here.
 *
 * Dormant in production: mounted only when `plan.spotlight` is non-null, which
 * happens solely when `events.website_open_browse` is TRUE (DEFAULT FALSE).
 *
 * NOTE (PR7→PR8 seam): copy + visual treatment here are intentionally minimal
 * and neutral — the brand-voice pass + designed empty/teaser states are PR8
 * (owner copy sign-off). This is the functional lead card PR8 restyles.
 */
export function SpotlightCard({
  spotlight,
  occasion = 'celebration',
}: {
  spotlight: HomeSpotlight;
  /** EventWords.occasion — 'celebration' (default) or the funeral's 'gathering'. */
  occasion?: string;
}) {
  const content = spotlightContent(spotlight, occasion);
  if (!content) return null;
  return (
    <Link
      href={content.href}
      className="group mt-6 flex items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-white/70 px-5 py-4 text-left shadow-sm transition hover:border-terracotta/40 hover:bg-white"
    >
      <span className="space-y-1">
        <span className="block font-mono text-[0.65rem] uppercase tracking-[0.2em] text-terracotta">
          {content.eyebrow}
        </span>
        <span className="block font-serif text-lg text-ink">{content.title}</span>
      </span>
      <ArrowRight
        aria-hidden
        className="h-5 w-5 shrink-0 text-ink/40 transition group-hover:translate-x-0.5 group-hover:text-terracotta"
      />
    </Link>
  );
}

function spotlightContent(
  spotlight: HomeSpotlight,
  occasion: string,
): { eyebrow: string; title: string; href: string } | null {
  switch (spotlight.kind) {
    case 'rsvp':
      return {
        eyebrow: 'Your invitation',
        title: `RSVP for the ${occasion}`,
        href: `#${SITE_MENU_ANCHORS.me}`,
      };
    case 'find_invite':
      return {
        eyebrow: 'Invited?',
        title: 'Find your invitation',
        href: `#${SITE_MENU_ANCHORS.me}`,
      };
    case 'watch_live':
      return {
        eyebrow: 'Happening now',
        title: `Watch the ${occasion} live`,
        href: `#${SITE_MENU_ANCHORS.gallery}`,
      };
    // std_film / countdown / editorial_cover are full-body moments — no card.
    default:
      return null;
  }
}
