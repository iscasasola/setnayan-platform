## 2026-08-09 · feat(marketing): the front door gets a menu, and the archive gets real

The public homepage offered **four outbound links and no menu**: start planning,
real stories, privacy, download. Things felt impossible to find not because the
content was missing, but because nothing pointed at it.

### The menu

**Find vendors · Real weddings · Journal** now sit in the top bar beside the
existing Prices/Download/Vendors popups. All three were already live, already
public, and reachable only by typing the address — **the Journal was linked from
nowhere at all.**

These are real links, not overlays, because each is a place you go and stay. The
2026-06-30 popup ruling was about Prices/Download/Vendors; it never said the site
should have no destinations. **The stylesheet already styled `.hr-links a`
alongside `.hr-links button`** — someone anticipated this — so it needed no CSS.

⚠ **Public site only.** The signed-in app has navigation on 14 sidebar screens and
11 bottom-bar mounts, held by a lint guard that fails the build if its shape
changes. A second menu there would fork it.

### 🪤 Four hardcoded couples were standing in for the archive

The Real Stories rail rendered **four invented weddings written into the source** —
"Claire & Ice", "Maria & Jose", "Lena turns 18", "The Reyes Reunion". A real couple
publishing their day changed **nothing** on the front page, and once one did, the
inventions would have sat beside them indistinguishable.

It now reads `loadPublishedShowcases` — the same reader `/realstories` uses. The
dead array is **deleted**, not commented out: fake names left in source are how
they come back.

### The threshold, and why it is the same answer to two different questions

Both rails hide below **two** items. A two-column grid holding one card reads as
**broken**, not sparse.

For stories that threshold does double duty: `loadPublishedShowcases` fails soft to
`[]` (it catches even the admin-client constructor), so **a failed read and a
genuinely empty archive arrive identically**. A written invitation is honest in
both cases — which a grid with one card in it would not be.

The Journal needs none of that care: it is **git-tracked markdown**, so the read is
synchronous, cannot fail, and its count is known at build time.

### Verification

**7,139 unit tests · 891 database tests · every lint run with CI's exact command
and env · `tsc` clean.** Port guard: nothing lost.

SPEC IMPACT: None — implements the 0015 main-website intent that the public site
be navigable; the destinations already existed.
