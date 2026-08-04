import Link from 'next/link';
import { PencilLine } from 'lucide-react';

import type { OwnerRibbonModel } from '@/lib/owner-ribbon';

/**
 * OWNER LAYER · surface 1 — the owner ribbon (owner-locked 2026-07-26).
 *
 * The event owner opens `/[slug]` like a guest and gets an owner layer ON TOP.
 * This is that layer's first surface: a discreet strip that tells the host what
 * they are looking at, hands them the doorway back to editing, and exposes the
 * four lifecycle-phase previews `page.tsx` already authorises for hosts but
 * never advertised.
 *
 * READ-ONLY. Four links and some type. No form, no action, no mutation.
 *
 * THE GATE IS UPSTREAM AND SINGULAR. This component renders nothing unless it
 * is handed a model, and the ONLY producer of a model is `buildOwnerRibbon()`,
 * which requires the server-verified `OwnerCapability`. There is no second
 * check here — deliberately: a UI-side "…and also look like a host" test would
 * be exactly the mistake the 2026-07-26 security review named (the UI is not
 * the boundary, the DB is).
 *
 * WHERE IT MOUNTS — above `<article data-pahina-chapters>`, not inside it.
 * The article's direct children are hidden until the scroll observer reveals
 * them (§6 choreography); the ribbon is CHROME, not a chapter, so it must be
 * on screen the moment the page paints. Mounting it as a sibling of the
 * identity trees inside `InvitationShell` also means ONE mount point covers
 * both the guest and anonymous bodies and every lifecycle phase.
 *
 * `sticky` rather than `fixed`: it keeps the ribbon reachable while the host
 * scrolls without taking the page out of flow, and `z-[90]` clears the
 * Save-the-Date stack (film z-50/70, reveal z-60, touch glow z-80) so a host
 * previewing `?phase=save_the_date` can still click their way back out.
 */
export function OwnerRibbon({ model }: { model: OwnerRibbonModel | null }) {
  if (!model) return null;
  return (
    <aside
      aria-label="Host controls"
      className="sticky top-0 z-[90] mb-8 border border-ink/10 bg-paper-deep/95 px-4 py-2.5 backdrop-blur"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink/70">
          Your live site — as a guest sees it
        </p>

        <Link
          href={model.editorHref}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3 py-1 text-xs font-medium text-ink/75 hover:border-terracotta hover:text-terracotta"
        >
          <PencilLine aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Edit this site
        </Link>

        {model.phaseLinks.length > 0 ? (
          <nav aria-label="Preview a phase" className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-ink/55">
              Preview
            </span>
            {model.phaseLinks.map((link) => (
              <Link
                key={link.phase}
                href={link.href}
                aria-current={link.active ? 'page' : undefined}
                className={
                  link.active
                    ? 'rounded-full border border-terracotta bg-terracotta/10 px-2.5 py-1 text-[0.7rem] font-medium text-terracotta-700'
                    : 'rounded-full border border-ink/15 px-2.5 py-1 text-[0.7rem] text-ink/65 hover:border-terracotta hover:text-terracotta'
                }
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </aside>
  );
}
