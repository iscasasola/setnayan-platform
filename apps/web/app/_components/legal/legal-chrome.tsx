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
