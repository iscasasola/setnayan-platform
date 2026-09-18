## 2026-09-18 · fix(auth): a failed bot check says why, to the person and to the console

The owner switched Supabase captcha on. The widget rendered **"Verification
failed"**, nobody could sign in with an email and password, and it took the
better part of an hour to work out what had happened — because of one line:

```js
'error-callback': () => {
  if (inputRef.current) inputRef.current.value = '';
},
```

**Cloudflare passes the error code to that callback.** We declared no
parameter and logged nothing — zero `console` calls in the file. The one fact
that explained a live outage was discarded at the instant it arrived. The
person saw a red box with no code. The owner saw a red box with no code. A
session holding the production database and the served bundle was reduced to
guessing at hostname lists.

🔑 **The measurement existed and reached nobody** — the same shape as the upload
that stopped with no event and the refused read that rendered as "no guests
yet", except this one hid the diagnosis of the outage itself.

- The callback **takes the code**, logs `[turnstile] challenge failed — code
  110200 · OWNER ACTION: … · <troubleshooting URL>`, and renders a line the
  visitor can act on.
- `lib/turnstile-error-guidance.ts` maps Cloudflare's code **families** by
  prefix (not an exact list, which would fall through silently the first time
  they add one), and an unrecognised code still gets the most useful generic
  answer plus the number.
- ⚖ **Every message ends somewhere the person can go.** Whatever the code, the
  other sign-in buttons carry no Turnstile token and still work. A
  misconfiguration says so and does **not** tell them to retry a permanent
  failure; a timeout or transient error does.
- A successful retry clears the notice, or the page keeps accusing itself.

Sabotage: dropping the parameter (the original bug), removing the console line,
removing the rendered notice, never clearing it, and a message that stops
offering a way forward — **1 red each**.

⚠ This does not tell us why *this* failure happened. It makes the next one — and
the current one, on the next reload — name itself in ten seconds.

SPEC IMPACT: None.
