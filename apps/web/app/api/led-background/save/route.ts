import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { findLedTemplate, LED_LOOP_OPTIONS } from '@/lib/led-background';

// 0005 LED Background Maker — save draft.
//
// POST /api/led-background/save
// Body: {
//   event_id: string,
//   template_slug: string,            // must match findLedTemplate
//   loop_duration_s: 300|600|1800|5400,
//   photo_pool_enabled: boolean,
// }
//
// Couple-authenticated. Upserts a `led_background_configs` row keyed by
// event_id where is_default=TRUE — V1 ships one default config per event
// (the partial unique index from PR #150 enforces this). The full
// customization payload (palette, effect_intensity, animation_speed,
// overlay, aspect_ratio, show_couple_names, show_date) lands in PR 2b
// when the editor surface adds those controls; for now we persist what
// the existing scaffold actually captures.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SaveBody = {
  event_id?: string;
  template_slug?: string;
  loop_duration_s?: number;
  photo_pool_enabled?: boolean;
};

const VALID_LOOP_SECONDS = new Set(
  LED_LOOP_OPTIONS.map((o) => o.durationSeconds),
);

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: SaveBody;
  try {
    body = (await req.json()) as SaveBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const eventId = body.event_id;
  const templateSlug = body.template_slug;
  const loopSeconds = body.loop_duration_s;
  const photoPool = body.photo_pool_enabled === true;

  if (!eventId || !templateSlug || !loopSeconds) {
    return NextResponse.json(
      { error: 'event_id, template_slug, loop_duration_s required' },
      { status: 400 },
    );
  }
  if (!findLedTemplate(templateSlug)) {
    return NextResponse.json({ error: 'unknown_template_slug' }, { status: 400 });
  }
  if (!VALID_LOOP_SECONDS.has(loopSeconds)) {
    return NextResponse.json({ error: 'invalid_loop_duration_s' }, { status: 400 });
  }
  // 5400 (90-min) is the Custom-tier render — saveable as a draft but the
  // render pipeline (PR 3) gates it behind the upsell. Accept here so the
  // editor surface can still draft a Custom config; pricing/checkout is a
  // downstream concern.

  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || membership.member_type !== 'couple') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();

  // Look for an existing default config (the partial unique index allows
  // exactly one is_default=TRUE row per event). If found, update in place;
  // otherwise insert a fresh row.
  const { data: existing } = await admin
    .from('led_background_configs')
    .select('config_id')
    .eq('event_id', eventId)
    .eq('is_default', true)
    .maybeSingle();

  const configJson = {
    template_id: templateSlug,
    loop_duration_s: loopSeconds,
    photo_pool_enabled: photoPool,
    // Other spec fields (palette, effect_intensity, animation_speed, overlay,
    // aspect_ratio, show_couple_names, show_date) default at render time
    // from the template's defaults.json until PR 2b adds editor controls.
  };

  if (existing) {
    const { error } = await admin
      .from('led_background_configs')
      .update({
        template_id: templateSlug,
        config_json: configJson,
        updated_at: new Date().toISOString(),
      })
      .eq('config_id', existing.config_id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ config_id: existing.config_id, created: false });
  }

  const { data: inserted, error } = await admin
    .from('led_background_configs')
    .insert({
      event_id: eventId,
      template_id: templateSlug,
      config_json: configJson,
      is_default: true,
    })
    .select('config_id')
    .single();
  if (error || !inserted) {
    return NextResponse.json(
      { error: error?.message ?? 'insert_failed' },
      { status: 500 },
    );
  }
  return NextResponse.json({ config_id: inserted.config_id, created: true });
}
