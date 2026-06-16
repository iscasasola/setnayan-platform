import {
  ADD_ONS,
  addOnHref,
  type AddOnEntry,
  type StudioGroup,
} from '@/lib/add-ons-catalog';
import { StudioCard } from './_components/studio-card';

// The cinema-poster card (service-poster.tsx) still owns the `PosterStyle`
// type that the catalog + Services tab consume, so it is intentionally kept.
// Re-export the type from its canonical home so existing imports of
// `PosterStyle` from this page module keep resolving.
export type { PosterStyle } from './_components/service-poster';

export const metadata = { title: 'Studio' };

type Props = { params: Promise<{ eventId: string }> };

/**
 * Studio hub — benefit-led, job-to-be-done discovery surface for every
 * Setnayan in-app service. Replaces the cinema-poster grid (owner directive
 * 2026-06-14 · REDESIGN_PLAN Phase 2) with calm v2.1 paper cards grouped by
 * what the couple is trying to *do*, not by vendor taxonomy.
 *
 * Four sections (fixed order): Capture the day · Your website & story ·
 * Plan & organize (free) · Music & extras. Within each section, available
 * cards come first and coming-soon cards sink to the bottom.
 */

// The 4 Studio sections (owner-locked 2026-06-17 customer-menu redesign — Studio
// absorbed Design). These ARE Studio's docked sub-nav (lib/customer-menu.ts anchor
// children scroll to `anchor`). The `utility` group (Orders) is intentionally
// absent → hidden from the hub. Order matches the sub-nav.
const SECTIONS: ReadonlyArray<{ group: StudioGroup; label: string; anchor: string }> = [
  { group: 'setnayan_ai', label: 'Setnayan AI', anchor: 'studio-ai' },
  { group: 'website', label: 'Website', anchor: 'studio-website' },
  { group: 'capture', label: 'Capture', anchor: 'studio-capture' },
  { group: 'branding', label: 'Branding', anchor: 'studio-branding' },
];

/** Available add-ons first; coming-soon sinks to the bottom (stable order). */
function comingSoonLast(a: AddOnEntry, b: AddOnEntry): number {
  const av = a.status === 'coming_soon' ? 1 : 0;
  const bv = b.status === 'coming_soon' ? 1 : 0;
  return av - bv;
}

export default async function StudioPage({ params }: Props) {
  const { eventId } = await params;

  return (
    <section className="space-y-10">
      <header className="space-y-2">
        <p
          className="m-eyebrow font-mono text-[11px] uppercase tracking-[0.22em]"
          style={{ color: 'var(--m-orange-2)' }}
        >
          Studio
        </p>
        <h1
          className="text-3xl font-semibold tracking-tight sm:text-4xl"
          style={{ color: 'var(--m-ink)' }}
        >
          Everything you can make with Setnayan
        </h1>
        <p className="max-w-prose text-base" style={{ color: 'var(--m-slate)' }}>
          Pick a tool to add to your event — from candid capture to your public
          website, planning aids, and music. New ones light up as they ship.
        </p>
      </header>

      {/* Alaala — the pillar framing. The memory features below (capture · your
          website & story · music) are the pieces of the couple's living memory;
          the free planning tools stay practical. Names the pillar + states the
          guardrail (the tech never intrudes). Calm v2.1 surface, --m-* tokens. */}
      <div
        className="rounded-2xl border p-5 sm:p-6"
        style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)' }}
      >
        <p
          className="m-eyebrow font-mono text-[11px] uppercase tracking-[0.22em]"
          style={{ color: 'var(--m-orange-2)' }}
        >
          Alaala · the memory you keep
        </p>
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed" style={{ color: 'var(--m-ink)' }}>
          The pieces below become your <span className="italic">Alaala</span> — the living memory of
          your day. The moments you’ll be too busy to see, the people who can’t be there, the stories
          your guests tell — all kept, and made into something you hold forever.
        </p>
        <p className="mt-2 max-w-prose text-[13px] leading-relaxed" style={{ color: 'var(--m-slate)' }}>
          And it never gets in the way. The day stays yours — the tech just quietly remembers it.
        </p>
      </div>

      {SECTIONS.map(({ group, label, anchor }) => {
        const addOns = ADD_ONS.filter((a) => a.studioGroup === group).slice().sort(
          comingSoonLast,
        );

        // Nothing to show for this section → skip it.
        if (addOns.length === 0) return null;

        return (
          // id + scroll-mt: the Studio docked sub-nav (lib/customer-menu.ts) scrolls
          // here and the scroll-spy lights the section in view.
          <div key={group} id={anchor} className="scroll-mt-24 space-y-4">
            <h2
              className="m-eyebrow font-mono text-[11px] uppercase tracking-[0.2em]"
              style={{ color: 'var(--m-slate)' }}
            >
              {label}
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {addOns.map((addon) => {
                const comingSoon = addon.status === 'coming_soon';
                return (
                  <StudioCard
                    key={addon.key}
                    label={addon.label}
                    blurb={addon.blurb}
                    Icon={addon.Icon}
                    href={comingSoon ? null : addOnHref(addon.key, eventId)}
                    comingSoon={comingSoon}
                    free={addon.tier === 'free'}
                    freeTrial={addon.freeTrial}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
