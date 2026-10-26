'use client';

import type { ReactNode } from 'react';
import { InspectorSheetAlone } from '@/app/_components/inspector/inspector-column';

/**
 * `?part=card&frame=panel` — the card in the REAL sheet the Guest list opens it in (`InspectorSheetAlone`: the peek, its
 * sticky eyebrow · name · reply header with the face and ✕, the 440 panel from 701), so the header and the body scrolling
 * under it can be looked at as a phone shows them (owner, live iPhone 2026-10-26: "Overlap"). ✕ / Escape / the peek do
 * nothing here — the lab has no list to go back to.
 */
export function LabCardSheet({ children }: { children: ReactNode }) {
  return <InspectorSheetAlone onClose={() => undefined}>{children}</InspectorSheetAlone>;
}
