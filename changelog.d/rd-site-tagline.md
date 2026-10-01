## 2026-09-30 · feat(seo): the site's default title says "Plan, share and relive every celebration"

The root layout's default title, description, Open Graph and Twitter card read
"Setnayan · Filipino wedding planning + verified suppliers" — the tab, share card
and search title of every page without its own title, selling one event type as
the whole product. They now read **"Setnayan · Plan, share and relive every
celebration"** (the line the owner picked for the email footer, #6199) and one
event-neutral sentence naming the Event Hub, suppliers, Papic, Live Watch,
Patiktok, Music Maker and Setnayan AI. One `SITE_TITLE` / `SITE_DESCRIPTION`
pair in `app/layout.tsx` feeds all three, so they cannot drift. The PWA
manifest description matches.

- Not touched: the homepage's own `HOME_TITLE` (already event-neutral), legal
  pages, `llms.txt` (already life-events positioning), and the og-card image —
  its pixels still say "Filipino wedding planning · verified vendors", so its
  `alt` keeps describing them until the card is redrawn.
- Guard: `lib/public-copy-is-not-wedding-only.test.ts` §4 — pins the title,
  forbids "wedding" in the default title/description and "vendor" in them,
  requires openGraph/twitter to read the constants, and checks the manifest.
  Mutation-tested: a wedding literal back in `openGraph.title`, "wedding" in
  `SITE_TITLE`, "vendors" in the description, a wedding literal in
  `twitter.description`, and a wedding manifest line each turn it red.

SPEC IMPACT: None in code terms — DECISION_LOG 2026-09-30 row said site SEO titles were NOT part of the email-tagline decision; this PR is the controller's recommendation to match, owner not objecting. Easily reverted.
