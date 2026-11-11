import { redirect } from 'next/navigation';

export const metadata = { title: 'Analytics · Shop' };

/**
 * /vendor-dashboard/performance — WAS "How is my business doing", a second Analytics. It is FOLDED into the Shop
 * carousel (owner 11 Nov 2026: *"Analytics should be the carousel."*; DECISION_LOG 2026-11-11 🎠 · 📊✅): there is ONE
 * Analytics, the carousel on the Shop tab, and every graph this page drew is one of its cards. Its reads moved,
 * unchanged, to `_components/one-analytics-section.tsx`, which the Shop tab streams.
 *
 * The address keeps working (links already sent — emails, bookmarks, the old `/funnel`): it lands on the carousel.
 * Every door inside the app goes STRAIGHT there (`ONE_ANALYTICS_HREF`), never through this stub (no stub bounces).
 */
export default function PerformanceHome(): never {
  redirect('/vendor-dashboard/shop#analytics');
}
