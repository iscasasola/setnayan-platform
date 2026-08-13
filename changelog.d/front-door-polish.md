## 2026-08-13 · fix(front-door): the shop shows itself, and a story says how long it takes

Two things the owner spotted on the live front door after the flag went on.

### A live business rendered as a placeholder

The shop card's thumbnail was the literal word **"SHOP"** — so the one approved,
verified shop on the front page looked like unfinished scaffolding. It now shows
the shop's real logo, falling back to its initials.

⚠ `vendor_profiles.logo_url` holds an **`r2://` tag, not a URL** — putting the raw
value in an `<img>` fails silently. Resolved through the shipped `displayLogoUrl`.

🔑 **A plain `<img>`, not `next/image`, and deliberately so.** An `r2://` logo
resolves to a **presigned** URL whose signature changes every render, so
`next/image` would re-transform it on each one and Vercel bills per
transformation — on the highest-traffic public page. A logo is small; optimising
it is not worth a recurring charge.

### A story with no length on it

Storyteller cards carried no reading time, because the shared shelf loader keeps
only an excerpt and a minute count guessed from a truncated lede is an invented
number — it would read "1 min" on a piece that takes ten, on somebody else's
wedding.

Now computed **at the loader, from the full body**, where it actually exists.
A chapter with no body still shows nothing rather than a guess.

🔑 **ONE reading-time rule, extracted rather than copied.** `lib/blog.ts` gains
`readingMinutesFromText(text)`; `readingMinutes(blocks)` delegates to it and
`storytellers.ts` calls it. The alternative — a second `words / 200` — is exactly
what `lint:dup-rule` caught on this page two commits ago, where the two copies
were *already unequal* (220 vs 200) and the same article advertised different
lengths on different pages.

### Guards

Four new assertions. 🛡 **All four mutation-tested with occurrence counts, files
restored byte-identical, all RED.** One was decorative on its first run: the
"never render the word SHOP" check required a literal `<` immediately after the
word, so inserting `>SHOP` followed by a newline slipped past. Re-anchored to the
word as a text node. *That is the fifth guard in this stream to need a second
pass — the mutation run is not optional.*

typecheck exit 0 · eslint exit 0 · all 16 `lint:*` scripts clean by exit code AND
output · 37 assertions across five files pass.

SPEC IMPACT: None.
