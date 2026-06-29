/**
 * /admin/more — mobile overflow landing for the system-last tune-groups.
 *
 * WHY: nav tune 2026-06-15 (owner-approved — "6 tabs, keep 'Work'"). The
 * 2026-06-08 ops redesign crammed the desktop tune-groups into a mobile
 * accordion; the owner re-promoted Money + Insights to their own bottom-nav
 * tabs; the 2026-06-21 ≤5 reroster demoted Insights BACK into More (Money keeps
 * its tab). The 2026-06-28 vocabulary re-skin then split the former desktop
 * "Platform" group into three (Data Structure · Content & Media · Settings), so
 * More now carries Insights + those three sections — a flat card grid (same
 * renderer as /admin/directory + /admin/money), no accordion.
 *
 * Mirrors the desktop sidebar's successor groups (keys 'content' · 'media' ·
 * 'settings-group') per [[feedback_setnayan_orphan_prevention]]. Mobile carries
 * a pre-existing SUBSET — menus · refinements · hero-video · reveal-studio
 * · recaps are desktop-only and stay so (a parity gap that predates
 * this re-skin, not introduced by it).
 *
 * SCOPE: server component. Hidden at lg+ via lg:hidden — desktop reaches
 * these through the sidebar tune-groups.
 */

import {
  BarChart3,
  LineChart,
  Radar,
  TrendingUp,
  Bug,
  WifiOff,
  Settings,
  Compass,
  Tag,
  PartyPopper,
  Globe,
  Newspaper,
  Brain,
  Palette,
  Music,
  Church,
  BookOpen,
  Bell,
  CircleUser,
} from 'lucide-react';
import { MobileLandingGrid, type LandingItem } from '../_components/mobile-landing-grid';

export const metadata = { title: 'More · Admin' };

// Insights group — demoted from its dedicated bottom-nav tab in the 2026-06-21
// ≤5 reroster, and (2026-06-21 "More" redesign) expanded into its own labeled
// section here, mirroring the desktop sidebar Insights group (key 'funnels') 1:1.
const INSIGHTS_ITEMS: LandingItem[] = [
  {
    key: 'insights-pulse',
    label: 'Insights',
    href: '/admin/insights',
    icon: BarChart3,
    description: 'The daily analytics pulse — the hub for the surfaces below.',
  },
  {
    key: 'growth',
    label: 'Growth',
    href: '/admin/growth',
    icon: LineChart,
    description: 'Sign-ups, activation, and revenue trends over time.',
  },
  {
    key: 'intelligence',
    label: 'Intelligence',
    href: '/admin/intelligence',
    icon: Radar,
    description: 'Market and competitor signals worth acting on.',
  },
  {
    key: 'funnels',
    label: 'Funnels',
    href: '/admin/funnels',
    icon: BarChart3,
    description: 'Where couples and vendors drop off, step by step.',
  },
  {
    key: 'operations-hiring',
    label: 'Operations & Hiring',
    href: '/admin/operations-hiring',
    icon: TrendingUp,
    description: 'Team capacity and hiring signals against demand.',
  },
  {
    key: 'connection-logs',
    label: 'Connection logs',
    href: '/admin/connection-logs',
    icon: Bug,
    description: 'Integration and webhook health at a glance.',
  },
  {
    key: 'offline',
    label: 'Offline daemon',
    href: '/admin/offline',
    icon: WifiOff,
    description: 'Background jobs and the offline sync worker status.',
  },
];

// The former flat PLATFORM_ITEMS list, re-split 2026-06-28 to mirror the
// desktop sidebar's three successor groups (Data Structure · Content & Media ·
// Settings) per [[feedback_setnayan_orphan_prevention]]. NOTE: mobile carries a
// pre-existing subset — menus · refinements · hero-video · reveal-studio ·
// recaps are desktop-only and remain so (separate parity gap, not
// introduced by this re-skin).

// DATA STRUCTURE — the App-Engine structure lane (mirrors desktop key 'content').
const DATA_STRUCTURE_ITEMS: LandingItem[] = [
  {
    key: 'taxonomy',
    label: 'Taxonomy',
    href: '/admin/taxonomy',
    icon: Tag,
    description:
      'Canonical vendor service categories and the sub-category card tree.',
  },
  {
    key: 'event-types',
    label: 'Event Types',
    href: '/admin/event-types',
    icon: PartyPopper,
    description:
      'Create, launch, and retire the event types Setnayan plans — pickers and vendor checkboxes follow automatically.',
  },
  {
    key: 'onboarding',
    label: 'Onboarding',
    href: '/admin/onboarding',
    icon: Compass,
    description:
      'New-account onboarding settings grouped by type — background music and future per-flow knobs.',
  },
  {
    key: 'wedding-types',
    label: 'Wedding types',
    href: '/admin/wedding-types',
    icon: Church,
    description:
      'Per-religion launch gate — vendor and venue readiness vs an editable threshold; open, hold, or disable each wedding religion.',
  },
  {
    key: 'wedding-traditions',
    label: 'Wedding traditions',
    href: '/admin/wedding-traditions',
    icon: BookOpen,
    description:
      'Per-religion wedding-traditions content shown on the couple paperwork guide. Edit items, or reset to the latest starter content.',
  },
  {
    key: 'brain',
    label: 'Setnayan AI brain',
    href: '/admin/brain',
    icon: Brain,
    description:
      'Curated knowledge feeding the Setnayan AI chat. Browse chunks by topic.',
  },
];

// CONTENT & MEDIA — couple-facing publishing surfaces + asset libraries
// (mirrors desktop key 'media').
const CONTENT_MEDIA_ITEMS: LandingItem[] = [
  {
    key: 'website',
    label: 'Website',
    href: '/admin/website',
    icon: Globe,
    description:
      'Marketing site widget visibility and content toggles. Manage the public homepage and footer.',
  },
  {
    key: 'real-stories',
    label: 'Real Stories',
    href: '/admin/real-stories',
    icon: Newspaper,
    description:
      'Feature and order which consented wedding editorials surface on the public /realstories page, and pick the hero.',
  },
  {
    key: 'songs',
    label: 'Songs',
    href: '/admin/songs',
    icon: Music,
    description:
      'The owned music-track library that scores rendered videos. Manage tracks and categories.',
  },
  {
    key: 'moodboard-library',
    label: 'Moodboard library',
    href: '/admin/moodboard-library',
    icon: Palette,
    description:
      'Curated location and figure imagery for the 3-pillar mood board. Manage palettes and tags.',
  },
];

// SETTINGS — the "Global Configuration" region: system + personal config
// (mirrors desktop key 'settings-group').
const SETTINGS_ITEMS: LandingItem[] = [
  {
    key: 'settings',
    label: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    description:
      'Platform identity, business details, and Sentry smoke-test. Edit gated to internal admins.',
  },
  {
    key: 'notifications',
    label: 'Notifications',
    href: '/admin/notifications',
    icon: Bell,
    description:
      'Cross-actor signal reader — customer→vendor and admin signals in one inbox.',
  },
  {
    key: 'demo-mode',
    label: 'Demo mode',
    href: '/admin/settings/demo-mode',
    icon: Settings,
    description:
      'Pilot demo-mode toggle. Surfaces seeded showcase data and hides retired SKU surfaces.',
  },
  {
    // Mirrors the desktop sidebar's Settings → My account entry (account-
    // security suite 2026-06-11) so mobile admins also reach the shared
    // /dashboard/profile surface for password + session controls.
    key: 'my-account',
    label: 'My account',
    href: '/dashboard/profile',
    icon: CircleUser,
    description:
      'Your personal account — display name, change password, and sign out other devices.',
  },
];

export default function AdminMoreLanding() {
  return (
    <MobileLandingGrid
      title="More"
      subtitle="Insights, data structure, content, and settings."
      searchable
      groups={[
        { label: 'Insights', items: INSIGHTS_ITEMS },
        { label: 'Data Structure', items: DATA_STRUCTURE_ITEMS },
        { label: 'Content & Media', items: CONTENT_MEDIA_ITEMS },
        { label: 'Settings', items: SETTINGS_ITEMS },
      ]}
    />
  );
}
