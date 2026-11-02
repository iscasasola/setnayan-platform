## 2026-08-07 · fix(retention): stop telling couples their originals last years when they last six months

Owner, 2026-08-07: *"6 months are initially kept as original. they can sync with
their google drive."* That is the model. Four user-facing surfaces said
otherwise, all in the same dangerous direction — **relax, you have years** — so a
couple reads them, downloads nothing, and loses the good version of their
wedding at six months.

⚠ **Scope was checked first.** The drop sweep reads `photo_delivery_artifacts`
as well as the Papic tables, so it covers **vendor-delivered albums too**. "That
claim is about photographer delivery so it's fine" would have been wrong.

**Fixed**

- **"Setnayan keeps a 5-year backup"** — twice on the delivery panel and once in
  its demo card. We hold full-resolution originals for **six months**.
- **"Keep your raws as long as you need"** on the public features page — that
  sentence now points at Drive, which is the thing that actually delivers it.
- **The decline-Drive button read "Not now — keep my photos in Setnayan."**
  Declining is *exactly* the branch where the originals are dropped. The word
  "keep" on the decline button was the whole defect.
- **The full-res warning email offered "a full account export"** as one of three
  ways to save the originals. **No such export exists** — no settings route, no
  action, nothing. It was the safest-*sounding* option, so a worried couple would
  pick it and end up with nothing. Now lists only the two things that move
  pixels, Drive first, because Drive is the one that still works after month six.
- **A dormant buy card still said "After 3 months"** — the clock became six on
  2026-08-02. It renders only while the retired Keep Full-Res SKU is active, so
  nobody read it; a stale number on a dormant screen is a landmine for whenever
  that SKU is flipped back on.

**Verified**

- No user-facing account export exists anywhere — searched routes, actions and
  settings surfaces before removing the instruction.
- Typecheck exit 0. ⚠ CI's typecheck is stricter than the local default and
  caught a `string | undefined` in the new test that a non-null assertion had
  hidden; fixed properly rather than with another `!`.

🛡 `retention-copy-is-true.test.ts` — pins that no copy promises a lifetime for
the ORIGINALS that the sweep does not honour, that the warning email never names
an account export, and that the decline button never says "keep". **Both failure
modes were reproduced on purpose to prove it fires.**

🪤 **My first pattern set cried wolf 3 times in 4.** `/originals?.{0,40}forever/`
fired on Pakanta's *"an ORIGINAL SONG for your wedding — yours, forever"* twice
and on an internal log line. The one real hit was a heading on the Keep Full-Res
buy card, where "keep your full-res forever" is precisely what that product does
— so not a lie either. Those patterns are removed, with the reasoning recorded
in the test so nobody helpfully adds them back. A guard that cries wolf teaches
you to skim past the one time it is right.

⏭ NOT in this PR: the live `/privacy` notice still says photos are **"kept for 5
years after the event date, then purged"** while the code drops originals at six
months. That is public legal copy in the owner's name as DPO — it is drafted
separately and **opened for his approval, never auto-merged**.

SPEC IMPACT: DECISION_LOG.md — covered by the 2026-08-07 preservation row.
