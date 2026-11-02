## 2026-10-08 · fix(perf): a signed-in page load no longer asks the server to render up to 14 other pages

**Production, 2026-10-08** (controller, Vercel runtime logs): one Maker open, and within nine seconds
eleven `vendor-dashboard` routes were server-rendered that nobody tapped; ~1,090 database requests
around that single open, on a database that allows nine connections.

**Cause.** The signed-in shell's "code preload" (`app/_components/app-preload.tsx`, owner 2026-10-02:
*"when someone logs in, it has their events, and their shop"*). To learn which chunk files a page
needs, it fetched the page the way the router does (`?_rsc=preload`, `RSC: 1`) — a FULL server render
of that page, layout and every database read — once for each page in the account's plan
(`appPreloadPlan`: 5 for a host, 9 more with a shop), on every hard load of any signed-in page. Its
own docblock promises "CODE, NOT DATA"; the mechanism rendered the data and threw it away.

**Change.** One constant, `APP_PRELOAD_RENDERS_ROUTES = false`: the shell's preload hands the queue no
jobs. The component, its four mounts, the plan and the job itself are untouched, and the docblock
carries the dated note with the owner's ruling and why the mechanism is off. The Maker's own tool
preload (`maker-tools.tsx`) is a different caller and is unchanged.

**What a person could notice.** The first tap on a section downloads that section's code then, as on
any site (upper bounds from the build: Guests ≤ 167 KB, Suppliers ≤ 263 KB, the Maker ≤ 232 KB, a
supplier page 1–106 KB gzipped beyond what every page already has). The proper fix — chunk names
from the build's manifest, no render — is the next PR (`rd/app-preload-reads-no-data`).

Guard `lib/app-preload-renders-nothing.test.ts` runs the whole plan through the real queue with a
counting `fetch`: 0 requests to app routes (and proves the counter sees one when the old job runs).

SPEC IMPACT: None applied here. It sets aside the MECHANISM of DECISION_LOG 2026-10-02 "A HOST'S WHOLE
APP LOADS ONCE, IN THE BACKGROUND" until the no-render version lands — owner's word requested by the
controller.
