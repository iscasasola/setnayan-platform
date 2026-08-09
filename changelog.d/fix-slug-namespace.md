## 2026-08-09 · fix(slugs): the paths that HAND OUT a web address now ask the same question the rename form asks

PR #4282 added `findSlugConflict` — one answer for the one namespace at
`setnayan.com/{word}` — and then wired it into the rename form only. The three
paths that actually mint or claim an address kept asking a shorter question.

**A new wedding could take over a live shop's public page.** `isSlugTaken` —
reached by EVERY event creation through `generateUniqueSlug` (create-event ×2,
onboarding/wedding, onboarding/_shared/commit-event, onboarding/simple) — queried
`events` and the forwarding ledger, never `vendor_profiles.business_slug` and
never `users.slug`. Because `app/[slug]/page.tsx` resolves the EVENT first, an
auto-minted wedding name equal to a live shop's address silently took over that
shop's page — a page in our sitemap. Now routed through `findSlugConflict`.

**A failed read read as "free".** The same function destructured `{ data }` and
dropped `error`. Supabase resolves `{ error }` rather than throwing, so an
unreadable table came back `data: null` and the word was handed out anyway. It
now fails CLOSED on all four probes, and `generateUniqueSlug` refuses outright
(`SlugNamespaceUnreadableError`) rather than looping 100 candidates through an
unreadable database and then returning a name it never checked at all.

**Shops and people skipped the check entirely.** The manual shop-address save
(`updateVendorWebsiteField`) checked shape + reserved + its own unique index; the
person-handle save (`updateUserSlug`) checked shape + reserved + `users`. A shop
could have claimed `bb-gandang-hari` — the one address actually forwarding in
production until 2026-08-22 — so printed invitations would have landed guests on
a stranger's business page. Both now run `findSlugConflict`. The shop's exclusion
id is read from the SAME row the write targets (`user_id = auth user`), never
from the form; the person's is the authenticated user's own id.

**The generated route list was blind to route groups.** `routeSlugsFromDisk` read
only the direct children of `apps/web/app`, so a page at
`app/(marketing)/foo/page.tsx` would have served `/foo` unreserved with the test
still green — the same hand-typed-list blindness the generator exists to end, one
level deeper. It now descends through path-transparent folders (route groups and
parallel slots). No output change today (zero top-level groups exist); a fixture
tree is what proves it.

Guards — all five mutation-tested, each sabotage verified applied and each killed:

- `lib/slug-claim-paths.test.ts` (NEW) RUNS the three shipped server actions with
  only the two Supabase client factories stubbed. Written because the rename
  path's only protection was a regex over its own source text, and a reviewer
  broke it by keeping the `findSlugConflict` call and DISCARDING its result while
  all twelve tests stayed green. A refusal that is computed and thrown away now
  fails here, because the action reaches its write.
- `lib/slug-availability.test.ts` gains the create-path cases: a word held by a
  shop or a person, all four namespaces probed, the auto-mint stepping over a
  shop's address, and every unreadable table refusing rather than granting.
- `lib/reserved-slugs.test.ts` gains a fixture route tree — the real one cannot
  fail this test, because it has no top-level group.

SPEC IMPACT: None. No schema, pricing or product change; the DB auto-mint gap
(`public.business_slug_is_reserved`, already flagged as `KNOWN_DB_MINT_GAP`) is
untouched — no migration in scope.
