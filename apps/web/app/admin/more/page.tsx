/**
 * /admin/more — mobile overflow landing for Insights + Money & Catalog +
 * Platform.
 *
 * WHY: the ops-shaped nav redesign (Admin_Console_Nav_Redesign_2026-06-08.md ·
 * owner conditionally signed off) re-cut the mobile strip to 4 tabs (Home ·
 * Work · Directory · More). The three desktop tune-groups that don't own a
 * bottom tab — Insights (key 'funnels') · Money & Catalog (key 'money') ·
 * Platform (key 'content') — compress into this More overflow. The dedicated
 * "Money" tab is gone; its config surfaces live here, its queues moved to
 * Work. Notifications gets a home here (it was an orphan), and Wedding types +
 * traditions moved in from Directory (governance + content, not look-up).
 *
 * Rendered as a **3-section accordion** (Insights → Money & Catalog →
 * Platform · PR 3 of the redesign §5) — grouped + collapsible, never a flat
 * dump. Sections start expanded; each collapses via its chevron.
 *
 * RSC BOUNDARY: the accordion renderer is a Client Component (collapse state
 * is interactive), and the section items carry lucide `icon` function refs.
 * Those non-serializable refs must NOT be passed from this Server Component
 * across the Server→Client boundary — doing so throws into the root error
 * boundary (the digest-only error screen). So the icon-carrying data + the
 * accordion render live entirely inside the 'use client' AdminMoreAccordion
 * wrapper; this page passes no props. See more-landing.tsx for the full
 * rationale. (Fix 2026-06-09 — regression from the 2026-06-08 accordion swap.)
 *
 * Kept as a Server Component because it owns the route `metadata` (Client
 * Components can't export metadata).
 *
 * Telemetry + Offline daemon remain FORWARD-REFERENCE entries until their
 * sprints land.
 */

import { AdminMoreAccordion } from './more-landing';

export const metadata = { title: 'More · Admin' };

export default function AdminMoreLanding() {
  return <AdminMoreAccordion />;
}
