import { redirect } from 'next/navigation';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';

/**
 * Full-screen LAUNCHER chrome — route group `(launcher)`, covering only the
 * account splash at `/dashboard`.
 *
 * ── THE HEADER MOVED INTO THE PAGE (owner, 2026-07-30) ──────────────────────
 * This layout used to render a top bar: wordmark on the left, a bell + account
 * capsule on the right. The owner: "on the upper part, that is the header part.
 * we do not want this. it looks generic." — and then, after the page still led
 * with a full-width search block, "the search bar is still on top."
 *
 * Both rows are now ONE row. `_components/home-rail.tsx` carries the wordmark,
 * the search and the bell + AccountSwitcher together, rendered by the page so
 * it can sit sticky above the page's own content. NOTHING was deleted: every
 * control the header held is still rendered, which is the whole point — this
 * repo's recurring bug is nav flattens that remove the only door to a surface
 * (`Route_Wayfinding_Audit_2026-07-15`). Sign-out, profile and notifications
 * are reachable from the rail exactly as they were from the header.
 *
 * ⚠ SCOPE: this group contains ONLY `/dashboard`. The other account spokes
 * (people · library · profile · setnayan-ai · notifications · year) render
 * their own copy of the slim top bar from `(account)/layout.tsx` and are
 * UNTOUCHED by this change — do not "tidy" them to match without giving each
 * one its own rail first, or they lose their account menu.
 *
 * What remains here: auth and the ambient wash. Auth/profile/deleted/vendor
 * gating + the welcome tour stay in the parent `dashboard/layout.tsx`.
 */
export default async function LauncherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath('/dashboard'));

  return (
    // The ambient Atelier wash — the warm paper + gold/green/slate glows the
    // frosted home cards sit ON (canonical `.sn-ambient`, Glass PR-1).
    <div className="sn-ambient min-h-dvh">
      <main>{children}</main>
    </div>
  );
}
