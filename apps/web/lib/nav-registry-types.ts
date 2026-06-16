// Shared types for the admin-managed nav / icon / menu registry.
// No imports → safe to use from server (resolver) AND client (DynamicIcon, editor).
// See `Nav_Icon_Menu_Registry_Design_2026-06-16.md` for the full model.

export type NavAccountScope = 'customer' | 'vendor' | 'admin' | 'public' | 'shared';
export type NavIconKind = 'lucide' | 'custom' | 'none';
export type NavLabelKind = 'literal' | 'i18nKey';

/** One slot's baked-in default (lives in code: lib/nav-registry-defaults.ts). */
export interface NavSlotDefault {
  /** Stable key — overrides reference this; never rename in place. */
  key: string;
  scope: NavAccountScope;
  area: string;
  route: string | null;
  label: string;
  labelKind: NavLabelKind;
  iconKind: NavIconKind;
  /** Lucide component name when iconKind === 'lucide'. */
  lucideName: string | null;
  /** Inline custom-mark ref (e.g. 'SetnayanMark') when iconKind === 'custom'. */
  customRef: string | null;
  sortOrder: number;
}

/** Admin override row (DB: public.nav_slot_override) — only changed slots exist. */
export interface NavSlotOverrideRow {
  slot_key: string;
  label: string | null;
  icon_kind: NavIconKind | null;
  lucide_name: string | null;
  custom_url: string | null;
  is_hidden: boolean;
}

/** Client-safe icon descriptor consumed by <DynamicIcon> (no server deps). */
export interface NavIconDescriptor {
  kind: NavIconKind;
  /** Lucide component name (kind === 'lucide'). */
  lucideName: string | null;
  /** Inline custom-mark ref (kind === 'custom', from a code default). */
  customRef: string | null;
  /** Uploaded image URL (kind === 'custom', from an admin upload). */
  customUrl: string | null;
}

/** Default merged with its override → what the app renders. */
export interface ResolvedNavSlot {
  key: string;
  scope: NavAccountScope;
  area: string;
  route: string | null;
  label: string;
  labelKind: NavLabelKind;
  icon: NavIconDescriptor;
  isHidden: boolean;
  isOverridden: boolean;
  sortOrder: number;
  /** The baked default, for diff display + reset affordances. */
  default: { label: string; icon: NavIconDescriptor };
}

/** Minimal serializable slot — safe to pass server→client to nav renderers. */
export interface NavSlotLite {
  label: string;
  icon: NavIconDescriptor;
  isHidden: boolean;
}
