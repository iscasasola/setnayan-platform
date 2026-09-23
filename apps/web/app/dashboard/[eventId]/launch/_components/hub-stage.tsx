import Link from 'next/link';
import { Eye, PencilLine } from 'lucide-react';
import type { HubFact, HubRole, HubRoleView, HubStanding } from '@/lib/event-hub-control';
import { SlugField } from '@/app/dashboard/[eventId]/invitation/_components/slug-field';

/*
  ── THE OBSIDIAN STAGE, MEASURED ───────────────────────────────────────────
  🚨 The app is LIGHT-LOCKED. Every Tailwind theme token resolves to its LIGHT
  value on this dark island and fails silently: `text-ink` is 1.27:1 here and
  `text-mulberry` is 3.81:1. So the stage paints from literals, exactly the way
  `studio/papic/_components/papic-stage.tsx` does, with the ratios written down:

    text  #FBFAF7 on #17160F ... 17.37:1  AAA
    soft  #B6B9BE on #17160F .... 9.22:1  AAA
    gold  #CBA766 on #17160F .... 7.99:1  AAA   ← gold is safe HERE and only here
    cta   #E5794E on #17160F .... 6.20:1  AA    (obsidian label on it: 6.20:1)
    card  #1E2229 raised panel — text 15.29:1 · soft 8.11:1 · gold 7.04:1

  ⛔ NEVER `--pos #4F6B4A` on this ground: 2.7:1. It is a light-ground token.
  ⚠ And the Tailwind slot named `terracotta` is the GOLD; the CTA is `mulberry`.
  These are the `--sn-ob-*` values from globals.css, inlined rather than
  referenced because this panel is obsidian in BOTH themes and a themed token
  would break exactly one of them.
*/
export const OB = {
  page: '#17160F',
  card: '#1E2229',
  text: '#FBFAF7',
  soft: '#B6B9BE',
  gold: '#CBA766',
  cta: '#E5794E',
  hairline: 'rgba(255,255,255,0.10)',
} as const;

/**
 * S1 · THE STAGE and S2 · THE FOUR FACTS — the couple's own public page, as it
 * is right now, with the four facts fused to its lower edge.
 *
 * ── WHY THIS IS ITS OWN FILE ───────────────────────────────────────────────
 * So it can be RENDERED in a test. The disease this whole build exists to fix
 * is a measurement that never reaches the pixel — a refused read that renders
 * byte-identically to an empty event — and a resolver test cannot prove the
 * render. `hub-stage-renders.test.ts` mounts this at three phases and reads the
 * emitted HTML. The precedent is `app/_components/byline-renders-as-a-door.test.ts`:
 * source guards for "does the file still say X", real DOM for "does a person
 * see it".
 *
 * It is presentational and PURE: every decision arrives already made, from
 * `lib/event-hub-control.ts`. It performs no I/O and resolves no phase.
 *
 * ⚠ EMPTY IS A PROMISE, NOT AN APOLOGY (design § 4.4). An event with nothing set
 * yet is shown THE PAGE IT WILL BECOME plus its countdown — never a sentence
 * apologising for being empty, and never a stranger's wedding as a sample.
 *
 * TWO THINGS SILENCE THE MINIATURE, AND ONLY TWO: a read that did not happen
 * (`channelName === null`), which withdraws the whole card; and an event with
 * no address yet (`slug === null`), which keeps the card and its countdown but
 * draws no frame — there is no page to photograph. Neither is an apology and
 * neither is a zero. Held by `hub-stage-renders.test.ts`.
 */
/**
 * ● full · ◐ partial or read-only · ○ nothing, on purpose — the § 3.2 key.
 * Paired with a WORD for screen readers: a glyph alone tells a person using one
 * nothing at all, and "what each role sees" is the entire content here.
 */
const MARK_GLYPH = { full: '\u25CF', partial: '\u25D0', none: '\u25CB' } as const;
const MARK_WORD = { full: 'Yes:', partial: 'Partly:', none: 'No:' } as const;

export function HubStage({
  slug,
  standing,
  facts,
  channelName,
  channelBlurb,
  channelIndex,
  channelCount,
  editHref,
  roles,
  armedRole,
  roleHrefBase,
  eventId,
  slugAction,
}: {
  slug: string | null;
  standing: HubStanding;
  facts: readonly HubFact[];
  /** The live channel's own name, or null when the event could not be read. */
  channelName: string | null;
  channelBlurb: string | null;
  /** 1-based, for "Stage 2 of 4". */
  channelIndex: number | null;
  channelCount: number;
  editHref: string;
  /**
   * VIEW AS — the reads this viewer may look through, already resolved and
   * already gated. EMPTY means the switcher does not render: the offer list is
   * produced by `hubPreviewRoles`, which returns nothing for a non-host.
   */
  roles: readonly HubRoleView[];
  /** Which chip is armed. Null when there is nothing to arm. */
  armedRole: HubRole | null;
  /**
   * `/dashboard/<eventId>/launch`. No longer used to BUILD a chip — the chips
   * are radios and nothing navigates — but kept on the contract because
   * `?viewas=` is still an honest deep link: the server resolves the armed role
   * and it is the radio that starts checked.
   */
  roleHrefBase?: string;
  /**
   * THE ADDRESS IS EDITABLE HERE — owner, 2026-09-23, pointing at the heading
   * below: *"should be editable here. and verified if it is available."*
   *
   * 🔑 NOTHING NEW WAS BUILT FOR IT. `SlugField` has shipped on the invitation
   * page for months: a 300ms-debounced live check against `/api/slugs/check`,
   * suggestions when a word is taken, and the copy for reserved / invalid /
   * forwarding. `updateEventSlug` behind it asks `findSlugConflict`, the ONE
   * availability answer for the one namespace weddings, shops and people all
   * share. Re-drawing any of that here would have been a second opinion about
   * who owns `/maria-and-jomar`.
   *
   * Both are optional so a test can mount the stage without a server action —
   * the page always passes them, and everyone who reaches `/launch` is already
   * a host (the page redirects otherwise, line `isHostMemberType`).
   */
  eventId?: string;
  slugAction?: (formData: FormData) => Promise<void>;
}) {
  /* The armed VIEW, not just its key — looked up in the list this viewer was
     actually offered, so a role that is not on it can never be rendered. */
  const armed = roles.find((r) => r.role === armedRole) ?? null;
  return (
    <section
      aria-labelledby="hub-stage-address"
      className="mt-6 overflow-hidden rounded-2xl"
      style={{ backgroundColor: OB.page }}
    >
      <div className="space-y-4 p-5 sm:p-6">
        <p
          className="font-mono text-[10px] font-bold uppercase tracking-[0.16em]"
          style={{ color: OB.gold }}
        >
          Your page · right now
        </p>
        <div className="space-y-1">
          <h2
            id="hub-stage-address"
            className="text-lg font-semibold tracking-tight sm:text-xl"
            style={{ color: OB.text }}
          >
            {slug ? `setnayan.com/${slug}` : 'Your one link, once you set it'}
          </h2>
          <p className="max-w-prose text-sm" style={{ color: OB.soft }}>
            One link for the whole life of your event — it changes itself as the day comes.
          </p>
        </div>

        {eventId && slugAction ? (
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: OB.card, border: `1px solid ${OB.hairline}` }}
          >
            <SlugField eventId={eventId} initialSlug={slug ?? ''} saveAction={slugAction} />
          </div>
        ) : null}

        {/* ══ THE MINIATURE — the page itself, not a sentence about it ══
            The docblock on this component has promised a miniature since it was
            written. What actually stood here was PROSE — "Day-of · the running
            order, live" — so the controller described a page it had never once
            looked at, which is the house disease with a nicer typeface.

            🔑 IT IS THE SAME ADDRESS AS THE BUTTON UNDER IT. `/{slug}`: no
            `?phase=`, no `?as=`, no `?editor=1`. If the page's own resolution
            ever disagrees with the stage we computed, the frame SHOWS the
            disagreement rather than letting the caption paper over it.

            ⚠ THE OWNER RIBBON RIDES THIS FRAME, and that is why the eyebrow
            above no longer says "as your guests see it". A host cannot stop
            being signed in, and `buildOwnerRibbon` gates on the server-verified
            capability ALONE — no param, no cookie, no prop a caller may set
            (`lib/owner-ribbon.ts`, owner-locked 2026-07-26). Inventing a
            hide-the-ribbon param to make a label true would be weakening a
            locked gate to win an argument with a caption. So the frame is
            labelled as the host's own view and the caption names the strip.

            Phone width and CLIPPED, never scaled: the page is already
            responsive, so a 420px frame renders the real mobile layout at 1:1
            instead of a transform that lies about type size. Same reason
            `website/editor/_components/editor-shell.tsx` opens on `max-w-[430px]`.

            It is INERT — `inert` + `tabIndex={-1}` + `pointer-events-none`. A
            picture of the page; the lit button beneath it is the door. */}
        {/* 🖥 SIDE BY SIDE ON A WIDE SCREEN, stacked on a phone.
            Owner, 2026-09-23, looking at it live: *"the page should directly
            fill the whole body and use the space."* He was right — a 420px
            phone frame centred in a 1,100px card left two columns of empty
            obsidian, and the words sat under it rather than beside it.

            The frame stays a PHONE, because that is what a guest holds and
            scaling it up would be a picture of a page nobody opens. What
            changes is what sits next to it: on `lg` the caption moves into its
            own column and the dead space becomes the text.

            📐 The shape is `plan3d-stage.tsx`'s — `grid` with an asymmetric
            two-column track — rather than a new one, because that panel sits a
            menu slot away and two stages that lay out differently read as two
            products. */}
        {channelName ? (
          /* 🪤 THE TWO-COLUMN TRACK PUT THE PREVIEW IN THE *SMALL* COLUMN.
             It read `lg:grid-cols-[minmax(0,420px)_1fr]` — preview capped at
             420px, prose handed the rest — so the thing the section exists to
             show stayed the width of a phone however wide the window got, and
             the card around it drew a second frame inside a page that already
             has one. Owner, 2026-09-23, with the shell's own gutter selected:
             *"remove the framing and let it consume the space"*.
             ⛔ NO CARD, NO CAP, NO GRID. The preview is the full measure of
             the column it sits in and the caption reads underneath it. The
             page's gutter is left alone on purpose — it is the dashboard
             shell's (`px-4 sm:px-6 lg:px-8`), shared by every sibling page,
             and eating it here would make this one page sit differently from
             the rest of the dashboard. */
          <figure className="m-0">
            {slug ? (
              <div
                className="relative h-[300px] w-full overflow-hidden rounded-xl sm:h-[420px] lg:h-[560px]"
                style={{ border: `1px solid ${OB.hairline}` }}
              >
                <iframe
                  src={`/${slug}`}
                  title={`Your page as it stands right now — ${channelName}`}
                  loading="lazy"
                  inert
                  tabIndex={-1}
                  className="pointer-events-none absolute left-0 top-0 h-[1100px] w-full border-0"
                />
              </div>
            ) : null}
            <figcaption className="pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em]"
                  style={{ backgroundColor: OB.cta, color: OB.page }}
                >
                  Active now
                </span>
                {channelIndex !== null && (
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.12em]"
                    style={{ color: OB.soft }}
                  >
                    Stage {channelIndex} of {channelCount}
                  </span>
                )}
              </div>
              <p className="mt-3 text-base font-semibold" style={{ color: OB.text }}>
                {channelName}
              </p>
              <p className="mt-1 max-w-prose text-sm" style={{ color: OB.soft }}>
                {channelBlurb}
              </p>
              {slug ? (
                <p className="mt-2 max-w-prose text-[11.5px]" style={{ color: OB.soft }}>
                  That strip across the top is yours alone — you are signed in, so your page
                  knows you. Your guests never see it.
                </p>
              ) : null}
            </figcaption>
          </figure>
        ) : (
          /* NOT "you have no page". We could not read the event, so we say
             exactly that and nothing more — and we draw NO frame, because a
             frame here would be a picture of a page we never confirmed. */
          <div className="rounded-xl p-4 sm:p-5" style={{ backgroundColor: OB.card }}>
            <p className="max-w-prose text-sm" style={{ color: OB.soft }}>
              We could not reach your event just now, so we are not going to guess which page your
              guests are seeing. Nothing has been lost.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {slug ? (
/* A real round trip to the public site, in a new tab — the same
               address the frame above is showing.

               🔴 IT SAID "Open as a guest", AND IT DOES NOT OPEN AS A GUEST.
               The host's session travels with the click and `buildOwnerRibbon`
               lights the ribbon from a server-verified capability, so what
               opens is the host's own page. The frame above now shows that
               plainly, which made the old label a contradiction a couple could
               see in one glance.

               🪤 AND IT IS NOT "Open your page", WHICH WAS THE FIRST FIX AND
               DISARMED A GATE. That exact string is the host role's own
               `previewLabel` in `lib/event-hub-control.ts`, and
               `view-as-reaches-the-render.test.ts` uses it to prove a
               `guest`-typed member cannot arm the host view by hand-typing
               `?viewas=host`. Borrowing it put the same words on a button that
               is ALWAYS painted, so the guard's failing case and its passing
               case emitted the same HTML — it caught this on the first run.
               A name collision reads as agreement and is not.

               ⚠ THE SAME LABEL IS STILL WRONG ON THREE OTHER SURFACES
               (`plan3d-stage.tsx` and two `ctaLabel`s in `event-hub-control.ts`,
               one of them pinned by a guard). That is a vocabulary sweep, not
               this change, and it is flagged rather than half-done. */
            <a
              href={`/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium"
              style={{ backgroundColor: OB.cta, color: OB.page }}
            >
              <Eye aria-hidden className="h-4 w-4" strokeWidth={2} />
              Open the live page
            </a>
          ) : null}
          <Link
            href={editHref}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium"
            style={{ border: `1px solid ${OB.hairline}`, color: OB.text }}
          >
            <PencilLine aria-hidden className="h-4 w-4" strokeWidth={2} />
            {slug ? 'Edit the page' : 'Set your link'}
          </Link>
        </div>
      </div>

      {/* S2 · THE FOUR FACTS — fused to the stage's lower edge. They are the
          first TEXT on the page even though the stage is the first PAINT.
          🔑 An UNKNOWN fact prints an em-dash: never a 0, never a phase guessed
          from a date nobody read. `known` is the only thing standing between a
          couple with 180 guests and the sentence "0 of 0 in". */}
      <dl
        aria-label={`Your event at a glance${standing.measured ? '' : ' — some of it could not be read'}`}
        className="grid grid-cols-2 gap-px sm:grid-cols-4"
        style={{ backgroundColor: OB.hairline }}
      >
        {facts.map((fact) => (
          <div key={fact.label} className="p-3.5" style={{ backgroundColor: OB.page }}>
            <dt
              className="font-mono text-[9px] font-bold uppercase tracking-[0.14em]"
              style={{ color: OB.gold }}
            >
              {fact.label}
            </dt>
            <dd
              className="mt-1 text-[13px] font-medium leading-snug"
              style={{ color: fact.known ? OB.text : OB.soft }}
            >
              {fact.known ? fact.value : <span title="We could not read this">&mdash;</span>}
            </dd>
          </div>
        ))}
      </dl>

      {/* ══ VIEW AS — the couple CHECKS the role matrix instead of trusting it ══
          Owner 2026-09-02: "make sure it also has view as (they pick what each
          role sees)." It rides the stage's LOWER EDGE, under the facts, because
          it is a property of the stage and not a setting — it never moves into
          a sheet (design § 3, prototype § 3).

          🔒 It renders NOTHING for a viewer `hubPreviewRoles` refused. The list
          arrives empty for a `guest`-typed `event_members` row, which is the
          person `Boolean(memberRow)` once waved through into a private site.

          Server-rendered links, not a client switch: the armed read is resolved
          by the same pure function the tests call, so what a person SEES is the
          thing under test — and it works with no JavaScript at all.

          📐 THE IDIOM IS ALREADY IN THIS REPO — `LensChip` in
          `schedule/_components/ros-p2.tsx`, whose own row is captioned "View
          as": chips, an href carrying the lens, one active. Same shape, painted
          from `OB` rather than reused, and NOT out of preference — that
          component is `bg-white text-ink/60`, and `text-ink` measures 1.27:1 on
          this obsidian ground. A light-ground token fails here silently, which
          is the whole reason `OB` exists. */}
      {armed ? (
        <div
          className="sn-viewas"
          style={{ borderTop: `1px solid ${OB.hairline}`, backgroundColor: 'rgba(255,255,255,0.03)' }}
        >
          {/* ══ VIEW AS — NOTHING NAVIGATES ══════════════════════════════════
              Owner, 2026-09-23, pressing a chip on the live page: *"clicking
              here refreshes the whole page, it should only refresh the lower
              part since that is the one that changes."* He is right, and it was
              worse than it looked: each chip was a `<Link>` carrying
              `?viewas=`, so one press re-ran the whole server page — the four
              facts, the stage cards, the day-of list — AND re-signed every
              background URL, to swap one description.

              🔑 SO ALL SIX READS ARE RENDERED AND CSS SHOWS ONE. Native radios,
              labels as the chips, `globals.css` revealing the card whose radio
              is checked. No navigation, no round trip, and the miniature above
              is never touched — an iframe that does not re-mount does not
              reload the couple's page.

              ✅ AND IT STILL WORKS WITH NO JAVASCRIPT, which is the property
              the `<Link>` version was built for in the first place. Every read
              is still resolved server-side by the same pure function the tests
              call; the only thing that moved to CSS is WHICH ONE IS SHOWN.

              🔗 `?viewas=` stays a real deep link: the armed role arrives from
              the server and is the radio that starts checked, so a link into a
              particular read still opens on it. */}
          <fieldset className="m-0 border-0 p-0">
            <legend className="sr-only">View this page as</legend>
            {roles.map((r) => (
              <input
                key={r.role}
                type="radio"
                name="sn-viewas"
                id={`sn-viewas-${r.role}`}
                defaultChecked={r.role === armed.role}
                className="sr-only"
              />
            ))}
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
              <span
                className="font-mono text-[9px] font-bold uppercase tracking-[0.14em]"
                style={{ color: OB.soft }}
              >
                View as
              </span>
              {roles.map((r) => (
                <label
                  key={r.role}
                  htmlFor={`sn-viewas-${r.role}`}
                  className="sn-viewas-chip cursor-pointer rounded-full px-2.5 py-1 text-[11.5px] font-medium"
                  style={{ border: `1px solid ${OB.hairline}`, color: OB.soft }}
                >
                  {r.name}
                </label>
              ))}
              <span className="ml-auto text-[10.5px]" style={{ color: OB.soft }}>
                The stage above becomes their page
              </span>
            </div>

            <div className="px-4 pb-4 sm:px-5 sm:pb-5">
              {roles.map((r) => (
                <div
                  key={r.role}
                  className="sn-viewas-card rounded-xl p-4"
                  data-viewas={r.role}
                  style={{ backgroundColor: OB.card }}
                >
                  <p
                    className="font-mono text-[9.5px] font-bold uppercase tracking-[0.12em]"
                    style={{ color: OB.gold }}
                  >
                    {r.who}
                  </p>
                  <p className="mt-2 text-[15px] font-semibold" style={{ color: OB.text }}>
                    {r.headline}
                  </p>
                  <p className="mt-1 max-w-prose text-[13px] leading-snug" style={{ color: OB.soft }}>
                    {r.blurb}
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {r.cells.map((cell) => (
                      <li key={cell.text} className="flex items-start gap-2 text-[12.5px]">
                        <span
                          aria-hidden
                          className="mt-px font-mono text-[11px] leading-5"
                          style={{ color: cell.mark === 'none' ? OB.soft : OB.gold }}
                        >
                          {MARK_GLYPH[cell.mark]}
                        </span>
                        {/* 🔑 An unknown line says it could not be read. It NEVER
                            renders as a zero and never as a shape we guessed. */}
                        <span style={{ color: cell.known ? OB.text : OB.soft }}>
                          <span className="sr-only">{MARK_WORD[cell.mark]} </span>
                          {cell.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {r.previewHref ? (
                      <a
                        href={r.previewHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium"
                        style={{ backgroundColor: OB.cta, color: OB.page }}
                      >
                        <Eye aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                        {r.previewLabel}
                      </a>
                    ) : null}
                    <p className="text-[11.5px]" style={{ color: OB.soft }}>
                      {r.footnote}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        </div>
      ) : null}
    </section>
  );
}
