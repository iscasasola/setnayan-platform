/**
 * 🗂 FORMS — a picked-client page (THE ONE BUILD, 8 Nov 2026 · v113).
 *
 * ⚠ STUB pushed by L2 at hour 0 so the mount in `clients/[eventId]/page.tsx` never conflicts. OWNER OF THIS
 * FILE: **C3 (B2 §2.7 — Form Maker + library)**. Until that lane fills it, it draws the section the client page drew before this build
 * (`shipped`), unchanged. Props come from `./context` — ask L2 (notes) for anything the context lacks.
 */
import type { PickedPageProps } from './context';

export function FormsPage({ shipped }: PickedPageProps) {
  return <>{shipped ?? null}</>;
}
