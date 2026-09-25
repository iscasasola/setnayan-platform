## 2026-09-25 · fix(app): a page from an older deploy reloads instead of erroring

**Incident:** the iOS app (a Capacitor WebView on www.setnayan.com) opened
`/login` before a production deploy had finished posting to the NEW
deployment. Vercel's runtime log:

```
POST /login 404 … [Error: Failed to find Server Action "40ba73…". This
request might be from an older or newer deployment.]
```

The person saw the generic "Something on our end didn't work" crash card.
The owner will enable Vercel Skew Protection — the primary fix. This is the
backup: the client-side signature for THIS shape, added as its own matcher
rather than folded into the existing one.

**Why a new matcher, not a new regex on the existing one.** `lib/stale-bundle.ts`
already recognises two shapes of "this tab is older than the server" (a stale
script, and a Server Action whose reply the client cannot parse — both added
2026-09-15/18). A rejected action is a THIRD, distinct shape: reading Next's
own source for the pinned version (`node_modules/next/dist/client/components/
router-reducer/reducers/server-action-reducer.js`) shows the client checks a
`NEXT_ACTION_NOT_FOUND_HEADER` response header and throws `UnrecognizedActionError`
**before** ever reaching the generic "unexpected response" branch — so it never
matched any existing `STALE_PATTERNS` regex. Next ships its own public
discriminator for exactly this case, `unstable_isUnrecognizedActionError` from
`next/navigation` (documented: *"the client and the server are not from the
same deployment... Reloading the page will fix this mismatch"*), which
`isDeploymentSkewError` uses as its primary signal, with a name/message
fallback for a hand-built test shape.

`app/error.tsx` and `app/global-error.tsx` (the two boundaries that already
carry the stale-bundle reload) now check `isDeploymentSkewError` first, and
reload once via a new `reloadForDeploymentSkew` — which shares the existing
one-reload-per-session budget (`STALE_RELOAD_KEY`) so a tab never gets a
reload for each shape. The reload's cause is written to a new
`DEPLOYMENT_SKEW_FAILURE_KEY` sessionStorage marker first (mirroring
`STYLESHEET_FAILURE_KEY` in `lib/stylesheet-recovery.ts`), which
`DeferredObservability` reports to Sentry at **`info`**, not `error`, once the
app is back up — the reload already fixed it, so this exists only to measure
how often deploy skew still reaches a person.

`app/vendor-dashboard/error.tsx`, `app/admin/error.tsx`, `app/[slug]/error.tsx`
and `app/dashboard/[eventId]/seating/error.tsx` are untouched: none of them
currently carry the stale-bundle mechanism at all (verified by reading each),
so wiring the skew check into them would be a new mechanism, not an extension
of an existing one. No central `useSaveLoader`-style action-invocation helper
exists in the repo to extend either (searched; every "save" button owns its
own loading state).

**Guarded** by `apps/web/lib/stale-bundle.test.ts`: the matcher against the
real `UnrecognizedActionError` class (imported from Next's own source, not
reconstructed by hand) and against hand-built fallback shapes, a
non-overlap test against the existing `isStaleBundleError`, the shared
one-reload budget, and a guard that both boundaries actually call the new
matcher — sabotaged both ways (the matcher forced to `false`, and the
boundary call removed) and confirmed each turns exactly the expected test(s)
red, then restored to green.

SPEC IMPACT: None.
