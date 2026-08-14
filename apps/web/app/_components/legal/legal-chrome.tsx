import { AppRailShell } from '@/app/_components/frontdoor/app-rail-shell';
// Shared body scaffold for the standalone legal/compliance pages (privacy,
// terms, refunds, cookies, acceptable-use).
//
// The page-local LegalHeader + LegalFooter were REMOVED 2026-07-03: these pages
// are now marketing routes (site-chrome.tsx NAV_ROUTES), so the ONE persistent
// glass nav + shared ReskinFooter supply the top/bottom chrome for the whole
// public site — rendering a second logo header + a second link footer here
// doubled the chrome. The inter-policy links the old LegalFooter carried live
// in the ReskinFooter's Legal column (Privacy / Terms / Refunds / Cookies /
// Acceptable use + Cookie settings). Only the article body remains.

export function LegalLayout({
  title,
  meta,
  children,
}: {
  title: string;
  meta: string;
  children: React.ReactNode;
}) {
  return (
    /*
      ─── THE LEGAL PAGES WEAR THE SHARED SHELL (owner 2026-08-15) ──────────
      Owner: *"stories and marketplace and its sub menu jumps out of shell."*
      The rail's small print points at Terms · Privacy · Acceptable use ·
      Cookies · Refunds, and every one of them threw the person out of the app.

      🔑 ONE COMPONENT EDIT COVERS FIVE PAGES, because this layout already owns
      both the <main> and the <h1> — which is exactly what `variant="doorway"`
      expects to be handed. No page below needs to change its markup.

      ⚠ EACH PAGE STILL NEEDS ITS OWN `force-dynamic` AND ITS OWN
      `loading.tsx`. A layout cannot set `dynamic` — it resolves nested-most
      wins and the children traversal completes before a parent layout's
      component is created — and a dynamic route with no loading boundary
      prefetches an EMPTY tree. Five files each, not one.
    */
    <AppRailShell variant="doorway">
    <main className="min-h-dvh bg-cream">
      <article className="mx-auto w-full max-w-3xl space-y-6 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="text-xs text-ink/55">{meta}</p>
        </header>
        {children}
      </article>
    </main>
    </AppRailShell>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 text-sm text-ink/75">{children}</div>
    </section>
  );
}
