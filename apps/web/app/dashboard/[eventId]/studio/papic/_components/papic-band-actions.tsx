'use client';

import { useState, type ReactNode } from 'react';
import { ArrowDown, Plus } from 'lucide-react';
import { ActionButton } from '@/components/action-button';

/**
 * The top band's two doors: **Buy more** unfolds the shipped credit card in
 * place (server-rendered, handed in as `children` — no request on the tap) and
 * **See your N photos** jumps down to the gallery.
 */
export function PapicBandActions({
  buy,
  photos,
  defaultOpen = false,
  children,
}: {
  buy: boolean;
  /** "See your N photos" — only a measured number above 0. */
  photos: number | null;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const photosLabel = photos ? `See your ${photos.toLocaleString('en-PH')} ${photos === 1 ? 'photo' : 'photos'}` : null;
  if (!buy && !photosLabel) return null;
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        {buy ? (
          <ActionButton
            tone="ok"
            main
            icon={<Plus aria-hidden="true" strokeWidth={1.9} />}
            label="Buy more"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            data-testid="papic-band-buy"
          />
        ) : null}
        {photosLabel ? (
          <ActionButton
            tone="neutral"
            icon={<ArrowDown aria-hidden="true" strokeWidth={1.9} />}
            label={photosLabel}
            href="#papic-gallery"
            data-testid="papic-band-photos"
          />
        ) : null}
      </div>
      {buy ? (
        <div data-papic-band-panel="" hidden={!open} className="pt-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}
