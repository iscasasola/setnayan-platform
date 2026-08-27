'use client';

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AlertCircle,
  Check,
  ChevronRight,
  ImageIcon,
  Pencil,
  Sparkles,
  Users,
  X,
} from 'lucide-react';

import { Field } from '@/app/_components/forms/field';
import { SubmitButton } from '@/app/_components/submit-button';
import { FileUpload } from '@/app/_components/file-upload';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { allowedEventOptions, droppedEventTypes } from '@/lib/coverage-allowed-events';
import { packageAuthoringEnabled } from '@/lib/package-authoring-flag';
import { parseCustomizationDraft } from '@/lib/service-customization-draft';
import {
  cardHealthLinesFromDraft,
  scoreCardHealth,
  type CardHealthSheet,
  type CardHealthSnapshot,
} from '@/lib/card-health';
import {
  EMPTY_CANVAS_SNAPSHOT,
  canvasSnapshotKey,
  readCanvasFormSnapshot,
  type CanvasFormSnapshot,
} from '@/lib/canvas-form-snapshot';
import { audienceGroups, type AudienceOption } from '@/lib/canvas-audience-groups';
import type { CanvasInitial } from '@/lib/canvas-initial';
import { clipPillLabel } from '@/lib/clip-duration-label';
import { coverageServesKey } from '@/lib/coverage-serves-key';

export type { AudienceOption };

import { PricingBasisEditor, IncludedFlags } from './pricing-basis-editor';
import {
  InclusionsEditor,
  DiscountsEditor,
  PriceBracketsEditor,
} from './service-list-editors';
import { ShowcaseMediaFields } from './showcase-media-fields';
import { CustomizationStep } from './customization-step';
import { commitVendorService } from '../actions';
import {
  updateCoverageServesInPlace,
  type CoverageServesResult,
} from '../coverage-actions';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CANVAS MAKER — "THE MAKER IS ZERO STEPS. THE CARD IS THE FORM."
 * (owner-locked 2026-07-27 · DECISION_LOG · artifact 15007a4d)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The vendor is shown THEIR OWN CARD — the thing couples will see — and edits
 * it by touching it. Each region opens a small bottom sheet and the card
 * visibly updates behind it. There is no step sequence, no Back/Continue, no
 * progress bar. The design lineage is 7 steps → 4 → 0, and every collapse
 * removed NAVIGATION, never content: everything the 6-step wizard could author,
 * this authors.
 *
 * ── WHAT IS ACTUALLY NEW HERE (the delta, and only the delta) ──────────────
 * COMPOSITION, plus two small pieces of chrome. Nothing about what gets saved
 * is new:
 *
 *   reused verbatim   ServiceWizard's one-form mechanics · FileUpload (+ its
 *                     watermark / compressImage / qrGuard) · ShowcaseMediaFields ·
 *                     PricingBasisEditor + IncludedFlags · PriceBracketsEditor ·
 *                     InclusionsEditor · DiscountsEditor · CustomizationStep
 *                     (the #3846 merged editor) · Field · SubmitButton ·
 *                     useModalA11y · the coverage chips from coverage-panel.tsx
 *   genuinely new     the CanvasSheet container, the card face itself, and the
 *                     card-health meter + one-line coach (lib/card-health.ts).
 *
 * ── THE CONSTRAINT THAT SHAPES EVERY LINE BELOW ───────────────────────────
 * THE SERVER DOES NOT CHANGE. This is one `<form action={commitVendorService}>`
 * carrying the EXACT field names the wizard carries — nothing added, nothing
 * renamed, nothing dropped. `commitVendorService` cannot tell which component
 * drew the screen. Two consequences you must preserve when editing this file:
 *
 *   1. SHEETS ARE NOT MODALS THAT UNMOUNT. Every sheet stays mounted and is
 *      hidden with the `hidden` attribute — exactly the wizard's `show()`
 *      mechanic. A `hidden` input still posts; an UNMOUNTED one does not, so
 *      unmounting a closed sheet would silently drop whatever the vendor typed
 *      in it. (This is also why the shipped <Sheet> primitive, which returns
 *      null when closed, is deliberately NOT used here.)
 *   2. NO NEW FIELD NAMES. lib/canvas-field-parity.test.ts fails the build if
 *      this component's input-name set ever diverges from the wizard's.
 *
 * The audience chips are the one thing that cannot ride this form — the event
 * types / faiths a card is discovered by live on `vendor_coverages`, which is
 * written by a DIFFERENT shipped action (`updateCoverageServes`). They are
 * therefore a SIBLING form, never a nested one (see
 * scripts/lint-nested-forms.mjs for what nesting one would cost), and the
 * parity scanner is told to skip exactly that block.
 */

type OtherCategory = { value: string; label: string };
/**
 * The kinds of service a shop can make a card for, in the SAME groups and with
 * the SAME live taxonomy labels as My Shop's picker — one list, drawn twice.
 */
export type CategoryChoice = OtherCategory & {
  /**
   * 'covered' — a family this shop already works in · 'open' — a new family its
   * plan still has room for · 'locked' — the save would refuse it.
   *
   * 🔑 THE STANDING IS DECIDED BY THE SAME FUNCTIONS THE SAVE ENFORCES
   * (`lib/vendor-category-parents.ts`), never re-derived here — a second copy of
   * a permission rule drifts, and the copy on the screen would be the
   * optimistic one.
   */
  standing: 'covered' | 'open' | 'locked';
  /** Why it is refused, in the vendor's own words. Only on 'locked'. */
  why?: string;
};
export type CategoryGroup = { key: string; label: string; options: CategoryChoice[] };
export type CoverageAudience = { eventTypes: string[]; faiths: string[] };

type SheetKey = 'media' | 'price' | 'excl' | 'custom' | 'audience' | 'kind';

/** Where a card-health finding sends the vendor. 'title' is inline on the card. */
const SHEET_FOR_FINDING: Record<CardHealthSheet, SheetKey | 'title'> = {
  media: 'media',
  price: 'price',
  excl: 'excl',
  custom: 'custom',
  audience: 'audience',
  title: 'title',
};

const line = 'var(--m-line)';
const paper = 'var(--m-paper)';

// ════════════════════════════════════════════════════════════════════════════
// The canvas
// ════════════════════════════════════════════════════════════════════════════

export function CanvasMaker({
  categoryValue,
  categoryLabel,
  otherCategories,
  coverages = [],
  vendorProfileId,
  claimToken = null,
  eventTypeOptions = [],
  faithOptions = [],
  coverageAudience = {},
  coverageAllowed = {},
  initial = null,
  categoryOptions = [],
}: {
  categoryValue: string;
  categoryLabel: string;
  otherCategories: OtherCategory[];
  coverages?: { id: number; label: string }[];
  vendorProfileId: string;
  /** PR-C claim passthrough — identical contract to <ServiceWizard>. */
  claimToken?: string | null;
  /** Live `event_type_vocab`, for the audience sheet. Empty = section hidden. */
  eventTypeOptions?: AudienceOption[];
  /** FAITH_REGISTRY, for the audience sheet. */
  faithOptions?: AudienceOption[];
  /** coverage id → its CURRENT event_types / faiths, so the chips open truthful. */
  coverageAudience?: Record<number, CoverageAudience>;
  /**
   * coverage id → the leaf's allowed event types (null/empty = unrestricted).
   * Chips render only inside this set — it is the SAME set the server enforces
   * on save, so a chip is never checkable-then-silently-dropped. Missing id
   * (or a failed taxonomy read upstream) = null = full vocab, the fail-soft.
   */
  coverageAllowed?: Record<number, string[] | null>;
  /**
   * "Start from one of your cards" — everything the vendor already AUTHORED on
   * an existing card, read server-side (lib/vendor-card-copy.ts). `null` is a
   * blank maker, which is every other entry into this screen.
   *
   * 🔑 A SEED IS NOT A LINK. Nothing here ties the new card to the old one: the
   * form posts the identical field set either way, so `commitVendorService`
   * cannot tell a copy from a first draft and the source card keeps ALL of its
   * history — bookings, record, event assignments (owner 2026-07-28, "events
   * created for that card stay on that card").
   */
  initial?: CanvasInitial | null;
  /**
   * ─── THE KIND OF SERVICE IS A FIELD ON THE CARD (owner 2026-08-28) ────────
   *
   * Owner, on "+ Create service card": *"i just bounces to a page for a link to
   * service card. we want it to directly go to a page to create a service
   * card."* So `/vendor-dashboard/services/new` opens THIS with no category
   * chosen and hands in the whole list — the vendor picks the kind here, on the
   * card, the way they pick the price and the audience.
   *
   * ⚠ EMPTY IS THE NORMAL CASE, NOT A DEGRADED ONE. `/services/new/[category]`
   * takes the category from its route and passes NO options, so that screen is
   * byte-identical to before: no kind region, no kind sheet, nothing to choose.
   * A guard pins both halves.
   */
  categoryOptions?: CategoryGroup[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const [sheet, setSheet] = useState<SheetKey | null>(null);
  /**
   * 🔑 THE POSTED CATEGORY IS STATE, NOT THE PROP. It is one hidden input under
   * its shipped name either way, so `commitVendorService` cannot tell which
   * screen chose it — the same contract every other region on this card keeps.
   */
  const allChoices = useMemo(
    () => categoryOptions.flatMap((g) => g.options),
    [categoryOptions],
  );
  const coveredChoices = useMemo(
    () => allChoices.filter((o) => o.standing === 'covered'),
    [allChoices],
  );
  /**
   * The one sentence explaining every greyed kind. One line, not one per pill:
   * a shop on a one-family plan would otherwise read the same upgrade sentence
   * twenty-odd times, which is the bombardment this change exists to remove.
   */
  const lockedWhy = useMemo(
    () => allChoices.find((o) => o.standing === 'locked' && o.why)?.why ?? null,
    [allChoices],
  );
  /**
   * ⚡ A ONE-TRADE SHOP IS ASKED NOTHING. If the whole shop covers exactly one
   * kind, that IS the answer — pre-picking it keeps the maker at zero steps for
   * the commonest case instead of opening with a question that has one button.
   * It stays editable: the region is still there and still opens the sheet.
   */
  const [category, setCategory] = useState(
    categoryValue || (coveredChoices.length === 1 ? (coveredChoices[0]?.value ?? '') : ''),
  );
  const canChooseKind = categoryOptions.length > 0;
  const activeCategoryLabel =
    categoryOptions
      .flatMap((g) => g.options)
      .find((o) => o.value === category)?.label ??
    (category === categoryValue ? categoryLabel : category);
  /**
   * "Comes with" bundles the shop's OTHER cards, so the kind this card IS has
   * to drop out of that list the moment it is chosen — otherwise the vendor is
   * offered a card that comes bundled with itself.
   */
  const otherCategoriesShown = useMemo(
    () => otherCategories.filter((c) => c.value !== category),
    [otherCategories, category],
  );
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [perk, setPerk] = useState(initial?.exclusivePerkText ?? '');
  const [snap, setSnap] = useState<CanvasFormSnapshot>(EMPTY_CANVAS_SNAPSHOT);
  /**
   * How long the picked clip is, in seconds — `null` while unknown.
   *
   * NOT part of the form snapshot, because it is not a form field: it is a
   * measurement of a LOCAL file, taken by the picker's own validator, and the
   * server has no use for it (see ShowcaseMediaFields.onClipDurationSeconds).
   * Keeping it out of the wire also keeps the canvas's input-name set identical
   * to the wizard's, which lib/canvas-field-parity.test.ts pins.
   */
  const [clipSeconds, setClipSeconds] = useState<number | null>(null);
  // Stable identity: the picker memoises its validator on this callback, and a
  // fresh function every render would rebuild the validator every render.
  const onClipDurationSeconds = useCallback((s: number | null) => setClipSeconds(s), []);

  // Which coverage this card sits in. The PICKER lives in the audience sheet
  // (it decides who finds the card), but the FIELD stays on the main form as a
  // hidden input under its shipped name — same value, same server contract.
  const [coverageId, setCoverageId] = useState<string>(initial?.coverageId ?? '');
  const selectedCoverage = coverageId ? Number(coverageId) : null;

  const [events, setEvents] = useState<string[]>([]);
  const [faiths, setFaiths] = useState<string[]>([]);
  // Re-seed the chips when the vendor moves the card to another coverage —
  // showing coverage A's audience while pointed at coverage B would be a lie.
  const seededFor = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    if (seededFor.current === selectedCoverage) return;
    seededFor.current = selectedCoverage;
    const next =
      selectedCoverage != null
        ? (coverageAudience[selectedCoverage] ?? { eventTypes: [], faiths: [] })
        : { eventTypes: [], faiths: [] };
    setEvents(next.eventTypes);
    setFaiths(next.faiths);
  }, [selectedCoverage, coverageAudience]);

  // The chips the selected coverage may actually render (see coverageAllowed
  // above), the saved keys the server would drop on save (admin narrowed the
  // leaf after the row was saved — disclose, don't silently strip), and a
  // label lookup for that disclosure.
  const selectedAllowed =
    selectedCoverage != null ? (coverageAllowed[selectedCoverage] ?? null) : null;
  const audienceOptions = useMemo(
    () => allowedEventOptions(eventTypeOptions, selectedAllowed),
    [eventTypeOptions, selectedAllowed],
  );
  const droppedKeys = useMemo(
    () =>
      selectedCoverage != null
        ? droppedEventTypes(
            (coverageAudience[selectedCoverage] ?? { eventTypes: [] }).eventTypes,
            selectedAllowed,
          )
        : [],
    [selectedCoverage, coverageAudience, selectedAllowed],
  );
  const eventTypeLabel = useMemo(() => {
    const m = new Map(eventTypeOptions.map((e) => [e.key, e.label]));
    return (k: string) => m.get(k) ?? k;
  }, [eventTypeOptions]);

  /**
   * SAVING "WHO IT’S FOR" MUST NOT COST THE VENDOR THE CARD.
   *
   * The audience write lands on `vendor_coverages`, so it is a sibling form —
   * and until now it used the action that ends in `redirect('/vendor-dashboard/
   * services')`. Pressing Save mid-build therefore threw away everything not yet
   * posted: the title, the price, the inclusions, the customization draft, the
   * photos already uploaded. The sheet WARNED about it, which is not a fix.
   * `useActionState` keeps the vendor on their card and reports the outcome
   * here, beside the button that caused it.
   */
  const [audienceState, saveAudience] = useActionState<CoverageServesResult, FormData>(
    updateCoverageServesInPlace,
    { ok: false, message: null, savedKey: null },
  );
  // "Saved" is a claim about a SELECTION, not about a moment. The sheet stays
  // open afterwards, so the note must go the instant the vendor touches another
  // chip — otherwise it sits there confirming an answer nobody saved. The
  // server returns the key of what it STORED; this is the key of what is on
  // screen; the note shows only while they match.
  const audienceSaved =
    audienceState.savedKey !== null &&
    audienceState.savedKey === coverageServesKey(coverageId, events, faiths);

  // ★ Customization ships flag-dark behind the SAME flag the wizard uses, so a
  // canvas and a wizard save carry identical payloads on both settings.
  const customizationEnabled = packageAuthoringEnabled();

  /**
   * THE LIVE READ — the card must move while the vendor types, in every region.
   *
   * Same idiom as the shipped ServiceCardLivePreview, with two additions the
   * canvas needs because the card is the ONLY preview there is:
   *
   *   • `click`, deferred a tick. The basis picker and the unit toggles are
   *     `<button type="button">`s that write React-CONTROLLED hidden inputs —
   *     no `input`/`change` event ever fires, and reading during the click
   *     handler would read the value from BEFORE React committed. A `setTimeout
   *     0` lands after the commit, so switching Fixed → Per hour repaints the
   *     price line immediately instead of up to a poll away.
   *   • a NO-OP BAIL. The poll exists for the controlled hidden inputs
   *     (FileUpload, the list editors, the customization draft), which fire no
   *     DOM event — but calling setState with a fresh object every tick would
   *     re-render the whole tree, including the editor the vendor is typing
   *     into, several times a second for nothing. Comparing the snapshot key
   *     first makes an unchanged tick cost one FormData read and no render.
   *
   * Focus is safe either way: every field inside a sheet is UNCONTROLLED
   * (`defaultValue`), so a parent re-render reconciles the same DOM node and
   * leaves the caret alone. Only the card's own title and the Exclusive are
   * controlled, and those are edited on the card face itself.
   */
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    let lastKey = '';
    let deferred: ReturnType<typeof setTimeout> | null = null;
    const read = () => {
      try {
        const next = readCanvasFormSnapshot(new FormData(form));
        const key = canvasSnapshotKey(next);
        if (key === lastKey) return;
        lastKey = key;
        setSnap(next);
      } catch {
        /* a mid-render read must never break the form */
      }
    };
    const readAfterCommit = () => {
      if (deferred) clearTimeout(deferred);
      deferred = setTimeout(read, 0);
    };
    read();
    form.addEventListener('input', read);
    form.addEventListener('change', read);
    form.addEventListener('click', readAfterCommit);
    const tick = setInterval(read, 400);
    return () => {
      form.removeEventListener('input', read);
      form.removeEventListener('change', read);
      form.removeEventListener('click', readAfterCommit);
      if (deferred) clearTimeout(deferred);
      clearInterval(tick);
    };
  }, []);

  const customizationLines = useMemo(() => {
    const parsed = parseCustomizationDraft(snap.customizationRaw);
    return parsed.ok ? cardHealthLinesFromDraft(parsed.items) : [];
  }, [snap.customizationRaw]);

  const healthSnapshot: CardHealthSnapshot = {
    hasCover: snap.hasCover,
    photoCount: snap.photoCount,
    hasClip: snap.hasClip,
    hasPrice: snap.hasPrice,
    title,
    exclusiveText: perk,
    // The other half of the real gate — see CardHealthSnapshot.
    inclusionLabels: snap.inclusionLabels,
    discountConditions: snap.discountConditions,
    lines: customizationLines,
    eventTypes: events,
    faiths,
  };
  const health = scoreCardHealth(healthSnapshot);

  /** Everything the card's "What couples get" region shows, in reading order. */
  const comesWith = useMemo(() => {
    const fromLines = customizationLines
      .filter((l) => l.state === 'required' || l.state === 'included')
      .map((l) => l.label.trim())
      .filter((l) => l.length > 0);
    return [...fromLines, ...snap.inclusionLabels];
  }, [customizationLines, snap.inclusionLabels]);

  const audienceLabel = useMemo(() => {
    const byKey = new Map(eventTypeOptions.map((e) => [e.key, e.label]));
    const evs = events.map((k) => byKey.get(k) ?? k);
    const faithByKey = new Map(faithOptions.map((f) => [f.key, f.label]));
    const fa =
      faiths.length === 0 ? 'all faiths' : faiths.map((k) => faithByKey.get(k) ?? k).join(', ');
    if (evs.length === 0) return 'Who is this for?';
    return `${evs.slice(0, 3).join(' · ')}${evs.length > 3 ? ` +${evs.length - 3}` : ''} · ${fa}`;
  }, [events, faiths, eventTypeOptions, faithOptions]);

  /** The coach chip and the diagnostics rows both land here. */
  const goTo = (target: CardHealthSheet | null) => {
    if (target === null) return;
    const key = SHEET_FOR_FINDING[target];
    if (key === 'title') {
      setSheet(null);
      titleRef.current?.focus();
      titleRef.current?.scrollIntoView({ block: 'center' });
      return;
    }
    setSheet(key);
  };

  /**
   * 🔒 NOTHING SAVES WITHOUT A KIND — INCLUDING A DRAFT. `commitVendorService`
   * parses the category on both paths and THROWS on an empty one, so an
   * enabled "Save as draft" here would hand the vendor a raw error for a
   * question the card never asked out loud. Both buttons wait for it.
   */
  const needsCategory = category.length === 0;
  const blocked = health.blockers.length > 0 || needsCategory;

  return (
    <div className="sn-canvas space-y-4">
      {/* ── STARTED FROM ANOTHER CARD ────────────────────────────────────────
          Two facts the vendor needs BEFORE they press anything, and the second
          is the one that would otherwise bite them silently.

          (1) This is a NEW card. The one they copied is untouched — it keeps
              its bookings, its record and its address. Nothing here posts an id.
          (2) The ★ Customization options did NOT come across. They are stored
              against a one-service package that has no link back to the card it
              was minted for, so there is no honest way to find them — and
              guessing by category would attach a DIFFERENT card's options to
              this one. Saying so is the whole point: a copy that quietly loses
              a card's choices is a card published missing what it sells. */}
      {initial ? (
        <div
          className="rounded-xl border p-3 text-sm"
          style={{ borderColor: 'var(--m-orange-3)', background: 'var(--m-orange-4)' }}
        >
          <p style={{ color: 'var(--m-ink)' }}>
            Started from{' '}
            <span className="font-semibold">
              {initial.sourceTitle ?? 'one of your cards'}
            </span>
            . This is a brand-new card — the one you copied keeps its bookings and
            everything it has done.
          </p>
          {initial.sourceWasOtherCategory ? (
            <p className="mt-1 text-xs" style={{ color: 'var(--m-slate-2)' }}>
              You copied it into a different category, so it sits under this one now.
            </p>
          ) : null}
          <p className="mt-1 text-xs" style={{ color: 'var(--m-slate-2)' }}>
            Your options and choices under “What couples get” don’t come across yet —
            add them here.
          </p>
        </div>
      ) : null}
      <form ref={formRef} action={commitVendorService} className="space-y-4">
        <input type="hidden" name="category" value={category} />
        {claimToken ? <input type="hidden" name="claim_token" value={claimToken} /> : null}
        {/* The coverage this card sits in. Chosen in the audience sheet; the
            FIELD lives here under its shipped name so the payload is unchanged. */}
        <input type="hidden" name="coverage_id" value={coverageId} />

        {/* ── THE ONE PROGRESS SURFACE ──────────────────────────────────────
            Owner 2026-07-27, on seeing two bars: there is EXACTLY ONE. The
            sticky header carries the meter, the grade, the item count (which IS
            the expand toggle), the coach chip, and the diagnostics beneath it.
            Nothing health-shaped renders anywhere else on this page. */}
        <HealthHeader
          health={health}
          open={diagnosticsOpen}
          onToggle={() => setDiagnosticsOpen((v) => !v)}
          onGo={goTo}
        />

        {/* ═══ THE CARD — every region is a control ═══════════════════════════ */}
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ borderColor: line, background: paper }}
        >
          {/* Media — a 1:1 cover (owner-locked square, 2026-07-27; the shipped
              FileUpload variant="square" is the canonical picker for it), then
              the 56px showcase strip and the clip pill, which is how the couple
              side reads this card. One control: tapping anywhere opens Photos. */}
          <button
            type="button"
            onClick={() => setSheet('media')}
            aria-label="Edit photos"
            className="block w-full"
          >
            <span className="flex justify-center" style={{ background: 'var(--m-orange-4)' }}>
              <span className="relative flex aspect-square w-full max-w-[280px] flex-col items-center justify-center gap-1 text-sm">
                {snap.hasCover ? (
                  <>
                    <Check aria-hidden className="h-5 w-5" strokeWidth={2} style={{ color: 'var(--m-orange-2)' }} />
                    <span style={{ color: 'var(--m-orange-2)' }}>Cover set — tap to change</span>
                  </>
                ) : (
                  <>
                    <ImageIcon aria-hidden className="h-5 w-5" strokeWidth={1.5} style={{ color: 'var(--m-orange-3)' }} />
                    <span style={{ color: 'var(--m-slate-2)' }}>Add cover photo</span>
                    <span
                      className="font-mono text-[9px] uppercase tracking-[0.12em]"
                      style={{ color: 'var(--m-orange-2)' }}
                    >
                      required
                    </span>
                  </>
                )}
              </span>
            </span>
            {snap.photoCount > 0 || snap.hasClip ? (
              <span className="flex items-center gap-1.5 overflow-x-auto px-4 py-2">
                {Array.from({ length: snap.photoCount }).map((_, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-lg font-mono text-[8px]"
                    style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-deep)' }}
                  >
                    {i + 1}
                  </span>
                ))}
                {snap.hasClip ? (
                  <span
                    className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10px]"
                    style={{ background: 'var(--m-ink)', color: 'var(--m-paper)' }}
                  >
                    {/* The real length when the browser could read it, the word
                        when it could not. Never a fabricated 0:00 — see
                        lib/clip-duration-label.ts. */}
                    ▶ {clipPillLabel(clipSeconds)}
                  </span>
                ) : null}
                <span className="sr-only">
                  {snap.photoCount} showcase photo{snap.photoCount === 1 ? '' : 's'}
                  {snap.hasClip ? ` and a ${clipPillLabel(clipSeconds)} clip` : ''}
                </span>
              </span>
            ) : null}
          </button>

          {/* ── WHAT KIND OF SERVICE THIS IS ─────────────────────────────────
              Only on the no-category entrance (`/services/new`), where nothing
              upstream has answered it. It sits ABOVE the name because it is the
              question the vendor came here with, and because every editor below
              it — pricing basis, what's included, the customization list — is
              drawn for a particular kind of service. */}
          {canChooseKind ? (
            <CardRegion onClick={() => setSheet('kind')} label="Choose what kind of service this is">
              {category ? (
                <span style={{ color: 'var(--m-ink)' }}>{activeCategoryLabel}</span>
              ) : (
                <span className="flex items-center gap-1.5" style={{ color: 'var(--m-orange-2)' }}>
                  <Sparkles aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                  What kind of service is this?
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em]">required</span>
                </span>
              )}
            </CardRegion>
          ) : null}

          {/* Title — edited INLINE on the card, never in a sheet. */}
          <input
            ref={titleRef}
            id="title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            aria-label="Service name"
            placeholder={activeCategoryLabel || "Service name"}
            className="w-full border-0 bg-transparent px-4 pb-1 pt-3 text-[17px] font-semibold tracking-[-0.01em] outline-none placeholder:font-normal"
            style={{ color: 'var(--m-ink)' }}
          />

          <CardRegion onClick={() => setSheet('price')} label="Edit price">
            {snap.hasPrice ? (
              <span style={{ color: 'var(--m-ink)' }}>{snap.priceLine}</span>
            ) : (
              <span style={{ color: 'var(--m-slate-3)' }}>
                Add your price — or leave it as quote-on-request
              </span>
            )}
          </CardRegion>

          <CardRegion onClick={() => setSheet('excl')} label="Edit your Setnayan Exclusive">
            <span className="flex items-center gap-1.5" style={{ color: 'var(--m-orange-2)' }}>
              <Sparkles aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              {perk.trim() ? perk.trim() : 'Add your Setnayan Exclusive'}
            </span>
          </CardRegion>

          <CardRegion onClick={() => setSheet('custom')} label="Edit what couples get">
            {comesWith.length ? (
              <span className="flex flex-wrap gap-x-3 gap-y-1" style={{ color: 'var(--m-slate)' }}>
                {comesWith.slice(0, 3).map((c) => (
                  <span key={c} className="inline-flex items-center gap-1">
                    <Check aria-hidden className="h-3 w-3 shrink-0" strokeWidth={2} style={{ color: 'var(--m-orange-2)' }} />
                    {c}
                  </span>
                ))}
                {comesWith.length > 3 ? (
                  <span style={{ color: 'var(--m-orange-2)' }}>+{comesWith.length - 3} more</span>
                ) : null}
              </span>
            ) : (
              <span style={{ color: 'var(--m-slate-3)' }}>
                What couples get — inclusions, choices, add-ons
              </span>
            )}
          </CardRegion>

          <CardRegion onClick={() => setSheet('audience')} label="Edit who this is for">
            <span className="flex items-center gap-1.5" style={{ color: 'var(--m-slate)' }}>
              <Users aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              {audienceLabel}
            </span>
          </CardRegion>
        </div>

        {/* Comes with — bundles the vendor's OTHER cards. Only when they have
            some; the couple reads it straight off the card. */}
        {otherCategoriesShown.length > 0 ? (
          <details className="rounded-xl border" style={{ borderColor: line, background: paper }}>
            <summary className="cursor-pointer select-none px-3 py-2.5 text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
              Comes with{snap.linkedCount > 0 ? ` · ${snap.linkedCount}` : ''}
            </summary>
            <div className="space-y-1.5 border-t px-3 pb-3 pt-3" style={{ borderColor: line }}>
              <p className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
                Other things you offer that come bundled with this one. Up to 6.
              </p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {otherCategoriesShown.map((c) => (
                  <label
                    key={c.value}
                    className="flex min-h-[38px] items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: line, color: 'var(--m-slate)' }}
                  >
                    <input
                      type="checkbox"
                      name="linked"
                      value={c.value}
                      defaultChecked={initial?.linkedCategories.includes(c.value) ?? false}
                      className="h-4 w-4 accent-terracotta"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
          </details>
        ) : null}

        {/* ── Recap + publish. NO meter, NO second guidance line — the sticky
            header is the only progress surface (owner 2026-07-27). ────────── */}
        <dl className="space-y-1.5 rounded-xl border p-3 text-sm" style={{ borderColor: line, background: paper }}>
          <Recap k="Category" v={activeCategoryLabel || '— not chosen yet'} />
          <Recap k="Cover photo" v={snap.hasCover ? 'Added' : '— none yet'} />
          <Recap k="Setnayan Exclusive" v={perk.trim() ? 'Set' : '— not set'} />
          <Recap
            k="What couples get"
            v={
              comesWith.length
                ? `${comesWith.length} line${comesWith.length === 1 ? '' : 's'}`
                : '— none'
            }
          />
          {snap.linkedCount > 0 ? (
            <Recap k="Comes with" v={`${snap.linkedCount} service${snap.linkedCount === 1 ? '' : 's'}`} />
          ) : null}
        </dl>

        <div className="flex flex-wrap gap-2">
          <SubmitButton
            name="publish"
            value="true"
            disabled={blocked}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full bg-terracotta-700 px-5 py-2.5 text-sm font-semibold text-cream hover:bg-terracotta-800 disabled:opacity-50"
            pendingLabel="Publishing…"
          >
            <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
            Publish service
          </SubmitButton>
          <SubmitButton
            name="publish"
            value="false"
            disabled={needsCategory}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border px-5 py-2.5 text-sm font-medium disabled:opacity-50"
            style={{ borderColor: line, color: 'var(--m-slate)' }}
            pendingLabel="Saving…"
          >
            Save as draft
          </SubmitButton>
        </div>

        {needsCategory ? (
          <p className="text-xs" style={{ color: 'var(--m-orange-2)' }}>
            Tell us what kind of service this is and both buttons open up.
          </p>
        ) : null}

        <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
          Availability is set on your Calendar, and payment terms are agreed in each
          couple&rsquo;s inquiry — so this card stays simple.
        </p>

        {/* ═══ SHEETS — always mounted, `hidden` when closed, so every field
            posts whether or not its sheet was ever opened. ═══════════════════ */}

        {/* ═══ WHAT KIND OF SERVICE ═══════════════════════════════════════
            The same grouped list My Shop's picker draws, from the same live
            taxonomy labels — but it lands ON the card instead of navigating to
            it. Choosing closes the sheet; the card, the pricing basis and the
            customization editor all redraw for the chosen kind. */}
        {canChooseKind ? (
          <CanvasSheet
            id="canvas-kind"
            title="What kind of service?"
            open={sheet === 'kind'}
            onClose={() => setSheet(null)}
            confirmLabel={category ? 'Update card' : null}
          >
            {coveredChoices.length > 0 ? (
              <>
                <p className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
                  What you already do. A kind can hold more than one card, so you can
                  add another where you already work.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {coveredChoices.map((opt) => (
                    <KindPill
                      key={opt.value}
                      opt={opt}
                      on={opt.value === category}
                      onPick={() => {
                        setCategory(opt.value);
                        setSheet(null);
                      }}
                    />
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
                Pick the one this card is for. A kind can hold more than one card, so
                you can add another even where you already work.
              </p>
            )}

            {/* ── EVERYTHING ELSE — NARROWED, NEVER HIDDEN ────────────────────
                A shop legitimately grows (a photographer adding a photo booth),
                so nothing is removed: the rest of the list is one tap away.
                What the plan cannot hold is shown greyed WITH THE REASON, which
                is the whole repair — that refusal used to arrive after the card
                was written, as a redirect that threw the work away. */}
            <details
              className="rounded-xl border"
              style={{ borderColor: line }}
              open={coveredChoices.length === 0}
            >
              <summary
                className="cursor-pointer select-none px-3 py-2.5 text-sm font-medium"
                style={{ color: 'var(--m-ink)' }}
              >
                {coveredChoices.length > 0 ? 'Something else I do' : 'All kinds of service'}
              </summary>
              <div className="space-y-4 border-t px-3 pb-3 pt-3" style={{ borderColor: line }}>
                {categoryOptions.map((group) => {
                  const rest = group.options.filter((o) => o.standing !== 'covered');
                  if (rest.length === 0) return null;
                  return (
                    <div key={group.key} className="space-y-1.5">
                      <p
                        className="font-mono text-[10px] uppercase tracking-[0.15em]"
                        style={{ color: 'var(--m-slate-3)' }}
                      >
                        {group.label}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {rest.map((opt) => (
                          <KindPill
                            key={opt.value}
                            opt={opt}
                            on={opt.value === category}
                            onPick={() => {
                              setCategory(opt.value);
                              setSheet(null);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
                {lockedWhy ? (
                  <p className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
                    {lockedWhy}
                  </p>
                ) : null}
              </div>
            </details>
          </CanvasSheet>
        ) : null}

        <CanvasSheet
          id="canvas-media"
          title="Photos"
          open={sheet === 'media'}
          onClose={() => setSheet(null)}
        >
          <Field
            label="Cover photo"
            htmlFor="primary_photo_r2_key"
            help="The first thing couples see, shown 1:1. PNG, JPEG, or WebP up to 5 MB. Required to publish."
          >
            {/* watermark: owner-locked 2026-07-03 — service COVERS carry the
                SETNAYAN watermark like every other marketplace photo.
                variant="square" is the canonical 1:1 picker (owner 2026-07-27). */}
            <FileUpload
              bucket="media"
              pathPrefix={`vendors/${vendorProfileId}/services`}
              name="primary_photo_r2_key"
              maxSizeMB={5}
              acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
              watermark
              compressImage
              variant="square"
              qrGuard
              currentValue={initial?.coverPhotoR2Key ?? null}
              initialDisplayUrls={initial?.mediaDisplayUrls}
            />
          </Field>
          <ShowcaseMediaFields
            vendorProfileId={vendorProfileId}
            onClipDurationSeconds={onClipDurationSeconds}
            videoCurrent={initial?.showcaseVideoR2Key ?? null}
            photosCurrent={initial?.showcasePhotoR2Keys}
            displayUrls={initial?.mediaDisplayUrls}
          />
        </CanvasSheet>

        <CanvasSheet
          id="canvas-price"
          title="Price"
          open={sheet === 'price'}
          onClose={() => setSheet(null)}
        >
          <PricingBasisEditor
            idPrefix="canvas"
            category={category}
            defaults={
              initial?.pricing ?? {
                pricing_basis: 'fixed',
                starting_price_php: null,
                base_pax: null,
                added_pax_price_php: null,
                per_pax_price_php: null,
                min_pax: null,
                hour_base_php: null,
                min_hours: null,
                extra_hour_php: null,
              }
            }
            fixedExtra={<PriceBracketsEditor initial={initial?.brackets ?? []} />}
          />
          <p className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
            Per head sets the minimum pax you can serve · per hour covers a first block
            then bills each extra hour · per event is flat, whatever the hours or pax.
            Either way the real number is quoted in each couple&rsquo;s inquiry.
          </p>
          <DiscountsEditor initial={initial?.discounts ?? []} />
          <Field label="Crew size (optional)" htmlFor="crew_size">
            <input id="crew_size" name="crew_size" type="number" min={0} step={1} defaultValue={initial?.crewSize ?? ''} className="input-field" />
          </Field>
          <IncludedFlags
            idPrefix="canvas"
            category={category}
            defaults={
              initial?.included ?? {
                crew_meal_included: false,
                transport_included: false,
                transport_flat_fee_php: null,
              }
            }
          />
          <details className="rounded-lg border p-3" style={{ borderColor: line }}>
            <summary className="cursor-pointer text-sm font-medium" style={{ color: 'var(--m-slate)' }}>
              Lead-time rules (advanced) — optional
            </summary>
            <div className="mt-3 space-y-3">
              <p className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
                Starting points the platform uses. Skip these and you can still publish.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Recommended lead (months)" htmlFor="recommended_lead_time_months">
                  <input id="recommended_lead_time_months" name="recommended_lead_time_months" type="number" min={0} step="0.5" defaultValue={initial?.recommendedLeadTimeMonths ?? ''} className="input-field" />
                </Field>
                <Field label="Last-minute ends (months)" htmlFor="last_minute_end_months">
                  <input id="last_minute_end_months" name="last_minute_end_months" type="number" min={0} step={1} defaultValue={initial?.lastMinuteEndMonths ?? ''} className="input-field" />
                </Field>
                <Field label="Last-minute surcharge (%)" htmlFor="last_minute_surcharge_pct">
                  <input id="last_minute_surcharge_pct" name="last_minute_surcharge_pct" type="number" min={0} max={100} step={1} defaultValue={initial?.lastMinuteSurchargePct ?? ''} className="input-field" />
                </Field>
              </div>
            </div>
          </details>
        </CanvasSheet>

        <CanvasSheet
          id="canvas-excl"
          title="Setnayan Exclusive"
          open={sheet === 'excl'}
          onClose={() => setSheet(null)}
        >
          <Field label="Your Setnayan Exclusive" htmlFor="exclusive_perk_text">
            <input
              id="exclusive_perk_text"
              name="exclusive_perk_text"
              value={perk}
              onChange={(e) => setPerk(e.target.value)}
              maxLength={500}
              placeholder="e.g. Free engagement mini-shoot for Setnayan couples"
              className="input-field"
            />
          </Field>
          <p className="text-sm" style={{ color: 'var(--m-slate-2)' }}>
            One thing couples only get by booking you through Setnayan. Required to{' '}
            <span className="font-medium" style={{ color: 'var(--m-ink)' }}>publish</span> — you can
            save a draft without it.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {['Free add-on', 'Priority date hold', 'Setnayan-only rate', 'Complimentary upgrade'].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setPerk(c)}
                className="min-h-[34px] rounded-full border px-3 py-1 text-xs"
                style={{ borderColor: line, background: paper, color: 'var(--m-slate)' }}
              >
                {c}
              </button>
            ))}
          </div>
        </CanvasSheet>

        <CanvasSheet
          id="canvas-custom"
          title="What couples get"
          open={sheet === 'custom'}
          onClose={() => setSheet(null)}
        >
          <InclusionsEditor initial={initial?.inclusions ?? []} />
          {/* The #3846 merged customization editor, mounted whole. Flag-dark on
              the SAME flag as the wizard: off ⇒ unmounted ⇒ contributes no
              field, exactly as the wizard behaves. */}
          {customizationEnabled ? (
            <CustomizationStep categoryValue={category} categoryLabel={activeCategoryLabel} />
          ) : null}
        </CanvasSheet>
      </form>

      {/* ═══════════════════════════════════════════════════════════════════
          parity:ignore-start
          THE AUDIENCE SHEET IS A SIBLING FORM, NOT A NESTED ONE.

          Who finds this card is `vendor_coverages.event_types` / `.faiths` —
          rows the couple-side filters already read, written by the SHIPPED
          `updateCoverageServes` action (services/coverage-actions.ts). It is a
          different write from the card's, so it is a different form, placed
          OUTSIDE the card form: nesting it would let a no-JS submit of the card
          dispatch THIS action instead (see scripts/lint-nested-forms.mjs).

          The chips, their field names and the "empty faiths = all faiths
          welcomed" rule are lifted from coverage-panel.tsx — the only thing new
          is the Life-events / Events split, which is presentation over ONE array.

          🔑 IT SAVES AND STAYS. The shipped `updateCoverageServes` ends in a
          redirect to Services, which — pressed from HERE, mid-build — threw away
          every unposted thing on the card: title, price, inclusions, the
          customization draft, the photos already uploaded. The sheet used to
          WARN about that, and a warning that precedes losing the vendor's work
          is not a fix. This form posts `updateCoverageServesInPlace` instead:
          the same write, the same validation, the same revalidation, reported
          here beside the button. The Services page's own coverage panel still
          uses the redirecting action — it is already on that page, so landing
          back on it costs nothing.
          ═══════════════════════════════════════════════════════════════════ */}
      <CanvasSheet
        id="canvas-audience"
        title="Who it’s for"
        open={sheet === 'audience'}
        onClose={() => setSheet(null)}
        confirmLabel={null}
      >
        {coverages.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--m-slate-2)' }}>
            This card isn&rsquo;t in a coverage yet, so nobody is searching for it. Add a
            coverage from your Shop first — then come back and choose who it serves.
          </p>
        ) : (
          <form action={saveAudience} className="space-y-4">
            <input type="hidden" name="coverage_id" value={coverageId} />
            <label className="block space-y-1">
              <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                This card sits in
              </span>
              {/* NO `name` — the picker drives the hidden coverage_id on BOTH
                  forms. Giving it one would add a duplicate to the payload. */}
              <select
                value={coverageId}
                onChange={(e) => setCoverageId(e.target.value)}
                aria-label="Coverage this card sits in"
                className="input-field cursor-pointer"
              >
                <option value="">— not assigned —</option>
                {coverages.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            {/* EVERY vocab option THE LEAF MAY SERVE renders, across these
                groups. The split is presentation over ONE array; the grouping
                (and the union invariant that keeps a new admin-added type from
                falling through) lives in lib/canvas-audience-groups.ts, tested.
                The only pre-filter is allowedEventOptions — the SAME set the
                server enforces on save (parseEventTypes), so a chip here is
                never checkable-then-silently-dropped. An ad-hoc `.filter()`
                instead is exactly how five live event types were silently
                strippable in the first cut. */}
            {audienceGroups(audienceOptions).map((group) => (
              <ChipGroup
                key={group.id}
                heading={group.heading}
                blurb={group.blurb}
                options={group.options}
                coverageField="event_types"
                selected={events}
                onToggle={(k) => setEvents((cur) => toggle(cur, k))}
                disabled={!coverageId}
              />
            ))}
            {audienceOptions.length < eventTypeOptions.length ? (
              <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
                Only the events this category can serve are shown.
              </p>
            ) : null}
            {droppedKeys.length > 0 ? (
              <p className="text-xs" style={{ color: 'var(--m-blush-deep)' }}>
                No longer offered for this category:{' '}
                {droppedKeys.map((k) => eventTypeLabel(k)).join(' · ')} — saving
                removes {droppedKeys.length === 1 ? 'it' : 'them'}.
              </p>
            ) : null}
            <ChipGroup
              heading="Faith"
              blurb="Leave all off to welcome every faith. Faith unlocks you for a search; it never gates you out."
              options={faithOptions}
              coverageField="faiths"
              selected={faiths}
              onToggle={(k) => setFaiths((cur) => toggle(cur, k))}
              disabled={!coverageId}
            />

            <p className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
              Who-it&rsquo;s-for is saved on your coverage, not on this card — it saves on
              its own and your card stays exactly as you left it.
            </p>
            <SubmitButton
              className="button-primary min-h-[44px] disabled:opacity-50"
              pendingLabel="Saving…"
              disabled={!coverageId || events.length === 0}
            >
              Save who it&rsquo;s for
            </SubmitButton>
            {/* The outcome lands HERE, beside the button that caused it. A
                refusal must never be silent: the shipped action showed one by
                putting `?error=` on the URL it redirected to, and this form no
                longer goes anywhere. */}
            {audienceState.message ? (
              <p
                role="alert"
                className="text-xs"
                style={{ color: 'var(--m-blush-deep)' }}
              >
                {audienceState.message}
              </p>
            ) : null}
            {audienceSaved ? (
              <p role="status" className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
                Saved — couples looking for these events will find this card.
              </p>
            ) : null}
          </form>
        )}
      </CanvasSheet>
      {/* parity:ignore-end */}
    </div>
  );
}

function toggle(list: string[], key: string): string[] {
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
}

// ── Card regions ────────────────────────────────────────────────────────────

/**
 * One kind of service, as a pill.
 *
 * 🔒 A LOCKED PILL IS NOT A BUTTON. It is disabled, not merely styled grey —
 * a pill that looks refused and still submits is the worst of both, and the
 * refusal it would meet lives on the far side of a whole authored card.
 */
function KindPill({
  opt,
  on,
  onPick,
}: {
  opt: CategoryChoice;
  on: boolean;
  onPick: () => void;
}) {
  const locked = opt.standing === 'locked';
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={locked}
      title={locked ? opt.why : undefined}
      onClick={onPick}
      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm disabled:cursor-not-allowed"
      style={{
        borderColor: on ? 'var(--m-orange-2)' : line,
        background: on ? 'var(--m-orange-4)' : paper,
        color: locked ? 'var(--m-slate-2)' : on ? 'var(--m-orange-2)' : 'var(--m-ink)',
        opacity: locked ? 0.55 : 1,
      }}
    >
      {on ? <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> : null}
      {opt.label}
      {locked ? (
        <span className="font-mono text-[9px] uppercase tracking-[0.12em]">upgrade</span>
      ) : null}
    </button>
  );
}

function CardRegion({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex min-h-[44px] w-full items-center gap-2 border-t px-4 py-2.5 text-left text-[13.5px]"
      style={{ borderColor: line }}
    >
      <span className="min-w-0 flex-1">{children}</span>
      <Pencil aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} style={{ color: 'var(--m-slate-3)' }} />
    </button>
  );
}

function Recap({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt style={{ color: 'var(--m-slate-2)' }}>{k}</dt>
      <dd className="text-right font-medium" style={{ color: 'var(--m-ink)' }}>
        {v}
      </dd>
    </div>
  );
}

// ── Health chrome ───────────────────────────────────────────────────────────

const GRADE_LABEL: Record<string, string> = {
  blocked: 'Blocked',
  poor: 'Poor',
  average: 'Average',
  good: 'Good',
  excellent: 'Excellent',
};

function gradeColour(grade: string): string {
  if (grade === 'blocked' || grade === 'poor') return 'var(--m-blush-deep, var(--m-orange-2))';
  if (grade === 'good' || grade === 'excellent') return 'var(--m-sage-deep, var(--m-orange-2))';
  return 'var(--m-orange-2)';
}

/**
 * THE ONE PROGRESS SURFACE (owner-locked 2026-07-27 — the owner saw two bars
 * and called it out; artifact 15007a4d, label one-meter-11-cover).
 *
 * Everything that tells the vendor where they stand lives in this one sticky
 * header and nowhere else: the meter, the grade + score, the item count that
 * doubles as the diagnostics toggle, the single next-best action, and the
 * diagnostics themselves collapsed beneath it. The count button disappears at
 * zero items, so a clean card has nothing to expand.
 *
 * A second meter (or a health panel further down the page) is a REGRESSION, not
 * an addition — the maker has no steps, and two progress readings that can
 * disagree is exactly the confusion the zero-step design removed.
 */
function HealthHeader({
  health,
  open,
  onToggle,
  onGo,
}: {
  health: ReturnType<typeof scoreCardHealth>;
  open: boolean;
  onToggle: () => void;
  onGo: (sheet: CardHealthSheet) => void;
}) {
  const colour = gradeColour(health.grade);
  const items = [
    ...health.blockers.map((f) => ({ f, tone: 'blocker' as const })),
    ...health.warnings.map((f) => ({ f, tone: 'warning' as const })),
    ...health.hints.map((f) => ({ f, tone: 'hint' as const })),
  ];
  return (
    <div
      className="sticky top-0 z-20 -mx-4 border-b px-4 pb-2 pt-3 backdrop-blur sm:-mx-6 sm:px-6"
      style={{
        borderColor: line,
        background: 'color-mix(in srgb, var(--m-paper) 92%, transparent)',
      }}
    >
      <div
        className="h-2 overflow-hidden rounded-full"
        style={{ background: 'color-mix(in srgb, var(--m-ink) 8%, transparent)' }}
        role="progressbar"
        aria-label="Card health"
        aria-valuenow={health.score}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="sn-canvas-meter h-full rounded-full"
          style={{ width: `${health.score}%`, background: colour }}
        />
      </div>

      <div className="mt-1 flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-bold tracking-[-0.01em]" style={{ color: colour }}>
          {GRADE_LABEL[health.grade] ?? health.grade}{' '}
          <span className="font-mono text-[10px] font-normal opacity-60">
            {health.score}/100
          </span>
        </p>
        {items.length > 0 ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls="canvas-diagnostics"
            className="min-h-[34px] shrink-0 px-1 text-xs font-medium"
            style={{ color: 'var(--m-slate-2)' }}
          >
            {items.length} item{items.length === 1 ? '' : 's'} {open ? '▴' : '▾'}
          </button>
        ) : null}
      </div>

      <CoachChip
        label={health.nextAction.label}
        ready={health.nextAction.sheet === null}
        onGo={() => onGo(health.nextAction.sheet ?? 'media')}
      />

      {items.length > 0 && open ? (
        <div id="canvas-diagnostics" className="sn-canvas-rise mt-2 space-y-1.5 pb-1">
          <p className="text-[11px]" style={{ color: 'var(--m-slate-3)' }}>
            {health.band}
          </p>
          {items.map(({ f, tone }) => (
            <FindingRow key={f.code + f.message} finding={f} tone={tone} onGo={onGo} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The coach — ALWAYS exactly one line. Never a list: the maker has no steps, so
 * a stack of "you could also…" would just be the wizard's checklist wearing a
 * different hat. When there is nothing left it turns green and says so rather
 * than vanishing (a control that disappears reads as a bug, not as success).
 */
function CoachChip({
  label,
  ready,
  onGo,
}: {
  label: string;
  ready: boolean;
  onGo: () => void;
}) {
  if (ready) {
    return (
      <p
        className="sn-canvas-rise mt-1.5 rounded-lg border px-3 py-2 text-[12.5px] font-medium"
        style={{
          borderColor: 'color-mix(in srgb, var(--m-sage-deep, var(--m-orange-2)) 40%, transparent)',
          background: 'color-mix(in srgb, var(--m-sage, var(--m-orange-4)) 25%, transparent)',
          color: 'var(--m-sage-deep, var(--m-ink))',
        }}
      >
        {label}
      </p>
    );
  }
  return (
    // `key` on the label so a NEW next-action re-mounts the chip and the rise
    // animation replays — that flick is the whole signal that the goalposts moved.
    <button
      key={label}
      type="button"
      onClick={onGo}
      className="sn-canvas-rise mt-1.5 block min-h-[38px] w-full rounded-lg border px-3 py-2 text-left text-[12.5px]"
      style={{
        borderColor: 'color-mix(in srgb, var(--m-orange-2) 45%, transparent)',
        background: 'var(--m-orange-4)',
        color: 'var(--m-orange-deep)',
      }}
    >
      {label}
    </button>
  );
}

function FindingRow({
  finding,
  tone,
  onGo,
}: {
  finding: { code: string; message: string; sheet: CardHealthSheet };
  tone: 'blocker' | 'warning' | 'hint';
  onGo: (sheet: CardHealthSheet) => void;
}) {
  const colour =
    tone === 'blocker'
      ? 'var(--m-blush-deep, var(--m-orange-2))'
      : tone === 'warning'
        ? 'var(--m-orange-2)'
        : 'var(--m-slate)';
  return (
    <button
      type="button"
      onClick={() => onGo(finding.sheet)}
      className="flex min-h-[38px] w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-xs"
      style={{ borderColor: `color-mix(in srgb, ${colour} 35%, transparent)`, color: colour }}
    >
      {tone === 'blocker' ? (
        <X aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      ) : tone === 'warning' ? (
        <AlertCircle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
      ) : (
        // A hint needs no glyph, but it does need the same gutter, so the three
        // tones read as one list rather than three indents.
        <span aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      )}
      <span className="flex-1">{finding.message}</span>
      <ChevronRight aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-50" strokeWidth={2} />
    </button>
  );
}

// ── Audience chips (the coverage-panel idiom, split for reading) ────────────
// parity:ignore-start — belongs to the sibling coverage form above. The field
// name here is `coverageField`, whose TYPE admits only the two shipped
// vendor_coverages column names, so this passthrough can never grow a third.

function ChipGroup({
  heading,
  blurb,
  options,
  coverageField,
  selected,
  onToggle,
  disabled,
}: {
  heading: string;
  blurb: string;
  options: AudienceOption[];
  /** The vendor_coverages column this group writes. Exhaustive by type. */
  coverageField: 'event_types' | 'faiths';
  selected: string[];
  onToggle: (key: string) => void;
  disabled: boolean;
}) {
  if (options.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.13em]" style={{ color: 'var(--m-slate-3)' }}>
        {heading}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o.key);
          return (
            <label
              key={o.key}
              className="inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs"
              style={{
                borderColor: on ? 'var(--m-orange-3)' : line,
                background: on ? 'var(--m-orange-4)' : paper,
                color: on ? 'var(--m-orange-2)' : 'var(--m-slate)',
                opacity: disabled ? 0.5 : 1,
              }}
            >
              {/* Controlled + visually hidden, exactly like coverage-panel's
                  SelectChip: the label is the whole hit target and the checkbox
                  is the single source of truth for what posts. */}
              <input
                type="checkbox"
                name={coverageField}
                value={o.key}
                checked={on}
                disabled={disabled}
                onChange={() => onToggle(o.key)}
                className="hidden"
              />
              {on ? <Check aria-hidden className="h-3 w-3" strokeWidth={2.5} /> : null}
              {o.label}
            </label>
          );
        })}
      </div>
      <p className="text-[11px]" style={{ color: 'var(--m-slate-3)' }}>{blurb}</p>
    </div>
  );
}
// parity:ignore-end

// ── The sheet container ─────────────────────────────────────────────────────

/**
 * A bottom sheet that NEVER unmounts.
 *
 * The shipped <Sheet> primitive (app/_components/sheet.tsx) returns null when
 * closed, which is correct for a modal and fatal here: the sheets ARE the form,
 * and an unmounted input posts nothing. So this keeps the shipped primitive's
 * contract — role="dialog", aria-modal, aria-labelledby, Esc, focus trap +
 * restore, scroll lock, backdrop-dismiss, all via the same `useModalA11y` hook —
 * and swaps the unmount for the `hidden` attribute, exactly the mechanic the
 * wizard uses to keep its inactive steps submitting.
 *
 * Two details that are load-bearing, not cosmetic:
 *   • the root carries NO Tailwind display utility, because `.flex` would
 *     out-cascade preflight's `[hidden]{display:none}` and the "hidden" sheet
 *     would stay on screen;
 *   • toggling display none→block restarts the CSS animation, which is why the
 *     rise replays on every open without any JS.
 */
function CanvasSheet({
  id,
  title,
  open,
  onClose,
  confirmLabel = 'Update card',
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onClose: () => void;
  /**
   * The explicit confirm at the sheet's foot (owner 2026-07-28: "pop ups must
   * have update button to avoid confusion"). Edits already applied live — this
   * button AFFIRMS and closes; it changes nothing. Pass null only when the
   * sheet carries its own real submit (the audience sheet's "Save who it's
   * for"), where a second confirm would compete with it.
   */
  confirmLabel?: string | null;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open, onClose, containerRef: dialogRef });

  return (
    <div hidden={!open} className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        className="sn-canvas-sheet absolute inset-x-0 bottom-0 mx-auto max-h-[78dvh] w-full max-w-[560px] overflow-y-auto rounded-t-3xl border shadow-[0_-12px_40px_rgba(0,0,0,0.18)] focus:outline-none"
        style={{ borderColor: line, background: paper }}
      >
        <header
          className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur"
          style={{ borderColor: line, background: 'color-mix(in srgb, var(--m-paper) 92%, transparent)' }}
        >
          <h2 id={`${id}-title`} className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full"
            style={{ color: 'var(--m-slate-2)' }}
          >
            <X aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        </header>
        <div className="sn-canvas-rise space-y-3 px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
          {children}
          {confirmLabel !== null ? (
            // type="button" is LOAD-BEARING: most sheets render INSIDE the one
            // card <form> — a default-submit button here would submit the card.
            <button
              type="button"
              onClick={onClose}
              className="button-primary min-h-[44px] w-full"
            >
              {confirmLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
