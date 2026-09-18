## 2026-09-18 · fix(auth): the bot check is solvable on a phone, and an early tap waits

Two defects that each hid the other, both found the hour Turnstile enforcement
went live in production.

**1 · The challenge could not be displayed on a phone.** Measured live on
`/papic/claim/[token]`: the widget's holder was **293 x 0** at a 375px viewport,
against **382 x 72** on desktop. Cloudflare's `flexible` size has a **300px
minimum width**; the card's padding left 293px, so the widget laid out at zero
height — invisible, unsolvable, and no token ever produced. The holder now
guarantees its own 300px and reclaims 8px per side from the padding rather than
widening the page.

**2 · The submit button was tappable before a token existed**, so the ordinary
path produced *"the security check did not pass"* — copy that blames the visitor
for the form's timing. An early tap is now QUEUED and re-fired when the token
lands, with a 10s fallback that submits anyway so nobody is ever trapped.

**Why both were invisible until now:** `appearance:'interaction-only'` passes a
trusted visitor silently — nothing is drawn, nothing needs to fit, the page
works. The layout floor only matters when Cloudflare demands an INTERACTIVE
solve, and what makes it demand one is many requests from a single IP in a short
window. **That is a wedding reception:** a hundred guests on one venue WiFi
scanning Papic QR codes within the hour, every one of them on a phone. The
failure would have been total, for the whole photo crew, during the event.

Found by accident: automated probing from one IP put Cloudflare into exactly
that state, which no ordinary test reaches.

Guarded by `lib/turnstile-holder-fits.test.ts`, which EXECUTES the decisions
rather than reading the CSS — the size/floor coupling, the fit at 285/293/300/382
px of available width, and the queue rule including the two cases that must
still proceed (no widget at all, and an already-queued re-submit). The first
value of the reclaim constant was 4px and this guard rejected it: it cleared the
measured 375px case and left a 320px phone short.

SPEC IMPACT: None.
