## 2026-06-21 · fix(std): veil rose petals stick again — guarantee ≥10% cling to the veil

Owner: "the petals are not reacting anymore? and no petals stick to the veil. we want at least 10% of the petals to stick."

Root cause (`apps/web/app/[slug]/_components/reveal/veil-reveal.tsx`): the cling was timing-fragile and self-defeating on a real lift —
1. The in-fall collision only clings a petal while `lift < 0.45`, but a **manual swipe lifts the veil faster than petals fall** from above-screen to the cloth, so almost none reached the cloth inside that window.
2. Even a caught petal **peeled off the instant the cloth moved fast** (the `sp > 0.045` detach), so a quick swipe stripped every clinger immediately.

Net: ~0% stuck. Fix:
- **Pre-cling ~20% of the shower** onto scattered front cloth points at seed time, so a guaranteed visible share is caught on the fabric (well above the owner's 10% floor; still under the existing ~30% cap, which they count toward). They ride up + shake/release like any clinger — not a static "pre-seed at rest".
- **Dropped the fast-cloth `sp` detach** so clingers *ride* the veil up instead of peeling off the moment a swipe starts. They still **release at the half-lift** (`lift > 0.5`) — which keeps them off the pinned crown (the owner's earlier "petals aligned on the top" fix) — and still shake loose on lowering.

So now a fifth-ish of the petals visibly cling to the veil and ride it up before letting go.

Verified: `tsc --noEmit` exit 0; adversarial review (cling/release correctness + visual-regression / "lined-up-on-top") clean. The WebGL petal physics can't be tested headlessly, so the *look* is owner-verified on-device. CI (lint + build) + Vercel preview are the gate.

SPEC IMPACT: iter 0024 Save-the-Date veil reveal — ≥10% of shower petals cling to the veil and ride it up before releasing at the half-lift. → DECISION_LOG row.
