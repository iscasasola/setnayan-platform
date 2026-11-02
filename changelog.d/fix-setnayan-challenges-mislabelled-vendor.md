## 2026-08-07 · fix(papic): Setnayan's recommended challenges were labelled "Vendor" to the couple

The §9 library (#4187) added a **fourth** mission source, `setnayan`, and widened
the database CHECK to `('auto','couple','vendor','setnayan')`. The couple's
challenge manager declared its **own** copy of that union — `'auto' | 'couple' |
'vendor'` — so it never learned about the fourth.

Its lookup ended `?? SOURCE_BADGE.vendor`. So every Setnayan recommendation
appearing in the couple's list was tagged **"Vendor"**: the couple was told a
supplier had written the challenge Setnayan supplied. Nothing errored, nothing
logged, CI was green — the fallback made a wrong answer look like a handled one.

**This is the session's recurring disease in its purest form:** one fact (what
sources exist) written in two places, and only one of them got the update.

### The fix is the guard, not the entry

`MissionRow['source']` and `SOURCE_BADGE` are now both keyed off the shared
`PapicMissionSource` from `lib/papic-missions.ts`. `Record<PapicMissionSource, …>`
makes completeness a **compile error**, so a fifth source cannot reach a couple's
screen unlabelled.

**Sabotage-tested** (house rule — a guard is decoration until it has been seen to
fail). Deleting the `setnayan` entry fails the build by name:

```
error TS2741: Property 'setnayan' is missing in type '{ couple: …; auto: …; vendor: … }'
  but required in type 'Record<PapicMissionSource, { label: string; cls: string; }>'
```

### Also

- Badge label for the new source: **"Recommended"** (`bg-gold/15 text-gold-700` —
  an existing token, already used by `negotiation-card-shell.tsx`; verified
  rather than invented).
- The fallback no longer borrows another source's badge. Defaulting to `vendor`
  is *how* this became a lie; it now degrades to a neutral "Challenge".
- Card copy said only "Write your own, and hide any you don't want". It now says
  we add a recommended set, which is what actually happens — verified against
  prod: `ensure_papic_board` inserts `source='setnayan'` rows with `approved`
  defaulting to `true`, so they land in this very list, where the couple can hide
  any they don't want.

### Correcting the record

An earlier note in this session claimed couples "cannot pick from the 40". That
was **wrong**, and the owner corrected it. Setnayan's recommendations arrive in
the couple's list automatically and can be hidden or added to — which is
picking. What does not exist is a browse-all-40-upfront picker (handoff PR-E);
the curation outcome already works.

Verified: `tsc --noEmit` clean · 18/18 lint scripts · guard sabotage-tested.

SPEC IMPACT: None.
