/**
 * The loading boundary for /help/topics (All topics) — so the press commits at once (`the-press-commits-now.test.ts`).
 * It renders nothing: the shared shell is already painted (see `app/(shell)/help/loading.tsx`).
 *
 * ⚠ This page sits in its OWN route group, `(help-list)`: a boundary here would also wrap `/help/topics/[key]`, whose
 * page calls notFound() — streaming would commit HTTP 200 before it runs (the soft-404). The topic and guide pages live
 * in `(help-pages)`, with no boundary at or above them. Checked: this page never calls notFound().
 */
export default function HelpTopicsLoading() {
  return null;
}
