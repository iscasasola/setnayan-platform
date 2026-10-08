/**
 * 🔲 EVERY EMPTY SCENE'S LOOK, IN SAMPLE SHAPES — the Maker's canvas only, never a guest.
 *
 * Owner, preview check 08 Oct, on a part with nothing in it yet: *"still cannot see the gallery style? maybe show
 * what it could look like with boxes?"* → the rule for every look picture: when a part has no content, each look
 * card AND the canvas draw that look's REAL ARRANGEMENT with sample shapes — grey boxes where photos go, short
 * grey lines where words go. The day's parts and Photo moments were first (`maker-fixed-parts.tsx`
 * `MakerDayPartStandIn`, `photo-moments-widget.tsx`); this is every other scene that is empty on a new event:
 * Special message · Schedule · Venue map · Reminders · Love Story · Photos · Countdown · Dress code (its three
 * layouts and its five palette looks) · Do's & Don'ts · E-Gifts.
 *
 * ── THE SHARED PLACE ───────────────────────────────────────────────────────────────────────────────
 * A look card is the guest page itself, asked for one scene in one style (`stage-panel/style-preview.tsx`), so
 * the one place every card and the canvas share is the scene's own empty state: `MakerEmptyScene` draws
 * `sceneSample(<scene type>, <style id>)` under the scene's name. A scene registers its looks' arrangements
 * HERE, keyed `<scene type>:<style id>` by the registry's own ids (`lib/scene-styles-stages.ts`) —
 * `every-look-draws-a-picture.test.ts` fails when a look of an empty-drawn scene has no arrangement of its own.
 *
 * ── A SAMPLE IS UNMISTAKABLY A SAMPLE ──────────────────────────────────────────────────────────────
 * Shapes only (owner 2026-09-27, "no sample content"): never a name, a date, a place or a stock photo — nothing
 * a couple could mistake for their own words. Every block is `aria-hidden` and carries `data-maker-sample`,
 * which `globals.css` hides on any page without a Maker marker (`[data-maker-section]`) — and the callers mount
 * it only on the Maker's canvas, where the scene is empty. Real content replaces the scene's empty state whole,
 * so a sample can never sit beside it.
 *
 * A server component, CSS only — no client JavaScript, nothing in the Maker's first load.
 */
import type { ReactNode } from 'react';
import { PALETTE_LOOK_DEFAULT, type PaletteLookId } from '@/lib/palette-looks';
import { DOS_LOOK_DEFAULT, type DosLookId } from '@/lib/dress-code-looks';

/** A photo's place. */
export const Box = ({ className = '' }: { className?: string }) => <span aria-hidden data-sample-box="" className={`block rounded-md bg-ink/10 ${className}`} />;
/** A line of words' place. */
export const Line = ({ w = 'w-2/3', className = '' }: { w?: string; className?: string }) => (
  <span aria-hidden data-sample-line="" className={`block h-2 rounded-full bg-ink/15 ${w} ${className}`} />
);
/** A heading's place — a heavier line. */
const Head = ({ w = 'w-1/2', className = '' }: { w?: string; className?: string }) => (
  <span aria-hidden data-sample-line="" className={`block h-3.5 rounded-full bg-ink/20 ${w} ${className}`} />
);
/** A hairline. */
const Rule = ({ className = '' }: { className?: string }) => <span aria-hidden className={`block h-px w-full bg-ink/15 ${className}`} />;

/** Four greys, light to dark — a sample palette is never a colour a couple could take for theirs. */
const GREYS = ['bg-ink/10', 'bg-ink/20', 'bg-ink/30', 'bg-ink/15'] as const;

/**
 * 🎨 "OUR COLOURS", AS EACH PALETTE LOOK ARRANGES THEM — Tags · Fabric swatches · Paint chips · Circles · Ribbon
 * (`lib/palette-looks.ts`), in greys. The Dress code scene draws this where its colours will go while the
 * couple has picked none.
 */
export const PALETTE_SAMPLE: Record<PaletteLookId, () => ReactNode> = {
  tags: () => (
    <span className="flex justify-center gap-2">
      {GREYS.map((g, i) => (
        <span key={i} className="block w-[3.25rem] space-y-1.5">
          <span aria-hidden data-sample-box="" className={`block h-16 w-full rounded-b-md ${g}`} />
          <Line w="w-3/4" className="mx-auto" />
        </span>
      ))}
    </span>
  ),
  fabric: () => (
    <span className="flex justify-center gap-3">
      {GREYS.map((g, i) => (
        <span key={i} className="block w-14 space-y-1.5">
          <span aria-hidden data-sample-box="" className={`block h-14 w-14 rounded-none p-1 ${g}`}>
            <span className="block h-full w-full border border-dashed border-ink/30" />
          </span>
          <Line w="w-3/4" className="mx-auto" />
        </span>
      ))}
    </span>
  ),
  chips: () => (
    <span className="mx-auto block w-3/4 space-y-px border border-ink/15 p-1">
      {GREYS.map((g, i) => (
        <span key={i} aria-hidden data-sample-box="" className={`flex h-9 items-end rounded-none px-2 pb-1.5 ${g}`}>
          <span className="block h-1.5 w-1/3 rounded-full bg-ink/25" />
        </span>
      ))}
    </span>
  ),
  circles: () => (
    <span className="block space-y-2">
      <span className="flex justify-center pl-3">
        {GREYS.map((g, i) => (
          <span key={i} aria-hidden data-sample-box="" className={`-ml-3 block h-14 w-14 rounded-full border-2 border-cream ${g}`} />
        ))}
      </span>
      <Line w="w-1/2" className="mx-auto" />
    </span>
  ),
  ribbon: () => (
    <span className="block space-y-2">
      <span className="flex h-9 w-full [clip-path:polygon(0_0,100%_0,calc(100%-10px)_50%,100%_100%,0_100%,10px_50%)]">
        {GREYS.map((g, i) => (
          <span key={i} aria-hidden data-sample-box="" className={`block h-full flex-1 rounded-none ${g}`} />
        ))}
      </span>
      <span className="flex gap-2">
        {GREYS.map((_, i) => (
          <Line key={i} w="flex-1" />
        ))}
      </span>
    </span>
  ),
};

/** The palette look's arrangement (Tags when the id is not one this version draws). */
export function paletteSample(look: string | null | undefined): ReactNode {
  return (PALETTE_SAMPLE[look as PaletteLookId] ?? PALETTE_SAMPLE[PALETTE_LOOK_DEFAULT])();
}

/** One list of the Do's & Don'ts: a heading, then lines — each behind a mark when the look draws marks. */
const DosList = ({ marks, widths }: { marks: boolean; widths: readonly string[] }) => (
  <span className="block space-y-2">
    <Head w="w-12" />
    {widths.map((w) => (
      <span key={w} className="flex items-center gap-3">
        {marks ? <span aria-hidden data-sample-box="" className="block h-2.5 w-2.5 shrink-0 rounded-full bg-ink/30" /> : null}
        <Line w={w} />
      </span>
    ))}
  </span>
);

/**
 * 🧾 THE DO'S & DON'TS, AS EACH LOOK ARRANGES THEM (`lib/dress-code-looks.ts`) — Two notes (two filled notes,
 * side by side from a tablet up) · Ticks and crosses (one list under the other, a mark before each line) · Side
 * by side (two columns under one rule). The Dress code scene draws this where the lists will go while the
 * couple has written none.
 */
export const DOS_SAMPLE: Record<DosLookId, () => ReactNode> = {
  notes: () => (
    <span className="grid grid-cols-1 gap-3 text-left">
      <span className="block border-l-2 border-ink/25 bg-ink/5 p-4">
        <DosList marks={false} widths={['w-3/4', 'w-1/2']} />
      </span>
      <span className="block border-l-2 border-ink/15 bg-ink/10 p-4">
        <DosList marks={false} widths={['w-2/3', 'w-3/5']} />
      </span>
    </span>
  ),
  marks: () => (
    <span className="block space-y-5 text-left">
      <DosList marks widths={['w-3/4', 'w-1/2']} />
      <DosList marks widths={['w-2/3', 'w-3/5']} />
    </span>
  ),
  'side-by-side': () => (
    <span className="grid grid-cols-2 gap-x-6 border-y border-ink/15 py-5 text-left">
      <DosList marks widths={['w-full', 'w-2/3']} />
      <span className="block border-l border-ink/15 pl-6">
        <DosList marks widths={['w-5/6', 'w-full']} />
      </span>
    </span>
  ),
};

/** The Do's & Don'ts sample block for a look (the shipped notes when the id is not one this version draws). */
export function dosSample(look: string | null | undefined): ReactNode {
  const id = (DOS_SAMPLE[look as DosLookId] ? look : DOS_LOOK_DEFAULT) as DosLookId;
  return (
    <div aria-hidden data-dress-code="dos" data-maker-sample={`dos:${id}`} className="mx-auto w-full max-w-md">
      {DOS_SAMPLE[id]()}
    </div>
  );
}

/** A row per role: its name and outfit at the left, its colours at the right. */
const RoleRows = () => (
  <span className="block divide-y divide-ink/10 border-y border-ink/10">
    {[0, 1, 2].map((i) => (
      <span key={i} className="flex items-center justify-between gap-3 py-2.5">
        <span className="block flex-1 space-y-1.5">
          <Line w={i === 1 ? 'w-1/3' : 'w-1/2'} />
          <Line w="w-2/3" className="!h-1.5" />
        </span>
        <span className="flex gap-1.5">
          <span aria-hidden data-sample-box="" className="block h-7 w-5 rounded-b-md bg-ink/20" />
          <span aria-hidden data-sample-box="" className="block h-7 w-5 rounded-b-md bg-ink/10" />
        </span>
      </span>
    ))}
  </span>
);

/** Each look's arrangement, keyed `<scene type>:<style id>` (`lib/scene-styles-stages.ts`, `lib/scene-styles-parts.ts`). */
export const SCENE_SAMPLE: Record<string, (opts: { paletteLook?: string | null }) => ReactNode> = {
  /* ── Special message ── */
  'special_message:note': () => (
    <span className="block space-y-2 bg-ink/5 px-5 py-5">
      <Line w="w-11/12" className="mx-auto" />
      <Line w="w-4/5" className="mx-auto" />
      <Line w="w-1/2" className="mx-auto" />
    </span>
  ),
  'special_message:letter': () => (
    <span className="mx-auto block w-3/4 space-y-2 text-left">
      <span className="flex items-start gap-2">
        <Box className="h-9 w-7 shrink-0 rounded-none bg-ink/20" />
        <span className="block flex-1 space-y-2 pt-1">
          <Line w="w-full" />
          <Line w="w-5/6" />
        </span>
      </span>
      <Line w="w-full" />
      <Line w="w-2/3" />
      <Line w="w-1/3" className="ml-auto !h-2.5 bg-ink/25" />
    </span>
  ),
  'special_message:quote': () => (
    <span className="block space-y-3">
      <Head w="w-11/12" className="mx-auto" />
      <Head w="w-2/3" className="mx-auto" />
      <Rule className="mx-auto !w-12" />
      <Line w="w-4/5" className="mx-auto" />
      <Line w="w-3/5" className="mx-auto" />
    </span>
  ),
  /* ── Schedule ── */
  'schedule:programme-rail': () => (
    <span className="block divide-y divide-ink/10 border-y border-ink/10 text-left">
      {['w-1/2', 'w-2/3', 'w-2/5', 'w-3/5'].map((w, i) => (
        <span key={w} className="flex items-center gap-4 py-2.5">
          <Line w="w-10" className={`shrink-0 ${i === 1 ? 'bg-ink/30' : ''}`} />
          <Line w={w} />
        </span>
      ))}
    </span>
  ),
  'schedule:one-per-screen': () => (
    <span className="block space-y-3 bg-ink/5 px-5 py-8">
      <Line w="w-12" className="mx-auto" />
      <Head w="w-2/3" className="mx-auto !h-5" />
      <Line w="w-1/2" className="mx-auto" />
      <span className="flex justify-center gap-1.5 pt-2">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} aria-hidden data-sample-box="" className={`block h-1.5 w-1.5 rounded-full ${i === 0 ? 'bg-ink/40' : 'bg-ink/15'}`} />
        ))}
      </span>
    </span>
  ),
  'schedule:clock-face': () => (
    <span className="block space-y-3">
      <span className="relative mx-auto block h-36 w-36 rounded-full border-2 border-ink/15">
        {['left-1/2 top-1 -translate-x-1/2', 'right-1 top-1/2 -translate-y-1/2', 'bottom-1 left-1/2 -translate-x-1/2', 'left-1 top-1/2 -translate-y-1/2'].map((at, i) => (
          <span key={at} aria-hidden data-sample-box="" className={`absolute block h-3 w-3 rounded-full ${at} ${i === 1 ? 'bg-ink/40' : 'bg-ink/15'}`} />
        ))}
        <span aria-hidden className="absolute left-1/2 top-1/2 block h-px w-10 origin-left -rotate-[20deg] bg-ink/30" />
      </span>
      <Line w="w-1/2" className="mx-auto" />
    </span>
  ),
  /* ── Venue map ── */
  'venue_map:photo-card': () => (
    <span className="block space-y-4 text-left">
      {[0, 1].map((i) => (
        <span key={i} className="block space-y-2">
          <Box className="aspect-[16/9] w-full" />
          <Head w={i === 0 ? 'w-1/2' : 'w-2/5'} />
          <Line w="w-3/4" />
        </span>
      ))}
    </span>
  ),
  'venue_map:full-photo': () => (
    <span className="relative block aspect-[4/5] w-full">
      <Box className="absolute inset-0 h-full w-full bg-ink/20" />
      <span className="absolute inset-x-4 bottom-4 block space-y-2 text-left">
        <span aria-hidden data-sample-line="" className="block h-3.5 w-1/2 rounded-full bg-cream/80" />
        <span aria-hidden data-sample-line="" className="block h-2 w-3/4 rounded-full bg-cream/70" />
      </span>
    </span>
  ),
  'venue_map:journey': () => (
    <span className="block space-y-3 text-left">
      <Box className="aspect-[16/7] w-full" />
      <span className="block space-y-3 border-l border-ink/20 pl-4">
        {['w-1/2', 'w-2/3', 'w-2/5'].map((w) => (
          <span key={w} className="relative block space-y-1.5">
            <span aria-hidden data-sample-box="" className="absolute -left-[21px] top-0 block h-2.5 w-2.5 rounded-full bg-ink/30" />
            <Line w={w} />
            <Line w="w-1/4" className="!h-1.5" />
          </span>
        ))}
      </span>
    </span>
  ),
  /* ── Reminders (What to bring) ── */
  'what_to_bring:note': () => (
    <span className="block space-y-2 bg-ink/5 px-5 py-5 text-left">
      <Line w="w-11/12" />
      <Line w="w-3/4" />
      <Line w="w-2/5" />
    </span>
  ),
  'what_to_bring:list': () => (
    <span className="block divide-y divide-ink/10 border-y border-ink/10 text-left">
      {['w-2/3', 'w-1/2', 'w-3/5'].map((w) => (
        <span key={w} className="flex items-center gap-3 py-2.5">
          <span aria-hidden data-sample-box="" className="block h-2 w-2 shrink-0 rounded-full bg-ink/25" />
          <Line w={w} />
        </span>
      ))}
    </span>
  ),
  'what_to_bring:gift-line': () => (
    <span className="block space-y-3 text-left">
      <Head w="w-5/6" />
      <Rule className="!w-12" />
      <Line w="w-4/5" />
      <Line w="w-1/2" />
    </span>
  ),
  /* ── Photos (the couple's own gallery) ── */
  'gallery:mosaic': () => (
    <span className="block space-y-3">
      <Box className="aspect-[4/3] w-full rounded-none" />
      <span className="grid grid-cols-2 gap-3">
        <Box className="aspect-[3/4] rounded-none" />
        <Box className="mt-6 aspect-[3/4] rounded-none" />
      </span>
    </span>
  ),
  'gallery:grid': () => (
    <span className="grid grid-cols-3 gap-1.5">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Box key={i} className="aspect-square rounded-none" />
      ))}
    </span>
  ),
  'gallery:film-strip': () => (
    <span className="block space-y-2">
      {[0, 1].map((row) => (
        <span key={row} className={`flex gap-2 overflow-hidden bg-ink/25 py-3 ${row === 1 ? 'pl-16' : 'pl-3'}`}>
          {[0, 1, 2].map((i) => (
            <span key={i} aria-hidden data-sample-box="" className="block aspect-[3/2] w-36 shrink-0 rounded-none bg-cream/70" />
          ))}
        </span>
      ))}
    </span>
  ),
  /* ── Love Story ── */
  'our_love_story:chapters': () => (
    <span className="block space-y-5 text-left">
      {[0, 1].map((i) => (
        <span key={i} className="block space-y-2">
          <Box className="aspect-[4/3] w-full" />
          <Line w="w-10" className="bg-ink/25" />
          <Head w={i === 0 ? 'w-1/2' : 'w-2/5'} />
          <Line w="w-11/12" />
        </span>
      ))}
    </span>
  ),
  'our_love_story:essay': () => (
    <span className="block space-y-3 text-left">
      <span className="flex items-start gap-2">
        <Box className="h-9 w-7 shrink-0 rounded-none bg-ink/20" />
        <span className="block flex-1 space-y-2 pt-1">
          <Line w="w-full" />
          <Line w="w-5/6" />
        </span>
      </span>
      <span className="block border-l-2 border-ink/25 py-1 pl-3">
        <Head w="w-4/5" />
      </span>
      {['w-1/2', 'w-2/5'].map((w) => (
        <span key={w} className="flex items-center gap-3">
          <Line w="w-8" className="shrink-0 bg-ink/25" />
          <Line w={w} />
        </span>
      ))}
    </span>
  ),
  'our_love_story:years': () => (
    <span className="block space-y-4">
      <span className="flex items-center justify-center gap-2 border-b border-ink/15 pb-3">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} aria-hidden data-sample-box="" className={`block h-6 w-12 rounded-full ${i === 1 ? 'bg-ink/30' : 'bg-ink/10'}`} />
        ))}
      </span>
      <Head w="w-1/2" className="mx-auto" />
      <Line w="w-4/5" className="mx-auto" />
    </span>
  ),
  /* ── Countdown (it needs the date) ── */
  'countdown:four-tiles': () => (
    <span className="flex justify-center gap-2">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="block w-14 space-y-1.5">
          <Box className="h-14 w-14" />
          <Line w="w-3/4" className="mx-auto !h-1.5" />
        </span>
      ))}
    </span>
  ),
  'countdown:big-number': () => (
    <span className="block space-y-3">
      <Box className="mx-auto h-20 w-28 bg-ink/15" />
      <Line w="w-1/2" className="mx-auto" />
    </span>
  ),
  'countdown:offset': () => (
    <span className="flex items-center gap-4 text-left">
      <Box className="h-20 w-24 shrink-0 bg-ink/15" />
      <span className="block flex-1 space-y-2">
        <Head w="w-2/3" />
        <Line w="w-1/2" />
      </span>
    </span>
  ),
  'countdown:line': () => (
    <span className="block border-y border-ink/15 py-3">
      <Line w="w-2/3" className="mx-auto" />
    </span>
  ),
  'countdown:circle': () => (
    <span className="block space-y-3">
      <span className="mx-auto grid h-28 w-28 place-items-center rounded-full border-4 border-ink/15">
        <Box className="h-9 w-12 bg-ink/15" />
      </span>
      <Line w="w-1/3" className="mx-auto" />
    </span>
  ),
  /* ── Dress code — its three layouts; "Colours and roles" wears the palette look ── */
  'dress_code:colours-and-roles': ({ paletteLook }) => (
    <span className="block space-y-4 text-left">
      <span data-dress-code="ours" data-sample-palette={PALETTE_SAMPLE[paletteLook as PaletteLookId] ? paletteLook : PALETTE_LOOK_DEFAULT} className="block space-y-2">
        <Line w="w-20" className="bg-ink/25" />
        {paletteSample(paletteLook)}
      </span>
      <RoleRows />
    </span>
  ),
  'dress_code:palette': () => (
    <span className="block space-y-4 text-left">
      {[0, 1].map((band) => (
        <span key={band} className="block space-y-1.5">
          <span className="flex h-16 w-full">
            {(band === 0 ? GREYS : GREYS.slice(1, 3)).map((g, i) => (
              <span key={i} aria-hidden data-sample-box="" className={`block h-full flex-1 rounded-none ${g}`} />
            ))}
          </span>
          <Line w={band === 0 ? 'w-1/3' : 'w-1/4'} />
        </span>
      ))}
      <Head w="w-1/2" />
    </span>
  ),
  'dress_code:line': () => (
    <span className="block space-y-4">
      <Head w="w-2/3" className="mx-auto !h-5" />
      <span className="mx-auto flex h-5 w-3/4">
        {GREYS.map((g, i) => (
          <span key={i} aria-hidden data-sample-box="" className={`block h-full flex-1 rounded-none ${g}`} />
        ))}
      </span>
      <span className="mx-auto block w-3/4 divide-y divide-ink/10 border-y border-ink/10">
        {['w-1/3', 'w-1/4', 'w-2/5'].map((w) => (
          <span key={w} className="flex items-center gap-4 py-2">
            <Line w={w} className="shrink-0" />
            <Line w="flex-1" className="!h-1.5" />
          </span>
        ))}
      </span>
    </span>
  ),
  /* ── E-Gifts — the four door looks are laid by `data-part-look` (globals.css); the door's own shape is one ── */
  'gifts:door': () => (
    <span className="flex items-center justify-between gap-3">
      <span className="block flex-1 space-y-2">
        <Line w="w-3/4" />
        <Line w="w-1/2" />
      </span>
      <span aria-hidden data-sample-box="" className="block h-10 w-24 shrink-0 rounded-full bg-ink/15" />
    </span>
  ),
};

/** The scene types with an arrangement of their own here. */
export const SAMPLED_SCENE_TYPES: readonly string[] = [...new Set(Object.keys(SCENE_SAMPLE).map((k) => k.split(':')[0]!))];

/** The key of the arrangement a scene's look draws — its first when the style is unknown; null: the scene has none. */
export function sceneSampleKey(sceneType: string, styleId: string | null | undefined): string | null {
  const want = `${sceneType}:${styleId ?? ''}`;
  if (SCENE_SAMPLE[want]) return want;
  return Object.keys(SCENE_SAMPLE).find((k) => k.startsWith(`${sceneType}:`)) ?? null;
}

/**
 * The sample block for one scene in one look — null for a scene with no arrangement here. `aria-hidden`, and
 * `data-maker-sample` so `globals.css` shows it on the Maker's canvas alone.
 */
export function SceneSample({
  sceneType,
  styleId = null,
  paletteLook = null,
  className = '',
  stepsAside = false,
}: {
  sceneType: string;
  styleId?: string | null;
  paletteLook?: string | null;
  className?: string;
  /** ✍ In an empty words scene the sample steps aside with the prompt while the couple types (`previewSceneWords`). */
  stepsAside?: boolean;
}) {
  const key = sceneSampleKey(sceneType, styleId);
  if (!key) return null;
  return (
    <div aria-hidden data-maker-sample={key} {...(stepsAside ? { 'data-maker-empty-prompt': '' } : {})} className={`mx-auto w-full max-w-md ${className}`}>
      {SCENE_SAMPLE[key]!({ paletteLook })}
    </div>
  );
}
