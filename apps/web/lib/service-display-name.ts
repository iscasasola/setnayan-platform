/**
 * 🎂 A SERVICE'S SHOWN NAME, WHEN THE SEED'S WORDS ARE WRONG FOR THE EVENT (W1-B22, supplier walk 16 Nov 2026).
 *
 * The Cake category's only service is `wedding_cake`, seeded (`iteration_0044_top15_seeds`) with the display name
 * "Wedding cake" — and the same service is offered for a Birthday, a Christening and every other event, where a
 * "Wedding cake" reads wrong. It shows as "Cake".
 *
 * DISPLAY ONLY. The key (`wedding_cake`) is the taxonomy's canonical id and is NOT renamed here — the taxonomy is owned
 * elsewhere (PRs #7887 / #7893). And the name stays the admin's (`canonical_service_schemas.display_name_en`, edited in
 * Admin › Categories — owner 2026-10-29, "never a label map in code"): a correction applies ONLY while the stored name
 * is still the exact seeded words it corrects. The moment an admin writes any other name, theirs is shown, untouched —
 * so this table can only ever retire itself, never fight an admin.
 *
 * Pure: no I/O. 🔒 lib/service-display-name.test.ts
 */

/** key → { the seeded words being corrected, what is shown instead }. */
const SEED_NAME_CORRECTIONS: Readonly<Record<string, { seeded: string; shown: string }>> = {
  wedding_cake: { seeded: 'Wedding cake', shown: 'Cake' },
};

/**
 * The name to show for a service: the stored name, corrected only when it is still the seed's exact words (or blank,
 * where the caller's key-words fallback would print the same wrong words). Otherwise blank stays blank — each caller
 * keeps its own fallback for a key with no name.
 */
export function serviceDisplayName(key: string, stored: string | null | undefined): string {
  const name = (stored ?? '').trim();
  const fix = SEED_NAME_CORRECTIONS[key];
  if (fix && (name === '' || name.toLowerCase() === fix.seeded.toLowerCase())) return fix.shown;
  return name;
}
