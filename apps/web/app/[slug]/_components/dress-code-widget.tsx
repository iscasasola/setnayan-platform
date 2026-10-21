import type { ReactNode } from 'react';
import { HUB_SCENE_WORDS_CLASS } from '@/lib/scene-words-class';
import type { EventWords } from '../_lib/event-words';
import type { EventRow } from '../_lib/types';
import { guestRoleLabel, type GuestAttire, type GuestRole } from '@/lib/guests';
import type { RoleNames } from '@/lib/role-names';
import { PALETTE_LIMITS, paletteKeyForRole, sanitizeRolePalette, type PaletteKey } from '@/lib/mood-board';
import { RoleFigure } from '@/app/_components/role-figure';
import { resolveDisplayPalette } from '@/lib/room-palette';
import {
  groupLabelOf,
  resolveGuestAttireWithGroups,
  sanitizeGroupAttire,
} from '@/lib/role-group-dress-code';
import { dressCodeForEveryone, speaksToThisReader, type EveryoneDot, type EveryoneDressRow } from '@/lib/dress-code-for-everyone';
import { ATTIRE_STYLE_LABEL, STYLE_UNSET_LINE, STYLE_UNSET_LINE_FOR_HOST, sanitizeRoleAttire } from '@/lib/role-dress-code';
import { PICK_LABEL, isDressableRole, isTwoPick, readerAttire, studioRowOf, type GuestNameParts, type ReadPick as ReaderPick } from '@/lib/attire-rows';
import { pickDots, singleWearerOf } from '@/lib/role-figure';
import { roleGroupOf } from '@/lib/role-groups';
import { roleLabel } from '@/lib/entourage';
import { marchPlaceLine, type MarchPlace } from '@/lib/march-place';
import { SeeWhereYouAre } from './see-where-you-are';
import { DressCodeLine, DressCodePalette } from './dress-code-styles';
import { DotWords, PaletteLookList } from './dress-code-palette-looks';
import { PALETTE_LOOK_DEFAULT, type PaletteLookId } from '@/lib/palette-looks';
import { SceneSample, dosSample, paletteSample } from './maker-scene-samples';
import { DressCodeDos } from './dress-code-dos';
import { DOS_LOOK_DEFAULT, type DosLookId } from '@/lib/dress-code-looks';

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

/** What a role's colours MEAN (the Mood Board's rule): the guests pick ANY ONE,
 *  everyone else wears one look — main colour + accent. A custom role is a look. */
const meaningOf = (key: string): 'outfit' | 'options' =>
  (PALETTE_LIMITS as Record<string, { meaning: string } | undefined>)[key]?.meaning === 'options' ? 'options' : 'outfit';

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
 * on the Mood Board (/dashboard/[eventId]/studio/mood-board). When every field is empty
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
  guestAttire = null,
  guestNameParts = null,
  march = null,
  rolePalette = null,
  roleNames = null,
  hideWhenEmpty = false,
  part = 'all',
  sceneStyle = null,
  paletteLook = null,
  dosLook = null,
  makerSample = false,
  mark = null,
  guestsArriveBy = null,
  readerOnly = false,
}: {
  /**
   * ⏰ WHEN GUESTS ARRIVE ("2:30 PM", `guestsArriveTime` — owner 2026-10-19): the `'arrive'` part's answer for a reader
   * with no call time of their own role. Null (every other caller) changes nothing.
   */
  guestsArriveBy?: string | null;
  /**
   * 👗 ONLY THIS READER'S OWN CARD (owner 2026-10-19, DECISION_LOG "DRESS WITH US SHOWS ONLY THE GUEST'S OWN ROLE":
   * *"Dress with us should only show their role. and the do's and dont's"*). Set for a guest's or a visitor's page —
   * never every role:
   *   · a listed guest with a role → their own "You are …" panel (the ONE per-person resolver Me › What to wear reads),
   *     plus the Do's & Don'ts;
   *   · a plain guest, a visitor, or a role with nothing picked (after its group's row, `studioRowOf`) → the Guests
   *     card, plus the Do's & Don'ts — never a bare heading; with nothing at all the scene stays hidden.
   * False (default) = every role: the couple and their hosts on their own Event Hub, and the Maker's canvas.
   */
  readerOnly?: boolean;
  /**
   * 🧱 WHAT TO WEAR'S OWN LOOK (`lib/block-looks.ts`, block `look`): the block's hidden mark, drawn right BEFORE this
   * widget's root — and only for the reader's own panel (`'you'` on Welcome, `'wear'` in Me), and only when that
   * panel is drawn. A reader with nothing personal gets no panel and no mark, so the mark never points at the part
   * after it. Null (every other caller) draws nothing.
   */
  mark?: ReactNode;
  /**
   * 🧾 HOW THE DO'S & DON'TS ARE DRAWN (owner 2026-10-08) — `canvas.dos`, resolved (`dosLookOfRow`). Null /
   * `notes` = the shipped two notes, markup unchanged; the others are `dress-code-dos.tsx`. Every layout and the
   * reader's own panel follow it.
   */
  dosLook?: DosLookId | null;
  /**
   * 🔲 THE MAKER'S CANVAS ONLY (owner 08 Oct: *"maybe show what it could look like with boxes?"*): while the
   * couple has given this scene nothing — or no colours — its look is drawn in sample shapes
   * (`maker-scene-samples.tsx`): the layout picked, and "Our colours" in the palette look picked, in greys.
   * Never set for a guest (both dispatchers pass `!guestView`); `[data-maker-sample]` is also hidden by
   * `globals.css` on any page without a Maker marker.
   */
  makerSample?: boolean;
  /**
   * 🏠 WHICH HALF (owner 2026-09-30, DECISION_LOG "THE INVITATION'S HOME IS THE
   * GUEST'S OWN PAGE"). `'you'` is the Welcome page's: only this reader's own
   * look — the "You are …" block and the Do's & Don'ts — and NOTHING when there
   * is nothing personal to say (the everyone view stays on Details). `'all'`
   * (default) is the section as it has always been.
   *
   * 👤 `'role'` · `'wear'` · `'arrive'` — three of the four FOR-EACH-GUEST parts
   * on Invitation › Me (owner 2026-10-06: *"they will have their own elements
   * per custom part for each guest"*; `lib/guest-me-parts.ts`). Each is ONE fact
   * of the same resolved "you" panel this widget already draws, under its own
   * heading — Your role · What to wear · Arrive by — and NOTHING when that fact
   * is not set (never a default style, never "to be confirmed").
   */
  part?: 'all' | 'you' | 'role' | 'wear' | 'arrive';
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
  /**
   * 👗 What the couple marked this guest as wearing on their guest list (`guests.attire`: gown · suit · neutral) — the
   * only word the product holds for which of a role's two picks is theirs (owner 2026-10-14: men and women each have
   * their own). Unknown → the reader is shown both picks.
   */
  guestAttire?: GuestAttire | null;
  /** 👪 The reader's typed title / shown name and their "Atty. (Woman)" pick (`guests.gender`) — with `guestAttire`, what
   *  names a parent per person ("Mother of the Groom", `kinWordOfReader`) and which column of a two-pick row is theirs
   *  (`readerAttire`): gender → title → attire, `womanOrManOf`. */
  guestNameParts?: GuestNameParts | null;
  /** The couple's mood board (`events.role_palette`, raw — sanitised here) —
   *  "Our colours" and every colour a role wears come from here. */
  rolePalette?: unknown;
  /** The couple's words for roles (`events.role_names`, owner 2026-09-30) —
   *  "You are Bride's Crew", and every row this scene names. */
  roleNames?: RoleNames | null;
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
  const dosIn: DosLookId = dosLook ?? DOS_LOOK_DEFAULT;
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
  // 👗 THE OUTFIT FIGURE IS THE COUPLE'S TO TURN OFF (owner 2026-09-30: "they
  // can opt not to add this"). Only an explicit `false` hides it — a config
  // saved before the switch existed has no key and keeps today's look. Off
  // hides BOTH figures (the reader's own panel and every role row); the chips,
  // the words and the lists are untouched.
  const showFigure = config?.show_figure !== false;
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
    isDressableRole,
  );
  const groups = sanitizeGroupAttire((config as { groups?: unknown } | null)?.groups);
  // THE GENERAL VIEW — "our theme and the palettes of each role" — read from the Studio's own rows and people
  // (`dressCodeForEveryone`: `ATTIRE_ROWS` + `picksOf`, 2026-10-17 "ONE FACT").
  const everyone = dressCodeForEveryone({ config, stored, board, ceremonyType, names: roleNames });
  /* 👗 A guest's page draws no role but the Guests' (owner 2026-10-19) — the reader's own role is their panel below. */
  const shownRows = readerOnly ? everyone.rows.filter((r) => r.tier === 'roles' && r.rowKey === 'guest') : everyone.rows;
  const generalHasContent = shownRows.length > 0;
  // THE SPECIFIC VIEW — "if there is an account specified to this, show their
  // palette only". A panel that could only name the role stands down for the
  // general view (`speaksToThisReader`).
  // 🪞 Their colours are their Studio row's (`studioRowOf` — a maid of honor wears the Bridesmaids row the couple
  // dressed, never an older palette key the Studio no longer shows).
  // 👯 An honour attendant wears their own row's colours once the couple picked their Wear there (2026-10-19).
  const readerRowKey = studioRowOf(guestRole, (config as Record<string, unknown> | null) ?? null)?.paletteKey ?? null;
  const readerRowHexes = readerRowKey ? (board[readerRowKey] ?? []).filter((h) => typeof h === 'string' && h.length > 0) : [];
  const withRowColours = <T extends { panel: { hexes: string[]; hex: string | null } | null }>(r: T): T =>
    r.panel && readerRowHexes.length > 0 ? { ...r, panel: { ...r.panel, hexes: [...readerRowHexes], hex: readerRowHexes[0] ?? null } } : r;
  /* 👗 THE READER'S OWN PICK (owner 2026-10-14): from a group with two picks (men · women, boys · girls), theirs — or
     both, named, when the page cannot tell which they are. Their colours and their person follow the same pick.
     🪞 Read BEFORE the panel may stand down (2026-10-17): a ninang whose couple picked only the women's Wear has a
     Wear to be told, though her row's first column says nothing. */
  type Resolved = ReturnType<typeof resolveGuestAttireWithGroups>;
  const readerDress = (panel: NonNullable<Resolved['panel']>, source: Resolved['source']) =>
    readerAttire({
      role: guestRole,
      attire: guestAttire,
      person: guestNameParts ?? null,
      source,
      config: config as Record<string, unknown> | null,
      style: panel.style,
      hexes: panel.hexes,
      label: (st) => ATTIRE_STYLE_LABEL[st],
      single: singleWearerOf,
    });
  const withOwnStyle = (r: Resolved): Resolved => {
    if (!r.panel || r.panel.style) return r;
    const own = readerDress(r.panel, r.source).picks.find((p) => p.style)?.style ?? null;
    return own ? { ...r, panel: { ...r.panel, style: own } } : r;
  };
  /* ⛔ NOTHING PICKED, NOTHING SHOWN (2026-10-17) — on a guest's page the reader's panel stands only when their Studio
     row (their own, else their group's — `studioRowOf`) is one the general view lists for THEIR person, or it holds
     their call time. Otherwise they read the Guests card: never a panel of colours nobody picked. */
  const readerRow = studioRowOf(guestRole, (config as Record<string, unknown> | null) ?? null);
  const listedRow = readerRow ? everyone.rows.find((r) => r.tier === readerRow.tier && r.rowKey === readerRow.key) ?? null : null;
  const standsOnAGuestsPage = (r: Resolved): Resolved => {
    if (!readerOnly || !r.panel || r.panel.callTime !== null) return r;
    const listed = listedRow
      ? !isTwoPick(readerRow) || readerDress(r.panel, r.source).picks.some((p) => listedRow.picks.some((lp) => lp.who === p.who))
      : false;
    return listed ? r : { ...r, panel: null, source: null };
  };
  const resolved = standsOnAGuestsPage(speaksToThisReader(withOwnStyle(withRowColours(resolveGuestAttireWithGroups({
    role: guestRole,
    roles,
    groups,
    palette: board,
    names: roleNames,
    person: guestRole ? { ...guestNameParts, gender: guestNameParts?.gender ?? null, attire: guestAttire } : null,
    config,
  }))), readerOnly || generalHasContent));
  const mineDress = resolved.panel ? readerDress(resolved.panel, resolved.source) : null;
  const mine = resolved.panel && mineDress ? { ...resolved.panel, styleLabel: mineDress.styleLabel, hexes: mineDress.hexes } : resolved.panel;
  /* 👗 A person is drawn only in a Wear that was picked (owner 2026-10-17: "if … nothing is picked, then nothing should
     show") — never a plain gown or suit assumed for them; their colours still show, each said by what it colours. */
  const mineWears = Boolean(mineDress?.picks.some((p) => p.style));
  /* 🏷 The reader's colours, each said by what it colours (`pickDots`, the Studio's words) — per person when the page
     shows them both (it cannot tell which they are). */
  const mineDots: Array<{ label: string | null; dots: EveryoneDot[] }> = mine
    ? (mineDress?.picks.length ? mineDress.picks : ([{ who: 'f', style: null, colours: null, role: null }] satisfies ReaderPick[])).map((p: ReaderPick, _i: number, all: readonly ReaderPick[]) => ({
        label: all.length > 1 ? PICK_LABEL[p.who] : null,
        dots: pickDots(p.style, p.colours && p.colours.length > 0 ? p.colours : mine.hexes, p.role),
      }))
    : [];
  // Said only when the answer came from the group, so a reader knows the couple
  // dressed her whole group and did not overlook her.
  const mineFromGroup = resolved.source === 'group' ? groupLabelOf(guestRole, roleNames) : null;
  // A host reading their own page (the couple, or a debut's celebrant): the
  // unset outfit is theirs to add, not something someone else owes them.
  const readerIsHost = guestRole !== null && ['couple', 'honoree'].includes(roleGroupOf(guestRole));
  /* 👗 THE READER'S OWN LOOK — their figure, then their colours: one drawing for the Welcome's "you" panel and Me's
     "What to wear".
     🎨 THEIR PALETTE, ALL OF IT (owner 2026-09-28: "show their palette only"). It used to be `mine.hex` — the role's
     FIRST colour — so a bridesmaid whose board holds three was shown one.
     👗 THE PERSON IN YOUR COLOURS (owner 2026-09-27, "an illustrated person in the exact role colours"): a ninang sees
     a woman in her colours, a groomsman a man — drawn from the same hexes as the chips.
     🧍 ONE LOOK, CENTRED (owner 2026-10-18, *"dresscode should also adapt center like wedding march"*): a reader with
     one look — not both of a role's picks — has their figure centred and their colours centred under it, as a lone
     row of the general view is. Two looks keep the shipped drawing. */
  const mineFigure =
    mine && showFigure && mine.hexes.length > 0 && guestRole && mineWears ? (
      <RoleFigure
        roleKey={guestRole}
        hexes={mine.hexes}
        meaning={meaningOf(paletteKeyForRole(guestRole) as PaletteKey)}
        picks={mineDress?.picks.filter((p) => p.style) ?? null}
        className="h-28 w-auto"
      />
    ) : null;
  const mineColours = mine && mine.hexes.length > 0;
  const mineLone = mineDots.length === 1;
  const mineLook =
    mineLone && (mineFigure || mineColours) ? (
      <div className="flex flex-col items-center gap-3 text-center" data-dress-code-lone="">
        {mineFigure}
        {mineColours ? <YourColours groups={mineDots} look={look} centre /> : null}
      </div>
    ) : (
      <>
        {mineFigure}
        {mineColours ? <YourColours groups={mineDots} look={look} /> : null}
      </>
    );

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

  // 🏠 The Welcome page's half says only what is this reader's own — or nothing.
  if (part === 'you' && !mine && !march) return null;

  /* 🚶 WHERE YOU WALK — one drawing, under "You are …" here and under Me's "Your role". */
  const marchLine = march ? (
    <p className="text-base leading-snug text-ink" data-dress-code="march">
      {marchPlaceLine(march)}
    </p>
  ) : null;

  /* 👤 THE FOR-EACH-GUEST PARTS — one fact each, from the SAME `mine` (owner
     2026-10-06). A part whose fact is unset draws nothing. */
  if (part === 'role') {
    const named = mine?.roleLabel ?? (guestRole && guestRole !== 'guest' ? (roleLabel(guestRole, roleNames) ?? guestRoleLabel(guestRole, roleNames)) : null);
    if (!named) return null;
    return (
      <section className="space-y-2" data-me-part="role">
        <p className="pahina-eyebrow">
          <span>Your role</span>
        </p>
        <p className="font-pahina text-2xl font-light leading-snug tracking-tight text-ink">{named}</p>
        {marchLine}
        {/* 🫵 Their marked name in the entourage, one tap away (owner 2026-10-17) — drawn only when it is on the page. */}
        <SeeWhereYouAre />
      </section>
    );
  }
  if (part === 'arrive') {
    /* ⏰ The role's own call time wins; anyone else arrives when GUESTS arrive (owner 2026-10-19 — the dress code's Guests
       call time, which is the invitation's first moment: `lib/guests-arrive.ts`). Neither set → nothing. */
    const arriveBy = mine?.callTime ?? guestsArriveBy ?? null;
    if (!arriveBy) return null;
    return (
      <section className="space-y-2" data-me-part="arrive">
        <p className="pahina-eyebrow">
          <span>Arrive by</span>
        </p>
        <p className="font-pahina text-2xl font-light tracking-tight text-ink">{arriveBy}</p>
      </section>
    );
  }
  if (part === 'wear') {
    if (!mine || (mine.styleLabel === null && mine.hexes.length === 0)) return null;
    return (
      <>
      {mark}
      <section className="space-y-3" data-me-part="wear">
        <p className="pahina-eyebrow">
          <span>What to wear</span>
        </p>
        {mineFromGroup ? (
          <p className="text-xs leading-relaxed text-ink/70">From your hosts&rsquo; note for {mineFromGroup}.</p>
        ) : null}
        {mine.styleLabel ? (
          <p className="font-pahina text-2xl font-light leading-snug tracking-tight text-ink">{mine.styleLabel}</p>
        ) : null}
        {mine.note ? <p className="text-sm leading-relaxed text-ink/70">{mine.note}</p> : null}
        {mineLook}
      </section>
      </>
    );
  }

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
        {makerSample ? <SceneSample sceneType="dress_code" styleId={sceneStyle} paletteLook={look} /> : null}
        {makerSample ? dosSample(dosIn) : null}
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
    /* 🏷 The palette style lists the names under its bands — said by name, never a hex a couple's editor stored as one. */
    /* No "Our colours" in this scene (owner 2026-10-17) — every layout draws the roles' colours only. */
    const general = { title: shownTitle, description: shownDescription, palette: [], rows: shownRows, dos, donts, genderNote, dosLook: dosIn, makerSample };
    return sceneStyle === 'palette' ? <DressCodePalette {...general} /> : <DressCodeLine {...general} />;
  }

  return (
    <>
    {part === 'you' ? mark : null}
    <section className="space-y-5">
      {part === 'you' ? (
        <p className="pahina-eyebrow">
          <span>What to wear</span>
        </p>
      ) : (
      <header className="space-y-2">
        <p className="pahina-eyebrow">
          <span>Dress code</span>
        </p>
        <h3 className="font-pahina text-3xl font-light leading-tight tracking-tight text-ink">
          {shownTitle}
        </h3>
      </header>
      )}
      {shownDescription && part !== 'you' ? (
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
            You are {mine?.roleLabel ?? (guestRole ? (roleLabel(guestRole, roleNames) ?? guestRoleLabel(guestRole, roleNames)) : null) ?? 'in the entourage'}
          </p>
          {/* 🚶 WHERE YOU WALK (owner 2026-09-29) — under the same "You are" line,
              so a walker whose role has no outfit line still reads it. */}
          {marchLine}
          {/* 🫵 Their marked name in the entourage, one tap away (owner 2026-10-17) — drawn only when it is on the page. */}
          <SeeWhereYouAre />
          {mine ? (
          <>
          {/* WHERE THE ANSWER CAME FROM — said only when it came from the group.
              A ninang who reads her group's line needs to know the couple
              dressed her whole group on purpose, not that they wrote something
              for her and it is being shown oddly. Silent provenance is the same
              defect as a silent override, seen from the other side. */}
          {mineFromGroup ? (
            <p className="text-xs leading-relaxed text-ink/70">
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
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-ink/70">
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
              <p className="text-sm leading-relaxed text-ink/65" data-dress-code="unset">
                {readerIsHost ? STYLE_UNSET_LINE_FOR_HOST : STYLE_UNSET_LINE}
              </p>
            )}
            {mine.note ? (
              <p className="text-sm leading-relaxed text-ink/70">{mine.note}</p>
            ) : null}
          </div>
          {/* 🎨 THEIR PALETTE, ALL OF IT, and THE PERSON IN THEIR COLOURS — `mineLook`, above. */}
          {mineLook}
          </>
          ) : null}
        </div>
      ) : null}
      {/* 🚫 NO "OUR COLOURS" IN THIS SCENE (owner 2026-10-17: *"we must ommit the our colors here since we are talking
          about their dress code"*). The event's palette lives on the Mood Board and in Look; this scene is each
          role's figure and colours. The Maker's canvas with nobody dressed yet shows where the rows go, in the
          palette look picked — in greys. Never a guest's. */}
      {makerSample && part === 'all' && !mine && !march && everyone.rows.length === 0 ? (
        <div aria-hidden className="space-y-2" data-dress-code="roles" data-maker-sample={`palette:${look}`}>
          {paletteSample(look)}
        </div>
      ) : null}
      {/* 👥 EVERY ROLE'S COLOURS — the general view's second half. One tidy row
          per role the couple dressed (label + its outfit line on the left, its
          chips on the right, wrapping under on a narrow phone), in the Mood
          Board's own order. Roles with no colours and no outfit are left out
          by `dressCodeForEveryone`, never drawn empty. */}
      {part !== 'you' && !mine && shownRows.length > 0 ? (
        /* 📜 `data-hub-rows`: one role per row, arriving in turn in a "One
           part after another" scene — the run of show's mechanism, not its own. */
        /* 👗 EACH ROLE, PRESENTED BY ITS FIGURE AND ITS COLOURS (owner 2026-10-17: *"dress code must present a better
           way using the image their role and the colors"*). One block per role: its name, then each of its people —
           the role's own drawing (#6589) dressed in their colours, ~144 px tall, their Wear in their own word, and every
           colour in the scene's palette look, each said by what it colours. A role that holds men and women shows both,
           side by side. Nothing picked → not here (`dressCodeForEveryone`). No frames (nothing here is pressed): a
           hairline above each block. One per row on a phone; two across from `sm`, three from `lg`. */
        <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3" data-dress-code="roles" data-hub-rows="">
          {shownRows.map((row) => {
            const options = row.meaning === 'options';
            /* 🧍 ONE LOOK, CENTRED — like a lone person in the wedding march (owner 2026-10-18: *"dresscode should also
               adapt center like wedding march"*; `entourage-section.tsx` `PairRow`, held by
               `lib/a-lone-person-is-centred.test.ts`). A row holding ONE look (a bride, a groom, a crew dressed alike —
               or a guests' row with one option) draws its figure centred, its words and colours stacked under it and
               centred, at the size a pair's column draws them; its heading is centred over it, as the march's default
               look centres a group's heading over a lone walker. Two looks keep their two columns, exactly as before.
               Held by `lib/a-lone-look-in-the-dress-code-is-centred.test.ts`. */
            const lone = row.picks.length === 1;
            const pair = row.picks.length > 1 && !options;
            /* 👔 THE GUESTS' BOARD (owner 2026-10-21, "up to 5 different attires"; prototype
               `attire_five_designs_per_style_2026-10-21.html` § 4): once the hosts allow more than one design in a
               column, the row is a board — the hero pair, one row per allowed style, the colours once at the foot. One
               design per column keeps the row exactly as it shipped. */
            if (options && showFigure && row.picks.some((p) => p.allowed.length > 0 && p.colours.length > 0) && row.picks.some((p) => p.allowed.flatMap((a) => a.designs).length > 1)) {
              return (
                <li key={row.key} className="border-t border-ink/10 py-5 text-center sm:col-span-2 lg:col-span-3" data-role-row={row.key}>
                  <GuestsBoard row={row} look={look} />
                </li>
              );
            }
            return (
              <li key={row.key} className={`space-y-3 border-t border-ink/10 py-5 ${lone ? 'text-center' : ''} ${options ? 'sm:col-span-2 lg:col-span-3' : ''}`} data-role-row={row.key}>
                <p className="text-base font-medium leading-snug text-ink">{row.label}</p>
                {row.note ? <p className="text-xs leading-relaxed text-ink/65">{row.note}</p> : null}
                <div className={lone ? 'flex flex-col items-center' : pair ? 'grid grid-cols-2 gap-x-4 gap-y-4' : options ? 'grid grid-cols-1 gap-4 lg:grid-cols-2' : 'flex flex-col gap-4'} data-dress-code-people={row.picks.length}>
                  {row.picks.map((p) => {
                    const drawn = showFigure && p.style && p.colours.length > 0;
                    const words = (
                      <div className={`min-w-0 space-y-1.5 ${lone ? 'flex flex-col items-center' : ''}`}>
                        {p.label || p.styleLabel ? (
                          <p className="text-sm leading-snug text-ink/75" data-dress-code-pick="">
                            {[p.label, p.styleLabel].filter(Boolean).join(' · ')}
                          </p>
                        ) : null}
                        <RowDots dots={p.dots} look={look} centre={lone} label={`${row.label}${p.label ? ` — ${p.label.toLowerCase()}` : ''} colours`} />
                      </div>
                    );
                    return (
                      <div key={p.who} className={`flex min-w-0 gap-3 ${lone ? 'flex-col items-center text-center' : pair || options ? 'flex-col items-start' : 'items-end'}`} data-dress-code-person={p.who} {...(lone ? { 'data-dress-code-lone': '' } : {})}>
                        {drawn ? (
                          <RoleFigure
                            roleKey={row.key}
                            hexes={p.colours}
                            meaning={row.meaning}
                            picks={[{ who: p.who, style: p.style, colours: p.colours, role: p.role }]}
                            className={options ? 'h-28' : 'h-36'}
                          />
                        ) : null}
                        {words}
                      </div>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {/* 🔲 The Maker's canvas, no list yet: where the Do's & Don'ts will go, in the look picked — in greys. */}
      {makerSample && part === 'all' && dos.length === 0 && donts.length === 0 ? dosSample(dosIn) : null}
      {dosIn !== DOS_LOOK_DEFAULT ? (
        <DressCodeDos dos={dos} donts={donts} look={dosIn} />
      ) : dos.length > 0 || donts.length > 0 ? (
        /* 🧾 The shipped two notes — the default look, exactly as it shipped (`data-dress-code` names the block
           for its look card; nothing a guest sees changes). */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-dress-code="dos">
          {dos.length > 0 ? (
            <div className="space-y-2 border-l-2 border-gild bg-veil/50 p-4 text-sm text-ink/80">
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-gild">Do</p>
              <ul className="space-y-1">
                {dos.map((row, i) => (
                  <li key={i} className={HUB_SCENE_WORDS_CLASS}>· {row}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {donts.length > 0 ? (
            <div className="space-y-2 border-l-2 border-ink/30 bg-paper-deep p-4 text-sm text-ink/75">
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/70">
                Don&rsquo;t
              </p>
              <ul className="space-y-1">
                {donts.map((row, i) => (
                  <li key={i} className={HUB_SCENE_WORDS_CLASS}>· {row}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
      {genderNote && part !== 'you' ? (
        <p className="max-w-prose text-sm font-medium text-ink/75">{genderNote}</p>
      ) : null}
    </section>
    </>
  );
}

/**
 * 👔 THE GUESTS' BOARD (owner 2026-10-21; prototype `attire_five_designs_per_style_2026-10-21.html` § 4). "Any of
 * these": the hero pair (each column's first allowed design, in its first colour), then FOR MEN / FOR WOMEN with one
 * line per allowed style — its designs side by side, each in the next colour in turn (the controller's call on open
 * question 2: "colours in turn"), so a row shows the palette without one figure per colour per design — then the
 * colours once at the foot. Only DRAWN designs reach here (`allowedStyles`). No frames: nothing on it is pressed.
 * Each figure takes the palette by its own zones (`zoneTints`): a guest man's suit wears the colour on the tie over
 * black, a barong its body (pants stay charcoal), smart casual its top (chinos stay khaki), a woman's dress all of it.
 */
function GuestsBoard({ row, look }: { row: EveryoneDressRow; look: PaletteLookId }) {
  const people = row.picks.filter((p) => p.allowed.length > 0 && p.colours.length > 0);
  const sameColours = people.every((p) => p.colours.join() === people[0]!.colours.join());
  const any = (n: number) => (n === 5 ? 'any of five' : n > 1 ? `any of ${n}` : '');
  return (
    <div className="flex flex-col items-center" data-dress-code-board={people.length}>
      <p className="font-serif text-[28px] font-light leading-tight text-ink">{row.label}</p>
      <p className="mt-1.5 font-mono text-[0.68rem] uppercase tracking-[0.2em] text-ink/75">Any of these</p>
      <div className="mt-4 flex items-end justify-center gap-[22px]" data-dress-code-hero="">
        {people.map((p) => {
          const hero = p.allowed[0]!.designs[0]!;
          return (
            <div key={p.who} className="flex flex-col items-center" data-dress-code-hero-person={p.who}>
              <RoleFigure roleKey={row.key} people={[{ who: p.who, garment: hero.art, main: p.colours[0]!, colours: [p.colours[0]!] }]} className="h-[200px]" />
              <p className="mt-1.5 text-[12px] leading-snug text-ink/70">{p.label ? `${p.label} · ` : ''}{hero.label}</p>
            </div>
          );
        })}
      </div>
      {people.map((p) => (
        <div key={p.who} className="mt-[18px] w-full" data-dress-code-gender={p.who}>
          {p.label ? (
            <p className="flex items-center justify-center gap-3 font-mono text-[0.6rem] uppercase tracking-[0.22em] text-ink/75 before:h-px before:w-8 before:bg-gild after:h-px after:w-8 after:bg-gild">{p.label}</p>
          ) : null}
          {p.allowed.map((a) => (
            <div key={a.style} className="mt-3" data-dress-code-style={a.style}>
              <p className="mb-1.5 text-[12.5px] font-semibold text-ink/85">
                {a.label}
                {any(a.designs.length) ? <small className="font-normal text-ink/55"> · {any(a.designs.length)}</small> : null}
              </p>
              <div className="flex items-end justify-center gap-1.5">
                {a.designs.map((d, i) => {
                  const c = p.colours[i % p.colours.length]!;
                  return (
                    <div key={d.id} className="w-16 flex-none text-center" data-dress-code-design={d.id}>
                      <span className="flex justify-center">
                        <RoleFigure roleKey={row.key} people={[{ who: p.who, garment: d.art, main: c, colours: [c] }]} className="h-[104px]" />
                      </span>
                      <p className="mt-1 text-[10.5px] leading-tight text-ink/70">{d.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
      <div className="mt-[18px] flex flex-col items-center gap-2" data-dress-code-board-colours="">
        {(sameColours ? [people[0]!] : people).map((p) => (
          <div key={p.who} className="flex flex-col items-center gap-1">
            {!sameColours && p.label ? <p className="font-mono text-[0.58rem] uppercase tracking-[0.2em] text-ink/60">{p.label}</p> : null}
            <RowDots dots={p.colours.map((hex) => ({ hex, word: '' }))} look={look} centre label={`${row.label}${!sameColours && p.label ? ` — ${p.label.toLowerCase()}` : ''} colours`} />
          </div>
        ))}
        <p className="text-[12.5px] text-ink/70">Wear any one of these colours, in any of the outfits above.</p>
      </div>
    </div>
  );
}

/** 🏷 A PERSON'S COLOURS AT ROW SIZE, each said by what it colours — the scene's palette look (Tags = the shipped
 *  chips), the words in one key line under them (`DotWords`). */
function RowDots({ dots, look, label, centre = false }: { dots: readonly EveryoneDot[]; look: PaletteLookId; label: string; centre?: boolean }) {
  if (dots.length === 0) return null;
  const items = dots.map((d) => ({ hex: d.hex, name: d.word }));
  /* `centre`: a lone look — its colours and their words centred under its figure. */
  if (look !== 'tags') return <PaletteLookList look={look} size="row" items={items} label={label} words centre={centre} />;
  return (
    <span className={`inline-flex flex-col gap-1 ${centre ? 'items-center' : 'items-start'}`}>
      <ul className={`flex flex-wrap gap-1.5 ${centre ? 'justify-center' : ''}`} aria-label={label}>
        {items.map((it, i) => (
          <li key={`${it.hex}-${i}`} title={it.name}>
            <span aria-hidden className={ROW_SWATCH} style={{ backgroundColor: it.hex }} />
            <span className="sr-only">{it.name}</span>
          </li>
        ))}
      </ul>
      <DotWords items={items} centre={centre} />
    </span>
  );
}

/** 🎨 THE READER'S OWN COLOURS — every colour their role wears, in the scene's palette look (Tags = the shipped
 *  chips), each said by WHAT IT COLOURS (owner 2026-10-17) — per person when both are shown. One drawing for the
 *  Welcome's "you" panel and Me's "What to wear". */
function YourColours({ groups, look, centre = false }: { groups: ReadonlyArray<{ label: string | null; dots: readonly EveryoneDot[] }>; look: PaletteLookId; centre?: boolean }) {
  return (
    <div className={centre ? 'w-full space-y-3' : 'space-y-3'} data-your-colours="">
      {groups.map((g, gi) =>
        g.dots.length === 0 ? null : (
          <div key={gi} className="space-y-1.5">
            {g.label ? <p className="text-xs leading-relaxed text-ink/65">{g.label}</p> : null}
            {look !== 'tags' ? (
              <PaletteLookList look={look} items={g.dots.map((d) => ({ hex: d.hex, name: d.word }))} label={g.label ? `Your colours — ${g.label.toLowerCase()}` : 'Your colours'} />
            ) : (
              <ul className={`flex flex-wrap gap-2 ${centre ? 'justify-center' : ''}`} aria-label={g.label ? `Your colours — ${g.label.toLowerCase()}` : 'Your colours'}>
                {g.dots.map((d, i) => (
                  <li key={`${d.hex}-${i}`} className="w-[3.25rem]">
                    <span aria-hidden className={`pahina-swatch ${SWATCH_EDGE}`} style={{ backgroundColor: d.hex }} />
                    <span className={`mt-2 block text-center font-mono text-[0.75rem] uppercase leading-tight tracking-[0.06em] text-ink/70 ${HUB_SCENE_WORDS_CLASS}`}>
                      {d.word}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ),
      )}
    </div>
  );
}
