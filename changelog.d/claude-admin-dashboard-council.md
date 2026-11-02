## 2026-07-09 · feat(admin): 6-menu sidebar respine + 5-council dashboard fix batch

Owner asks: "use the 5 council to fix our admin dashboard" + "integrate different pages, and make it up to 6 menus only."

**6-menu respine.** The admin desktop sidebar now renders exactly SIX menu rows (Overview · Accounts · Studio · Ugat Console · App Performance · Money) instead of six always-open sections exposing ~69 links. Each menu is an expandable parent (the shipped auto-expand-inside-section SidebarItem pattern) that lands on one integrated surface; queue counts aggregate onto the Overview menu (worst-urgency tone) so folding the queue links never hides SLA pressure. `ADMIN_NAV_GROUPS` stays the single source of truth — the parents are derived (`deriveSixMenus`), so `/admin/more` and the registry overlay keep working unchanged. New `/admin/ugat` hub landing; `/admin/money` promoted to a desktop hub and repointed to derive from the canonical group (its hand-list had drifted: missing Custom plans / Vendor recommendations / Price bands / Compliance + settings tail, still listing Discount codes which moved to Studio). `MobileLandingGrid` gains a `desktopVisible` mode (3-col at lg). Added the missing `custom-plans` nav description.

**5-council fix batch** (5 parallel review agents — design-direction / density / correctness / consistency / mobile-a11y — 40 findings, chair-synthesized to 15; all 15 shipped):

1. **Security:** new shared `lib/admin/require-admin.ts` gate (cache()'d). The Overview page now gates itself before touching the service-role client — a layout is not a safe auth boundary. Layout + payments actions refactored onto it. *Follow-up (deferred): roll the call out to the remaining ~58 admin pages.*
2. **Bug:** integrity-watch had a digest count (feeding totalOpen/overdue) but NO overview tile — added to the Recourse lane.
3. **Bug:** degraded queue counts surfaced — third topbar pill ("Queue counts unavailable"), overview digest fetch degrades instead of hard-crashing, "some counts unavailable" shows even when work is open.
4. **Bug:** mobile bottom-nav occlusion — `pb-20` → safe-area-aware padding (admin + vendor layouts).
5. **Bug:** flat bottom-nav tab labels now truncate (5-tab admin bar + FAB shrink collided at 375px).
6. **A11y:** BadgeDot + landing count pills announce via sr-only text (aria-label on role-less spans never announced).
7. **Backlog (wine):** Action-queues section chrome, header links, activity dot: terracotta/gold → mulberry wine.
8. **Backlog (violet doorway):** `--a-violet` token; DoorwaySidebarHeader `accentColor` dot (admin passes violet); 🟣/🟢 emoji role badges → labeled dots.
9. **Backlog (wine):** overview Tile chip/CTA + both mobile-landing icon tints → wine nav-active tokens.
10. **Density:** queue summary → KPI cluster (ProgressRing of cleared-queues share + open / past-SLA / due-soon stats; due-soon was computed but never rendered).
11. **Density:** ActionQueueTile threads `oldestAt`/`slaHours` — "oldest 5h" sub-line, 3px SLA-pressure bar, distinct due-soon tone. `ageShort` lifted to `lib/admin/queue-counts.ts`.
12. **Consistency:** topbar SLA pills' hardcoded hexes → semantic red/warn classes.
13. **Consistency:** `ADMIN_QUEUE_META` now DERIVED from `QUEUE_DEFS` (lane + slaHours folded into each def) — key-set drift structurally impossible.
14. **Polish:** micro-text contrast raised to clear WCAG AA (lane eyebrows, summary, timestamps, tile subs).
15. **Polish:** wine focus rings on tiles/cards, topbar pill hit-area, accordion panel stays mounted for aria-controls, `timeAgo` floors instead of rounds.

SPEC IMPACT: DECISION_LOG.md row appended (2026-07-09): admin console re-cut to a 6-menu-only sidebar (owner-directed), superseding the 2026-07-04 six-group respine's always-visible item lists; hub landings /admin/ugat (new) + /admin/money (desktop-promoted). No iteration-file edits — 0023 is an archive stub; the code is canonical.
