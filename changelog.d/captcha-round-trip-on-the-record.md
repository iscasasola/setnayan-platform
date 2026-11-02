## 2026-09-22 · docs(auth): OWNER_ACTIONS records the captcha round trip and the real-phone test

`OWNER_ACTIONS.md`'s Turnstile section described activation as something never
yet attempted — "currently a strict no-op". That reading was accurate again on
2026-09-22 but only by coincidence: steps 2 and 3 were both completed for real
on 2026-09-18, made email+password sign-in unusable for every mobile visitor
(the widget's holder measured `293 x 0` at a 375px viewport, under Cloudflare's
300px minimum for `size:'flexible'`; desktop measured `382 x 72` and worked),
and Supabase's captcha switch was turned off the same day to restore sign-in.
The render bug is fixed and shipped — grep `TURNSTILE_HOLDER_MIN_WIDTH_PX` in
`apps/web/app/_components/auth/turnstile-field.tsx`.

On 2026-09-22 `NEXT_PUBLIC_TURNSTILE_SITE_KEY` was deleted from Vercel (every
scope, deleted rather than blanked, since `vercel env pull` writes `KEY=""` for
both a blanked variable and an unreadable one). With Supabase's switch off and
`TURNSTILE_SECRET_KEY` never set, the widget rendered on every auth form and its
answer was verified by nobody. Verified served-clean after redeploy: `/login`,
`/signup` and `/forgot-password` each return 0 for `captcha_token`,
`cf-turnstile` and `challenges.cloudflare.com`, and a live GoTrue password grant
returns `invalid_credentials` rather than a captcha refusal.

The section now carries that history, states that all three values are unset
today with commands to re-measure rather than believe it, and adds the test that
would have caught the lockout: try step 3 on a real phone, not a desktop browser
and not an automated one (Turnstile detects automation and silently never
starts, while each attempt issues a challenge that never completes and scores
the origin IP as a bot).

Documentation only — no code or schema change.

SPEC IMPACT: None.
