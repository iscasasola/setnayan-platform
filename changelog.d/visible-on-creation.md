# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-08-04 · feat(guest-site): a new event's website works by link from the moment it is created

Fifth build item of the event-website work. Owner, 2026-08-03: *"so the event websites should be visible upon creation."*

**Three states, not two — which is why this and the 2026-06-20 "private until launch" ruling both hold.** A new event now ships **`unlisted`**: anyone the couple sends the link to walks the whole site, but it is not indexed and not listed anywhere public. **Launch keeps its full meaning** — `public` is what allows indexing, reaches the aggregate surfaces, and fires the guest announcement emails. So the paid Save-the-Date reveal is still a reveal; what changes is that the link works before it, instead of showing a locked door to someone the couple deliberately sent it to.

`unlisted` was chosen over `public` on verified grounds, not preference: `app/[slug]/page.tsx` returns `robots: { index: false, follow: false }` with name-free metadata for any non-public visibility, `lib/public-profile.ts` gates the aggregate surfaces on `=== 'public'`, and `lib/save-the-date-emails.ts` refuses to fan out unless `public`. Defaulting to `public` would have silently converted a paid reveal into a mailing button.

**🔴 The anonymous-draft carve-out, and why it needed its own module.** The onboarding INSERT runs through the **service-role** admin client, which bypasses RLS — so `20270823141500_events_anon_cannot_publish.sql`, the RESTRICTIVE policy that stops an anonymous JWT writing a non-private visibility, **does not fire on this path**. It would have stayed green while doing nothing.

An anonymous draft is somebody who typed two real people's names into a signup flow and has not yet made an account. So the rule is re-asserted in application code: **anonymous ⇒ private**, upgraded to `unlisted` when the account is secured.

`initialLandingVisibility()` states it once, for both insert sites (the generic builder and the wedding commit), and **fails closed** — only a literal `false` publishes. That matters because one call site reads the flag off an auth user where it can be `undefined`; a truthiness test would have made `undefined` mean "not anonymous", i.e. publish. **Mutation-verified**: replacing the strict check with truthiness fails the test.

Verified: 6,314/6,314 unit tests, `tsc --noEmit` clean. **No migration** — the column and its enum already ship, and the DB default stays `private` so nothing existing changes. No flag, no route change.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-03 — supersedes the practical effect of the 2026-06-20 private-until-launch default for NEW events created by a secured account. Existing events are untouched.
