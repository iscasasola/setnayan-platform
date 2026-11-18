/**
 * 🗓 W1-B18 (walked live on 8c1bbc1, 16 Nov 2026): a brand-new shop pressed Clients › + Add, typed a name and a date,
 * and was told "Pick which schedule this client belongs to. Nothing was added." — with NO schedule picker on screen
 * (one schedule draws none). The sheet had posted an EMPTY `pool_id`.
 *
 * THE ONE RULE, used by the sheet AND by `importExternalClient`: the schedule posted wins; with none posted and exactly
 * ONE schedule, it is that one (there is nothing to pick); with several and none posted, nothing — the sheet shows its
 * picker then. Never an empty string.
 */
export function outsideClientPoolOf(posted: string | null | undefined, pools: ReadonlyArray<{ poolId: string }>): string | null {
  const p = typeof posted === 'string' ? posted.trim() : '';
  if (p) return p;
  const real = pools.map((x) => (typeof x.poolId === 'string' ? x.poolId.trim() : '')).filter(Boolean);
  return real.length === 1 ? (real[0] as string) : null;
}
