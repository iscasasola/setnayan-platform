# Buttons and dead taps: code inventory (27 Nov 2026)

Read-only audit of every button and tappable control in `apps/web/app/**` and `apps/web/components/**`,
at `origin/main` **068460f** (the commit live on setnayan.com on 27 Nov 2026). No app code was changed.

**Totals:** 6219 tappable controls in 1703 files ·
**0 blocker · 34 bug · 183 polish**.

The full per-control inventory (route, label, handler, where it goes) is
[`buttons-inventory.tsv`](buttons-inventory.tsv), one row per control: `file · line · route · element · label · handler / destination`.

Already known and **not re-reported** here: the guest dead taps "Open in Safari" and "Copy my link" (lane L2), and the
missing press feedback on plain links because `PRESS_TARGETS` in `app/_components/press-feel.tsx` leaves out `a[href]`.

## How this was checked

A TypeScript-AST scan (every `.tsx` under `app/` and `components/`; tests, `app/dev/**` and `*.lab.tsx` are exempt
per the wiring rules §17). A control is any `<button>`, `<a>`, `<Link>`, `<ActionButton>`, `<summary>`, anything with
`role="button|link|tab|menuitem|option|switch"`, and any element with `onClick`. Each candidate below was then read
by hand; false positives found while reading were fixed in the scan rules, and the rows kept are the ones that held up.

| Check | Rule used |
|---|---|
| Empty / no-op | `onClick` (inline or a local function) whose body is empty, `undefined`, or only `console.*`; `href="#"` or `""`. |
| onClick on a non-button | `onClick` on div/span/li/img/etc. with no `role` or no key handler. Click delegation (the element wraps real buttons/links) and stopPropagation-only handlers are skipped. |
| No accessible name | button/link whose children are only icons/svg, with no `aria-label`, `aria-labelledby`, `title`, `sr-only` word or alt text. `ActionButton` always has one (`label`). |
| Under 44 px | Global CSS gives every `<button>` and `[role=button]` `min-height: 44px`, so a button is flagged only when a utility lowers it (`min-h-9`, `min-h-10`, `min-h-[36px]`, `min-h-0`) or it is drawn narrower than 44 (`w-8`, `size-9`) as an icon button; a link is flagged when it is `h-<11`. `.sn-hit` / `.sn-dot-btn` halos count as 44. |
| ▾ not a list | a `ChevronDown` / `▾` / `caret` on a link (bug), on a button with `aria-haspopup="dialog"` (polish: check the sheet is a list) or with no `aria-haspopup`/`aria-expanded` (polish). Reorder arrows and fold toggles are skipped. |
| More than one main | `ActionButton main` or `.button-primary` twice in one component where the scan can prove both can render together (same branch); rows inside a `.map()` too. Each is a "verify in the browser" row. |
| Missing route | every literal or template `href`, `router.push/replace`, `redirect()` checked against the 690 `page`/`route` files in the app router tree, `public/`, `next.config` redirects and `lib/legacy-redirects.ts`. Route-builder calls (`lib/routes.ts`) are trusted. |
| Server action | in a `'use client'` file, a call to an import from a `'use server'` module that is never awaited (a bare statement, `void`, or returned into a JSX event prop or `startTransition`), or an `await` whose result object is thrown away. Telemetry calls (`record*`, `track*`, `heartbeat*`) under `void` are skipped. |

## Summary by area

| Area | Controls | Blocker | Bug | Polish |
|---|---:|---:|---:|---:|
| `/dashboard` | 2522 | 0 | 9 | 86 |
| `/vendor-dashboard` | 967 | 0 | 2 | 17 |
| `(shared app components)` | 944 | 0 | 4 | 30 |
| `/admin` | 625 | 0 | 8 | 16 |
| `/[slug]` | 311 | 0 | 0 | 3 |
| `/papic` | 113 | 0 | 2 | 6 |
| `/onboarding` | 113 | 0 | 7 | 2 |
| `/v` | 92 | 0 | 0 | 1 |
| `/open-shop` | 58 | 0 | 0 | 6 |
| `/explore` | 51 | 0 | 0 | 9 |
| `/privacy` | 35 | 0 | 0 | 0 |
| `/panood` | 27 | 0 | 0 | 1 |
| `/tour` | 26 | 0 | 0 | 3 |
| `/vendor` | 20 | 0 | 0 | 0 |
| `/features` | 19 | 0 | 0 | 0 |
| `/u` | 17 | 0 | 0 | 0 |
| `/join` | 16 | 0 | 0 | 0 |
| `/pricing` | 15 | 0 | 0 | 0 |
| `/pay` | 15 | 0 | 1 | 0 |
| `/help` | 14 | 0 | 0 | 0 |
| `/for-coordinators` | 13 | 0 | 0 | 0 |
| `/pa3d` | 13 | 0 | 0 | 0 |
| `/terms` | 13 | 0 | 0 | 0 |
| `(shared components)` | 13 | 0 | 1 | 0 |
| `/suppliers` | 12 | 0 | 0 | 0 |
| `/about` | 10 | 0 | 0 | 0 |
| `/articles` | 10 | 0 | 0 | 0 |
| `/for-suppliers` | 10 | 0 | 0 | 0 |
| `/samahan` | 10 | 0 | 0 | 1 |
| `/monogram` | 9 | 0 | 0 | 0 |
| `/tl` | 8 | 0 | 0 | 0 |
| `/download` | 7 | 0 | 0 | 0 |
| `/realstories` | 7 | 0 | 0 | 0 |
| `/3d_plan` | 6 | 0 | 0 | 0 |
| `/claim` | 6 | 0 | 0 | 0 |
| `/(root)` | 6 | 0 | 0 | 0 |
| `/signup` | 6 | 0 | 0 | 0 |
| `/vendor-invite` | 6 | 0 | 0 | 0 |
| `/alaala` | 5 | 0 | 0 | 0 |
| `/refunds` | 5 | 0 | 0 | 0 |
| `/login` | 5 | 0 | 0 | 0 |
| `/proposals` | 5 | 0 | 0 | 2 |
| `/acceptable-use` | 4 | 0 | 0 | 0 |
| `/cookies` | 4 | 0 | 0 | 0 |
| `/creators` | 4 | 0 | 0 | 0 |
| `/forgot-password` | 4 | 0 | 0 | 0 |
| `/receipts` | 4 | 0 | 0 | 0 |
| `/waitlist` | 3 | 0 | 0 | 0 |
| `/host` | 3 | 0 | 0 | 0 |
| `/sample` | 2 | 0 | 0 | 0 |
| `/our-story` | 1 | 0 | 0 | 0 |
| `/web-only` | 1 | 0 | 0 | 0 |
| `/i` | 1 | 0 | 0 | 0 |
| `/live` | 1 | 0 | 0 | 0 |
| `/reset-password` | 1 | 0 | 0 | 0 |
| `/wall` | 1 | 0 | 0 | 0 |
| **Total** | **6219** | **0** | **34** | **183** |

## Summary by problem

| Severity | Problem | Count |
|---|---|---:|
| bug | onClick on non-button | 22 |
| bug | server action not awaited / error dropped | 6 |
| bug | role=button with no key/click path | 4 |
| bug | ▾ not opening a list | 1 |
| bug | no accessible name | 1 |
| polish | under 44 px | 131 |
| polish | ▾ not opening a list | 19 |
| polish | more than one main | 15 |
| polish | onClick on non-button | 10 |
| polish | server action not awaited / error dropped | 5 |
| polish | missing route | 2 |
| polish | empty / no-op handler | 1 |

## Summary by route (routes with at least one finding)

| Route | Controls | Blocker | Bug | Polish |
|---|---:|---:|---:|---:|
| `/onboarding/wedding` | 71 | 0 | 7 | 2 |
| `/admin/ugat` | 35 | 0 | 6 | 1 |
| `/dashboard/[eventId]/vendors` | 221 | 0 | 5 | 4 |
| `(shared app components)` | 944 | 0 | 4 | 30 |
| `/dashboard/[eventId]/launch` | 329 | 0 | 2 | 10 |
| `/papic/decorate` | 11 | 0 | 2 | 1 |
| `/dashboard/[eventId]/studio/mood-board` | 118 | 0 | 1 | 10 |
| `/vendor-dashboard/clients/[eventId]` | 148 | 0 | 1 | 2 |
| `/admin` | 45 | 0 | 1 | 1 |
| `/admin/moodboard-library` | 21 | 0 | 1 | 1 |
| `(shared components)` | 13 | 0 | 1 | 0 |
| `/dashboard/[eventId]/vendors/[vendorId]/workspace` | 54 | 0 | 1 | 0 |
| `/pay/[reference]` | 15 | 0 | 1 | 0 |
| `/vendor-dashboard/shop` | 112 | 0 | 1 | 0 |
| `/dashboard/[eventId]/website/editor` | 146 | 0 | 0 | 18 |
| `/dashboard/[eventId]/seating` | 199 | 0 | 0 | 12 |
| `/admin/categories` | 89 | 0 | 0 | 9 |
| `/explore` | 47 | 0 | 0 | 9 |
| `/dashboard/[eventId]/schedule` | 127 | 0 | 0 | 6 |
| `/open-shop` | 54 | 0 | 0 | 6 |
| `/papic/guest` | 46 | 0 | 0 | 5 |
| `/dashboard/[eventId]/studio/panood/broadcast` | 16 | 0 | 0 | 4 |
| `/[slug]` | 224 | 0 | 0 | 3 |
| `/dashboard/[eventId]/guests` | 154 | 0 | 0 | 3 |
| `/dashboard/[eventId]/website` | 28 | 0 | 0 | 3 |
| `/dashboard/[eventId]/website/our-story` | 41 | 0 | 0 | 3 |
| `/dashboard/samahan/[communityId]` | 32 | 0 | 0 | 3 |
| `/vendor-dashboard` | 102 | 0 | 0 | 3 |
| `/vendor-dashboard/on-the-day` | 38 | 0 | 0 | 3 |
| `/vendor-dashboard/services` | 113 | 0 | 0 | 3 |
| `/dashboard/[eventId]/budget` | 20 | 0 | 0 | 2 |
| `/proposals/[publicId]` | 5 | 0 | 0 | 2 |
| `/admin/hub-music` | 8 | 0 | 0 | 1 |
| `/admin/menus` | 10 | 0 | 0 | 1 |
| `/admin/studio` | 33 | 0 | 0 | 1 |
| `/admin/work` | 16 | 0 | 0 | 1 |
| `/dashboard/[eventId]` | 223 | 0 | 0 | 1 |
| `/dashboard/[eventId]/details` | 28 | 0 | 0 | 1 |
| `/dashboard/[eventId]/seating/walkthrough` | 7 | 0 | 0 | 1 |
| `/dashboard/[eventId]/studio/indoor-blueprint` | 3 | 0 | 0 | 1 |
| `/dashboard/[eventId]/studio/panood/setup` | 8 | 0 | 0 | 1 |
| `/dashboard/[eventId]/studio/papic` | 43 | 0 | 0 | 1 |
| `/dashboard/[eventId]/studio/save-the-date/stamp` | 5 | 0 | 0 | 1 |
| `/dashboard/people` | 53 | 0 | 0 | 1 |
| `/panood/control/[eventId]` | 18 | 0 | 0 | 1 |
| `/samahan/chat/[threadId]` | 3 | 0 | 0 | 1 |
| `/tour` | 6 | 0 | 0 | 1 |
| `/tour/gallery` | 5 | 0 | 0 | 1 |
| `/tour/vendors` | 4 | 0 | 0 | 1 |
| `/v/[slug]` | 68 | 0 | 0 | 1 |
| `/vendor-dashboard/customers` | 41 | 0 | 0 | 1 |
| `/vendor-dashboard/forms` | 19 | 0 | 0 | 1 |
| `/vendor-dashboard/messages/[threadId]` | 34 | 0 | 0 | 1 |
| `/vendor-dashboard/moodboard-library` | 12 | 0 | 0 | 1 |
| `/vendor-dashboard/packages` | 7 | 0 | 0 | 1 |
| `/vendor-dashboard/services/requests` | 12 | 0 | 0 | 1 |

Routes are derived from the file's folder: a piece in `app/x/_components/` is counted under `/x`; `components/**` is "(shared components)", used on many routes.

## Blockers (a press does nothing or goes nowhere): 0

None found by the scan. The two candidate blockers it raised were read by hand and moved to polish (see the /open-shop and /tour rows).

## Bugs (works for some people, fails for others, or hides a failure): 34

| file:line | route | label | problem | fix |
|---|---|---|---|---|
| `app/dashboard/[eventId]/vendors/_components/accordion-lock.tsx:667` | `/dashboard/[eventId]/vendors` | markCategoryComplete() | await markCategoryComplete() result is thrown away; it returns a result/error object | Read the result; on !ok show the plain reason + Try again |
| `app/dashboard/[eventId]/vendors/_components/pending-lock-proposals.tsx:81` | `/dashboard/[eventId]/vendors` | dismissVendorLockProposal() | 'await dismissVendorLockProposal()' result is thrown away, then the row is removed anyway: a refused dismiss looks like it worked | Remove the row only on ok; on error show the reason + Try again |
| `app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx:4920` | `/dashboard/[eventId]/vendors` | clearCategoryDecision() | await clearCategoryDecision() result is thrown away; it returns a result/error object | Read the result; on !ok show the plain reason + Try again |
| `app/dashboard/[eventId]/vendors/_components/team-controls.tsx:136` | `/dashboard/[eventId]/vendors` | clearBuildPicks() | await clearBuildPicks() result is thrown away; it returns a result/error object | Read the result; on !ok show the plain reason + Try again |
| `app/vendor-dashboard/clients/[eventId]/_components/client-refunds.tsx:168` | `/vendor-dashboard/clients/[eventId]` | recordClientRefund() | await recordClientRefund() result is thrown away; it returns a result/error object | Read the result; on !ok show the plain reason + Try again |
| `app/vendor-dashboard/shop/_components/suggested-coverage-card.tsx:84` | `/vendor-dashboard/shop` | suggestedCoverage() | await suggestedCoverage() result is thrown away; it returns a result/error object | Read the result; on !ok show the plain reason + Try again |
| `app/admin/_components/focus-row.tsx:124` | `/admin` | {mark} {title} {sub} {open ? ( &lt;ChevronU} | A ▾ on a link: it navigates instead of opening a list | Drop the ▾ (use ChevronRight) or open a PickMenu |
| `app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/couple-story-shares-card.tsx:56` | `/dashboard/[eventId]/vendors/[vendorId]/workspace` | (icon) | Icon-only control with no accessible name (no aria-label, title or word) | Add aria-label (house rule: icon + word where room allows) |
| `app/_components/chat-message-stream.tsx:3021` | `(shared app components)` | {m.body ? ( &lt;} {voice ? ( //} {m.is_bot ? ( } {mine ? 'You' : counterp | onClick on &lt;div> with no role, keyboard handler, tabIndex: keyboard users cannot press it | Use a &lt;button> (or ActionButton); a row can be a &lt;button> styled as .sn-row |
| `app/_components/picked/picked-shell.tsx:840` | `(shared app components)` | {m.control} | onClick on &lt;div> with no keyboard handler, tabIndex: keyboard users cannot press it | Use a &lt;button> (or ActionButton); a row can be a &lt;button> styled as .sn-row |
| `app/_components/ticker.tsx:147` | `(shared app components)` | {c.t} | onClick on &lt;div> with no keyboard handler, tabIndex: keyboard users cannot press it | Use a &lt;button> (or ActionButton); a row can be a &lt;button> styled as .sn-row |
| `components/thumb-row.tsx:361` | `(shared components)` | {field.node} | onClick on &lt;span> with no role, keyboard handler, tabIndex: keyboard users cannot press it | Use a &lt;button> (or ActionButton); a row can be a &lt;button> styled as .sn-row |
| `app/admin/moodboard-library/_components/color-range-manipulator.tsx:256` | `/admin/moodboard-library` | {!imgLoaded && ( &lt;div} | onClick on &lt;div> with no role, keyboard handler, tabIndex: keyboard users cannot press it | Use a &lt;button> (or ActionButton); a row can be a &lt;button> styled as .sn-row |
| `app/admin/ugat/_components/ugat-console.tsx:712` | `/admin/ugat` | (path) | onClick on &lt;path> with no role, keyboard handler, tabIndex: keyboard users cannot press it | Use a &lt;button> (or ActionButton); a row can be a &lt;button> styled as .sn-row |
| `app/admin/ugat/_components/ugat-console.tsx:722` | `/admin/ugat` | {(joints.length > 1 ? '(${joint} | onClick on &lt;g> with no role, keyboard handler, tabIndex: keyboard users cannot press it | Use a &lt;button> (or ActionButton); a row can be a &lt;button> styled as .sn-row |
| `app/admin/ugat/_components/ugat-console.tsx:759` | `/admin/ugat` | {finding.sev === 'red' ? '!' : } | onClick on &lt;g> with no role, keyboard handler, tabIndex: keyboard users cannot press it | Use a &lt;button> (or ActionButton); a row can be a &lt;button> styled as .sn-row |
| `app/admin/ugat/_components/ugat-console.tsx:792` | `/admin/ugat` | {n.name} {n.countLabel} {worst && ( } | onClick on &lt;g> with no role, keyboard handler, tabIndex: keyboard users cannot press it | Use a &lt;button> (or ActionButton); a row can be a &lt;button> styled as .sn-row |
| `app/admin/ugat/_components/ugat-console.tsx:838` | `/admin/ugat` | {worst === 'red' ? '!' : '~'} | onClick on &lt;g> with no role, keyboard handler, tabIndex: keyboard users cannot press it | Use a &lt;button> (or ActionButton); a row can be a &lt;button> styled as .sn-row |
| `app/admin/ugat/_components/ugat-console.tsx:1673` | `/admin/ugat` | {r.cells.map((cell, ci) => ( } | onClick on &lt;tr> with no role, keyboard handler, tabIndex: keyboard users cannot press it | Use a &lt;button> (or ActionButton); a row can be a &lt;button> styled as .sn-row |
| `app/dashboard/[eventId]/launch/_components/details-march.tsx:1235` | `/dashboard/[eventId]/launch` | {fixed ? undefined : '${sec.label} — drag to move the whole section'} | onClick on &lt;p> with no keyboard handler: keyboard users cannot press it | Use a &lt;button> (or ActionButton); a row can be a &lt;button> styled as .sn-row |
| `app/dashboard/[eventId]/launch/_components/stage-panel/kit.tsx:122` | `/dashboard/[eventId]/launch` | {small} | onClick on &lt;div> with no role, keyboard handler, tabIndex: keyboard users cannot press it | Use a &lt;button> (or ActionButton); a row can be a &lt;button> styled as .sn-row |
| `app/dashboard/[eventId]/studio/mood-board/_components/recolor-studio.tsx:254` | `/dashboard/[eventId]/studio/mood-board` | (canvas) | onClick on &lt;canvas> with no role, keyboard handler, tabIndex: keyboard users cannot press it | Use a &lt;button> (or ActionButton); a row can be a &lt;button> styled as .sn-row |
| `app/onboarding/wedding/_components/location-step.tsx:321` | `/onboarding/wedding` | {c.n} {d != null && &lt;span className="} {c.r} | onClick on &lt;div> with no role, keyboard handler, tabIndex: keyboard users cannot press it | Use a &lt;button> (or ActionButton); a row can be a &lt;button> styled as .sn-row |
| `app/onboarding/wedding/_components/onboarding-shell.tsx:851` | `/onboarding/wedding` | {label} {lk ? &lt;span className="lk">{lk}} | onClick on &lt;span> with no role, keyboard handler, tabIndex: keyboard users cannot press it | Use a &lt;button> (or ActionButton); a row can be a &lt;button> styled as .sn-row |
| `app/onboarding/wedding/_components/onboarding-shell.tsx:3084` | `/onboarding/wedding` | Your Event Hub preview | onClick on &lt;div> with no keyboard handler: keyboard users cannot press it | Use a &lt;button> (or ActionButton); a row can be a &lt;button> styled as .sn-row |
| `app/onboarding/wedding/_components/onboarding-shell.tsx:3862` | `/onboarding/wedding` | {o.title} {o.desc} | onClick on &lt;div> with no role, keyboard handler, tabIndex: keyboard users cannot press it | Use a &lt;button> (or ActionButton); a row can be a &lt;button> styled as .sn-row |
| `app/onboarding/wedding/_components/onboarding-shell.tsx:3890` | `/onboarding/wedding` | {o.title} {o.desc} | onClick on &lt;div> with no role, keyboard handler, tabIndex: keyboard users cannot press it | Use a &lt;button> (or ActionButton); a row can be a &lt;button> styled as .sn-row |
| `app/onboarding/wedding/_components/onboarding-shell.tsx:4316` | `/onboarding/wedding` | {v.verified && &lt;span className=} {v.name} {hasRating && ( } {v.city && | onClick on &lt;div> with no role, keyboard handler, tabIndex: keyboard users cannot press it | Use a &lt;button> (or ActionButton); a row can be a &lt;button> styled as .sn-row |
| `app/onboarding/wedding/_components/welcome-moments.tsx:229` | `/onboarding/wedding` | {m.t === 'speak' ? ( &lt;d} | onClick on &lt;div> with no role, keyboard handler, tabIndex: keyboard users cannot press it | Use a &lt;button> (or ActionButton); a row can be a &lt;button> styled as .sn-row |
| `app/pay/[reference]/_components/pay-panel.tsx:602` | `/pay/[reference]` | (img) | onClick on &lt;img> with no role, keyboard handler, tabIndex: keyboard users cannot press it | Use a &lt;button> (or ActionButton); a row can be a &lt;button> styled as .sn-row |
| `app/_components/proposal-maker.tsx:1980` | `(shared app components)` | Drag to reorder | role="button" on &lt;span> with only onDragStart/onDragEnd handlers: no keyboard or click path | Remove the role or make it a real button |
| `app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx:1880` | `/dashboard/[eventId]/vendors` | ⠿ | role="button" on &lt;span> with only onDragStart/onDragEnd handlers: no keyboard or click path | Remove the role or make it a real button |
| `app/papic/decorate/_components/kwento-decorator.tsx:478` | `/papic/decorate` | Resize and rotate | role="button" on &lt;span> with only onPointerDown handlers: no keyboard or click path | Remove the role or make it a real button |
| `app/papic/decorate/_components/kwento-decorator.tsx:486` | `/papic/decorate` | Delete | role="button" on &lt;span> with only onPointerDown handlers: no keyboard or click path | Remove the role or make it a real button |

## Polish (house-standard breaks: 44 px, ▾, one main): 183

| file:line | route | label | problem | fix |
|---|---|---|---|---|
| `app/_components/thread-call-room.tsx:159` | `(shared app components)` | endThreadCall() | 'void endThreadCall()' in unmount cleanup: a failure is silent (commented best-effort) | Acceptable; log the failure so a stuck call row is visible |
| `app/dashboard/[eventId]/details/_components/supplier-changes-row.tsx:43` | `/dashboard/[eventId]/details` | resolveScheduleSuggestion() | await resolveScheduleSuggestion() result is thrown away; it returns a result/error object (try/catch only sees throws) | Read the result; on !ok show the plain reason + Try again |
| `app/dashboard/[eventId]/vendors/_components/booked-room-line.tsx:41` | `/dashboard/[eventId]/vendors` | sendChatMessage() | await sendChatMessage() result is thrown away; it returns a result/error object (try/catch only sees throws) | Read the result; on !ok show the plain reason + Try again |
| `app/vendor-dashboard/messages/[threadId]/_components/thread-tools-sheet.tsx:550` | `/vendor-dashboard/messages/[threadId]` | sendChatMessage() | await sendChatMessage() result is thrown away; it returns a result/error object (try/catch only sees throws) | Read the result; on !ok show the plain reason + Try again |
| `app/vendor-dashboard/moodboard-library/_components/stylist-library-editor.tsx:326` | `/vendor-dashboard/moodboard-library` | importEditorialMediaToGallery() | await importEditorialMediaToGallery() result is thrown away; it returns a result/error object (try/catch only sees throws) | Read the result; on !ok show the plain reason + Try again |
| `app/_components/account-switcher/account-switcher.tsx:880` | `(shared app components)` | Open account switcher | ▾ opens a dialog/sheet (aria-haspopup="dialog"), not a list | Confirm the sheet is a list of choices; otherwise drop the ▾ |
| `app/_components/account-switcher/account-switcher.tsx:1048` | `(shared app components)` | {ariaLabel} | ▾ opens a dialog/sheet (aria-haspopup="dialog"), not a list | Confirm the sheet is a list of choices; otherwise drop the ▾ |
| `app/_components/frontdoor/discover-supplier-controls.tsx:56` | `(shared app components)` | Category: ${*} | ▾ opens a dialog/sheet (aria-haspopup="dialog"), not a list | Confirm the sheet is a list of choices; otherwise drop the ▾ |
| `app/_components/negotiation-card-shell.tsx:79` | `(shared app components)` | {t.label}: {title} {pill} | ▾ with no aria-haspopup / aria-expanded: cannot prove it opens a list | Use PickMenu, or add aria-expanded/aria-haspopup="listbox" |
| `app/dashboard/[eventId]/guests/_components/guest-proxy-row.tsx:169` | `/dashboard/[eventId]/guests` | Link ▾ an existing guest | ▾ with no aria-haspopup / aria-expanded: cannot prove it opens a list | Use PickMenu, or add aria-expanded/aria-haspopup="listbox" |
| `app/dashboard/[eventId]/launch/_components/stage-item-menu.tsx:115` | `/dashboard/[eventId]/launch` | {label} | ▾ opens a dialog/sheet (aria-haspopup="dialog"), not a list | Confirm the sheet is a list of choices; otherwise drop the ▾ |
| `app/dashboard/[eventId]/launch/_components/stage-tools.tsx:1966` | `/dashboard/[eventId]/launch` | ${*}${*} — open Pages | ▾ opens a dialog/sheet (aria-haspopup="dialog"), not a list | Confirm the sheet is a list of choices; otherwise drop the ▾ |
| `app/dashboard/[eventId]/launch/_components/stages-studio-parts.tsx:150` | `/dashboard/[eventId]/launch` | {stagePillLabel(name)} | ▾ opens a dialog/sheet (aria-haspopup="dialog"), not a list | Confirm the sheet is a list of choices; otherwise drop the ▾ |
| `app/dashboard/[eventId]/launch/_components/studio-colour-field.tsx:54` | `/dashboard/[eventId]/launch` | ${*} colour: ${*} | ▾ opens a dialog/sheet (aria-haspopup="dialog"), not a list | Confirm the sheet is a list of choices; otherwise drop the ▾ |
| `app/dashboard/[eventId]/seating/_components/seating-editor.tsx:5223` | `/dashboard/[eventId]/seating` | {grp.label} {formatCount(grp.member_count)} | ▾ with no aria-haspopup / aria-expanded: cannot prove it opens a list | Use PickMenu, or add aria-expanded/aria-haspopup="listbox" |
| `app/dashboard/[eventId]/seating/_components/seating-editor.tsx:9944` | `/dashboard/[eventId]/seating` | {u.isLinked ? ( } {u.label} {u.members.length > 1 } {formatCount(seate | ▾ with no aria-haspopup / aria-expanded: cannot prove it opens a list | Use PickMenu, or add aria-expanded/aria-haspopup="listbox" |
| `app/dashboard/[eventId]/seating/walkthrough/_components/walkthrough-manager.tsx:240` | `/dashboard/[eventId]/seating/walkthrough` | {zone.tableIds.length} table{zone.tableIds.length === 1 ? '} in this z | ▾ with no aria-haspopup / aria-expanded: cannot prove it opens a list | Use PickMenu, or add aria-expanded/aria-haspopup="listbox" |
| `app/dashboard/[eventId]/website/_components/apply-pro-sheet.tsx:117` | `/dashboard/[eventId]/website` | {none ? 'Ready to apply' : grou} {none ? null : ( &lt;I} {none ? null : t | ▾ with no aria-haspopup / aria-expanded: cannot prove it opens a list | Use PickMenu, or add aria-expanded/aria-haspopup="listbox" |
| `app/dashboard/[eventId]/website/editor/_components/colour-well.tsx:107` | `/dashboard/[eventId]/website/editor` | {sheet.value ? current.slice(0,} | ▾ opens a dialog/sheet (aria-haspopup="dialog"), not a list | Confirm the sheet is a list of choices; otherwise drop the ▾ |
| `app/dashboard/[eventId]/website/editor/_components/type-in-place.tsx:706` | `/dashboard/[eventId]/website/editor` | Style ▾ | ▾ with no aria-haspopup / aria-expanded: cannot prove it opens a list | Use PickMenu, or add aria-expanded/aria-haspopup="listbox" |
| `app/samahan/chat/[threadId]/_components/group-switcher.tsx:21` | `/samahan/chat/[threadId]` | {name} | ▾ opens a dialog/sheet (aria-haspopup="dialog"), not a list | Confirm the sheet is a list of choices; otherwise drop the ▾ |
| `app/vendor-dashboard/clients/[eventId]/_components/event-files-board.tsx:441` | `/vendor-dashboard/clients/[eventId]` | Tag to inspiration | ▾ opens a dialog/sheet (aria-haspopup="dialog"), not a list | Confirm the sheet is a list of choices; otherwise drop the ▾ |
| `app/vendor-dashboard/services/_components/canvas-maker.tsx:1341` | `/vendor-dashboard/services` | {category ? 'Services: ${activeCategoryLabel}. Tap to change' : 'Choos | ▾ opens a dialog/sheet (aria-haspopup="dialog"), not a list | Confirm the sheet is a list of choices; otherwise drop the ▾ |
| `app/vendor-dashboard/services/requests/_components/tell-us-view.tsx:92` | `/vendor-dashboard/services/requests` | Change category | ▾ with no aria-haspopup / aria-expanded: cannot prove it opens a list | Use PickMenu, or add aria-expanded/aria-haspopup="listbox" |
| `app/_components/chat/chat-step-card.tsx:162` | `(shared app components)` | {sending ? 'Sending…' : sendLabel} (:162) + Next (:194) + Next (:231)  | 4 main buttons can render in one scope | Keep one main verb; make the others quiet/neutral |
| `app/[slug]/_components/copy-my-link.tsx:119` | `/[slug]` | Open in your browser {OPEN_IN_BROWSER_WHY} (:119) + Copy my link {show | 2 main buttons can render in one scope (lane L2 is already reworking this file) | Keep one main verb; make the others quiet/neutral |
| `app/[slug]/_components/get-inside.tsx:101` | `/[slug]` | Try again (:101) + {STRANGER_DOOR_WORDS} (:154) + Join as a guest (:11 | 4 main buttons can render in one scope | Keep one main verb; make the others quiet/neutral |
| `app/admin/hub-music/hub-music-manager.tsx:454` | `/admin/hub-music` | Add (:454) + {sending } (:577) | 2 main buttons can render in one scope | Keep one main verb; make the others quiet/neutral |
| `app/admin/moodboard-library/_components/library-editor.tsx:421` | `/admin/moodboard-library` | {isPending ? 'Rolling…' : 'Generate random prompt'} (:421) + {isPendin | 4 main buttons can render in one scope | Keep one main verb; make the others quiet/neutral |
| `app/dashboard/[eventId]/guests/_components/quick-add-sheet.tsx:520` | `/dashboard/[eventId]/guests` | {isGroupPending ? 'Creating…' : 'Create'} (:520) + Done (:697) + Add $ | 3 main buttons can render in one scope | Keep one main verb; make the others quiet/neutral |
| `app/dashboard/[eventId]/guests/_components/send-invite.tsx:371` | `/dashboard/[eventId]/guests` | {big ? 'Send to ${first}' : sentAt ? 'Send again' : 'Send invite'} (:3 | 3 main buttons can render in one scope | Keep one main verb; make the others quiet/neutral |
| `app/dashboard/[eventId]/seating/_components/seating-editor.tsx:5292` | `/dashboard/[eventId]/seating` | Table (:5292) + {askMove.a.kind === 'swap' ? 'Swap' : 'Move'} (:8133)  | 6 main buttons can render in one scope | Keep one main verb; make the others quiet/neutral |
| `app/dashboard/[eventId]/vendors/_components/accordion-build.tsx:117` | `/dashboard/[eventId]/vendors` | {isPending ? 'Adding…' : 'Add to build'} (:117) + {isPending ? 'Replac | 2 main buttons can render in one scope | Keep one main verb; make the others quiet/neutral |
| `app/dashboard/[eventId]/vendors/_components/book-this-build.tsx:181` | `/dashboard/[eventId]/vendors` | Book this build (:181) + Yes, book them (:192) | 2 main buttons can render in one scope | Keep one main verb; make the others quiet/neutral |
| `app/onboarding/wedding/_components/onboarding-shell.tsx:3288` | `/onboarding/wedding` | Use this monogram (:3288) + Tell it (:3380) + This is us (:3637) + Yes | 9 main buttons can render in one scope | Keep one main verb; make the others quiet/neutral |
| `app/open-shop/_components/open-shop-wizard.tsx:1977` | `/open-shop` | {coordinating ? APPROVE_PAGE : 'Approve card'} (:1977) + Tap Reload to | 3 main buttons can render in one scope | Keep one main verb; make the others quiet/neutral |
| `app/vendor-dashboard/clients/[eventId]/_components/top-up-carry-over.tsx:54` | `/vendor-dashboard/clients/[eventId]` | {label} (:54) + Confirm & pay ${*} (:94) | 2 main buttons can render in one scope | Keep one main verb; make the others quiet/neutral |
| `app/vendor-dashboard/forms/_components/forms-page-body.tsx:318` | `/vendor-dashboard/forms` | New form (:318) + New form (:350) | 2 main buttons can render in one scope | Keep one main verb; make the others quiet/neutral |
| `app/vendor-dashboard/packages/_components/package-editor.tsx:415` | `/vendor-dashboard/packages` | {pending ? 'Saving…' : 'Save to my shop'} (:415) + Send to this couple | 2 main buttons can render in one scope | Keep one main verb; make the others quiet/neutral |
| `app/_components/fold.tsx:403` | `(shared app components)` | {tip} | onClick on &lt;div> with no role, keyboard handler, tabIndex (looks like a backdrop; Esc should also close) | Mark aria-hidden and close on Esc (Sheet does this) |
| `app/_components/frontdoor/front-door-shell.tsx:1375` | `(shared app components)` | (div) | onClick on &lt;div> with no role, keyboard handler, tabIndex (looks like a backdrop; Esc should also close) | Mark aria-hidden and close on Esc (Sheet does this) |
| `app/_components/service-face-cover-show.tsx:183` | `(shared app components)` | {photos.map((p, k) => k} {held ? ( &lt;span } {caption ? ( &lt;span } | onClick on &lt;span> with no role, keyboard handler, tabIndex (looks like a backdrop; Esc should also close) | Mark aria-hidden and close on Esc (Sheet does this) |
| `app/admin/ugat/_components/ugat-console.tsx:434` | `/admin/ugat` | (div) | onClick on &lt;div> with no role, keyboard handler, tabIndex (looks like a backdrop; Esc should also close) | Mark aria-hidden and close on Esc (Sheet does this) |
| `app/dashboard/[eventId]/budget/_components/budget-screen.tsx:373` | `/dashboard/[eventId]/budget` | (span) | onClick on &lt;span> with no role, keyboard handler, tabIndex (looks like a backdrop; Esc should also close) | Mark aria-hidden and close on Esc (Sheet does this) |
| `app/dashboard/[eventId]/seating/_components/seat-plan-phone.tsx:99` | `/dashboard/[eventId]/seating` | {children} | onClick on &lt;div> with no keyboard handler, tabIndex (looks like a backdrop; Esc should also close) | Mark aria-hidden and close on Esc (Sheet does this) |
| `app/dashboard/[eventId]/seating/_components/seating-frame.tsx:206` | `/dashboard/[eventId]/seating` | {children} | onClick on &lt;div> with no keyboard handler, tabIndex (looks like a backdrop; Esc should also close) | Mark aria-hidden and close on Esc (Sheet does this) |
| `app/dashboard/[eventId]/vendors/_components/category-search-overlay.tsx:807` | `/dashboard/[eventId]/vendors` | (div) | onClick on &lt;div> with no role, keyboard handler, tabIndex (looks like a backdrop; Esc should also close) | Mark aria-hidden and close on Esc (Sheet does this) |
| `app/onboarding/wedding/_components/onboarding-shell.tsx:4760` | `/onboarding/wedding` | (div) | onClick on &lt;div> with no role, keyboard handler, tabIndex (looks like a backdrop; Esc should also close) | Mark aria-hidden and close on Esc (Sheet does this) |
| `app/papic/guest/_components/papic-guest-capture.tsx:1868` | `/papic/guest` | {grid && !tagging && !exhausted} {!tagging && !exhausted ? &lt;Focu} {((! | onClick on &lt;div> with no role, keyboard handler, tabIndex (looks like a backdrop; Esc should also close) | Mark aria-hidden and close on Esc (Sheet does this) |
| `app/open-shop/_components/claim-door.tsx:565` | `/open-shop` | {NOT_MY_BUSINESS} | No-op fallback 'onClick={() => undefined}' when no declineAction is passed. The live /open-shop page always passes one; only the dev lab hits it | Make declineAction required, or hide "Not my business" without it |
| `app/tour/page.tsx:54` | `/tour` | Start the tour &rarr; | Links to /maria-and-jose: only the guest Event Hub catch-all /[slug] matches, so it works only while that demo event exists in prod | Read the demo slug from one constant and guard it with a health test |
| `app/tour/vendors/page.tsx:273` | `/tour/vendors` | &larr; The invitation | Links to /maria-and-jose: only the guest Event Hub catch-all /[slug] matches, so it works only while that demo event exists in prod | Same constant as /tour |
| `app/_components/app-store/studio-card-demo.tsx:1233` | `(shared app components)` | {playing ? 'Pause demo' : 'Play demo'} | Press target under 44 px (32px wide; class "flex h-8 w-8 items-center justify-center rounded-full bg-ink") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/_components/app-store/studio-card-demo.tsx:1248` | `(shared app components)` | Step ${*} | Press target under 44 px (8px wide; class "h-2 w-2 rounded-full transition ${*}") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/_components/booking-fee-notice.tsx:279` | `(shared app components)` | {copy.payLabel ?? 'Pay now'} | Press target under 44 px (36px tall; class "inline-flex h-9 items-center rounded-full px-4 text-sm font-") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/_components/card-portfolio-section.tsx:61` | `(shared app components)` | {inspirationChipWords(i)} | Press target under 44 px (min-height removed; class "sn-press inline-flex min-h-9 items-center gap-1 rounded-full") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/_components/chat/conversation-column.tsx:122` | `(shared app components)` | {f.label} | Press target under 44 px (min-height removed; class "inline-flex min-h-9 shrink-0 items-center rounded-full borde") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/_components/chat/file-to-decision-menu.tsx:218` | `(shared app components)` | Filed under ${*} · open it | Press target under 44 px (min-height removed; class "-mt-1 inline-flex min-h-6 max-w-[200px] items-center gap-1 r") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/_components/chat/message-heart.tsx:26` | `(shared app components)` | {mine ? 'Take your heart back' : 'Heart this message'} | Press target under 44 px (min-height removed; class "{chip
          ? '-mt-1.5 inline-flex min-h-6 items-center ") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/_components/file-upload.tsx:2151` | `(shared app components)` | Try again | Press target under 44 px (min-height removed; class "inline-flex min-h-9 items-center rounded-full bg-cream px-3 ") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/_components/held-shop-name-card.tsx:55` | `(shared app components)` | {pending ? &lt;Loader2 aria-hidden} {ITS_MY_BUSINESS_LABEL} | Press target under 44 px (min-height removed; class "inline-flex min-h-[36px] items-center gap-1.5 rounded-full b") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/_components/memories/memories-photo-viewer.tsx:369` | `(shared app components)` | {r.label} | Press target under 44 px (min-height removed; class "sn-gal-btn min-h-[40px] rounded-full px-3 text-[13px] ${*}") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/_components/memories/memories-photo-viewer.tsx:485` | `(shared app components)` | Remove | Press target under 44 px (min-height removed; class "sn-gal-btn inline-flex min-h-[40px] items-center gap-1 round") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/_components/memories/memories-photo-viewer.tsx:511` | `(shared app components)` | Add | Press target under 44 px (min-height removed; class "sn-gal-btn inline-flex min-h-[40px] items-center gap-1 round") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/_components/negotiation-composer-menu.tsx:112` | `(shared app components)` | Close | Press target under 44 px (24px wide; class "inline-flex h-6 w-6 items-center justify-center rounded-full") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/_components/notifications/notifications-list.tsx:404` | `(shared app components)` | More | Press target under 44 px (36px wide; class "-my-1 ml-0.5 mr-1.5 hidden h-9 w-9 flex-none items-center ju") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/_components/overlay-backdrop.tsx:66` | `(shared app components)` | {label} | Press target under 44 px (min-height removed; class "sn-popup-dark fixed inset-0 block min-h-0 w-full cursor-defa") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/_components/quote-card-lines.tsx:36` | `(shared app components)` | Ask for a change: ${*} | Press target under 44 px (min-height removed; class "-mx-1 flex min-h-9 w-[calc(100%+0.5rem)] items-center gap-2 ") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/_components/side-panel.tsx:143` | `(shared app components)` | Close | Press target under 44 px (40px wide; class "sn-press inline-flex h-10 w-10 shrink-0 items-center justify") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/_components/site-stage/site-stage.tsx:196` | `(shared app components)` | {d.label} | Press target under 44 px (28px wide; class "inline-flex h-7 w-7 items-center justify-center rounded-full") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/_components/vendor-packages/lock-modal.tsx:536` | `(shared app components)` | Close | Press target under 44 px (40px wide; class "-m-2 inline-flex h-10 w-10 items-center justify-center round") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/_components/vendor-packages/lock-modal.tsx:751` | `(shared app components)` | One hour fewer | Press target under 44 px (36px wide; class "inline-flex h-9 w-9 items-center justify-center rounded-full") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/_components/vendor-packages/lock-modal.tsx:768` | `(shared app components)` | One hour more | Press target under 44 px (36px wide; class "inline-flex h-9 w-9 items-center justify-center rounded-full") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/[slug]/_components/our-love-story-styles.tsx:184` | `/[slug]` | {open ? 'Read less' : 'Read mor} | Press target under 44 px (min-height removed; class "mt-2 inline-flex min-h-[32px] items-center rounded-full bord") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/admin/_components/admin-ask-pill.tsx:43` | `/admin` | What can I ask? | Press target under 44 px (40px tall; class "grid h-10 w-10 shrink-0 place-items-center rounded-full text") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/admin/categories/_components/four-level-map.tsx:586` | `/admin/categories` | Needs a look · {needs} ({data.servicesRead ? gapCategor} without a ser | Press target under 44 px (min-height removed; class "ml-1 inline-flex min-h-8 items-center gap-1.5 rounded-full b") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/admin/categories/_components/four-level-map.tsx:603` | `/admin/categories` | {plural(unsetAvailability(data)} no Availability set | Press target under 44 px (min-height removed; class "ml-1 inline-flex min-h-8 items-center gap-1.5 rounded-full b") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/admin/categories/_components/four-level-map.tsx:629` | `/admin/categories` | Back to groups | Press target under 44 px (min-height removed; class "inline-flex min-h-10 items-center rounded-full border border") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/admin/categories/_components/four-level-map.tsx:632` | `/admin/categories` | All | Press target under 44 px (min-height removed; class "inline-flex min-h-10 items-center gap-1 rounded-full border ") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/admin/categories/_components/four-level-map.tsx:636` | `/admin/categories` | {g.label} | Press target under 44 px (min-height removed; class "inline-flex min-h-10 items-center gap-1 rounded-full border ") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/admin/categories/_components/panel-kit.tsx:48` | `/admin/categories` | {c.label} | Press target under 44 px (min-height removed; class "sn-press inline-flex min-h-8 items-center gap-1 rounded-full") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/admin/categories/_components/what-suppliers-fill-in.tsx:167` | `/admin/categories` | Add an option | Press target under 44 px (min-height removed; class "sn-press inline-flex min-h-9 items-center gap-1 rounded-full") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/admin/categories/page.tsx:434` | `/admin/categories` | + Add | Press target under 44 px (min-height removed; class "inline-flex min-h-10 items-center rounded-full bg-ink px-4 t") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/admin/categories/page.tsx:487` | `/admin/categories` | ‹ {LIST_LABEL[state.list]} | Press target under 44 px (min-height removed; class "mb-3 inline-flex min-h-10 items-center text-sm font-medium t") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/admin/menus/_components/menu-registry-editor.tsx:278` | `/admin/menus` | {name} | Press target under 44 px (32px wide; class "flex h-8 w-8 items-center justify-center rounded-md border t") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/admin/studio/_surfaces/social-queue-surface.tsx:1378` | `/admin/studio` | Download 9:16 card | Press target under 44 px (36px tall; class "button-primary inline-flex h-9 items-center px-3 text-xs") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/admin/work/_components/supplier-inbox.tsx:497` | `/admin/work` | Close | Press target under 44 px (40px tall, 40px wide; class "sn-press grid h-10 w-10 shrink-0 place-items-center rounded-") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/_components/set-date-nudge.tsx:101` | `/dashboard/[eventId]` | Dismiss set-your-date reminder | Press target under 44 px (32px wide; class "ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-cente") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/budget/_components/budget-screen.tsx:421` | `/dashboard/[eventId]/budget` | Close search | Press target under 44 px (36px wide; class "inline-flex h-9 w-9 shrink-0 items-center justify-center rou") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/launch/_components/logo-layer-cards.tsx:160` | `/dashboard/[eventId]/launch` | ${*}${*}${*} — ${*} | Press target under 44 px (min-height removed; class "flex min-h-0 flex-1 touch-pan-x select-none flex-col [-webki") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/launch/_components/maker-logo.tsx:1438` | `/dashboard/[eventId]/launch` | Colour ${*} | Press target under 44 px (36px tall, 36px wide; class "h-9 max-h-9 min-h-9 w-9 min-w-9 max-w-9 shrink-0 rounded-ful") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/launch/_components/maker-made-once.tsx:269` | `/dashboard/[eventId]/launch` | Use the invitation card instead | Press target under 44 px (min-height removed; class "sn-press inline-flex min-h-10 items-center rounded-full bg-i") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/launch/_components/print-guest-sheet.tsx:210` | `/dashboard/[eventId]/launch` | Select all shown | Press target under 44 px (min-height removed; class "ml-auto min-h-10 font-medium text-ink") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/launch/_components/print-guest-sheet.tsx:218` | `/dashboard/[eventId]/launch` | Clear | Press target under 44 px (min-height removed; class "min-h-10 font-medium text-ink/60") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/launch/_components/stage-picker.tsx:154` | `/dashboard/[eventId]/launch` | Stages | Press target under 44 px (min-height removed; class "sn-press inline-flex min-h-10 items-center gap-1 self-start ") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/schedule/_components/day-rail.tsx:1152` | `/dashboard/[eventId]/schedule` | ＋ {formatClock(g.startMin)} | Press target under 44 px (min-height removed; class "absolute left-2.5 right-0 z-[1] grid min-h-0 place-items-cen") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/schedule/_components/day-rail.tsx:1170` | `/dashboard/[eventId]/schedule` | ${*} — add a chapter | Press target under 44 px (min-height removed; class "absolute left-2.5 right-0 z-[1] grid min-h-0 place-items-cen") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/schedule/_components/day-rail.tsx:1213` | `/dashboard/[eventId]/schedule` | {r.kind === 'adjust' } | Press target under 44 px (min-height removed; class "absolute z-[6] flex min-h-0 items-center overflow-hidden whi") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/schedule/_components/day-rail.tsx:1253` | `/dashboard/[eventId]/schedule` | ${*}, ${*}${*} | Press target under 44 px (min-height removed; class "group absolute z-[2] flex min-h-0 overflow-hidden rounded-md") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/schedule/_components/emcee-script-button.tsx:123` | `/dashboard/[eventId]/schedule` | Close | Press target under 44 px (32px wide; class "inline-flex h-8 w-8 items-center justify-center rounded-lg t") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/schedule/_components/schedule-one-line.tsx:216` | `/dashboard/[eventId]/schedule` | Schedule settings | Press target under 44 px (40px wide; class "sn-press grid h-10 w-10 flex-none place-items-center rounded") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/seating/_components/seating-editor.tsx:8872` | `/dashboard/[eventId]/seating` | Resize dance floor | Press target under 44 px (20px wide; class "absolute -bottom-2 -right-2 z-10 flex h-5 w-5 cursor-nwse-re") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/seating/_components/seating-editor.tsx:8952` | `/dashboard/[eventId]/seating` | Resize cocktail area | Press target under 44 px (20px wide; class "pointer-events-auto absolute -bottom-2 -right-2 z-10 flex h-") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/seating/_components/seating-editor.tsx:8997` | `/dashboard/[eventId]/seating` | Resize stage | Press target under 44 px (20px wide; class "absolute -bottom-2 -right-2 z-10 flex h-5 w-5 cursor-nwse-re") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/seating/_components/seating-editor.tsx:9690` | `/dashboard/[eventId]/seating` | Drag to change the room width | Press target under 44 px (10px wide; class "absolute right-0 top-1/2 z-20 h-10 w-2.5 -translate-y-1/2 cu") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/seating/_components/seating-editor.tsx:9700` | `/dashboard/[eventId]/seating` | Drag to change the room length | Press target under 44 px (40px wide; class "absolute bottom-0 left-1/2 z-20 h-2.5 w-10 -translate-x-1/2 ") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/seating/_components/seating-editor.tsx:9710` | `/dashboard/[eventId]/seating` | Drag to resize the room | Press target under 44 px (20px wide; class "absolute bottom-0 right-0 z-20 flex h-5 w-5 cursor-nwse-resi") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/seating/_components/seating-editor.tsx:9816` | `/dashboard/[eventId]/seating` | Rotate table — drag in a circle (hold Shift for 1° steps) | Press target under 44 px (28px wide; class "absolute z-40 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/studio/indoor-blueprint/_components/blueprint-studio.tsx:142` | `/dashboard/[eventId]/studio/indoor-blueprint` | Drag to set the venue entrance | Press target under 44 px (40px wide; class "absolute z-30 h-10 w-10 -translate-x-1/2 -translate-y-1/2 ro") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/studio/mood-board/_components/palette-section.tsx:308` | `/dashboard/[eventId]/studio/mood-board` | Pick a ${*} colour | Press target under 44 px (36px wide; class "flex h-9 w-9 items-center justify-center rounded-md border b") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/studio/mood-board/_components/palette-section.tsx:338` | `/dashboard/[eventId]/studio/mood-board` | Add another ${*} colour | Press target under 44 px (36px wide; class "inline-flex h-9 w-9 items-center justify-center rounded-md b") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/studio/mood-board/_components/recolor-studio.tsx:343` | `/dashboard/[eventId]/studio/mood-board` | {hex} | Press target under 44 px (32px wide; class "h-8 w-8 rounded-md border transition ${*}") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/studio/mood-board/_components/swatch-popover.tsx:79` | `/dashboard/[eventId]/studio/mood-board` | {m.name} | Press target under 44 px (min-height removed; class "inline-flex min-h-9 items-center gap-1.5 rounded-full border") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/studio/mood-board/_components/swatch-popover.tsx:98` | `/dashboard/[eventId]/studio/mood-board` | ${*}Change color, currently ${*} | Press target under 44 px (36px wide; class "h-9 w-9 shrink-0 cursor-pointer rounded-md border p-0.5 ${*}") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/studio/mood-board/_components/swatch-popover.tsx:163` | `/dashboard/[eventId]/studio/mood-board` | Copy | Press target under 44 px (min-height removed; class "inline-flex min-h-9 items-center gap-1 rounded-full bg-ink/5") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/studio/mood-board/_components/swatch-popover.tsx:172` | `/dashboard/[eventId]/studio/mood-board` | Paste {board.clipboard.name} | Press target under 44 px (min-height removed; class "inline-flex min-h-9 items-center gap-1.5 rounded-full bg-ink") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/studio/mood-board/_components/swatch-popover.tsx:185` | `/dashboard/[eventId]/studio/mood-board` | Cancel swap | Press target under 44 px (min-height removed; class "inline-flex min-h-9 items-center rounded-full bg-terracotta/") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/studio/mood-board/_components/swatch-popover.tsx:196` | `/dashboard/[eventId]/studio/mood-board` | ⇄ Swap here | Press target under 44 px (min-height removed; class "inline-flex min-h-9 items-center rounded-full bg-terracotta/") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/studio/mood-board/_components/swatch-popover.tsx:207` | `/dashboard/[eventId]/studio/mood-board` | ⇄ Swap with another role | Press target under 44 px (min-height removed; class "inline-flex min-h-9 items-center rounded-full bg-ink/5 px-3 ") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/studio/panood/broadcast/control-room.tsx:509` | `/dashboard/[eventId]/studio/panood/broadcast` | Back to Live Watch setup | Press target under 44 px (32px tall, 32px wide; class "inline-flex h-8 w-8 shrink-0 items-center justify-center rou") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/studio/panood/broadcast/control-room.tsx:545` | `/dashboard/[eventId]/studio/panood/broadcast` | Connect cameras | Press target under 44 px (32px tall, 32px wide; class "inline-flex h-8 w-8 shrink-0 items-center justify-center rou") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/studio/panood/broadcast/control-room.tsx:555` | `/dashboard/[eventId]/studio/panood/broadcast` | Pop out for OBS | Press target under 44 px (32px wide; class "inline-flex h-8 w-8 shrink-0 items-center justify-center rou") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/studio/panood/broadcast/control-room.tsx:569` | `/dashboard/[eventId]/studio/panood/broadcast` | {layout === 'board' ? 'Switch to compact console' : 'Switch to directo | Press target under 44 px (32px wide; class "inline-flex h-8 w-8 shrink-0 items-center justify-center rou") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/studio/panood/setup/go-live-card.tsx:380` | `/dashboard/[eventId]/studio/panood/setup` | {pending ? 'Ending…' : 'End bro} | Press target under 44 px (min-height removed; class "inline-flex min-h-[40px] items-center gap-1.5 rounded-md bor") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/studio/papic/_components/one-code.tsx:88` | `/dashboard/[eventId]/studio/papic` | Print poster | Press target under 44 px (min-height removed; class "inline-flex min-h-[36px] items-center gap-1.5 rounded-md bor") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/studio/save-the-date/stamp/wax-stamp-maker.tsx:803` | `/dashboard/[eventId]/studio/save-the-date/stamp` | Wax colour ${*} | Press target under 44 px (28px wide; class "h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-[#1511") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx:750` | `/dashboard/[eventId]/website` | Close | Press target under 44 px (40px wide; class "sn-press absolute right-1.5 top-1.5 inline-flex h-10 w-10 it") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/website/_components/hub-draft-button.tsx:66` | `/dashboard/[eventId]/website` | {said} | Press target under 44 px (40px tall; class "{bar
            ? '${bar === 'apply' ? MAKER_BAR_APPLY : MA") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/website/editor/_components/background-colour-wells.tsx:74` | `/dashboard/[eventId]/website/editor` | Remove the second colour | Press target under 44 px (min-height removed; class "sn-press absolute -right-1 -top-1 flex h-[18px] min-h-0 w-[1") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/website/editor/_components/background-fade-bar.tsx:101` | `/dashboard/[eventId]/website/editor` | As is | Press target under 44 px (32px tall; class "sn-press relative inline-flex h-8 min-h-0 shrink-0 items-cen") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/website/editor/_components/details-bound-field.tsx:167` | `/dashboard/[eventId]/website/editor` | Edited here · Use {DETAILS_FACT[fact].boxLabel.to} | Press target under 44 px (min-height removed; class "sn-press ml-auto inline-flex min-h-10 items-center gap-1.5 r") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/website/editor/_components/details-bound-field.tsx:228` | `/dashboard/[eventId]/website/editor` | Cancel | Press target under 44 px (min-height removed; class "sn-press flex min-h-10 w-full items-center justify-center te") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx:2568` | `/dashboard/[eventId]/website/editor` | Music | Press target under 44 px (40px wide; class "sn-press inline-flex h-10 w-10 shrink-0 items-center justify") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx:2782` | `/dashboard/[eventId]/website/editor` | {showing ? 'Hide ${tile.label} from guests' : 'Show ${tile.label} to g | Press target under 44 px (28px wide; class "sn-press absolute bottom-1 right-1 inline-flex h-7 w-7 items") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx:2883` | `/dashboard/[eventId]/website/editor` | Edit ${*} | Press target under 44 px (28px wide; class "sn-press inline-flex h-7 w-7 items-center justify-center rou") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx:2892` | `/dashboard/[eventId]/website/editor` | Show ${*} to guests | Press target under 44 px (28px wide; class "sn-press inline-flex h-7 w-7 items-center justify-center rou") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx:3201` | `/dashboard/[eventId]/website/editor` | Event Bar | Press target under 44 px (36px wide; class "sn-press inline-flex h-9 w-9 items-center justify-center rou") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx:3831` | `/dashboard/[eventId]/website/editor` | {unlockLabel(proPriceLabel)} | Press target under 44 px (min-height removed; class "sn-press mt-2.5 inline-flex min-h-10 items-center rounded-fu") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/website/editor/_components/main-background-panel.tsx:1326` | `/dashboard/[eventId]/website/editor` | Turn off | Press target under 44 px (32px tall; class "sn-press relative inline-flex h-8 min-h-0 shrink-0 items-cen") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/website/editor/_components/maker-canvas-guard.tsx:143` | `/dashboard/[eventId]/website/editor` | Try again | Press target under 44 px (min-height removed; class "sn-press inline-flex min-h-10 items-center rounded-full bg-i") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/website/editor/_components/maker-canvas-guard.tsx:168` | `/dashboard/[eventId]/website/editor` | Back to your page | Press target under 44 px (min-height removed; class "sn-press inline-flex min-h-10 items-center rounded-full bg-i") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/website/editor/_components/sections-panel.tsx:319` | `/dashboard/[eventId]/website/editor` | Move ${*} up | Press target under 44 px (28px wide; class "inline-flex h-7 w-7 items-center justify-center rounded-md b") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/website/editor/_components/sections-panel.tsx:333` | `/dashboard/[eventId]/website/editor` | Move ${*} down | Press target under 44 px (28px wide; class "inline-flex h-7 w-7 items-center justify-center rounded-md b") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/website/editor/_components/sections-panel.tsx:1280` | `/dashboard/[eventId]/website/editor` | {on ? 'Current background colour ${hex}' : 'Use ${hex} as the backgrou | Press target under 44 px (28px wide; class "block h-7 w-7 rounded-md border-2 ${*}") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/website/our-story/_components/moment-sheet-studio.tsx:582` | `/dashboard/[eventId]/website/our-story` | Not now | Press target under 44 px (min-height removed; class "inline-flex min-h-10 items-center rounded-full px-4 text-[14") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/website/our-story/_components/moment-sheet.tsx:463` | `/dashboard/[eventId]/website/our-story` | Not now | Press target under 44 px (min-height removed; class "inline-flex min-h-10 items-center rounded-full px-4 text-[14") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/[eventId]/website/our-story/milestones-field.tsx:68` | `/dashboard/[eventId]/website/our-story` | Remove milestone ${*} | Press target under 44 px (36px wide; class "inline-flex h-9 w-9 shrink-0 items-center justify-center rou") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/(account)/people/_components/dependents-section.tsx:345` | `/dashboard/people` | Remove ${*} | Press target under 44 px (28px wide; class "relative grid h-7 w-7 place-items-center rounded-full text-i") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/(account)/samahan/[communityId]/_components/group-collage.tsx:79` | `/dashboard/samahan/[communityId]` | Watch ${*}’s story | Press target under 44 px (min-height removed; class "relative block h-full min-h-0 w-full overflow-hidden bg-blac") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/(account)/samahan/[communityId]/_components/samahan-stories.tsx:619` | `/dashboard/samahan/[communityId]` | Yes, remove it | Press target under 44 px (min-height removed; class "inline-flex min-h-8 items-center gap-1 text-[10px] font-medi") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/dashboard/(account)/samahan/[communityId]/_components/samahan-stories.tsx:631` | `/dashboard/samahan/[communityId]` | Take it down | Press target under 44 px (min-height removed; class "inline-flex min-h-8 items-center gap-1 text-[10px] text-ink/") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/(shell)/explore/_components/sticky-marketplace-header.tsx:335` | `/explore` | {option.label} | Press target under 44 px (36px tall; class "{option.active
                      ? 'inline-flex h-9 shri") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/(shell)/explore/_lib/marketplace-view.tsx:3275` | `/explore` | {LENSES[k].label} | Press target under 44 px (min-height removed; class "inline-flex min-h-[36px] items-center rounded-full border px") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/(shell)/explore/_lib/marketplace-view.tsx:3769` | `/explore` | {SORT_LABEL[k]} | Press target under 44 px (min-height removed; class "inline-flex min-h-[36px] items-center rounded-full border px") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/(shell)/explore/_lib/marketplace-view.tsx:4317` | `/explore` | Clear all filters | Press target under 44 px (40px tall; class "button-secondary inline-flex h-10 px-4") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/(shell)/explore/_lib/marketplace-view.tsx:4464` | `/explore` | {shop.name} | Press target under 44 px (40px tall; class "button-secondary inline-flex h-10 px-4") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/(shell)/explore/_lib/marketplace-view.tsx:4474` | `/explore` | Show all | Press target under 44 px (40px tall; class "button-primary inline-flex h-10 px-4") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/(shell)/explore/_lib/marketplace-view.tsx:4481` | `/explore` | Clear all filters | Press target under 44 px (40px tall; class "button-secondary inline-flex h-10 px-4") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/(shell)/explore/_lib/marketplace-view.tsx:4509` | `/explore` | List your business | Press target under 44 px (40px tall; class "button-primary inline-flex h-10 items-center px-4 text-sm") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/(shell)/explore/_lib/marketplace-view.tsx:4515` | `/explore` | How supplier listings work → | Press target under 44 px (40px tall; class "inline-flex h-10 items-center text-sm font-medium text-terra") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/open-shop/_components/city-pin.tsx:558` | `/open-shop` | Use my location | Press target under 44 px (min-height removed; class "absolute right-2 top-2 z-[402] inline-flex min-h-10 items-ce") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/open-shop/_components/claim-door.tsx:907` | `/open-shop` | {on ? &lt;Check aria-hidden classN} {o.label} | Press target under 44 px (min-height removed; class "inline-flex min-h-9 items-center gap-1.5 rounded-full border") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/open-shop/_components/service-cards.tsx:468` | `/open-shop` | {isOn ? &lt;Check aria-hidden clas} {o.label} | Press target under 44 px (min-height removed; class "inline-flex min-h-9 items-center gap-1.5 rounded-full border") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/open-shop/_components/services-at-events.tsx:95` | `/open-shop` | {on ? &lt;Check aria-hidden classN} {s.label} | Press target under 44 px (min-height removed; class "inline-flex min-h-9 items-center gap-1.5 rounded-full border") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/panood/control/[eventId]/page.tsx:945` | `/panood/control/[eventId]` | {appleIap ? 'Leave the controller — back to Today' : 'Leave the contro | Press target under 44 px (36px tall; class "inline-flex h-9 shrink-0 items-center gap-1 rounded-md px-1.") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/papic/decorate/_components/kwento-decorator.tsx:478` | `/papic/decorate` | Resize and rotate | Press target under 44 px (24px wide; class "absolute -bottom-3 -right-3 flex h-6 w-6 cursor-nwse-resize ") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/papic/guest/_components/guest-camera-tools.tsx:113` | `/papic/guest` | ${*} times zoom | Press target under 44 px (36px tall; class "relative flex h-9 min-h-0 min-w-11 items-center justify-cent") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/papic/guest/_components/papic-challenge-panel.tsx:328` | `/papic/guest` | {busy && !attached.consent_shar} {attached.consent_shared ? &lt;Che} Shar | Press target under 44 px (min-height removed; class "relative inline-flex min-h-0 items-center gap-1 rounded-full") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/papic/guest/_components/papic-challenge-panel.tsx:341` | `/papic/guest` | Keep private | Press target under 44 px (min-height removed; class "relative inline-flex min-h-0 items-center rounded-full px-3 ") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/papic/guest/_components/papic-guest-capture.tsx:2051` | `/papic/guest` | {m === 'photo' ? 'Photo' : 'Sni} | Press target under 44 px (32px tall; class "relative h-8 min-h-0 rounded-full px-3 text-[12.5px] font-se") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/proposals/[publicId]/page.tsx:768` | `/proposals/[publicId]` | Amount to pay | Press target under 44 px (36px tall; class "mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-mulb") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/proposals/[publicId]/page.tsx:799` | `/proposals/[publicId]` | Book on your Suppliers page | Press target under 44 px (36px tall; class "inline-flex h-9 items-center gap-1.5 rounded-lg bg-mulberry ") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/tour/gallery/_components/tour-palette-preview.tsx:121` | `/tour/gallery` | Their palette | Press target under 44 px (min-height removed; class "inline-flex min-h-[36px] items-center gap-1.5 rounded-full b") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/v/[slug]/page.tsx:4592` | `/v/[slug]` | Show more reviews | Press target under 44 px (40px tall; class "button-secondary inline-flex h-10 px-4") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/vendor-dashboard/_components/branch-manager.tsx:481` | `/vendor-dashboard` | Cancel ${*} | Press target under 44 px (36px wide; class "inline-flex h-9 w-9 items-center justify-center rounded-md b") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/vendor-dashboard/_components/instagram-connect-card.tsx:209` | `/vendor-dashboard` | {item.showOnProfile ? ( } | Press target under 44 px (28px wide; class "inline-flex h-7 w-7 items-center justify-center rounded-full") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/vendor-dashboard/_components/instagram-connect-card.tsx:223` | `/vendor-dashboard` | Open on Instagram | Press target under 44 px (28px tall, 28px wide; class "absolute bottom-2 right-2 inline-flex h-7 w-7 items-center j") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/vendor-dashboard/customers/_components/customers-calendar.tsx:786` | `/vendor-dashboard/customers` | {dayHeadWords(g.day, todayIso)} {nearWord(todayIso, g.day) === } | Press target under 44 px (min-height removed; class "sn-press min-h-10 text-left") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/vendor-dashboard/on-the-day/_components/guest-review-qr.tsx:120` | `/vendor-dashboard/on-the-day` | Close fullscreen | Press target under 44 px (40px wide; class "absolute right-4 top-4 inline-flex h-10 w-10 items-center ju") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/vendor-dashboard/on-the-day/_components/issues-log.tsx:205` | `/vendor-dashboard/on-the-day` | {i.resolved ? 'Reopen issue' : 'Mark issue resolved'} | Press target under 44 px (24px wide; class "inline-flex h-6 w-6 shrink-0 items-center justify-center rou") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/vendor-dashboard/on-the-day/_components/shot-list.tsx:244` | `/vendor-dashboard/on-the-day` | {s.done ? 'Mark "${s.label}" not captured' : 'Mark "${s.label}" captur | Press target under 44 px (24px wide; class "inline-flex h-6 w-6 shrink-0 items-center justify-center rou") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/vendor-dashboard/services/_components/addons-editor.tsx:138` | `/vendor-dashboard/services` | Remove add-on | Press target under 44 px (36px wide; class "inline-flex h-9 w-9 shrink-0 items-center justify-center rou") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |
| `app/vendor-dashboard/services/_components/coverage-panel.tsx:222` | `/vendor-dashboard/services` | Remove ${*} | Press target under 44 px (16px wide; class "relative inline-flex h-4 w-4 items-center justify-center rou") | Add .sn-hit (invisible 46 px halo) or size to h-11/w-11 |

## Not covered

- **The live 7-day dead-tap log.** Needs production access (the press-feel / dead-tap telemetry); the controller will add it.
- **Runtime-only behaviour.** This is a static read. A handler that calls a function which itself does nothing, a button
  disabled forever by state, a sheet that opens empty, or a link built by a `lib/routes.ts` builder that points at a
  retired page are not visible to it. Route builders were trusted, not walked.
- **Rendered size.** Sizes come from class names. Controls sized by CSS modules, `style={{}}`, or `globals.css` rules
  (e.g. `.hc-*`, `.ab`) were not measured; a 375 px Playwright pass over every route is needed for real pixels.
- **"One main per scope" across components.** Counted per component function. Two components that each draw one main on
  the same screen are not caught; the rows above are "can render together" by branch analysis and need a browser check.
- **▾ intent.** Whether a sheet opened by a ▾ is a list of choices needs a look at the screen.
- **Server actions passed through props** (a parent hands `onSave={action}` to a child) and actions called from `lib/`
  hooks were not followed. Error display was checked only as "result read or not"; whether the read error reaches the
  screen was not traced.
- **Exempt by rule:** `app/dev/**`, `*.lab.tsx`, tests. `app/api/**` route handlers have no controls.
- **The house-design-standard skill** was not present in this checkout (`.claude/skills/` holds only `think-and-build`);
  its three rules used here (one main per scope, a ▾ opens a list, 44 px) were taken from the task brief and CLAUDE.md §3.
