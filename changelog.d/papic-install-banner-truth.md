## 2026-07-21 · fix(papic): the install banner promised a faster camera it does not deliver

Two honesty fixes from `Papic_Low_Light_Council_Verdict_2026-07-21.md` § 8, tier (i) — both outside
the capture path, neither with a gate.

**1 · The banner made a false quality claim, eight lines above its own contradiction.**

`papic/join/[token]/_components/app-install-banner.tsx` read *"A faster camera and instant uploads."*
The same page renders *"lands straight in the couple's gallery — **no app to install**"* at
`page.tsx:162`.

The claim is not merely awkward beside that line — **it is untrue.** `apps/mobile/capacitor.config.ts`
is a **REMOTE-URL** shell (*"this shell does NOT bundle the app"*, `server.url` →
`https://www.setnayan.com`). The WebView loads the same hosted app and runs the **same
`getUserMedia` path** through `lib/use-papic-camera.ts`. `@capacitor/camera` is a declared dependency
with **zero importers** anywhere in `apps/web`, and background upload is one of the named-but-unbuilt
native gaps.

**So installing the app improves the photo by zero pixels.** Copy now claims convenience — a
home-screen icon, no browser chrome — which is what the shell actually provides. The module docblock
records why, so the next person writing this copy does not re-add a capture claim.

⚠ **It matters now because the banner is dormant only by accident** — it renders whenever
`NEXT_PUBLIC_IOS_APP_STORE_URL` / `_ANDROID_PLAY_STORE_URL` are set, and it renders for **both**
`seat` and `guest` join kinds. Landing this before those vars are ever set means the first install
cohort never receives the false promise.

**2 · The perf budget was stale by ~1.85× and was silently under-costing every proposal built on it.**

`lib/papic-photo-styles.ts` budgeted *"~2 MP (≤1920×1080)"*. The hook requests
`{ width: 2560, height: 1440 }` — **~3.7 MP** (`use-papic-camera.ts:200`). No runtime change; the
comment now states the real figure, cites its source, and instructs that N-frame stacking, a 3D LUT
and Drag mode all be costed against 3.7 MP per frame.

SPEC IMPACT: `0012_papic/Papic_Themes_Spec_2026-07-21.md` carries the same stale ~2 MP figure and is
corrected in the corpus alongside this.
