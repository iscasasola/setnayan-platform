import { MilestonesField, type MilestoneRow } from '../milestones-field';

/**
 * The Our-Story form BODY, shared by the sub-page and the unified editor's
 * inline panel (owner 2026-07-25 — "our story … we want it to stay here").
 *
 * ⚠ Same rule as the dress-code extraction: `updateOurStory` reads EVERY field
 * on each save, so a partial form would silently blank the answers it didn't
 * post. One shared set of fields — 17 inputs + the milestones builder — makes
 * that impossible and keeps the two surfaces from drifting. Moved verbatim from
 * the page (which now renders this too); caller supplies the surrounding
 * `<form action=…>` + submit button.
 */

export type LoveStoryBlob = Record<string, unknown> & {
  anchors?: Record<string, unknown>;
  milestones?: MilestoneRow[];
};

export function storyString(blob: LoveStoryBlob, key: string): string {
  const v = blob[key];
  return typeof v === 'string' ? v : '';
}

export function parseMilestones(story: LoveStoryBlob): MilestoneRow[] {
  return Array.isArray(story.milestones)
    ? story.milestones.filter(
        (m): m is MilestoneRow =>
          !!m && typeof m === 'object' && typeof (m as MilestoneRow).title === 'string',
      )
    : [];
}

const fieldCls =
  'mt-2 w-full rounded-lg border border-ink/15 bg-cream p-3 text-sm leading-relaxed text-ink focus:border-terracotta focus:outline-none';

function Field({
  label,
  name,
  value,
  placeholder,
  rows = 2,
  hint,
}: {
  label: string;
  name: string;
  value: string;
  placeholder: string;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="sn-eye">{label}</span>
      <textarea
        name={name}
        rows={rows}
        maxLength={600}
        defaultValue={value}
        placeholder={placeholder}
        className={fieldCls}
      />
      {hint ? <span className="mt-1 block text-xs text-ink/45">{hint}</span> : null}
    </label>
  );
}

export function StoryFields({ story }: { story: LoveStoryBlob }) {
  const s = storyString;
  const anchors = (story.anchors ?? {}) as Record<string, unknown>;
  const anchor = (k: string) => (typeof anchors[k] === 'string' ? (anchors[k] as string) : '');
  const milestones = parseMilestones(story);

  return (
    <div className="space-y-8">
      <fieldset className="space-y-4">
        <legend className="font-serif text-lg italic text-ink">The beginning</legend>
        <Field
          label="How you met"
          name="how_we_met"
          value={s(story, 'how_we_met')}
          placeholder="One jeepney, two strangers, and rain that would not stop."
          rows={3}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="sn-eye">The year you met</span>
            <input name="met_year" defaultValue={s(story, 'met_year')} placeholder="2022" maxLength={12} className={fieldCls} />
          </label>
          <label className="block">
            <span className="sn-eye">Together since</span>
            <input name="together_since" defaultValue={s(story, 'together_since')} placeholder="2022" maxLength={120} className={fieldCls} />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-serif text-lg italic text-ink">The spark</legend>
        <Field
          label="The first thing you noticed was…"
          name="spark"
          value={s(story, 'spark')}
          placeholder="The way she laughed before the punchline."
        />
        <Field
          label="Why did that stick?"
          name="spark_why"
          value={s(story, 'spark_why')}
          placeholder="Because nobody else laughs like that."
        />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-serif text-lg italic text-ink">The almost</legend>
        <Field
          label="There was a moment you almost didn&rsquo;t make it because…"
          name="obstacle"
          value={s(story, 'obstacle')}
          placeholder="Two cities, one long year."
        />
        <Field
          label="What kept you going?"
          name="obstacle_kept"
          value={s(story, 'obstacle_kept')}
          placeholder="Sunday calls that never got shorter."
        />
        <input type="hidden" name="obstacle_kind" defaultValue={s(story, 'obstacle_kind')} />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-serif text-lg italic text-ink">The yes</legend>
        <Field
          label="You knew the moment…"
          name="proposal"
          value={s(story, 'proposal')}
          placeholder="The sun came up over the ridge and the question was already out."
          rows={3}
        />
        <Field
          label="How the other of you felt"
          name="proposal_feel"
          value={s(story, 'proposal_feel')}
          placeholder="Yes — before the sentence even finished."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="sn-eye">The year</span>
            <input name="proposal_year" defaultValue={s(story, 'proposal_year')} placeholder="2025" maxLength={12} className={fieldCls} />
          </label>
          <label className="block">
            <span className="sn-eye">The setting</span>
            <input
              name="proposal_setting"
              defaultValue={s(story, 'proposal_setting')}
              placeholder="a sunrise at the ridge"
              maxLength={120}
              className={fieldCls}
            />
          </label>
        </div>
        <input type="hidden" name="proposal_voice" defaultValue={s(story, 'proposal_voice')} />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-serif text-lg italic text-ink">The little things</legend>
        <p className="text-sm text-ink/60">The details only the two of you would know.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="sn-eye">Your song</span>
            <input name="anchor_song" defaultValue={anchor('song')} placeholder="The one you never skip" maxLength={120} className={fieldCls} />
          </label>
          <label className="block">
            <span className="sn-eye">Your place</span>
            <input name="anchor_place" defaultValue={anchor('place')} placeholder="Where it always ends up" maxLength={120} className={fieldCls} />
          </label>
          <label className="block">
            <span className="sn-eye">Your inside joke</span>
            <input name="anchor_injoke" defaultValue={anchor('injoke')} placeholder="No one else gets it" maxLength={120} className={fieldCls} />
          </label>
          <label className="block">
            <span className="sn-eye">Your food</span>
            <input name="anchor_food" defaultValue={anchor('food')} placeholder="The usual order" maxLength={120} className={fieldCls} />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-serif text-lg italic text-ink">Your timeline</legend>
        <p className="text-sm text-ink/60">
          The moments worth a line of their own — they render as your story&rsquo;s
          timeline.
        </p>
        <MilestonesField initial={milestones} />
      </fieldset>
    </div>
  );
}
