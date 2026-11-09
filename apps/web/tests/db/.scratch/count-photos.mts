// SCRATCH (never committed): count taxonomy photos after a full migration replay.
import { createReplayedDb } from '../replay-migrations.ts';
const { db } = await createReplayedDb();
const r = await db.query<{ id: string; tier: number; photo: string | null; hidden: boolean }>(
  `select id, tier, nullif(sample_photo_r2_key,'') as photo, marketplace_hidden as hidden from public.service_categories where tier in (1,2) order by tier, sort_order`);
console.log(JSON.stringify(r.rows));
process.exit(0);
