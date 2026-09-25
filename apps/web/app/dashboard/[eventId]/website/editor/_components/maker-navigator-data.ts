/**
 * THE NAVIGATOR'S DATA — built on the server by the editor page and handed to
 * `MakerWork` as plain values (no functions cross, no icons).
 *
 *   · `stageLists` — for each of the four stages, what the canvas draws, in the
 *     order it draws it, plus the fold of what it leaves out and why
 *     (`lib/maker-scene-list.ts`, which asks the page's own `resolveSiteBodyPlan`).
 *   · `fullOrder` — every hideable section in (drafted) display order: the order
 *     the move actions swap in, so a drag past hidden rows is counted right.
 *   · `minis` — a miniature of each section for its tile (owner 2026-09-25:
 *     *"shouldnt mobile mode also have mobile preview on navigation"*): the
 *     section's own title, its first line, and its ground (colour or photo).
 *     No iframe per tile — the words and the picture the section already has.
 */
import type { InvitationWidgetRow, LifecyclePhase, WidgetType } from '@/lib/invitation-widgets';
import { makerStageLists, type MakerStageList, type MakerStageInput } from '@/lib/maker-scene-list';
import { sanitizeHubCanvas, resolveHubBackground } from '@/lib/hub-canvas';
import { sanitizeCustomSection, isCustomSectionType } from '@/lib/custom-sections';
import { SCENE_TEMPLATES } from '@/lib/scene-templates';
import { loveStoryScenes } from '@/lib/love-story-moments';
import type { PostEventMakerRead } from '@/lib/post-event-scenes';

export type SceneMini = {
  eyebrow?: string;
  title: string;
  line?: string;
  /** A flat ground, `#rrggbb`. */
  ground?: string;
  /** A photo ground, already signed. */
  photoUrl?: string;
};

export type MakerNavigatorData = {
  stageLists: Record<LifecyclePhase, MakerStageList>;
  fullOrder: string[];
  minis: Record<string, SceneMini>;
  /** The theme's page ground / ink / accent, for tiles with no ground of their own. */
  tint: { canvas: string; ink: string; accent: string };
  /**
   * 📖 POST EVENT (Maker Phase 8) — when the story was written, or that its
   * scenes could not be read (then the one "story after the day" tile stands
   * in, and the navigator SAYS the list is unavailable). Null before the day.
   */
  postEvent: { generatedAt: string } | 'unreadable' | null;
};

const firstLine = (s: unknown, max = 70): string | undefined => {
  if (typeof s !== 'string') return undefined;
  const line = s.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
  if (!line) return undefined;
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
};

export function buildMakerNavigatorData(input: {
  plan: Omit<MakerStageInput, 'stage'>;
  sectionRows: readonly InvitationWidgetRow[];
  tint: MakerNavigatorData['tint'];
  facts: {
    names: string | null;
    dateLabel: string | null;
    daysToGo: number | null;
    venueName: string | null;
    venueAddress: string | null;
    firstBlock: { label: string; time: string | null } | null;
    dressTitle: string | null;
    dressLine: string | null;
    photoMomentsLine: string | null;
    specialMessage: string | null;
    whatToBring: string | null;
    loveStory: unknown;
    entourageCount: number | null;
    heroPhotoUrl: string | null;
    firstGalleryUrl: string | null;
  };
  /** ref → signed URL, for section photo grounds (the page already signed them). */
  photoUrls: Readonly<Record<string, string>>;
  /** Post Event's compiled scenes (`readPostEventForMaker`) — null before the day. */
  postEvent?: PostEventMakerRead | null;
}): MakerNavigatorData {
  const { facts } = input;
  const minis: Record<string, SceneMini> = {};

  minis['f:hero'] = {
    eyebrow: 'Together with their families',
    title: facts.names ?? 'Your names',
    line: facts.dateLabel ?? undefined,
    photoUrl: facts.heroPhotoUrl ?? undefined,
  };
  minis['f:film'] = { eyebrow: 'Save the date', title: facts.names ?? 'Your names', line: facts.dateLabel ?? undefined, photoUrl: facts.heroPhotoUrl ?? undefined };
  minis['f:editorial'] = { eyebrow: 'After the day', title: 'The story after the day', line: facts.names ?? undefined };
  minis['f:entourage'] = {
    eyebrow: 'Standing with us',
    title: 'The entourage',
    line: facts.entourageCount && facts.entourageCount > 0 ? `${facts.entourageCount} with a role` : undefined,
  };
  minis['f:story'] = { eyebrow: 'Our story', title: 'How it began', line: undefined };

  const byType: Partial<Record<WidgetType, SceneMini>> = {
    countdown: { eyebrow: 'Counting down', title: facts.daysToGo !== null ? `${facts.daysToGo} days` : 'Countdown', line: facts.dateLabel ?? undefined },
    schedule: {
      eyebrow: 'Run of show',
      title: facts.firstBlock?.label ?? 'Run of show',
      line: facts.firstBlock?.time ?? undefined,
    },
    venue_map: { eyebrow: 'The venue', title: facts.venueName ?? 'The venue', line: facts.venueAddress ?? undefined },
    dress_code: { eyebrow: 'Dress code', title: facts.dressTitle || 'Dress code', line: facts.dressLine ?? undefined },
    photo_moments: { eyebrow: 'Savour the moments', title: 'Photo moments', line: facts.photoMomentsLine ?? undefined },
    tier_comparison: { eyebrow: 'Your access', title: 'Two ways to celebrate' },
    special_message: { eyebrow: 'A message', title: firstLine(facts.specialMessage, 40) ?? 'Special message', line: undefined },
    what_to_bring: { eyebrow: 'What to bring', title: firstLine(facts.whatToBring, 40) ?? 'What to bring' },
    our_photos: { eyebrow: 'Gallery', title: 'Photo gallery', photoUrl: facts.firstGalleryUrl ?? undefined },
    our_love_story: (() => {
      const first = loveStoryScenes(facts.loveStory)[0];
      return { eyebrow: first?.chapterLabel ?? 'Love story', title: first ? firstLine(first.line, 40) ?? 'Love story' : 'Love story moments', line: first?.when || undefined };
    })(),
    event_details: { eyebrow: 'Event details', title: facts.dateLabel ?? 'Event details' },
    your_photos: { eyebrow: 'Photos of you', title: 'Photos of each guest' },
  };

  for (const row of input.sectionRows) {
    const canvas = sanitizeHubCanvas(row.config_json);
    const bg = resolveHubBackground(canvas);
    const base: SceneMini = isCustomSectionType(row.widget_type)
      ? (() => {
          const c = sanitizeCustomSection(row.config_json);
          const tpl = canvas.template ? SCENE_TEMPLATES[canvas.template]?.name : undefined;
          return { eyebrow: tpl ?? 'Your scene', title: c.title || tpl || 'Your own scene', line: firstLine(c.body) };
        })()
      : (byType[row.widget_type] ?? { title: row.widget_type });
    minis[`w:${row.widget_type}`] = {
      ...base,
      ...(bg?.kind === 'color' ? { ground: bg.color } : {}),
      ...(bg && bg.kind !== 'color' && input.photoUrls[bg.media] ? { photoUrl: input.photoUrls[bg.media] } : {}),
    };
  }

  /* 📖 Post Event's scenes: each tile shows its template, what filled it — or,
     for a skipped one, why it is skipped. The cover wears the cover's picture
     (the hero until a post-event cover is chosen). */
  const pe = input.postEvent && input.postEvent.ok ? input.postEvent : null;
  for (const r of pe?.rows ?? []) {
    const tpl = r.template ? SCENE_TEMPLATES[r.template]?.name : null;
    minis[`p:${r.key}`] = {
      eyebrow:
        r.status === 'skipped' ? 'Skipped' : r.status === 'optional' ? 'Optional' : r.open ? 'Opens full screen' : (tpl ?? 'Auto'),
      title: r.name,
      line: r.status === 'auto' ? r.source : (r.note ?? undefined),
      ...(r.key === 'cover' && pe?.coverPhotoUrl ? { photoUrl: pe.coverPhotoUrl } : {}),
    };
  }

  return {
    postEvent: pe ? { generatedAt: pe.generatedAt } : input.postEvent && !input.postEvent.ok ? 'unreadable' : null,
    stageLists: makerStageLists({ ...input.plan, postEvent: pe?.rows ?? null }),
    fullOrder: input.sectionRows.map((r) => r.widget_id),
    minis,
    tint: input.tint,
  };
}
