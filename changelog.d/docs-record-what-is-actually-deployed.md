## 2026-08-06 · docs(env): three notes that were wrong about live reality

All three would have sent the owner to do work already finished. He caught two of
them himself — *"i thought we also did that turn already"*, then *"and step 3
also"* — after being handed a step-by-step procedure for both.

### 1 · TURN was configured three weeks before the note said otherwise

`CLOUDFLARE_TURN_KEY_ID` + `CLOUDFLARE_TURN_API_TOKEN` have been set in Vercel
(Production + Preview) **since 2026-07-16**. A memory note read
*"OWNER ACTIVATION (not done)"* the whole time.

🚨 **The stale belief reached customers.** Because TURN was assumed off, the call
screen shipped *"Couldn't connect … (no TURN yet)"* to couples while the relay was
live — a lie in production from 2026-07-16 until PR #4192 replaced it with a
measured `relayAvailable`.

### 2 · Google Search Console is verified — by DNS, not by a meta tag

`setnayan.com` carries a `google-site-verification=…` TXT record. An audit grepped
the live HTML for the `<meta>` tag, found none, and declared it unverified.

🔑 **The meta tag and the DNS record are ALTERNATIVE proofs.** Absence of one is
not absence of verification. `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` adds nothing
here and leaving it unset does not mean undone. Bing has no readable trace either
way, because Bing commonly imports verification straight from Search Console.

### 3 · The website menu is ON by default — the doc stated the opposite gate

The block opened *"🔴 THIS IS AN OUTSTANDING OWNER ACTION"* and stated the gate as
`isSample || flag === 'true'`. The code says:

```ts
if (opts.isSample) return true;
return opts.flag !== 'false';     // site-menu.ts:88-89
```

`!== 'false'` ⇒ **unset is the ON position.** `site-menu.test.ts` has asserted
exactly this all along — *"on by default for real events … the flag is now an
opt-OUT"*. The behaviour was flipped deliberately and the doc never followed, so
the only untrue thing was the sentence.

🪤 **And the trap in that same block caught the audit correcting it.** The one
prod event with open-browse on is `maria-and-jose`, which is `is_sample = true` —
it forces the menu on regardless and proves nothing. The right answer came from
READING THE GATE, not from loading a page. Recorded so the next person tests on
`is_sample = false`.

### The pattern

Three records, three different homes — a memory note, a live-HTML check, and a
doc restating a formula — all wrong about the same class of thing: **state that
lives in a system the repo cannot see.** A note about deployment is a snapshot
that starts decaying when written.

Each block now records what IS deployed, dated, with how it was verified —
and says plainly that the block itself is a snapshot too.

SPEC IMPACT: None — documentation only; no code, schema or behaviour changed.
