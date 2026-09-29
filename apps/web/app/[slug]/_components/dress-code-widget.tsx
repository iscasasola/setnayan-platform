import type { EventWords } from '../_lib/event-words';
import type { EventRow } from '../_lib/types';
import { ROLE_LABELS, type GuestRole } from '@/lib/guests';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { resolveDisplayPalette } from '@/lib/room-palette';
import {
  groupLabelOf,
  resolveGuestAttireWithGroups,
  sanitizeGroupAttire,
} from '@/lib/role-group-dress-code';
import { dressCodeForEveryone, ourColoursWith, speaksToThisReader } from '@/lib/dress-code-for-everyone';
import { STYLE_UNSET_LINE, sanitizeRoleAttire } from '@/lib/role-dress-code';
import { roleLabel } from '@/lib/entourage';
import { marchPlaceLine, type MarchPlace } from '@/lib/march-place';
import { DressCodeLine, DressCodePalette } from './dress-code-styles';
import { PaletteLookList } from './dress-code-palette-looks';
import { PALETTE_LOOK_DEFAULT, type PaletteLookId } from '@/lib/palette-looks';

/*
 * 🧵 THE SILK CHIP, VISIBLE ON ANY GROUND. `.pahina-swatch` shades a chip with
 * two inset shadows and no edge, so a near-white colour (#FAF7F2 — a real
 * groom's first colour) on a light scene was a chip nobody could see. A 1px
 * outline drawn INSIDE the chip gives every colour an edge without touching the
 * shared swatch rule (`outline` is its own property, so the chip's
 * `box-shadow` shading is left exactly as it was).
 */
const SWATCH_EDGE = 'outline outline-1 outline-ink/20 [outline-offset:-1px]';
/** The same chip at row size — ten roles of full-size chips is a wall on a phone. */
const ROW_SWATCH = `pahina-swatch !h-7 !w-5 shrink-0 ${SWATCH_EDGE}`;

/*
 * The INC and Muslim modest-dress guidance. Said on its own when the couple has
 * authored nothing, and — since the Mood Board now fills this scene for nearly
 * every couple (owner 2026-09-28) — used as the heading and words above the
 * colours when the couple wrote no title or description of their own, so the
 * guidance is not silently traded for a palette.
 */
const MODEST_GUIDANCE = {
  // INC weddings require modest, formal attire of everyone present (no
  // sleeveless / short) — INC_Wedding_Practices_Reference_2026-06-28.md § 5.4.
  inc: {
    heading: 'Modest & formal',
    body:
      'Our ceremony is held in the INC chapel, so we kindly ask everyone to dress modestly and formally — please avoid sleeveless tops and short dresses or skirts. Thank you for honoring the occasion with us.',
  },
  // lib/wedding-traditions 'muslim': modest dress.
  muslim: {
    heading: 'Modest dress',
    body:
      'We warmly ask everyone to dress modestly — shoulders and knees covered. Ladies, please feel free to bring a scarf for the ceremony. Thank you for honoring the occasion with us.',
  },
} as const;

/**
 * Dress code section on the public landing page (CLAUDE.md 2026-05-22).
 *
 * Reads `events.dress_code_config` (migration 20260605030000) — host edits
 * via /dashboard/[eventId]/website/dress-code. When every field is empty
 * (brand-new event, host hasn't set anything yet), renders a polite
 * brand-voice fallback so guests know the section is intentional and to
 * check back closer to the day.
 *
 * ── WHO IS ASKING (owner 2026-09-28) ─────────────────────────────────────
 * *"we already have a palette and it adjusts real time with the event hub. if
 * in general, show our theme and the palettes of each role. but if there is an
 * account specified to this, show their palette only."*
 *
 *   · GENERAL — no `guestRole`: a stranger on the public link, a guest with no
 *     role, and the couple's own Maker canvas (the dispatcher withholds the
 *     host's role there). "Our colours" (the Mood Board's main colours, merged
 *     with any palette typed in the dress-code editor), then every role the
 *     couple dressed with ALL of its colours and its outfit line.
 *   · SPECIFIC — an identified guest whose role has something to say: that
 *     role only, every colour it holds, call time first.
 *
 * The colours are read from `rolePalette` — the SAME `events.role_palette` the
 * page's theme colours are built from (`buildSitePaletteVars`, `loaders.ts`),
 * off the same row, which on the Maker canvas is the draft-overlaid one. So
 * this scene moves when the Mood Board moves, exactly as the rest of the hub.
 */
export function DressCodeWidget({
  config,
  ceremonyType,
  genderSeparation,
  words,
  guestRole = null,
  march = null,
  rolePalette = null,
  hideWhenEmpty = false,
  sceneStyle = null,
  paletteLook = null,
}: {
  /**
   * 🚶 WHERE THIS READER WALKS (owner 2026-09-29, DECISION_LOG "THE WEDDING
   * MARCH ON THE INVITATION TELLS EACH ENTOURAGE MEMBER THEIR ROLE…"): their
   * place, their partner and who walks before them — said UNDER the "You are
   * <role>" line below, which stays the one place the role is named.
   */
  march?: MarchPlace | null;
  words: EventWords;
  /** A GUEST's view (owner 2026-09-26): with nothing authored, the section is
   *  left out instead of the "not shared yet" note. The INC / Muslim
   *  modest-dress defaults are real guidance and still show. The Maker keeps it. */
  hideWhenEmpty?: boolean;
  config: EventRow['dress_code_config'];
  /** The reader's own role, when the reader is an identified guest. */
  guestRole?: GuestRole | null;
  /** The couple's mood board (`events.role_palette`, raw — sanitised here) —
   *  "Our colours" and every colour a role wears come from here. */
  rolePalette?: unknown;
  ceremonyType?: string | null;
  genderSeparation?: string | null;
  /**
   * 🎨 `colours-and-roles` (this, the default) · `palette` · `line`
   * (`dress-code-styles.tsx`). Arranges the GENERAL view only: a guest the
   * page knows still sees just their own role's panel, in every style.
   */
  sceneStyle?: string | null;
  /**
   * 🎨 HOW THE COLOURS ARE DRAWN (owner 2026-09-29, "FIVE PALETTE STYLES") —
   * `canvas.palette`, resolved (`paletteLookOfRow`). Null / `tags` = the
   * shipped tags, markup unchanged; the other four are `dress-code-palette-looks.tsx`.
   * "Our colours", the reader's own colours and every role row follow it (a
   * role row at row size). "The palette" and "The line" layouts draw the
   * general view's colours their own way, so there only the reader's own
   * panel follows it.
   */
  paletteLook?: PaletteLookId | null;
}) {
  const look: PaletteLookId = paletteLook ?? PALETTE_LOOK_DEFAULT;
  // The couple's walima seating posture, surfaced to guests so they know what to
  // expect at the reception. Muslim-only; 'none' (default) shows nothing. Neutral
  // tone per the spec — we describe, never editorialize.
  const genderNote =
    ceremonyType === 'muslim' && genderSeparation === 'sections'
      ? 'Seating: separate sections for men and women.'
      : ceremonyType === 'muslim' && genderSeparation === 'separate_spaces'
        ? 'Seating: separate spaces for men and women.'
        : null;
  // Defensive read — JSONB column defaults to `{}` so every field may be
  // absent. Skip rows in palette that aren't valid #RRGGBB to avoid CSS
  // injection via the inline style attribute.
  const title = typeof config?.title === 'string' ? config.title : '';
  const description = typeof config?.description === 'string' ? config.description : '';
  const dos = Array.isArray(config?.dos)
    ? config.dos.filter((s): s is string => typeof s === 'string' && s.length > 0)
    : [];
  const donts = Array.isArray(config?.donts)
    ? config.donts.filter((s): s is string => typeof s === 'string' && s.length > 0)
    : [];
  const authoredPalette = Array.isArray(config?.palette)
    ? config.palette.filter(
        (p): p is { name: string; hex: string } =>
          !!p &&
          typeof p.name === 'string' &&
          typeof p.hex === 'string' &&
          /^#[0-9a-fA-F]{6}$/.test(p.hex),
      )
    : [];

  // ── COMPUTED BEFORE THE EMPTY-STATE DECISION, and that ordering is the fix.
  //
  // 🔴 SEEN ON A REAL EVENT, 2026-09-20: a couple who had set ONLY per-role
  // outfits — no title, no palette, no do/don't list — hit `hasAnything ===
  // false` and their ninongs were told "your hosts haven't shared the dress
  // code yet", while the answer for their role sat in the config unread. An
  // answer that exists and is not rendered is the defect this repo keeps
  // finding; here it was one variable's worth of ordering.
  // ⬆ BOTH TIERS, and the coarse one is why this reads differently than it did.
  // A ninang whose couple dressed "Principal Sponsors" in one line — and never
  // wrote anything for her specifically — used to get NOTHING here, because the
  // only tier this widget knew was per role. The answer existed and was not
  // rendered, which is the exact defect the ordering comment above was written
  // for; it simply had a second shape nobody had reached yet.
  //
  // 🔑 Precedence is NOT decided here. `resolveGuestAttireWithGroups` delegates
  // to `resolveAttireFor`, the one place that ranks the tiers, so this widget
  // and the editor's preview cannot disagree about which line won.
  //
  // 🎨 THE MOOD BOARD, READ ONCE. `stored` is the couple's own board; `board`
  // is what the Mood Board SHOWS (`resolveDisplayPalette` — the untouched roles
  // it derives from the main colours), the same palette the 3D room dresses
  // people in. Every colour below comes from `board`, so this scene, the Mood
  // Board and the room cannot tell one bridesmaid three different things.
  const stored = sanitizeRolePalette(rolePalette);
  const board = resolveDisplayPalette(stored);
  const roles = sanitizeRoleAttire(
    (config as { roles?: unknown } | null)?.roles,
    (v) => roleLabel(v as GuestRole) !== null,
  );
  const groups = sanitizeGroupAttire((config as { groups?: unknown } | null)?.groups);
  // THE GENERAL VIEW — "our theme and the palettes of each role".
  const everyone = dressCodeForEveryone({ stored, board, roles, groups, ceremonyType });
  // "Our colours": the Mood Board's main colours lead (live); a colour the
  // couple typed in the dress-code editor lends a same-hex chip its name, or
  // follows after — see `ourColoursWith` for why this merges.
  const palette = ourColoursWith(everyone.ourColours, authoredPalette);
  const generalHasContent = palette.length > 0 || everyone.rows.length > 0;
  // THE SPECIFIC VIEW — "if there is an account specified to this, show their
  // palette only". A panel that could only name the role stands down for the
  // general view (`speaksToThisReader`).
  const resolved = speaksToThisReader(resolveGuestAttireWithGroups({
    role: guestRole,
    roles,
    groups,
    palette: board,
  }), generalHasContent);
  const mine = resolved.panel;
  // Said only when the answer came from the group, so a reader knows the couple
  // dressed her whole group and did not overlook her.
  const mineFromGroup = resolved.source === 'group' ? groupLabelOf(guestRole) : null;

  const hasAnything =
    title.length > 0 ||
    description.length > 0 ||
    dos.length > 0 ||
    donts.length > 0 ||
    // The Mood Board is a dress code too: "our theme and the palettes of each
    // role" (owner 2026-09-28) — a couple who picked colours and typed nothing
    // here still has something every guest can dress by.
    generalHasContent ||
    // A line for THIS reader's role is a dress code, even when the couple
    // filled in nothing else.
    mine !== null ||
    // …and so is their place in the march: "you walk 5th" is what to be ready for.
    march !== null;

  // Empty state — section stays visible (so guests know to expect it) but
  // reads as an intentional note in the host's brand voice.
  if (!hasAnything) {
    // INC weddings require modest, formal attire of everyone present (no
    // sleeveless / short), so even when the host hasn't authored a dress code
    // we surface that expectation — it spares guests the most common INC-
    // wedding friction. See INC_Wedding_Practices_Reference_2026-06-28.md § 5.4.
    if (ceremonyType === 'inc') {
      return (
        <section className="space-y-4">
          <header className="space-y-2">
            <p className="pahina-eyebrow">
              <span>Dress code</span>
            </p>
            <h3 className="font-pahina text-3xl font-light leading-tight tracking-tight text-ink">
              {MODEST_GUIDANCE.inc.heading}
            </h3>
          </header>
          <p className="max-w-prose text-base leading-relaxed text-ink/70">
            {MODEST_GUIDANCE.inc.body}
          </p>
        </section>
      );
    }
    // Muslim weddings carry a strong modesty expectation (lib/wedding-traditions
    // 'muslim': modest dress), so surface it even when the host hasn't authored a
    // dress code — it spares guests the most common Nikah/walima friction.
    if (ceremonyType === 'muslim') {
      return (
        <section className="space-y-4">
          <header className="space-y-2">
            <p className="pahina-eyebrow">
              <span>Dress code</span>
            </p>
            <h3 className="font-pahina text-3xl font-light leading-tight tracking-tight text-ink">
              {MODEST_GUIDANCE.muslim.heading}
            </h3>
          </header>
          <p className="max-w-prose text-base leading-relaxed text-ink/70">
            {MODEST_GUIDANCE.muslim.body}
          </p>
          {genderNote ? (
            <p className="max-w-prose text-sm font-medium text-ink/75">{genderNote}</p>
          ) : null}
        </section>
      );
    }
    if (hideWhenEmpty) return null;
    return (
      <section className="space-y-4">
        <header className="space-y-2">
          <p className="pahina-eyebrow">
            <span>Dress code</span>
          </p>
          <h3 className="font-pahina text-3xl font-light leading-tight tracking-tight text-ink">
            Coming together
          </h3>
        </header>
        <p className="max-w-prose text-base leading-relaxed text-ink/65">
          Your hosts haven&rsquo;t shared the dress code yet — check back closer to
          the {words.eventWord}.
        </p>
      </section>
    );
  }

  // Pahina (design 2026-07-25 §5/§7): the palette rendered as SILK SWATCHES
  // (tall fabric chips with inner shading + a gild pin, not flat color dots),
  // and the Do/Don't boxes recoloured off the app's success/danger greens and
  // reds onto palette-derived tones — the functional-color exile (§4). The
  // two lists stay distinguishable by their key and rule, not by hue.
  // ⚠ owner 2026-09-25 "drop the numbers": no chapter numeral — title only.
  // ── WHAT *YOU* WEAR (owner 2026-09-20 · lib/role-dress-code.ts).
  // A reader with a role is answered for THEIR role only: the whole palette is
  // everyone else's instructions, and a ninang does not need the groomsmen's.
  // A reader with no role (or no session) falls through to the general section
  // below: our colours, then every role's.
  const modest =
    ceremonyType === 'inc' ? MODEST_GUIDANCE.inc : ceremonyType === 'muslim' ? MODEST_GUIDANCE.muslim : null;
  const shownTitle = title || (!description && modest ? modest.heading : 'Dress with us');
  const shownDescription = description || (!title && modest ? modest.body : '');

  // 🚶 A guest with a place in the march keeps the shipped card — its march line
  // ("you walk 5th") is theirs alone, and the general styles draw no such line.
  if (!mine && !march && (sceneStyle === 'palette' || sceneStyle === 'line')) {
    const general = { title: shownTitle, description: shownDescription, palette, rows: everyone.rows, dos, donts, genderNote };
    return sceneStyle === 'palette' ? <DressCodePalette {...general} /> : <DressCodeLine {...general} />;
  }

  return (
    <section className="space-y-5">
      <header className="space-y-2">
        <p className="pahina-eyebrow">
          <span>Dress code</span>
        </p>
        <h3 className="font-pahina text-3xl font-light leading-tight tracking-tight text-ink">
          {shownTitle}
        </h3>
      </header>
      {shownDescription ? (
        <p className="max-w-prose text-base leading-relaxed text-ink/70">{shownDescription}</p>
      ) : null}
      {mine || march ? (
        /* 🎀 NO FILL BEHIND "YOU". The box used to sit on `bg-veil/50`, which
           a palette-tinted page turns pink, and a near-white first colour
           (#FAF7F2) vanished into it. The gild rule alone marks the panel; the
           chips carry their own edge (`SWATCH_EDGE`). */
        <div className="space-y-3 border-l-2 border-gild py-1 pl-4" data-dress-code="you">
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-gild">
            {/* The entourage's own label first ("Ninang"); the couple are not
                in the entourage list, so a bride or groom reads the guest
                list's label ("Groom") instead of "in the entourage". */}
            You are {mine?.roleLabel ?? (guestRole ? (roleLabel(guestRole) ?? ROLE_LABELS[guestRole]) : null) ?? 'in the entourage'}
          </p>
          {/* 🚶 WHERE YOU WALK (owner 2026-09-29) — under the same "You are" line,
              so a walker whose role has no outfit line still reads it. */}
          {march ? (
            <p className="text-base leading-snug text-ink" data-dress-code="march">
              {marchPlaceLine(march)}
            </p>
          ) : null}
          {mine ? (
          <>
          {/* WHERE THE ANSWER CAME FROM — said only when it came from the group.
              A ninang who reads her group's line needs to know the couple
              dressed her whole group on purpose, not that they wrote something
              for her and it is being shown oddly. Silent provenance is the same
              defect as a silent override, seen from the other side. */}
          {mineFromGroup ? (
            <p className="text-xs leading-relaxed text-ink/55">
              From your hosts&rsquo; note for {mineFromGroup}.
            </p>
          ) : null}
          {/* ⏰ THE CALL TIME SITS ABOVE THE OUTFIT, AND THAT IS THE POINT.
              Owner, 2026-09-23, on what a ninang needs: “what she needs most is
              her call time”. Putting it under the swatch and the hex would have
              made the thing she needs most the last thing she reaches. It reads
              before the outfit because she can decide what to wear later and
              cannot decide when to leave the house later.

              Absent when unset — never “TBA” and never a guessed hour. Same
              rule the style already follows: this product telling a sponsor the
              wrong time is worse than telling her nothing. */}
          {mine.callTime ? (
            <p className="text-base leading-snug text-ink">
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-ink/55">
                Call time
              </span>{' '}
              <span className="font-pahina text-2xl font-light tracking-tight">{mine.callTime}</span>
            </p>
          ) : null}
          <div className="space-y-1">
            <p className="font-pahina text-2xl font-light leading-snug tracking-tight text-ink">
              {mine.styleLabel ?? 'Outfit to be confirmed'}
            </p>
            {mine.styleLabel ? null : (
              <p className="text-sm leading-relaxed text-ink/65">{STYLE_UNSET_LINE}</p>
            )}
            {mine.note ? (
              <p className="text-sm leading-relaxed text-ink/70">{mine.note}</p>
            ) : null}
          </div>
          {/* 🎨 THEIR PALETTE, ALL OF IT (owner 2026-09-28: "show their palette
              only"). It used to be `mine.hex` — the role's FIRST colour — so a
              bridesmaid whose board holds three was shown one. */}
          {mine.hexes.length > 0 && look !== 'tags' ? (
            <PaletteLookList look={look} items={mine.hexes.map((hex) => ({ hex }))} label="Your colours" />
          ) : mine.hexes.length > 0 ? (
            <ul className="flex flex-wrap gap-2" aria-label="Your colours" data-pal-look="tags">
              {mine.hexes.map((hex, i) => (
                <li key={`${hex}-${i}`} className="w-[3.25rem]">
                  <span aria-hidden className={`pahina-swatch ${SWATCH_EDGE}`} style={{ backgroundColor: hex }} />
                  <span className="mt-2 block text-center font-mono text-[0.55rem] uppercase leading-tight tracking-[0.08em] text-ink/55">
                    {hex}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          </>
          ) : null}
        </div>
      ) : null}
      {/* The full palette is everyone else's instructions. A reader who has
          their own line above does not need it (owner 2026-09-20). */}
      {!mine && palette.length > 0 ? (
        <div className="space-y-2" data-dress-code="ours">
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-gild">Our colours</p>
          {look !== 'tags' ? (
            <PaletteLookList look={look} items={palette} label="Our colours" />
          ) : (
            /* gap-2: five full chips (the Mood Board's five main colours) fit
               one line at 375px; gap-3 wrapped the fifth onto a row alone.
               🎨 Tags — the default look — is this list exactly as it shipped;
               `data-pal-look` only lets its swing-in entrance find it. */
            <ul className="flex flex-wrap gap-2" data-pal-look="tags">
              {palette.map((p, i) => (
                <li key={`${p.hex}-${i}`} className="w-[3.25rem]" title={p.name || p.hex}>
                  <span aria-hidden className={`pahina-swatch ${SWATCH_EDGE}`} style={{ backgroundColor: p.hex }} />
                  {p.name ? (
                    <span className="mt-2 block text-center font-mono text-[0.6rem] uppercase leading-tight tracking-[0.12em] text-ink/60">
                      {p.name}
                    </span>
                  ) : (
                    <span className="sr-only">{p.hex}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      {/* 👥 EVERY ROLE'S COLOURS — the general view's second half. One tidy row
          per role the couple dressed (label + its outfit line on the left, its
          chips on the right, wrapping under on a narrow phone), in the Mood
          Board's own order. Roles with no colours and no outfit are left out
          by `dressCodeForEveryone`, never drawn empty. */}
      {!mine && everyone.rows.length > 0 ? (
        /* 📜 `data-hub-rows`: one role per row, arriving in turn in a "One
           part after another" scene — the run of show's mechanism, not its own. */
        <ul className="divide-y divide-ink/10 border-y border-ink/10" data-dress-code="roles" data-hub-rows="">
          {everyone.rows.map((row) => (
            <li key={row.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2.5" data-role-row={row.key}>
              <div className="min-w-0 flex-1 basis-40 space-y-0.5">
                <p className="text-sm font-medium leading-snug text-ink">{row.label}</p>
                {row.lines.map((line, i) => (
                  <p key={i} className="text-xs leading-relaxed text-ink/65">
                    {line.label} · {line.styleLabel}
                    {line.note ? <> — {line.note}</> : null}
                  </p>
                ))}
              </div>
              {row.hexes.length > 0 && look !== 'tags' ? (
                <PaletteLookList look={look} size="row" items={row.hexes.map((hex) => ({ hex }))} label={`${row.label} colours`} />
              ) : row.hexes.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5" aria-label={`${row.label} colours`}>
                  {row.hexes.map((hex, i) => (
                    <li key={`${hex}-${i}`} title={hex}>
                      <span aria-hidden className={ROW_SWATCH} style={{ backgroundColor: hex }} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {dos.length > 0 || donts.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {dos.length > 0 ? (
            <div className="space-y-2 border-l-2 border-gild bg-veil/50 p-4 text-sm text-ink/80">
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-gild">Do</p>
              <ul className="space-y-1">
                {dos.map((row, i) => (
                  <li key={i}>· {row}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {donts.length > 0 ? (
            <div className="space-y-2 border-l-2 border-ink/30 bg-paper-deep p-4 text-sm text-ink/75">
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/50">
                Don&rsquo;t
              </p>
              <ul className="space-y-1">
                {donts.map((row, i) => (
                  <li key={i}>· {row}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
      {genderNote ? (
        <p className="max-w-prose text-sm font-medium text-ink/75">{genderNote}</p>
      ) : null}
    </section>
  );
}

