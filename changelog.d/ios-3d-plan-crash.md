## 2026-10-29 · fix(seating-3d): a phone can no longer be killed by the 3D plan

Owner, iPhone, the installed app: *"When i pressed 3d plan"* → iOS's `"Setnayan" Crashed` dialog, back to Events.
The seat plan's 3D room (Guests › Seats › 3D, `seating-lab-3d.tsx`) always ran the DESKTOP tier on a phone, drew every
frame with nothing moving, and — mounted on first open and kept by R4 — held its WebGL context behind `hidden` while 2D
and List ran. Measured in WebKit at 390×844 DPR 3 on a 25-table / 230-guest plan (the size of the event that crashed):
GPU-process footprint ~290 MB Build / ~390–465 MB Play, 258 MB still held while hidden, 144–170 draws per idle 2 s.

- New `lib/phone-gpu-budget.ts` (pure caps + phone reading) and `app/_components/plan3d/phone-gpu-budget.tsx` (hooks +
  the fallback line).
- On a phone the room runs the guest walk's 'low' tier, no Tier B composer, DPR capped at 1.25, `frameloop="demand"`
  while nothing moves (`DemandTail` keeps it drawing through each change and its ease). Computers are unchanged.
- The room's Canvas unmounts while it has no size (hidden behind 2D / List) — the WebGL context is released; the room's
  lock, mode and picks stay mounted (R4's "loads once" holds).
- `webglcontextlost` → "3D needs more memory than this device has free right now." + Show 2D / Try 3D again, never a
  dead canvas. Also on the Event Hub venue walk and the 3D Plan demo (both also take the phone DPR cap).
- After: ~140 MB Build / ~240 MB Play, ~103 MB and no canvas while hidden, 0 idle draws.
- Guard: `lib/phone-gpu-budget.test.ts` (6 sabotages, each red).

SPEC IMPACT: None
