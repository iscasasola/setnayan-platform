'use client';

import { Activity, BookOpen, CalendarClock, Camera, Home, Images, Info, Radio, User, type LucideIcon } from 'lucide-react';
import type { NavSlotKey } from '@/app/[slug]/_lib/site-nav';

/**
 * 📄 PAGE ▾'S ICONS — the guest's pages, each with the icon the guest's own
 * bar draws for it (`site-menu-bar.tsx` ICONS), held equal by
 * `the-page-dropdown-is-the-guest-bar.test.ts`.
 *
 * ✂ THE MAKER IN 4 (2026-10-02): the dropdown itself moved from the top of the
 * navigator to the Maker's toolbar, where it holds every stage with its pages
 * (`maker-shell.tsx`, `makerPageMenu` in `maker-bar.ts`) — design frame D:
 * "This replaces the stage tabs in today's top bar and the navigator column".
 * Only the icons live here now; the words still come from the guest bar itself
 * (`resolveSiteNav`, via `lib/maker-guest-pages.ts`).
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
