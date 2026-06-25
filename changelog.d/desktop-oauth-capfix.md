## 2026-06-26 · fix(desktop): grant oauth:allow-start/allow-cancel (loopback was permission-denied)

The desktop OAuth capability granted `oauth:default`, but `tauri-plugin-oauth`
defines NO default permission set (only `allow-start` / `allow-cancel`). Tauri
auto-creates an empty `oauth:default`, so `generate_context` passed but at runtime
`plugin:oauth|start` was denied — "Could not start the desktop sign-in helper."
Swapped `oauth:default` → `oauth:allow-start` + `oauth:allow-cancel`. Validated
with `cargo check`. Needs a desktop rebuild.

SPEC IMPACT: None.
