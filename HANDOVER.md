# HANDOVER — rd/guest-reply-lands-on-door (2026-10-12)

Lock labels: `reply-door` (heavy) · `walk:reply-door` (walk).

## CAUSE (what is known, with the evidence) — read this first

**The door comes from one line:** `app/[slug]/invite/reply/page.tsx` —
`if (!canvas && !session) redirect(\`/${home}\`)`. The Reply request reached the server
**without a usable guest pass** for maria-and-jose, so the reply page sent the guest to
`/maria-and-jose`, which (also passless) drew the stranger door. 13 seconds earlier the
landing had the pass. **The landing already holds the tool made for exactly this — its own
single-use re-entry code (`?k=`, minted by the redeem, 30 min) — but the Reply link drops it
(`inviteReplyPath(home)` is bare) and the reply page has no `?k=` fallback** (the landing,
`invite/enter/page.tsx`, has one: no pass + code → `/redeem?k=` → back). So a guest whose
pass went missing between the landing and the Reply has no way in but the door.

Evidence (prod, read-only):
- 22:58:55Z redeem for guest 2a1d5a99 (maria-and-jose), UA **desktop Safari 26.6.2 (Mac)**;
  landing re-entry code minted, **never spent** → the landing rendered WITH the pass.
- 22:58:58Z `/api/guest/pass-card` read the cookie (the signing warning only logs when a cookie is present).
- 22:59:10Z `app_fault_issues` DEAD_END `forwarded /[slug]/invite/reply ← /[slug]/invite/enter`, landed `/[slug]`
  (first seen on d2e38b7, 1 hit). Vercel: `/maria-and-jose` rendered as a stranger at 22:59:10, :12,
  23:00:12, :19, :20, 23:03:18 (no `guest-context` phase).
- The guest's qr_token was NOT rotated (no `guest_qr_rotations` row; my walk with the current token works).
- iOS Safari also shows `enter:no-key` misses (3, Oct 10–11): Safari arriving at a guest page passless.

**NOT reproduced in Chromium** (fresh, signed-out Playwright context) on the same live guest
(maria-and-jose · 2a1d5a99, dated 2026-12-12, Invitation stage): link → landing → Reply (3 s and
15 s waits) → the questions, every time. Same on marco-marga (Bean). So the stage/date gate is
NOT the cause; the reply page's code is identical for both. What made Safari lose (or replace —
the pass is ONE cookie per browser, any other event's pass replaces it) the pass in those 13 s
is NOT determined: Safari WebDriver needs "Allow remote automation" (a settings change — not
mine to make) and Playwright WebKit is not installed (a download).

## FIX (in progress)
Reply carries the landing's code; the reply page re-keys from it when the pass is missing
(or is another event's): `/{slug}/redeem?k=…&to=reply` → back to the questions. No sign-in,
no account (owner: "you can still reply without an account"). A stranger with no code still
gets the door; the Save the Date landing still has no Reply.

## Live walks done (read-only, nothing sent)
- Chromium, maria-and-jose guest 2a1d5a99 (token read from prod into a 0600 scratch file, never printed): Reply → questions.
- Chromium, marco-marga Bean: landing = "Open the save the date" only; /invite/reply → questions.
Each walk wrote one scan_events row + one unspent landing code (what opening a link does).
