import Link from 'next/link';
import { Eye, PencilLine } from 'lucide-react';
import type { HubFact, HubRole, HubRoleView, HubStanding } from '@/lib/event-hub-control';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import { SlugField } from '@/app/dashboard/[eventId]/invitation/_components/slug-field';
import { OB } from '@/app/_components/site-stage/obsidian';
import { SiteStage, type SiteStageStage } from '@/app/_components/site-stage/site-stage';

/* The obsidian colour table moved to `app/_components/site-stage/obsidian.ts`
   so the shared (client) stage can read it without importing this server file.
   Re-exported here because `plan3d-stage.tsx` imports it from this path. */
export { OB };

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
 * (`livePhase === null`), which withdraws the whole stage; and an event with
 * no address yet (`slug === null`), which keeps the card and its countdown but
 * draws no frame — there is no page to photograph. Neither is an apology and
 * neither is a zero. Held by `hub-stage-renders.test.ts`.
 *
 * ── WHO × WHEN (owner, 2026-09-24: *"this 2 can integrate to each other"*) ──
 * The frame, the "When" switch that picks which of the four stages it shows,
 * the "View as" switch beside it, and the per-stage doors (Preview ↗, the
 * Editorial workroom) are ONE shared client component —
 * `app/_components/site-stage/site-stage.tsx` — so the site editor can adopt
 * the same stage. This file hands it plain data only.
 */
export function HubStage({
  slug,
  standing,
  facts,
  livePhase,
  initialPhase,
  stages,
  editHref,
  rolesByPhase,
  armedRole,
  workroomHref = null,
  eventId,
  slugAction,
}: {
  slug: string | null;
  standing: HubStanding;
  facts: readonly HubFact[];
  /**
   * The stage the guests are on TODAY, or null when the event could not be
   * read — which withdraws the whole stage rather than guessing one.
   */
  livePhase: LifecyclePhase | null;
  /** Which stage the "When" switch opens on — `resolveHubStageSelection`. */
  initialPhase: LifecyclePhase | null;
  /** The four stages, in order, as plain data (no icons cross this line). */
  stages: readonly SiteStageStage[];
  editHref: string;
  /**
   * VIEW AS — each role's read, per stage, already resolved and already gated.
   * EMPTY means the switcher does not render: the offer list is produced by
   * `hubPreviewRoles`, which returns nothing for a non-host.
   */
  rolesByPhase: Partial<Record<LifecyclePhase, readonly HubRoleView[]>>;
  /** Which chip is armed. Null when there is nothing to arm. */
  armedRole: HubRole | null;
  /** `/dashboard/<id>/story` — Editorial's workroom door. */
  workroomHref?: string | null;
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

        {/* ══ THE STAGE — who × when ══
            Two things silence it: a read that did not happen (no live phase),
            and nothing else. No address yet keeps the switch and the caption
            and simply draws no frame. */}
        {livePhase && initialPhase ? (
          <SiteStage
            slug={slug}
            stages={stages}
            livePhase={livePhase}
            initialPhase={initialPhase}
            rolesByPhase={rolesByPhase}
            armedRole={armedRole}
            workroomHref={workroomHref}
            initialDevice="desktop"
            urlParam="stage"
          />
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

    </section>
  );
}
