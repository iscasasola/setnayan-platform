## 2026-07-05 · feat(loading): admin-configurable loader variants + veil/speed/pop

Made the shared brand loader (`<SDLoader>` + boot splash + blocking overlay)
admin-configurable from `/admin/settings`. Admins pick a **variant** (Gather ·
Aurora · Pulse), **veil solidity** (70–100%), **narration speed** (800–3000 ms),
and a **tap-to-pop** micro-interaction on/off. Config is stored on the
`platform_settings` singleton, read server-side (cached, `unstable_cache` +
React `cache`, 1-hour revalidate) in the root layout, and threaded to every
`<SDLoader>` via a new `LoaderConfigProvider` — zero per-navigation cost, and it
degrades to the shipped `gather`/90/1500/pop-on default if the migration hasn't
been applied.

- Migration `20270520000000_platform_settings_loader_appearance.sql` — additive
  `loader_variant` / `loader_veil_opacity` / `loader_step_interval_ms` /
  `loader_pop_enabled` columns (CHECK-constrained), inherits table RLS.
- New: `lib/loader-config.ts` (client-safe type + default), `lib/loader-settings.ts`
  (cached reader), `app/_components/loader-config-provider.tsx`,
  `app/admin/settings/_components/loader-appearance-card.tsx` (live preview).
- Aurora + Pulse are two new CSS variant treatments of the SAME mark (no mark
  redesign); tap-to-pop is a WAAPI gold-mote burst gated on the toggle and
  `prefers-reduced-motion`.

SPEC IMPACT: None; additive admin config on the shipped loader system.
