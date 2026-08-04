## 2026-08-01 · fix(papic): 29 more guest strings, and the guardrail that missed them

Found by finally reaching the capture screen — the login-free flag went live, so
the anonymous guest path became walkable for the first time. The screen says:

```
Record a 10-second clip        …        press and hold to record (up to 5s)
```

`CLIP_MAX_MS = 10_000` sits **800 lines above that hint, in the same file**, and
has since the owner raised the cap on 2026-07-22. The button label and the
over-length error both say 10. Only the hint still said 5. Now interpolated from
the constant, so the next re-price cannot leave one of the three behind.

⚠ Pabati's "up to 5 seconds" was checked and **left alone** — `MAX_CLIP_MS = 5000`
there is its own corpus-locked cap. A find-and-replace would have broken it.

**And 29 more "the couple" / "this wedding" strings** across the Papic guest
tree: the guest camera's blocked-camera notice, its consent copy, the Kwento
sheet, the pool grid's tag + closed-gallery notices, the decorator, and — on the
capture screen itself — *"Every shot lands in the couple's gallery."* Papic ships
on all 16 event types; these surfaces are reached by a token and have no couple.

## 🪤 The guardrail added hours earlier had the bug it was written to prevent

`lib/papic-guest-copy.test.ts` listed **four `page.tsx` files by hand** and missed
every `_components/` folder — which is where the strings actually live. It passed
green while 29 sat one directory below.

**A hand-typed file list is the same defect as a hand-typed string.** It now
WALKS `app/papic`, so a new surface is covered the moment it exists and nobody
has to remember. 4 assertions became 58; mutation-checked by reintroducing a
"couple"/"wedding" string and watching two go red.

`app/papic/page.tsx` stays excluded — the public marketing page is deliberately
wedding-first per "lead all-events, weddings deepest".

SPEC IMPACT: None — copy + one derived number. No behaviour change.
