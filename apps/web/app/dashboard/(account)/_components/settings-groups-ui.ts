/**
 * settings-groups-ui.ts — what the two DRAWINGS of the settings groups share: the page's `SettingsShell` (its phone
 * list, its panes) and, from 701, the rail's `SettingsRailContext` (plan D5, 2026-11-13). One glyph per group and the
 * two window events by which a rail row asks the shell to open a group and the shell says which group it shows.
 *
 * Kept out of `lib/profile-settings-groups.ts` on purpose: that module is pure and the server action imports it.
 */
import { IdCard, LockKeyhole, ShieldCheck, SlidersHorizontal, UserRound, Utensils, type LucideIcon } from 'lucide-react';
import type { SettingsGroup } from '@/lib/profile-settings-groups';

export const SETTINGS_GROUP_ICONS: Record<SettingsGroup, LucideIcon> = {
  profile: UserRound,
  'guest-details': Utensils,
  privacy: ShieldCheck,
  security: LockKeyhole,
  preferences: SlidersHorizontal,
  account: IdCard,
};

/** A rail row → the shell: "open this group" (`detail` is the group). */
export const SETTINGS_GO_EVENT = 'sn:settings-go';
/** The shell → the rail: "this group is the one shown" (`detail` is the group). */
export const SETTINGS_SHOWN_EVENT = 'sn:settings-shown';
