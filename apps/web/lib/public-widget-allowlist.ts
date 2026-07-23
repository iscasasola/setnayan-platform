/**
 * The public-widget firewall (OPEN-BROWSE PR1 — council build plan §3 row 1).
 *
 * The ONLY hideable widget types the anonymous public landing path
 * (`PublicLanding` in `app/[slug]/page.tsx`) may render. Every type here
 * carries event-level data only (no per-guest fields), so it is safe to show
 * a visitor with no guest session. The 4 always-on widgets (hero · greeting ·
 * qr_card · rsvp) and the 2 guest-personalized hideable widgets
 * (event_details · your_photos) are deliberately ABSENT — they need a guest
 * object / session cookie to be meaningful, and rendering them anonymously
 * would leak guest-personal surface.
 *
 * Extracted verbatim from PublicLanding's inline allow-list so it is a named,
 * unit-tested constant (`lib/public-widget-allowlist.test.ts` asserts the
 * guest-personal types can never creep in). The open-browse program's later
 * CI anonymous-bytes check builds on this constant — treat any addition here
 * as a privacy decision, not a rendering convenience.
 */
import type { WidgetType } from './invitation-widgets';

export const PUBLIC_WIDGET_ALLOWLIST: readonly WidgetType[] = [
  'countdown',
  'schedule',
  'venue_map',
  'dress_code',
  'photo_moments',
  'tier_comparison',
  'special_message',
  'what_to_bring',
  'our_photos',
  'our_love_story',
];
