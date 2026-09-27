'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { makerSave } from '@/lib/maker-refresh';
import type { HubSectionCanvas } from '@/lib/hub-canvas';
import { HERO_DESIGNS, HERO_DESIGN_LABEL, heroDesignLabel, heroDesignOf, withHeroDesign } from '@/lib/hero-design';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import { hubDraftAction } from '../../website/hub-draft-actions';

/**
 * 🎴 THE HERO'S DESIGN — ONE dropdown on the Hero page (owner rule: any set of
 * choices is one dropdown on the shared `PickMenu`, never a pill row).
 *
 * Owner, 2026-09-26: *"designs are the initial design, they can always improve
 * it."* A pick lays out the hero's parts in one of four arrangements
 * (`lib/hero-design.ts`); every part stays tap-to-edit on the canvas, and the
 * couple's per-part edits (`canvas.elements`) ride along untouched — a pick
 * writes the SAME canvas with only `design` changed (`withHeroDesign`).
 *
 * 💾 THE DRAFT, NEVER LIVE: a pick posts `hubDraftAction` intent=save with the
 * hero row's WHOLE canvas (the draft replaces a canvas whole — `mergeHubDraft`),
 * built from the draft-over-live canvas the page handed in. Guests see it after
 * Apply. 🔑 The latest canvas is a REF, not the prop (`element-sheet.tsx`'s
 * rule): two quick picks would otherwise both build on the canvas from before
 * the first save.
 */
export function MakerHeroDesignPicker({
  eventId,
  canvas,
  liveCanvas,
}: {
  eventId: string;
  /** The hero row's canvas, draft over live. */
  canvas: HubSectionCanvas;
  /** The hero row's LIVE canvas — what guests see today. */
  liveCanvas: HubSectionCanvas;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<HubSectionCanvas>(canvas);
  const [shown, setShown] = useState(heroDesignOf(canvas));
  const live = heroDesignOf(liveCanvas);

  const pick = (key: string) => {
    const design = HERO_DESIGNS.find((d) => d === key);
    if (!design || design === shown) return;
    const next = withHeroDesign(latest.current, design);
    latest.current = next;
    setShown(design);
    start(async () => {
      setError(null);
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        fd.set('patch', JSON.stringify({ widgets: { hero: { canvas: next } } }));
        const r = await makerSave(() => hubDraftAction(eventId, fd), () => router.refresh());
        if (!r.ok) setError(r.error);
      } catch {
        setError('Your design could not be saved. Please try again.');
      }
    });
  };

  return (
    <div className="flex flex-col gap-1.5" data-maker-hero-design={shown} aria-busy={pending || undefined}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[13px] font-semibold text-ink">Design</span>
        <PickMenu
          label="Your hero's design"
          value={shown}
          options={HERO_DESIGNS.map((d) => ({ key: d, label: heroDesignLabel(d) }))}
          onPick={pick}
          dataAttr="data-hero-design-pick"
        />
      </div>
      <p className="text-[12.5px] text-ink/65">
        {HERO_DESIGN_LABEL[shown].suits} Tap any part of it on the canvas to change its font, colour, size or motion.
      </p>
      {shown !== live ? (
        <p className="text-[12px] font-semibold text-terracotta-700" data-made-once-drafted="">
          In your draft — guests see it after you Apply.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-[12.5px] text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
