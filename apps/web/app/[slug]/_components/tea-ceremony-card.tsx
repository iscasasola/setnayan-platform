import { Leaf } from 'lucide-react';
import { isChineseWedding, type CeremonyOverlayInput } from '@/lib/chinese-wedding';
import { WEDDING_TRADITIONS_GUIDE } from '@/lib/wedding-traditions';

/**
 * Guest-facing tea-ceremony (敬茶) card on the public /[slug] page.
 *
 * Renders ONLY when the event is a Chinese (Tsinoy) wedding — primary OR
 * secondary rite — via the shared isChineseWedding() predicate (the common
 * church-primary + Chinese-secondary case is the must-not-skip one).
 *
 * PRIVACY (paramount): /[slug] is guest-facing / anonymous. This card is STATIC
 * tradition copy ONLY — never the guest roster, never the serving order's names,
 * no PII. The serving-order list (which DOES carry guest names) lives behind the
 * auth-gated couple tool at /dashboard/[eventId]/guests/tea-ceremony, never here.
 *
 * The body copy reuses the canonical 敬茶 note from WEDDING_TRADITIONS_GUIDE so
 * the guest-facing card and the couple's /paperwork guide stay one source of
 * truth (no re-typed drift). Styled with the same terracotta/cream/ink tokens
 * the ScheduleWidget uses, mirroring the DressCodeWidget guest-widget precedent.
 */

/** The canonical guest-safe 敬茶 note from the traditions guide (single source). */
const TEA_NOTE: string =
  WEDDING_TRADITIONS_GUIDE.chinese.items.find((i) => i.label === 'Tea ceremony (敬茶)')?.note ??
  'The couple kneels and serves tea to elders in order of seniority — the groom’s side first, then the bride’s — formally joining each family. Elders drink, give a blessing, and offer ang pao (red envelopes) or gold.';

export function TeaCeremonyCard({ event }: { event: CeremonyOverlayInput }) {
  if (!isChineseWedding(event)) return null;

  // Pahina (design 2026-07-25 §7): plate grammar, gild mono key, display-face
  // rite name. Unnumbered — it is a conditional companion to the details
  // chapter, not a chapter of its own. Copy is untouched (single source of
  // truth stays WEDDING_TRADITIONS_GUIDE).
  return (
    <section className="space-y-4">
      <h2 className="pahina-eyebrow">
        <span>Chinese tradition</span>
      </h2>
      <div className="pahina-plate">
        <div className="flex items-start gap-2.5">
          <Leaf aria-hidden className="mt-1 h-4 w-4 shrink-0 text-gild" strokeWidth={1.5} />
          <div className="min-w-0">
            <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-gild">
              Ceremony
            </p>
            <p className="mt-1 font-pahina text-xl font-light leading-snug text-ink">
              Tea ceremony (敬茶)
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink/70">{TEA_NOTE}</p>
      </div>
    </section>
  );
}
