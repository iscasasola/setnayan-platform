## 2026-06-26 · chore(desktop): temporary OAuth loopback diagnostics

`signInWithProviderDesktop` now surfaces the exact failure point of the desktop
system-browser OAuth flow via `alert()` + console trace (Tauri bridge presence,
plugin:oauth|start, signInWithOAuth, plugin:opener|open_url, exchange). Gated to
the desktop shell, so web/mobile are untouched. TEMPORARY — reverts to the quiet
error-routing version once the round-trip is confirmed on a real install.

SPEC IMPACT: None.
