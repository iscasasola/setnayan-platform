'use client';

/**
 * 📅 Draws its children in the picked head, under the title (`PickedHeadLineContext`, CHAT-09); outside a picked shell
 * — or before the slot exists — it draws them where it stands, so the words are never lost.
 */
import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PickedHeadLineContext } from './picked-nav';

export function PickedHeadLine({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const slot = useContext(PickedHeadLineContext);
  if (!slot) return <>{fallback}</>;
  return createPortal(children, slot);
}
