/**
 * 🧹 RW-167 (re-walk at c0c8ff4, 14 Nov 2026): the shop's "Services shown first" listed "Lights & Sound" AND "Lights
 * Sound". The shop made only one: the second was its own service under an older key spelling (`lights_sound` beside
 * `lights_and_sound`) that the category list no longer names, so it fell back to a title-cased guess and read as a
 * second service. Same family as F-W1-35/42.
 *
 * One service, one row: keys that are the same words once punctuation and "and" are set aside are ONE service, and the
 * key the category list knows wins (its label is the real one). A key that matches nothing else stays, even unknown —
 * it is still the shop's own service.
 */
export type ShopServiceRow = { key: string; label: string };

/** The words a service key spells, set apart from how they are joined (`lights_and_sound` ≡ `lights-sound`). */
export function serviceKeyStem(key: string): string {
  return key
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && w !== 'and')
    .join('');
}

export function distinctShopServices(
  keys: readonly string[],
  labels: Readonly<Record<string, string>> | undefined,
  fallback: (key: string) => string,
): ShopServiceRow[] {
  const byStem = new Map<string, ShopServiceRow & { known: boolean; at: number }>();
  keys.forEach((key, at) => {
    const known = Boolean(labels?.[key]);
    const row = { key, label: labels?.[key] ?? fallback(key), known, at };
    const stem = serviceKeyStem(key) || key;
    const had = byStem.get(stem);
    // The first spelling holds its place; a known key replaces an unknown one there.
    if (!had) byStem.set(stem, row);
    else if (!had.known && known) byStem.set(stem, { ...row, at: had.at });
  });
  return [...byStem.values()].sort((a, b) => a.at - b.at).map(({ key, label }) => ({ key, label }));
}
