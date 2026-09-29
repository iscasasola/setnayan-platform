'use client';

import { BookOpen, Home, Info, User, type LucideIcon } from 'lucide-react';
import type { GuestPageKey, MakerGuestPage } from '@/lib/maker-guest-pages';
import { PickMenu } from './pick-menu';

/**
 * 📄 PAGE ▾ — the guest's pages, Home · Details · Story · Me, as ONE dropdown at
 * the top of the navigator (owner 2026-09-30; `lib/maker-guest-pages.ts`).
 *
 * The icons are the guest bar's own (`site-menu-bar.tsx` ICONS), held equal by
 * `the-page-dropdown-is-the-guest-bar.test.ts`, so the couple sees the page the
 * way a guest's bar names it. A page with no scenes on this stage is listed but
 * not pickable, with its reason — never a pick that goes nowhere. Me is always
 * pickable: the navigator then says what Me is (`ME_NOT_ON_CANVAS`).
 */
export const GUEST_PAGE_ICON: Readonly<Record<GuestPageKey, LucideIcon>> = {
  home: Home,
  details: Info,
  story: BookOpen,
  me: User,
};

export function MakerPagePick({
  pages,
  value,
  onPick,
}: {
  pages: readonly MakerGuestPage[];
  value: GuestPageKey;
  onPick: (key: GuestPageKey) => void;
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
          icon: <Icon className="h-4 w-4" strokeWidth={1.75} />,
          ...(p.key !== 'me' && p.tiles.length === 0 ? { disabledNote: 'not on your page yet' } : {}),
        };
      })}
      onPick={(key) => {
        const page = pages.find((p) => p.key === key);
        if (page) onPick(page.key);
      }}
      className="flex-1"
    />
  );
}
