import Link from 'next/link';
import { PencilLine } from 'lucide-react';

import type { OwnerRibbonModel } from '@/lib/owner-ribbon';
import { OwnerPhaseMenu } from './owner-phase-menu';

/**
 * OWNER LAYER · surface 1 — the owner ribbon (owner-locked 2026-07-26).
 *
 * The event owner opens `/[slug]` like a guest and gets an owner layer ON TOP.
 * This is that layer's first surface: a discreet strip that tells the host what
 * they are looking at, hands them the doorway back to editing, and exposes the
 * four lifecycle-phase previews `page.tsx` already authorises for hosts but
 * never advertised.
 *
 * READ-ONLY. One link, one "Preview ▾" dropdown and a line of type. No form,
 * no action, no mutation. (The four phase pills became ONE dropdown on
 * 2026-10-03 — owner, on the live hub: "too many buttons"; `OwnerPhaseMenu`.)
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
      /* 👁 The host's own controls stay pressable while the page is drawn for a See as sample (sample-viewer-inert.tsx). */
      data-owner-ribbon=""
      className="sticky top-0 z-[90] mb-8 border border-ink/10 bg-paper-deep/95 px-4 py-2.5 backdrop-blur"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink/70">
          Your Event Hub — as a guest sees it
        </p>

        <Link
          href={model.editorHref}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3 py-1 text-xs font-medium text-ink/75 hover:border-terracotta hover:text-terracotta-700"
        >
          <PencilLine aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          {model.editorLabel}
        </Link>

        {model.phaseLinks.length > 0 || model.seeAsLinks.length > 0 ? (
          <OwnerPhaseMenu links={model.phaseLinks} seeAs={model.seeAsLinks} />
        ) : null}
      </div>
    </aside>
  );
}
