/**
 * A COVERED ROW SAYS WHY — the one place a supplier shown under a category
 * their package "also covers" is named.
 *
 * Owner 2026-09-21 ruled that a supplier's "Also covers" (`event_vendors.
 * covers_plan_groups`) "auto populate to the other categories". Owner
 * 2026-10-21, on Seda Vertis North shown locked under Cake, Catering and Bridal
 * Car with nothing else: it looked like a bug. Verbatim: *"Put '· with
 * Reception' on the covered rows"*. So a covered row reads
 * **"Seda Vertis North · with Reception"** — the supplier, then the category
 * they were actually booked under (`ShortlistVendor.includedWith`, the label of
 * their home row).
 *
 * Every surface that draws a covered row names it through `coveredRowName` —
 * the Find row's collapsed line (`lockedNamesOf`), the Build line, its dropdown
 * and the "This build" card. No surface spells " · with " itself. Held by
 * `lib/a-covered-row-says-why.test.ts`.
 *
 * Dependency-free on purpose: the client Find body, the pure Build lib and the
 * labs all import it.
 */

/** "Seda Vertis North · with Reception" for a covered copy; the bare name otherwise. */
export function coveredRowName(name: string, includedWith: string | null | undefined): string {
  const from = includedWith?.trim();
  return from ? `${name} · with ${from}` : name;
}

/**
 * The names a collapsed Find row lists under itself — its booked suppliers,
 * each through `coveredRowName`. A row's own bookings come first and covered
 * copies last, so "· with Reception" always sits right after the supplier it
 * belongs to and never reads as if it were about the name before it.
 */
export function lockedNamesOf(
  vendors: ReadonlyArray<{ name: string; status: string; includedWith: string | null }>,
): string[] {
  const locked = vendors.filter((v) => v.status === 'locked');
  return [
    ...locked.filter((v) => !v.includedWith),
    ...locked.filter((v) => v.includedWith),
  ].map((v) => coveredRowName(v.name, v.includedWith));
}
