/**
 * lib/chart-source-hues.ts — "Where couples found you": ONE fixed hue per source, the same on every screen (owner 22 Nov
 * 2026, DECISION_LOG "ANALYTICS GRAPHS: COLOUR BY MEANING, NOT THE THEME COLOUR"). The hues are the chart tokens
 * `--color-chart-src-1…5` (globals.css, light + dark); a source not named here is quiet grey. The label always stays
 * beside the bar, so colour is never the only signal.
 *
 * The keys are the `source` values the shop-view and booking writers stamp (`vendor_profile_views.source`,
 * `event_vendors.source`; labels in `lib/vendor-funnel.ts` SOURCE_LABELS).
 */
export type SourceHue = 'src-1' | 'src-2' | 'src-3' | 'src-4' | 'src-5' | 'quiet';

const HUE_OF: Readonly<Record<string, SourceHue>> = {
  // Setnayan search
  search: 'src-1',
  host_marketplace_search: 'src-1',
  // Your shop link
  profile_direct: 'src-2',
  external_promo: 'src-2',
  // Browsing a category
  explore_card: 'src-3',
  category: 'src-3',
  // A friend's share
  share: 'src-4',
  referral: 'src-4',
  // Saved by the couple
  favorites: 'src-5',
  shortlist: 'src-5',
};

/** The hue a source wears everywhere. */
export function sourceHue(key: string): SourceHue {
  return HUE_OF[key] ?? 'quiet';
}

/** The CSS colour for a source's bar — a token, never a hex. */
export function sourceHueColor(key: string): string {
  return `rgb(var(--color-chart-${sourceHue(key)}))`;
}
