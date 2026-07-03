/**
 * /admin/more — mobile overflow landing for the 6-menu respine's two
 * non-tab groups (2026-07-03: Overview · Accounts · Marketing · Performance
 * get tabs under the ≤5 ruleset; Content + System Settings live here).
 *
 * System Settings absorbs the dissolved Money-config surfaces (Pricing ·
 * Add-ons · Discount→Marketing · Token bands · Budget Planner · Receipts)
 * and Data Structure (Taxonomy · Event Types · …), mirroring the desktop
 * sidebar (keys 'media' + 'settings-group') per
 * [[feedback_setnayan_orphan_prevention]]. Mobile carries a pre-existing
 * SUBSET — menus · refinements · hero-video · reveal-studio · recaps ·
 * patiktok are desktop-only and stay so (a parity gap that predates this
 * respine, not introduced by it).
 *
 * SCOPE: server component. Hidden at lg+ via lg:hidden — desktop reaches
 * these through the sidebar groups.
 */

import {
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
  DollarSign,
  Sparkles,
  Coins,
  PiggyBank,
  Receipt,
  Landmark,
} from 'lucide-react';
import { MobileLandingGrid, type LandingItem } from '../_components/mobile-landing-grid';

export const metadata = { title: 'More · Admin' };

// DATA STRUCTURE items — folded into the System Settings section below
// (desktop dissolved the standalone group into 'settings-group').
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

// MONEY CONFIG — the dissolved Monetization lane's mobile cards (act-now money
// QUEUES live under Overview; Discount codes + Referrals moved to Marketing).
const MONEY_CONFIG_ITEMS: LandingItem[] = [
  {
    key: 'pricing',
    label: 'Pricing',
    href: '/admin/pricing',
    icon: DollarSign,
    description:
      'The admin-managed retail catalog — every SKU price lives here, never in code.',
  },
  {
    key: 'addons',
    label: 'Add-ons',
    href: '/admin/addons',
    icon: Sparkles,
    description: 'Attachable add-on SKUs and their availability.',
  },
  {
    key: 'token-bands',
    label: 'Token bands',
    href: '/admin/token-bands',
    icon: Coins,
    description: 'Vendor token pricing bands by location tier.',
  },
  {
    key: 'budget-planner',
    label: 'Budget Planner',
    href: '/admin/budget-planner',
    icon: PiggyBank,
    description: 'The couple budget-planner reference table and defaults.',
  },
  {
    key: 'receipts',
    label: 'Receipts',
    href: '/admin/receipts',
    icon: Receipt,
    description: 'Issued receipts and BIR-facing records.',
  },
  {
    key: 'payment-methods',
    label: 'Payment methods',
    href: '/admin/settings/payment-methods',
    icon: Landmark,
    description:
      'The BDO / GCash receiving accounts shown on payment instructions.',
  },
];

// CONTENT — couple-facing publishing surfaces + asset libraries
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
      subtitle="Content and System Settings — publishing surfaces, catalog config, data structure, and platform settings."
      searchable
      groups={[
        { label: 'Content', items: CONTENT_MEDIA_ITEMS },
        {
          label: 'System Settings',
          items: [
            ...SETTINGS_ITEMS,
            ...MONEY_CONFIG_ITEMS,
            ...DATA_STRUCTURE_ITEMS,
          ],
        },
      ]}
    />
  );
}
