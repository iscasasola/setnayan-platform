## 2026-08-08 · fix(vendor): a shop address that isn't live yet stops answering like a lost wedding invitation — and stops telling Google it was found

The owner opened their own shop address, `www.setnayan.com/setnaprod`, and got
**"This invitation link can't be found."** Two separate things were wrong behind
that one screenshot; neither was the address.

**Nothing is broken about the URL.** `app/[slug]/page.tsx` already dispatches a
bare slug to `renderVendorBySlug`, the vendor sitemap already emits
`${baseUrl}/${business_slug}`, and `/v/[slug]` is legacy. Verified in prod:
`setnaprod` is `public_visibility = 'hidden'`, `verification_state =
'unverified'`, `is_published = false`. `hidden` is the resting state of every
unapproved vendor by owner ruling 2026-07-27 ("we only show shops that are
ready"), so the 404 is correct behaviour. Both prod vendors are hidden.

### 1 · The 404 was aimed at the wrong person

`app/[slug]/not-found.tsx` renders for BOTH audiences — the dispatcher falls
through from event to vendor — but its copy only ever addressed one: a wedding
guest, told to "check the link with the host". A vendor, or anyone they handed
their address to before approval, read that as a broken product rather than a
shop that hasn't opened. The headline is now neutral and the body offers all
three recovery paths (invitation · a business page not open yet · sign in).

The explanatory comment describing the guest-only framing was already in the
file and did not stop this. Prose is not a mechanism, so the rule is now a test.

### 2 · The legacy vendor route soft-404'd — measured, not reasoned about

`app/v/[slug]/loading.tsx` made the streaming shell commit **HTTP 200** before
the body ran, so the `notFound()` for an unknown or unapproved shop rendered
404 UI under a 200 status. Confirmed live before the fix:
`https://www.setnayan.com/v/definitely-not-a-real-shop-xyz` → **200**. Every
junk shop URL was an indexable soft-404 telling Google it had found a page.

This is the identical bug commit `04c03063d` deleted the bare-root
`app/[slug]/loading.tsx` to fix, and `first-byte.test.ts` was written to hold —
the guard just never covered the sibling route that serves the same shop.
Deleted. No skeleton is lost in practice: the canonical bare-root vendor path
returns `renderVendorBySlug` *before* its `<Suspense>`, so it already blocks.

### Guards (all three mutation-tested — each fails when broken on purpose)

Added to `apps/web/app/[slug]/_lib/first-byte.test.ts`, where the reasoning
already lives:

- `v/[slug]/loading.tsx` must not come back.
- The bare-root 404 headline must not name invitations, and its body must keep a
  shop-visitor recovery path — **conditional on `page.tsx` still falling through
  to `renderVendorBySlug`**, so it goes quiet if that ever changes.

🪤 The copy assertion was **decorative in its first draft** and only the sabotage
run showed it: it matched the whole file, and the comment block explaining why
the shop audience matters says "shop"/"vendor" nine times — so it passed on its
own justification while the visible sentence could say anything. Now scoped to
the JSX after `return (`. Same shape as the payments status scan that had to be
narrowed to the query chain.

🪤 `npx tsx --test "app/[slug]/_lib/first-byte.test.ts"` reports **"# tests 0 …
# fail 0"** — the `[slug]` brackets are read as a glob character class, so it
matches nothing and exits green. It looks exactly like a pass. Run the file
directly (`npx tsx 'app/[slug]/_lib/first-byte.test.ts'`) or via the CI glob
`app/**/*.test.ts`, which does pick it up (verified: tests 61–63).

Not changed: `public_visibility` stays admin-only, no read path was widened, and
the page still refuses to reveal that a hidden shop exists at an address.

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/CLAUDE.md` — the ACTIVE block
lists the vendor-route soft-404 as open; it is fixed for `/v/[slug]`. The same
block's "`setnayan.com/setnaprod` 404s only because that shop is unverified +
hidden" is now confirmed against prod rather than inferred.
