## 2026-09-10 · feat(invite): the invite link wears a theme — House free, Capiz in Event Hub Pro

Owner, 2026-09-10: *"5 different invite themes… elegant, classy,
sophisticated, rugged, and generic"* · *"Generic is the Free (nothing to
edit). The other 4 will be the Event Hub Pro service"* · *"background will use
the reveal background photo."* This change ships the machinery and the first
two themes:

- **`events.invite_theme`** (migration `20271219583821`) — nullable text,
  closed to `house | capiz | velvet | galeriya | abaca`. NULL = never chosen =
  House, so **no live invite changes at deploy**; a couple opts in by saving.
  `GRANT SELECT` to `authenticated` only (no UPDATE — the writer is the admin
  client after `assertCouple` + a Pro re-check), `events_host` rebuilt verbatim
  over it, self-proving `DO $$ … RAISE` post-conditions. Exposure baseline
  widened by exactly one fact (`events.invite_theme authenticated=S`), in its
  own commit.
- **`lib/invite-themes.ts`** — the registry and two resolvers: what a guest
  SEES (`resolveInviteTheme`: House unless a shipped theme was saved and, for
  Pro, `COUPLE_WEBSITE_PRO` is active now) and what the picker PRE-SELECTS
  (`suggestedInviteTheme`: the saved choice, else the theme the onboarding feel
  points at). Every one of the 8 feels maps to exactly one theme (tested).
- **The ground** (`lib/invite-ground[-rule].ts`) — `events.std_background`
  resolved exactly as the site does, with one stricter rule: an uploaded
  background is painted only if it is a genuine `r2://` object (the SEC-6 trap
  of a verbatim URL-shaped value).
- **`DoorShell` gains a `skin`** — ground · crest · hinge · a CSS scope. A skin
  owns what sits behind and around the card, never the card, its 3px edge or
  its one action; DoorShell imports no stylesheet, and a theme's CSS module is
  imported only from `app/[slug]/invite/_components/themes/`.
- **Capiz** (Elegant) — the couple's photo seen through a capiz window, their
  monogram as the seal on the card's edge, a gold hairline as the hinge.
- **The host's picker** on `/dashboard/[eventId]/guests/invite` — House always;
  Pro themes named and disabled without Event Hub Pro, with the one link to it.

**Event Hub Pro now SAYS it includes this** (owner 2026-08-28: "say what it
includes"). A guest-facing gate on `COUPLE_WEBSITE_PRO` that is not the
watermark is a new thing a non-buyer is refused, so all three claim surfaces
name it: the buy page's `BENEFITS`, the Studio catalogue blurb, and the
description the PUBLIC pricing page renders (migration `20271220364681` —
the 2026-08-28 text byte for byte plus one clause, *"and a Pro theme for your
invite link that opens on your own photo"*; no count of themes; price, aliases
and gates untouched). `says-what-it-includes.test.ts` now allows a non-watermark
guest gate only while every surface names it, and fails the other way if the
claim outlives the gate (mutation-checked 4/4); it reads the LATEST description
migration instead of a fixed filename.

Velvet, Galeriya and Abaca are in the registry but `ready: false` — never
offered, and a saved choice for one renders as House — until their typefaces
are self-hosted (`lint:fonts` requires local fonts; six new faces pending the
owner's go-ahead). The cinematic reveal on door 01 follows as its own change.

Guarded by `lib/invite-themes.test.ts` and
`app/[slug]/invite/_components/themes/themes-stay-skins.test.ts`;
`lint-events-column-grants.mjs` sabotage-checked against the new column.
`doors-are-designed.test.ts` gains one snippet pardon (`member_type ===
'couple'` in join-flow — a DB enum, not copy) now that join-flow imports
DoorShell's type and joins that rule's derived set.

SPEC IMPACT: records the 2026-09-10 invite-theme decision (DECISION_LOG row
already added with the arrival, #5403); the font question and the Button-color
question stay open for the owner.
