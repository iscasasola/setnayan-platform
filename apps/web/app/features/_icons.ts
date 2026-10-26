import { GLYPHS, type IconComponent as LucideIcon } from '@/app/_components/icon/icon-map';
import { EVENT_MENU_ICONS } from '@/lib/customer-menu';
import type { FeatureExtraIconName, FeatureIconName } from '@/lib/feature-pages';

/**
 * The /features glyphs. A feature that has a row in the app's own menu wears
 * THAT row's icon (`EVENT_MENU_ICONS`, the shipped sidebar set — owner
 * 2026-10-01: *"neeeds to be icons"*), so Papic on this page is the same
 * camera a host sees in their event. Only features with no menu row draw from
 * the short list below. Server-only use: nothing here crosses into a client
 * component (a component across that boundary took production down on
 * 2026-09-23 — see `EventMenuIconName`).
 */
const FEATURE_EXTRA_ICONS: Record<FeatureExtraIconName, LucideIcon> = {
  checklist: GLYPHS['list-checks'],
  date: GLYPHS['calendar-search'],
  compare: GLYPHS['columns-2'],
  contracts: GLYPHS['file-signature'],
  traditions: GLYPHS['book-open'],
  std: GLYPHS.film,
  march: GLYPHS.footprints,
  helpers: GLYPHS['user-cog'],
  store: GLYPHS.store,
  package: GLYPHS.package,
  inbox: GLYPHS.inbox,
  'calendar-check': GLYPHS['calendar-check'],
  earnings: GLYPHS.wallet,
  performance: GLYPHS['bar-chart-3'],
  branches: GLYPHS['building-2'],
  verified: GLYPHS['badge-check'],
  shield: GLYPHS['shield-check'],
  handshake: GLYPHS.handshake,
  receipt: GLYPHS.receipt,
  printer: GLYPHS.printer,
  shirt: GLYPHS.shirt,
  subscription: GLYPHS['credit-card'],
  challenge: GLYPHS.trophy,
};

export function featureIcon(name: FeatureIconName): LucideIcon {
  return (EVENT_MENU_ICONS as Record<string, LucideIcon>)[name] ?? FEATURE_EXTRA_ICONS[name as FeatureExtraIconName];
}
