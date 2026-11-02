## 2026-08-09 · fix(marketing): the Taglish site was reachable only from itself

Setnayan ships a Taglish edition of `/about` and `/how-it-works`. Both of those
pages carry a correct, `hreflang`-tagged link **back** to English.

**Neither English page linked forward.** Measured: `EN→TL: 0` on both.

So the entire Taglish edition was reachable only by already being on it — or by
typing `/tl/…` from memory. Hand-written Taglish copy, correct locale tags, real
SEO plumbing, and **no door**, on the pages where every visitor actually lands.

🔑 **A ONE-WAY LINK IS A LINK NOBODY USES.** The return path existing made the
feature *look* wired from the inside, which is exactly why nobody noticed: anyone
testing it started on the Taglish page, where the switch is present and works.

### Also corrected in my own notes

I first reported the switcher as being "on zero pages". Wrong — I grepped for
`LanguageSwitch` / `LangToggle` and the component is called `LocaleSwitch`. It
renders on `/features`, and Taglish ships on **three** pages, not none. The real
gap was narrower and more interesting than the one I described.

⚠ **The homepage still has no Taglish edition**, so it gets no switch — a control
pointing at a page that does not exist is worse than no control. That is a real
build, not a copy edit: `/tl/about` and `/tl/how-it-works` are standalone
hand-written pages of 291 and 405 lines, and the homepage is 970 lines of
interactive React. Mirroring it as a second static file would drift within a week.
The right shape is one locale-aware component rendered at both addresses.

### Verification

7,139 unit tests · every lint run with CI's exact command and env · `tsc` clean ·
port guard reports nothing lost.

SPEC IMPACT: None — completes the localization slice `/tl/about` already describes
as "more pages follow the same shape".
