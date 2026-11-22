'use client';

/**
 * 🎂 "DESIGN YOUR CAKE FOR US" — the shop's invite, posted from its ＋ › For your service › Ask for a cake design (Cake
 * Maker v6 §03; DECISION_LOG 2026-11-21 "CAKE MAKER v6 = THE BUILD REFERENCE").
 *
 *   · the couple → Design your cake: the designer opens (full screen on a phone, the split view on a computer).
 *   · the shop   → "Waiting for their design" — the design arrives as its own card in this chat.
 */
import { lazy, Suspense, useState } from 'react';
import { CakeSlice, Clock } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import css from './cake-design-card.module.css';

const CakeDesigner = lazy(() => import('@/app/_components/cake-maker/cake-designer').then((m) => ({ default: m.CakeDesigner })));

export function CakeInviteCard({
  threadId,
  viewer,
  shopName,
  stamp = null,
  onSent,
}: {
  threadId: string;
  viewer: 'couple' | 'vendor';
  shopName: string;
  /** "You · 10:12" / "Dulce Cakes · 10:12" under the card. */
  stamp?: string | null;
  /** After the couple sends a design from here — the chat refreshes. */
  onSent?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className={css.rcard} aria-label="Design your cake for us" data-cake-invite={viewer}>
      <div className={css.rh}>
        <CakeSlice aria-hidden width={18} height={18} className={css.ic} />
        <b>Design your cake for us</b>
      </div>
      <p className={css.lline}>{shopName} · Cake Maker</p>
      <p className={css.lline}>Pick the tiers, shape, colours and accents in 3D. We’ll quote from your design.</p>
      {viewer === 'couple' ? (
        <div className={css.ra}>
          <ActionButton tone="brand" main icon={CakeSlice} label="Design your cake" onClick={() => setOpen(true)} data-cake-invite-open="" />
        </div>
      ) : (
        <p className={css.lline} role="status" data-cake-invite-waiting="">
          <Clock aria-hidden width={14} height={14} />
          <span>Waiting for their design</span>
        </p>
      )}
      {stamp ? <p className={css.meta}>{stamp}</p> : null}
      {open ? (
        <Suspense fallback={null}>
          <CakeDesigner threadId={threadId} onClose={() => setOpen(false)} onSent={onSent} />
        </Suspense>
      ) : null}
    </section>
  );
}
