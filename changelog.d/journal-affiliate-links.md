## 2026-08-12 · feat(journal): affiliate shopping links, disclosed and correctly marked

Adds a `shop` block to the Journal article union — an outbound merchant link
carrying our affiliate tag — plus the disclosure and the guard that keep it
honest. **Flag-free but inert: zero shop blocks are authored, so nothing renders
until an editor writes one and the owner has an affiliate account.**

**Why this and not display ads.** An affiliate link sets nothing on our side —
the merchant attributes the sale after the click. Display ads would break the
live `/privacy` page, which tells the public in four places that we run no
third-party tracking and never share data for advertising. That is a legal
statement under RA 10173, so ads are gated on rewriting it with owner sign-off;
affiliate links are not.

**What landed**

- `lib/blog.ts` — the `shop` block (`text` · `href` · `label` · `merchant`),
  `isValidShopHref` (absolute https, real host, **rejects our own domains**),
  `articleHasShopLinks`, and `AFFILIATE_DISCLOSURE`.
- `app/blog/[slug]/_components/shop-link.tsx` — the outbound anchor.
- `app/blog/[slug]/page.tsx` — the `shop` case + the disclosure, **derived from
  the blocks** so an editor can neither forget it nor leave a stale one behind.
- `lib/journal-affiliate-links.test.ts` — 13 assertions, four mutation-proved.

**🔑 `rel="sponsored nofollow noopener noreferrer"` is the load-bearing line.**
Google reads a commercial link without `sponsored` as a paid link scheme and the
penalty lands on the **whole domain** — all 81 Journal articles, i.e. exactly
the organic traffic the affiliate money depends on. Nothing in the app can
detect it; we would find out as a ranking collapse months later with no event to
point at. Same family as the phantom column / enum value / RPC argument /
blocked iframe: **the only symptom is an absence.**

**🪤 A malformed href earns ₱0 and looks exactly like one that earns.** So an
invalid href renders as plain prose with no button, rather than a dead link the
reader taps and blames us for. And an affiliate href pointing at
`setnayan.com` is refused outright — marking an internal link
`rel="sponsored nofollow"` would tell Google to distrust our own hub-and-spoke
linking, which is the opposite of what the Journal is for.

**🚨 THE FIRST CUT OF THE COMPONENT SHIPPED TWO DEFECTS, BOTH SILENT.** It did
the obvious thing — `import posthog from 'posthog-js'` — and that was wrong
twice over. Caught by reading the existing PostHog provider instead of trusting
the obvious import; **it was the only direct value-import of that module in the
app, and being the sole instance of a pattern was the tell.**

1. **60 kB gzipped into the article bundle.** The provider lazy-loads the SDK
   into its own async chunk on purpose. A static import would have put it in the
   shared cost of the one page in the product whose entire job is to rank and
   load fast — self-defeating for a feature whose revenue *is* that traffic.
   Now imported inside `onClick`, where the reader is leaving anyway.
2. **It would have counted clicks from readers who declined analytics**,
   bypassing the cookie-consent banner — third-party tracking on the very
   feature whose selling point is that it does none. Now gated on
   `analyticsAllowed()`, the same check the provider uses.

Both are now assertions in the guard, because neither would ever have errored.

**🛡 Four mutations, each measured by occurrence count before → after:** strip
`sponsored` from the rel (1→0, red) · delete the disclosure JSX (1→0, red) ·
reintroduce the static import (0→1, red) · remove the consent short-circuit
(1→0, red). The source assertions strip comments first — a rule that lives only
in a comment is exactly what a comment-matching guard would happily accept.

⚠ The first mutation attempt reported `2 -> 0` and printed its own
"did not apply" warning: the string appears in the docblock as well as the code.
Re-run anchored to the JSX attribute alone, leaving the comment intact, which is
the sharper test anyway — it proves the guard reads code, not prose about code.

**⏭ Owner actions, neither of which is engineering:** sign up with an affiliate
network (Involve Asia / Shopee / Lazada) and paste the tag into article hrefs;
and decide whether the Journal's voice may carry commercial links at all.

SPEC IMPACT: `03_Strategy` / iteration `0038_editorial_and_affiliates` — the
affiliate-link mechanism named in § 3 now exists in code. Display ads (0039)
remain **blocked** on a `/privacy` rewrite, recorded in `DECISION_LOG.md`.

### 2026-08-13 · fix(journal): narrow the rel capture through assert, not `!`

CI's typecheck failed at `journal-affiliate-links.test.ts:85:15` — `TS2532: Object
is possibly 'undefined'` — while the same file passed 13/13 under `tsx --test`.
`relMatch!` asserts the MATCH is non-null; it says nothing about capture group
`[1]`, which is `string | undefined` under `noUncheckedIndexedAccess`. This is the
documented CI-is-stricter-than-tsx trap.

Narrowed through `assert.ok` on the captured value instead, which also makes the
assertion slightly stronger (an empty group now fails too) and keeps both original
messages verbatim.

ONE ROOT CAUSE, TWO RED CHECKS: the `playwright e2e (chromium)` job produced no
report at all ("No files were found with the provided path:
apps/web/playwright-report/") because it builds before it runs — so it died on the
same type error rather than on a test.

Mutation-tested with the sabotage MEASURED, not assumed: dropping `sponsored` from
the component's rel took its occurrence count 3 → 2, the guard went red naming the
missing token, and restoring returned 13/13.

SPEC IMPACT: None.
