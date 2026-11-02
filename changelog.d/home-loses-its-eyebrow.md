## 2026-08-18 · design(home): the account home header becomes one line

**SPEC IMPACT:** None — copy and layout on an existing screen; no price, SKU,
schema or product decision moves.

Follows [#4557](https://github.com/iscasasola/setnayan-platform/pull/4557), which
took 97 page headers down to one row. The owner screenshotted **three** headers;
this was the third, and #4557's lint could never have caught it — that guard looks
for an `.sn-eye` inside a `<header>`, and home's greeting is a plain `<p>` in a
hand-built header of its own.

**Before:** a greeting eyebrow — *"Kumusta, {name} · welcome back"* — over a title
with a grey tail hanging off it (*"Pick up where you left off."*).

**After:** one line. Returning visitors get **"Where to?"** and nothing else.

The returning tail was decoration and is deleted. The first-run copy was the only
instruction a brand-new account got up there, so it is **not** deleted — it
*becomes* the title (*"Let's set up your first event."*). Either state is a single
line, which is the whole point.

**The name is not lost.** `greeting` still initials the composer directly below,
and `noEvents` still counts the MERGED board rather than the organiser-only set —
somebody whose only events are invitations must never be told to set up their
first one directly above them (guarded already in
`an-invited-person-is-recognised.test.ts`, still green).

**Guard:** a seventh case in
`app/dashboard/(launcher)/two-levels-and-the-board.test.ts`. All three sabotages
were **measured by occurrence count as having landed** (0→1, 1→2, 1→0) and each
turned the suite RED.

⚠ Two process notes worth more than the change. The guard runs over
`stripComments` output **because this commit's own comment quotes the removed
strings** — a raw-source guard would report the defect it just fixed. And a
mutation run using `perl` against `Let’s` silently did not apply: the count read
1→1 and the suite stayed green, which meant nothing at all. **A curly apostrophe
is why; an unmeasured mutation proves nothing, in either direction.**
