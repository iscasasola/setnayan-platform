'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { PrintQrMode } from '@/lib/supplier-prints';

/**
 * 🔗 THE CODE CARRIES ONTO THE PRINTS (owner 2026-11-06, QR codes Option B: *"B"* — a code's sheet ends with
 * "Put it on…", and the prints carry THIS code). One ask, from the QR codes list to the Prints sheet on the same page:
 * which code, and whether to open straight on the door print (the 6 Nov ruling moved the door sticker INTO Prints —
 * "the door print and the badge print are pieces INSIDE prints").
 *
 * Nothing is stored: the ask lives while the page is open, like the Prints sheet's own Design ▾ and QR ▾.
 */
export type PutOnAsk = { qr: PrintQrMode; piece: 'door' | null; n: number };

type Bridge = { ask: PutOnAsk | null; putOn: (qr: PrintQrMode, piece: 'door' | null) => void };

const PromoteBridgeCtx = createContext<Bridge | null>(null);

export function PromoteBridge({ children }: { children: ReactNode }) {
  const [ask, setAsk] = useState<PutOnAsk | null>(null);
  const putOn = useCallback((qr: PrintQrMode, piece: 'door' | null) => setAsk((a) => ({ qr, piece, n: (a?.n ?? 0) + 1 })), []);
  return <PromoteBridgeCtx.Provider value={{ ask, putOn }}>{children}</PromoteBridgeCtx.Provider>;
}

/** Null outside Shop › Promote (Customers › QR codes has no prints) — the caller then draws no "Put it on…". */
export function usePromoteBridge(): Bridge | null {
  return useContext(PromoteBridgeCtx);
}
