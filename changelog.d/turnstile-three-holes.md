## 2026-08-11 · fix(auth): close three silent lockouts before bot protection is switched on

Nothing is broken today — `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is unset, so the whole
feature is inert. Every item below is a refusal that would begin the hour it is set.

### 1 · Our own security header blocked the bot check itself

The enforced `Content-Security-Policy` in `apps/web/next.config.ts` listed YouTube,
Vimeo, Instagram, TikTok and OpenStreetMap under `frame-src` — and not
`challenges.cloudflare.com`. Turnstile paints its challenge in a frame from that
origin, so the check could not have rendered on **any** surface: sign-in, sign-up,
password reset, claim screens, the owner's own login. Added there and to the
report-only `script-src`.

`https://itunes.apple.com` added to the report-only `script-src` in the same pass —
the Song Bank preview is JSONP (`lib/itunes-preview.ts` appends a `<script src>`)
and that origin had never been named. Report-only blocks nothing, so this was
inaccurate measurement rather than a live break; enforcing the old list would have
killed song previews.

**The existing guard could not have caught this.** `lib/csp-embeds-are-allowed.test.ts`
matched a literal `<iframe` in `.tsx` files only. Turnstile's window is created by
Cloudflare's script (no `<iframe` in our source) and half its plumbing lives in
`lib/turnstile-client.ts` (a `.ts` file the scan never opened). The guard now also
scans `.ts`, resolves external `<script>` hosts, requires each in the report-only
`script-src`, and requires any host in `FRAME_CREATING_SCRIPT_HOSTS` in the enforced
`frame-src`. Same disease as the OSM grey box, one step further out.

### 2 · Forgot-my-password was never wired, on either half

`app/forgot-password/actions.ts` called `resetPasswordForEmail` with no captcha
option and no import; `page.tsx` rendered the form with no widget. It is the only
reset call site in the repo and it is linked off the sign-in card — the way out of
a lockout was the page that would have refused you. Both halves wired.

### 3 · The two claim screens expected a stamp they never asked for

`claimPapicSeat` and `claimPanoodCamera` have read `captcha_token` off their forms
since captcha landed, under comments asserting "the claim form carries a
`<TurnstileField>`". Neither form did. `papicSeatAnonEnabled` is **ON in production**,
so that one was live. Widgets added to both.

Also wired: `startGuestPickSession` (Live Studio guest camera-pick), a fourth bare
anonymous sign-in whose comment accepted captcha refusal as "graceful degradation".
Re-read with captcha on, that means the **paid** multi-camera feature silently
switches off for every guest at every wedding. Turnstile judges a visitor, not an
address, so the shared-venue-NAT reasoning that (correctly) keeps the per-IP
onboarding throttle off this path does not apply to it. **The onboarding rate limit
was NOT added to any claim screen** — a venue shares one connection and it would cut
off the sixth crew member at every wedding.

### The mechanism, so this class cannot come back

New `apps/web/lib/captcha-is-wired.test.ts`:
- every captcha-gated GoTrue call carries a token, or has a costed line in
  `ACCEPTED_UNWIRED` (one entry: the post-signup auto-sign-in, whose single-use
  token is already spent — it falls through to `/login?ready=`, which has a working
  widget, so it costs a re-typed password and is not a lockout);
- every server action that READS a form token has a form that SUPPLIES one — the
  exact bug in §3;
- both sweeps fail if they find nothing, so a refactor cannot silently blind them.

All new assertions mutation-tested. Two flaws in the new guard were found that way
and fixed: the widget check was satisfied by the bare `import` line, and then by a
**comment quoting `<TurnstileField>`** — the original bug wearing the guard's
clothes. Source is comment-stripped before checking.

### Order when going live (unchanged, now correct)

Site key in Vercel + redeploy FIRST → then enforcement in Supabase. Any other order
rejects real people. `OWNER_ACTIONS.md` corrected: it claimed every auth form was
wired (false), counted three anonymous paths (there are four), and its post-flip
test list omitted both broken flows.

Verified: 7617 unit tests green · `tsc --noEmit` clean · 15 lint scripts + eslint
clean.

SPEC IMPACT: None — no product behaviour, pricing, SKU or schema change. Activation
runbook lives in `OWNER_ACTIONS.md` (corrected in this PR), not in the spec corpus.
