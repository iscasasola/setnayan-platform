## 2026-07-08 · fix(plan3d): dev preview labs 404 in production

`/dev/booth-lab` and `/dev/figure-lab` (internal 3D preview pages from the booth/figure build sessions) shipped unguarded — harmless (procedural content, no data) but dev tooling shouldn't be publicly routable. Both now `notFound()` in production builds; dev behavior unchanged.

SPEC IMPACT: None
