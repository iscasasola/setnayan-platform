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

## FIX (committed 5dd7c6bcc)
- `lib/guest-pass-hop.ts`: `ReentryDestination` gains `'reply'`; `reentryDestinationPath(slug, to)`;
  `replyHrefCarrying(slug, code)` (the Reply's address, carrying the landing's `?k=` when it has one);
  `replyEntry({ slug, hasPass, code })` → ask · rekey (`/{slug}/redeem?k=…&to=reply`) · door (`/{slug}`).
- `app/[slug]/invite/reply/page.tsx`: the bare `if (!canvas && !session) redirect(/{slug})` → `replyEntry`.
- `app/[slug]/redeem/route.ts`: the code exchange opens `reentryDestinationPath(event.slug, to)`.
- `app/[slug]/invite/enter/page.tsx`: all three Reply links (landing Reply, plus-one's Reply, "Change my reply")
  → `replyHrefCarrying(home, search.k)`.
No sign-in, no account. A code is spent only when the pass is missing. Prefetch is harmless either way: the reply
page itself never spends; if a prefetch's redirect were followed to the redeem, it would spend the code only
when this browser has no pass — and write this guest's own pass, the re-key the click wanted anyway (the redeem
refuses link-preview robots).

## Guard + sabotage
`app/[slug]/invite/reply/a-guest-without-the-pass-still-replies.test.ts` (5 tests).
- On main's code: 1 pass / 4 fail (only (5), the unchanged Save the Date, passes — expected).
- S1 reply page back to the bare redirect → (3) red. S2 landing Reply bare → (4) red.
  S3 `replyEntry` sends a lost guest to the door → (1) red. S4 redeem ignores `to=reply` → (2) red. Restored → 5/5.
- 181 neighbouring tests (pass-hop, one-path, invite/*, redeem, reply-card, guest-pathway, reply-waits) green.

## Not done / open
- Local walk: impossible here — the local `.env.local` has no service-role key and no guest-session
  secret, so no guest pass can be minted locally (and it points at prod). The live Chromium walks above stand in.
- Why desktop Safari lost the pass in 13 s is not determined (see CAUSE). Worth a real-Safari walk by the
  controller/owner after deploy: link → landing → Reply.
- Preflight + PR: see below.

## Live walks done (read-only, nothing sent)
- Chromium, maria-and-jose guest 2a1d5a99 (token read from prod into a 0600 scratch file, never printed): Reply → questions.
- Chromium, marco-marga Bean: landing = "Open the save the date" only; /invite/reply → questions.
Each walk wrote one scan_events row + one unspent landing code (what opening a link does).
