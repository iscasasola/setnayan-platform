## 2026-09-19 · test(day-of): fence the On-the-day shot list to photo/video suppliers (S43 · 8)

AREA-VENDOR reported that the shot list on the On-the-day page shows for every
supplier. **Re-measured on origin/main, that is not the case.** The one mount
(`<ShotListSection>`) has sat behind `kind === 'photo'` since the 2026-07-01
reskin (8155ea13d). `kind` comes from `resolveDayOfConsoleKind`, where only the
photo_video / editorial / livestream tiles resolve to `photo`. DAY-10's couple
side (`shot-list-card.tsx`) uses the booking category only to decide whether an
EMPTY list gets a "not shared yet" line.

Nothing about behaviour changes. The gate had no guard, so this adds
`on-the-day/the-shot-list-is-for-the-camera.test.ts`. It parses the mount's
condition (exactly one mount, gated on `kind === 'photo'`; red when mutated to
`true`) and checks that non-photo tiles never resolve to the photo console.

SPEC IMPACT: None.
