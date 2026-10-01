import type { LucideIcon } from 'lucide-react';
import {
  BadgeCheck,
  BarChart3,
  BookOpen,
  CalendarCheck,
  CalendarSearch,
  Columns2,
  CreditCard,
  FileSignature,
  Film,
  Footprints,
  Handshake,
  Inbox,
  ListChecks,
  Package,
  Receipt,
  ShieldCheck,
  Store,
  Trophy,
  UserCog,
  Wallet,
  Building2,
} from 'lucide-react';
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
  checklist: ListChecks,
  date: CalendarSearch,
  compare: Columns2,
  contracts: FileSignature,
  traditions: BookOpen,
  std: Film,
  march: Footprints,
  helpers: UserCog,
  store: Store,
  package: Package,
  inbox: Inbox,
  'calendar-check': CalendarCheck,
  earnings: Wallet,
  performance: BarChart3,
  branches: Building2,
  verified: BadgeCheck,
  shield: ShieldCheck,
  handshake: Handshake,
  receipt: Receipt,
  subscription: CreditCard,
  challenge: Trophy,
};

export function featureIcon(name: FeatureIconName): LucideIcon {
  return (EVENT_MENU_ICONS as Record<string, LucideIcon>)[name] ?? FEATURE_EXTRA_ICONS[name as FeatureExtraIconName];
}
