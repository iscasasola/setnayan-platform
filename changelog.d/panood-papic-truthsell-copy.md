## 2026-06-26 · fix(studio): align Panood + Papic selling copy to the real deliverable (truth-in-selling)

Launch-readiness audit found the in-app studio copy over-promised features that
aren't built yet (the public pricing/marketing site was already honest). The
underlying features genuinely work, so this aligns the *copy* to reality — no
gating.

- **Panood** — removed claims of a Setnayan-run multi-camera production (server
  ingest, compositing, monogram-on-broadcast overlay, program-feed relay, "up to
  6 cameras"). Honest today-state: the couple streams to their OWN YouTube (phone
  or OBS) and Setnayan embeds that live broadcast on their colour-matched event
  page; watch URL + auto-archive stay on their channel. The control room /
  camera-operator links / highlight markers / cast-to-projector are framed as
  "coming with the streaming rollout," not included today.
- **Papic** — capture is described as phone-browser (no app to install); the real
  web shutter (one tap + Photo/Clip toggle, no flash/torch) is shown, and the
  drag-gesture + flash/torch shutter is quarantined as "coming with the native
  Papic app (V1.5)." Face auto-tag is presented as enhanced/when-available with
  QR scan-to-tag as the working primary path.

Pure copy/structural-rename edits (WEB_CONTROLS / COMING_GESTURES); state logic,
gates, and live prices unchanged. Adversarially verified (real tsc clean; Papic +
compile passed; the three residual Panood control-room over-promises fixed).

SPEC IMPACT: none (copy aligned to shipped behavior; Panood multi-cam control room
confirmed on the roadmap, owner 2026-06-26).
