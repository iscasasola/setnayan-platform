# Lane 6 shots — Account / launcher onto the 701 line (plan D5)

Drawn from `/dev/account-lab` (the real `FrontDoorShell`, account bar, `SettingsShell` and the new settings rail
rows; fixture panes only). **Now** = main's `settings-shell.tsx` + account bar at the 1024 line (`?b=lg`);
**Proposed** = this branch (`?b=tab`). `compare-<w>.png` puts them side by side.

- **390** — Now and Proposed are pixel-identical (measured: `ImageChops.difference(...).getbbox()` → `None`).
- **768** — Now: phone bottom bar + the page's own Settings sidebar + ☰ drawer. Proposed: the rail's 72-px strip
  (Home · Discover · Features, then the six settings groups as rows), no bottom bar, one reading column.
- **1280** — Now: full rail + the page sidebar. Proposed: full rail with a "Settings" group of six rows and a
  `max-w-3xl` reading column.
