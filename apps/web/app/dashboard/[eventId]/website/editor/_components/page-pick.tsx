'use client';

import { Activity, BookOpen, CalendarClock, Camera, Home, Images, Info, Radio, User, type LucideIcon } from 'lucide-react';
import type { MakerGuestPage } from '@/lib/maker-guest-pages';
import type { NavSlotKey } from '@/app/[slug]/_lib/site-nav';
import { PickMenu } from './pick-menu';

/**
 * 📄 PAGE ▾ — the guest's pages on the stage being edited, as ONE dropdown at
 * the top of the navigator (owner 2026-09-30; `lib/maker-guest-pages.ts`).
 *
 * The words come from the guest bar itself (`resolveSiteNav`); the icons are
 * the guest bar's own (`site-menu-bar.tsx` ICONS), held equal by
 * `the-page-dropdown-is-the-guest-bar.test.ts`. A page of this one with no
 * scenes on this stage is listed but not pickable, with its reason — never a
 * pick that goes nowhere. Me, and a page that leaves (the Camera), are
 * pickable: the navigator then says what they are.
 */
export const GUEST_PAGE_ICON: Readonly<Partial<Record<NavSlotKey, LucideIcon>>> = {
  live: Activity,
  home: Home,
  details: Info,
  schedule: CalendarClock,
  story: BookOpen,
  camera: Camera,
  watch: Radio,
  gallery: Images,
  me: User,
};

export function MakerPagePick({
  pages,
  value,
  onPick,
}: {
  pages: readonly MakerGuestPage[];
  value: string;
  onPick: (page: MakerGuestPage) => void;
}) {
  return (
    <PickMenu
      label="Page"
      dataAttr="data-maker-page-pick"
      value={value}
      options={pages.map((p) => {
        const Icon = GUEST_PAGE_ICON[p.key];
        return {
          key: p.key,
          label: p.label,
          ...(Icon ? { icon: <Icon className="h-4 w-4" strokeWidth={1.75} /> } : {}),
          ...(!p.leaves && p.key !== 'me' && p.tiles.length === 0 ? { disabledNote: 'nothing to arrange yet' } : {}),
        };
      })}
      onPick={(key) => {
        const page = pages.find((p) => p.key === key);
        if (page) onPick(page);
      }}
      className="flex-1"
    />
  );
}
