/**
 * 🥇 The No. 1 seal's door: its art (~150 KB, `no1-seal-svg.ts`) is fetched only when asked for, never in a page's
 * first load. `<SealPlaque variant="no1">` with no `seal` calls this itself on the tap that opens it.
 *
 * ⚠ What EARNS No. 1 is an open owner question — nothing outside the kit may offer it until he rules.
 */
export function loadNo1Seal(year: string | number, fit: 'card' | 'arch' = 'card', uid?: string): Promise<string> {
  return import(/* webpackChunkName: "award-no1" */ './no1-seal-svg').then((m) => m.no1Seal(year, fit, uid));
}
