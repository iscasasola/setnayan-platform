'use client';

/** The comparison sheet, open from the start, for the lab's screenshot. DEV-ONLY (lives under /dev). */
import { useState } from 'react';
import { QuoteVersionsCompare } from '@/app/_components/quote-versions-compare';
import type { QuoteVersion } from '@/lib/quote-versions';

export function QuoteVersionsCompareLab({ versions }: { versions: QuoteVersion[] }) {
  const [open, setOpen] = useState(true);
  return <QuoteVersionsCompare versions={versions} open={open} onClose={() => setOpen(false)} />;
}

import { OfferDropCard } from '@/app/_components/chat/cards/offer-card';
import type { DroppableOffer } from '@/app/_components/chat/cards/offer-calls';

/** The supplier's drop card on fixture offers (its close does nothing in the lab). */
export function OfferDropLab({ seed, startStep }: { seed: DroppableOffer[]; startStep: number }) {
  return <OfferDropCard threadId="00000000-0000-4000-8000-00000000c0de" onClose={() => {}} seed={seed} startStep={startStep} />;
}
