## 2026-10-23 · fix(appearance): Light is the default again — until dark mode covers every screen

Owner: *"if there are too many, make light the default first"* · *"but if the build is small to fix it, then make automatic default"*. Measured: about 10 of ~320 user-facing pages are on `DARK_READY`, ~16 area PRs remain → Light.

- `DEFAULT_APPEARANCE` `'auto'` → `'light'`; the pre-paint script (`theme-bootstrap-script.ts`) reads no cookie as Light.
- Migration `20271286061585`: the 22 rows #6825's migration moved to Automatic (all last touched before 2026-10-23 02:06:57Z; nobody had picked Automatic — it did not exist) go back to Light; column default `'light'`. A Light, Dark or Automatic someone picked since is untouched.
- Light · Dark · Automatic stay as the three choices.

SPEC IMPACT: DECISION_LOG row "23 Oct: Light stays the default until dark covers every screen" (corpus).
