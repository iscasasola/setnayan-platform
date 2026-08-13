# Redesign Session 6 — the seam

## 2026-08-13 · feat(auth): signing in never leaves the page, and the wordmark is the way out

**SPEC IMPACT:** `DECISION_LOG.md` row 2026-08-13 (the app rail wordmark now
exits to the public front door — a partial reversal of the 2026-07-16 Council
Verdict "Plaque-as-Menu, **Wordmark-as-Home**", taken on the owner's newer
sentence and on the binding prototype) ·
`REDESIGN_SESSIONS_2026-08-12.md` Session 6 marked DONE · the register's
"Session 4 ships behind a flag that is off" line corrected — **it is ON in
production** (measured from the served HTML of `www.setnayan.com`, which
returns the front-door rail and no `home-reskin` markup at all).

Binding sources, ported not redrawn: `FRONT_DOOR_AND_SEAM_FINAL_2026-08-12.md`
§3 + §4b, and `prototypes/front_door_and_seam_2026-08-12.html`.

---

### The rule: the rail never leaves

Signing in on the public site was a **departure**, in four different ways:

| where | what it did |
|---|---|
| front door, top bar + rail prompt | `<Link href="/login">` — replaced the page |
| public shop page, "Sign in to customize" | `<Link href="/login">` — replaced the shop |
| explore "Save", expired session | `window.location.href = '/login?next=…'` |
| marketing nav popup | opened over the page, but hardcoded `next='/'` |

So the one surface that already did it right still dropped everybody on the
account board instead of back where they were — and **every one of them
answered a wrong password by redirecting to `/login?error=…`**. One typo and
the page, the scroll position and anything typed into it were gone.

Now there is **one** panel (`app/_components/auth/sign-in-here.tsx`), mounted
once in the root layout, opened from every public surface. It renders the SAME
`<SignInCard>` `/login` renders, in the same shell, wired to the same
credential exchange — "one login everywhere" (owner-locked 2026-07-18) is
preserved by construction, and the second copy that had drifted (the marketing
nav's own `SignInOverlay`) is **retired**.

🔑 **`router.refresh()`, not `router.push()` — that one call is the whole
seam.** Refresh re-renders the server half with the new session while every
client component stays mounted, which is what keeps a half-written enquiry in
its box. A push to the same URL looks identical in the address bar and throws
the typing away.

🔑 **`signInInPlace` shares its entire body with `signInWithPassword`** via one
extracted `exchangeCredentials`. The two differ in exactly one thing — the
route redirects, the panel returns — and a copy of the remember-me downgrade,
the `last_login_at` stamp, the guest-session link and the account-type home
resolution would have been four more things to keep in step.

⚠ **No `landOn` option.** One was written, for the seam doc's "a sign-in with no
destination lands on the board", and **deleted for having no caller**: that case
is the `/login` ROUTE, reached by a hard load or a redirect, which genuinely has
nothing behind it and already behaves that way. An option nothing passes is a
decision nobody made.

### The way out, and what it cost

**The app had no exit.** A search of the whole dashboard / vendor / admin chrome
found **zero** links to `/`. A member who wanted to read an article had to type
the address or sign out.

The rail wordmark now goes to `/`, still signed in — the owner's sentence
(*"the wordmark is the way out of the app"*), and what the prototype draws
(`data-act="exit" title="Back to the public site"`).

🔒 **This reverses half of the 2026-07-16 council verdict, deliberately and on
the record.** That verdict made the wordmark the rail's ONLY 1-click home. Its
real concern — the rail must always offer home in one press — is preserved, one
level closer to where it is needed: the in-event rail now opens with
**"← All your events"**, the same row the prototype draws (*"inside an event the
rail opens with the way OUT of it — the level above is never a guess"*), and the
account panel's Home item (the documented 2-click fallback, and mobile's only
path home since mobile bars carry no wordmark) is untouched.

And the front door answers the press: a signed-in visitor's rail now opens with
**"Back to your events"** instead of "Events". Same destination, same count —
the sentence is the whole change, and it is what makes the trip read as a round
trip instead of two products.

### Sign out lives under the avatar and nowhere else

It lived in **five** places. Two were loose buttons in top bars (admin, vendor)
and one was a button on the profile page; all three are retired. The three that
remain are the same gesture — press your picture, the panel opens — rendered by
three shells: `profile-menu.tsx`, `account-switcher.tsx`,
`front-door-shell.tsx`.

🪤 **The fifth was found by MEASURING, not by searching.** The first sweep was
`grep … | head -40` and the vendor top bar fell off the end of the list. A
truncated list is not a list.

### Colour — the one place the two palettes meet

The panel wears the app's **#C24E25**, not the front door's gold
(`FRONT_DOOR_AND_SEAM_FINAL` §4b: *"the first room inside, not the last step
outside"*). Every selector is scoped under `.sn-signin-terra`; `.hr-si-*` is
shared with `/login` and recolouring the bare class would repaint surfaces this
decision says nothing about.

### Guard

`app/_components/auth/seam-invariants.test.ts` — 14 assertions, **all 14
mutation-tested with the occurrence count printed before → after**, baseline
green and restored green. It pins: sign-out in the account menus and nowhere
else (**and still present in all three** — narrowing "one place" to "no place"
is the failure the first check cannot see); sign-out as a POST form, never a
prefetchable link; both wordmark variants leaving the app; the in-event rail
keeping its one-press route home; the front door intercepting both sign-ins;
refresh-not-push; no `redirect()` in the in-place action; exactly one
`<SignInCard>` host; the locked terracotta with no gold; and the phone rule —
public is a top bar, the app is a bottom bar, **never both, never crossed**.

🪤 It strips comments before matching. Every file here carries a note naming the
string that was removed, and a guard reading raw source would find
`action="/auth/sign-out"` inside the note saying it is gone, and pass forever.

### Trap paid on the way

⚠ **`useSearchParams()` was in the first cut of both new components and had to
come out.** The provider is mounted in the ROOT LAYOUT, so it would have opted
**every page in the app** out of static rendering — the marketing pages and the
front door are ISR/edge-cached. A site-wide performance regression shipped as a
sign-in tweak, and `tsc` cannot see it; only a real `next build` can. Both read
`window.location` instead, which is safe because the panel only ever mounts from
a click.

### Named, not built

A signed-out visitor sees **no Save button** on a marketplace card
(`canSave={user !== null && …}`), so the prototype's headline demonstration —
*signed out → open a shop → press Save → sign in → still on the shop, button
reads Saved* — is **not reachable in the shipped product**. The retry-after-
sign-in is wired and works for the case that IS reachable (a session that
expired while reading). Showing Save to strangers changes what every visitor
sees on every card: a product call, not a defect of this change.
