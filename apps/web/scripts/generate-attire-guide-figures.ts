/**
 * generate-attire-guide-figures.ts
 *
 * Generation script for the 5-style × 10-role Wedding Attire Guide
 * clipart library. Reads the canonical prompt template + per-role +
 * per-style parameter tables from
 * `02_Specifications/Wedding_Attire_Guide_AI_Generation.md`, fans them
 * into 50 Recraft API calls, downloads SVG outputs, uploads to R2, and
 * writes a seed-SQL stdout dump for human review before applying as a
 * Supabase migration.
 *
 * Owner action gate: requires RECRAFT_API_KEY in env (sign up at
 * https://www.recraft.ai/, generate a key, paste into .env.local AND
 * Vercel env). Optional: R2_* env vars to upload directly to Cloudflare
 * R2; without them, script writes SVGs to /tmp/recraft-output/ for
 * manual upload.
 *
 * Run:
 *   pnpm -F web tsx scripts/generate-attire-guide-figures.ts
 *
 * Flags (env vars):
 *   RECRAFT_API_KEY=...      Required
 *   R2_ACCOUNT_ID=...        Optional · enables R2 upload
 *   R2_ACCESS_KEY_ID=...     Optional · enables R2 upload
 *   R2_SECRET_ACCESS_KEY=... Optional · enables R2 upload
 *   R2_PUBLIC_BASE_URL=...   Optional · override the public-URL prefix
 *                              for the uploaded SVGs (default:
 *                              https://media.setnayan.com)
 *   DRY_RUN=1                Optional · skips API calls + writes the
 *                              prompts only (for prompt-review iteration)
 *   ROLES=bride,groom        Optional · comma-separated RoleKey filter
 *                              for selective regeneration
 *   STYLES="editorial cream" Optional · comma-separated style filter for
 *                              selective regeneration (note: style values
 *                              contain spaces + middots, quote in shell)
 *
 * Output:
 *   /tmp/recraft-output/{style_slug}/{role}.svg  - raw SVG bytes per figure
 *   /tmp/recraft-output/preview.html             - visual grid for review
 *   /tmp/recraft-output/seed.sql                 - copy-paste for migration
 *   stdout: progress log + cost tally
 */

import { generateVectorSvg, decodeBase64Svg } from '../lib/recraft';
import {
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Types matching the prompt spec doc + WAG RoleKey union.
// ---------------------------------------------------------------------------

type RoleKey =
  | 'bride'
  | 'groom'
  | 'bridesmaids'
  | 'groomsmen'
  | 'female_ps'
  | 'male_ps'
  | 'mothers'
  | 'fathers'
  | 'guests'
  | 'men_guests';

type StyleKey =
  | 'elegant · simple · classic'
  | 'bridgerton · regal'
  | 'editorial cream'
  | 'tropical heritage'
  | 'modern minimalist';

type RoleParams = {
  label: string;
  pose: string;
  attireBase: string;
  /** Main attire color · the dominant block (gown body, suit jacket,
   *  dress fabric). Gets the bulk of the painted region. */
  defaultTint: string;
  /** Accent attire color · the smaller secondary detail color (sash,
   *  belt, tie, trim, embroidery, neckline edge, boutonniere ribbon).
   *  Owner directive 2026-05-23 PM 4th-pass: Filipino wedding attire
   *  conventionally has 2 visible colors — main fabric + small accent
   *  element. Single-tone figures read as flat / unfinished. */
  accentTint: string;
  /** Description of where the accent appears on this specific role's
   *  attire (informs Recraft what region to paint with accentTint). */
  accentLocation: string;
  ethnicityPrecision: string;
  attireDetail: string;
};

type StyleParams = {
  label: string;
  modifier: string;
  /** URL-safe slug for the R2 path + DB style_theme reverse-mapping. */
  slug: string;
};

// ---------------------------------------------------------------------------
// Per-role + per-style parameter tables — mirror the spec doc verbatim.
// ---------------------------------------------------------------------------

const ROLES: Record<RoleKey, RoleParams> = {
  bride: {
    label: 'Bride',
    pose: 'standing front-facing, hands holding small bouquet at waist',
    attireBase:
      'wedding gown, A-line silhouette, fitted bodice, soft veil flowing behind shoulders',
    defaultTint: '#FAFAFA',
    accentTint: '#D4B896',
    accentLocation:
      'champagne sash at waist + champagne bouquet ribbon',
    ethnicityPrecision:
      'Filipina woman, fair-complexion light tan skin, dark brown long hair past shoulders, soft feminine youthful face, gentle smile',
    attireDetail:
      'small white-and-blush bouquet at waist, modest scoop neckline, no train',
  },
  groom: {
    label: 'Groom',
    pose: 'standing front-facing, hands at sides',
    attireBase:
      'barong tagalog over black trousers, traditional Filipino embroidery panel down center front',
    defaultTint: '#E8D9B8',
    accentTint: '#2E3F5C',
    accentLocation:
      'navy boutonniere ribbon at left chest + dark navy trim along barong neckline',
    ethnicityPrecision:
      'Filipino man, fair-complexion light tan skin, short black hair, clean shaven, friendly serious face',
    attireDetail:
      'small ribbon boutonniere at left chest, formal black trousers, formal black leather shoes',
  },
  bridesmaids: {
    label: 'Bridesmaid',
    pose: 'standing front-facing, holding small posy bouquet at waist',
    attireBase:
      'matching A-line bridesmaid gown, sleeveless, knee-length, soft skirt flare',
    defaultTint: '#7E1F32',
    accentTint: '#D4B896',
    accentLocation:
      'champagne sash at waist + champagne bouquet ribbon',
    ethnicityPrecision:
      'young Filipina woman, fair-complexion light tan skin, dark hair half-up, soft feminine face, gentle smile',
    attireDetail:
      'small matching posy bouquet, simple round neckline, low-heel pumps',
  },
  groomsmen: {
    label: 'Groomsman',
    pose: 'standing front-facing, hands at sides',
    attireBase:
      'tailored navy two-piece suit, crisp white dress shirt, narrow tie',
    defaultTint: '#2E3F5C',
    accentTint: '#7E1F32',
    accentLocation:
      'burgundy tie + burgundy pocket square + burgundy boutonniere',
    ethnicityPrecision:
      'young Filipino man, fair-complexion light tan skin, short black hair, clean shaven, friendly smile',
    attireDetail: 'small boutonniere at lapel, tucked shirt, polished black shoes',
  },
  female_ps: {
    label: 'Female Principal Sponsor',
    pose: 'standing front-facing, hands clasped at waist',
    attireBase:
      'formal Filipiniana terno gown with classic butterfly sleeves, full-length, refined sash',
    defaultTint: '#D4B896',
    accentTint: '#C9A66B',
    accentLocation:
      'gold ceremonial sash from shoulder to hip + gold-trimmed butterfly sleeve edges',
    ethnicityPrecision:
      'mature Filipina woman in her 50s, fair-complexion light tan skin, hair styled up in soft chignon, dignified gentle face',
    attireDetail: 'shawl draped over one arm, small clutch, formal heels',
  },
  male_ps: {
    label: 'Male Principal Sponsor',
    pose: 'standing front-facing, hands at sides',
    attireBase:
      'embroidered barong tagalog with prominent piña-textile pattern, formal black trousers',
    defaultTint: '#E8D9B8',
    accentTint: '#C9A66B',
    accentLocation:
      'gold ceremonial lapel pin + gold-trimmed embroidery panel down center',
    ethnicityPrecision:
      'distinguished Filipino man in his 50s, fair-complexion light tan skin, salt-and-pepper short hair, clean shaven, dignified face',
    attireDetail: 'gold lapel pin, formal black leather shoes',
  },
  mothers: {
    label: 'Mother of the Bride/Groom',
    pose: 'standing front-facing, slight smile',
    attireBase:
      'midi-length formal dress with elegant shawl draped over shoulders, modest sleeves',
    defaultTint: '#C5C8CC',
    accentTint: '#2E3F5C',
    accentLocation:
      'navy shawl draped over shoulders + navy small clutch',
    ethnicityPrecision:
      'mature Filipina woman in her 60s, fair-complexion light tan skin, short hair styled simply, warm gentle motherly face',
    attireDetail: 'small clutch, low-heel formal pumps',
  },
  fathers: {
    label: 'Father of the Bride/Groom',
    pose: 'standing front-facing, hands at sides',
    attireBase: 'barong tagalog mature gentleman cut, formal black trousers',
    defaultTint: '#E8D9B8',
    accentTint: '#1A1A1A',
    accentLocation:
      'black trim along barong collar + black-detailed embroidery panel',
    ethnicityPrecision:
      'mature Filipino man in his 60s, fair-complexion light tan skin, short white-gray hair, clean shaven, dignified gentle face',
    attireDetail: 'formal black leather shoes',
  },
  guests: {
    label: 'Guest woman',
    pose: 'standing front-facing',
    attireBase: 'knee-length cocktail dress, fitted bodice with soft skirt',
    defaultTint: '#7E1F32',
    accentTint: '#C9A66B',
    accentLocation: 'gold clutch + gold belt accent at waist',
    ethnicityPrecision:
      'young Filipina woman, fair-complexion light tan skin, dark hair styled simply, soft feminine face',
    attireDetail: 'small clutch, formal heels',
  },
  men_guests: {
    label: 'Guest man',
    pose: 'standing front-facing, hands at sides',
    attireBase:
      'long-sleeve polo or guayabera-cut shirt, dress trousers, no tie',
    defaultTint: '#B8DCE8',
    accentTint: '#2E3F5C',
    accentLocation: 'navy dress trousers + navy belt',
    ethnicityPrecision:
      'young Filipino man, fair-complexion light tan skin, short black hair, clean shaven, friendly relaxed face',
    attireDetail: 'tucked-in shirt, formal leather shoes, smart casual register',
  },
};

const STYLES: Record<StyleKey, StyleParams> = {
  'elegant · simple · classic': {
    label: 'Elegant · Simple · Classic',
    modifier:
      'sophisticated editorial illustration, refined and minimal, subdued color palette with cream + ink + single accent, magazine-clipping aesthetic',
    slug: 'elegant-simple-classic',
  },
  'bridgerton · regal': {
    label: 'Bridgerton · Regal',
    modifier:
      'Regency-era period illustration, romantic Bridgerton aesthetic, rich jewel-tone color palette with burgundy and gold, ornate but flat-vector-style detail',
    slug: 'bridgerton-regal',
  },
  'editorial cream': {
    label: 'Editorial Cream',
    modifier:
      'wedding-magazine editorial illustration, sophisticated cream + blush + champagne-gold palette, soft refined aesthetic, neutral tones with one warm accent',
    slug: 'editorial-cream',
  },
  'tropical heritage': {
    label: 'Tropical Heritage',
    modifier:
      'tropical Filipino heritage illustration, abaca + piña textile inspiration, warm greens and earthy ochres, cultural rootedness, Filipiniana embroidery hint',
    slug: 'tropical-heritage',
  },
  'modern minimalist': {
    label: 'Modern Minimalist',
    modifier:
      'modern minimalist illustration, two-tone bold palette, stark contemporary aesthetic, architectural clean lines, no ornamentation',
    slug: 'modern-minimalist',
  },
};

// ---------------------------------------------------------------------------
// Prompt template assembly — mirrors the spec doc.
// ---------------------------------------------------------------------------

function buildPrompt(role: RoleParams, style: StyleParams): string {
  // Owner directive 2026-05-23 PM 5th pass: shared reference image of
  // "WEDDING ATTIRE GUIDE · elegant · simple · classic" showing the actual
  // target aesthetic — soft fashion-illustration / Etsy wedding clipart
  // style, with FACELESS abstracted heads (no facial features), natural
  // standing poses, cream warm background, 2-tone attire clearly visible.
  //
  // Pivoting AWAY from analytical prompting (color hex codes, ear
  // placement instructions, gender-anti-beard negatives) which Recraft
  // kept ignoring or mis-interpreting. New approach: lean into aesthetic
  // reference vocabulary Recraft was trained on (Etsy wedding clipart,
  // fashion plate, magazine editorial illustration). Skip the face
  // entirely — matches the reference AND eliminates the beard/ear issues
  // (no face = no facial-rendering failures).
  const isFemale =
    role.label.toLowerCase().includes('bride') ||
    role.label.toLowerCase().includes('mother') ||
    role.label.toLowerCase().includes('female') ||
    role.label.toLowerCase().includes('guest woman') ||
    role.label.toLowerCase().includes('bridesmaid');
  const hairDesc = isFemale
    ? 'sleek long dark hair flowing past shoulders'
    : 'short dark hair, clean groomed';
  const personDesc = isFemale ? 'Filipina woman' : 'Filipino man';

  // Owner directive 2026-05-23 PM 6th pass: revert to v3 prompt (the
  // "perfect!" iteration). Drop the v4 additions of explicit
  // transparent-background instructions + natural-standing-pose
  // contrapposto language — those changed the aesthetic away from
  // what owner approved. The SVG that v3 produced is already
  // transparent (verified via PIL pixel sampling: all 4 corner
  // alpha=0), the cream backdrop the owner saw was a Preview-app
  // viewer artifact, not in the file. Keep v3 prompt verbatim.
  return `Soft fashion-illustration of a ${personDesc} in wedding attire, Etsy wedding-attire-guide clipart style, magazine editorial fashion plate aesthetic. FACELESS figure: no facial features rendered, no eyes, no nose, no mouth, no ears visible — head is an abstract simple silhouette with only the ${hairDesc} clearly defined. Fair Filipina light-tan skin tone for any visible skin (neck, hands).

Wearing ${role.attireBase}. Two-tone color blocking clearly visible: main attire color ${role.defaultTint} (covers most of the fabric) PLUS accent color ${role.accentTint} on ${role.accentLocation}. Both colors must be distinct flat regions on the figure, not blended.

${role.attireDetail}. Natural relaxed standing pose, ${role.pose}. Subtle soft shadow under the feet indicating standing on a surface.

Aesthetic: ${style.modifier}. Soft watercolor-meets-flat-vector style, clean fashion-plate proportions, similar to elegant Etsy/Pinterest wedding-attire-guide illustrations by independent designers. Warm cream pastel background (not pure white). Sophisticated minimalist character illustration. Full body view, single subject centered.

Color blocking: solid flat regions with subtle soft transitions only at fabric folds. Skip detailed facial features, skip detailed hand features, focus all detail on the attire itself.

Negative: photorealism, harsh gradients, dramatic shadows, noise, texture overlays, multiple figures, busy background scenes, watermarks, text labels, signatures, anime style, manga style, hyperrealistic, detailed face, eyes, nose, mouth, facial features, protruding ears, exaggerated features, monochrome single-color outfit, plain pure-white background, harsh outlines, cartoon outline style.`;
}

// ---------------------------------------------------------------------------
// R2 upload (optional — falls through to /tmp if R2 env vars missing).
// ---------------------------------------------------------------------------

function getR2Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

const R2_BUCKET = 'setnayan-media';

async function uploadSvgToR2(
  client: S3Client,
  key: string,
  svgBytes: string,
): Promise<string> {
  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: svgBytes,
      ContentType: 'image/svg+xml',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
  // URL pattern depends on R2_PUBLIC_URL type:
  //   r2.dev subdomain (pub-{hash}.r2.dev) → bucket name IMPLICIT in pub-{hash}
  //     prefix → URL = `${R2_PUBLIC_URL}/${key}` (no bucket in path)
  //   custom domain (media.setnayan.com) → bucket name may need to be in path
  //     depending on Cloudflare Custom Domain config → URL = `${R2_PUBLIC_URL}/${bucket}/${key}`
  // Detected via .r2.dev presence in the base URL.
  const base = process.env.R2_PUBLIC_URL;
  if (!base) {
    throw new Error(
      'R2_PUBLIC_URL env var is unset. Paste the value from Vercel (the ' +
        'public-facing R2 URL prefix · custom domain OR r2.dev subdomain) ' +
        'into apps/web/.env.local. Without it the script cannot construct ' +
        'a reachable URL for the seed SQL.',
    );
  }
  // Strip trailing slash from base if present to avoid `//` in the path.
  const baseClean = base.replace(/\/$/, '');
  // r2.dev URLs are bucket-specific (each bucket has its own pub-{hash}
  // subdomain); custom domains MAY be account-level + need bucket in path.
  const isR2DevUrl = baseClean.includes('.r2.dev');
  return isR2DevUrl
    ? `${baseClean}/${key}`
    : `${baseClean}/${R2_BUCKET}/${key}`;
}

// ---------------------------------------------------------------------------
// Main loop.
// ---------------------------------------------------------------------------

async function main() {
  const dryRun = process.env.DRY_RUN === '1';
  const r2 = getR2Client();
  const outDir = '/tmp/recraft-output';
  fs.mkdirSync(outDir, { recursive: true });

  // Optional CLI filters for selective regeneration.
  const roleFilter = process.env.ROLES?.split(',').map((s) => s.trim()) ?? null;
  const styleFilter = process.env.STYLES?.split(',').map((s) => s.trim()) ?? null;

  const roleKeys = (Object.keys(ROLES) as RoleKey[]).filter(
    (k) => !roleFilter || roleFilter.includes(k),
  );
  const styleKeys = (Object.keys(STYLES) as StyleKey[]).filter(
    (k) => !styleFilter || styleFilter.includes(k),
  );
  const totalJobs = roleKeys.length * styleKeys.length;

  console.log(
    `[recraft-generate] starting · ${totalJobs} jobs · dryRun=${dryRun} · ` +
      `R2=${r2 ? 'configured' : 'fallback to /tmp'}`,
  );

  type Result = {
    role: RoleKey;
    style: StyleKey;
    storagePath: string;
    sampledHex: string;
    label: string;
  };
  const results: Result[] = [];
  let jobIdx = 0;
  let totalUsCost = 0;

  for (const styleKey of styleKeys) {
    const styleParams = STYLES[styleKey];
    fs.mkdirSync(path.join(outDir, styleParams.slug), { recursive: true });

    for (const roleKey of roleKeys) {
      jobIdx += 1;
      const roleParams = ROLES[roleKey];
      const prompt = buildPrompt(roleParams, styleParams);

      console.log(
        `[recraft-generate] ${jobIdx}/${totalJobs} · ${styleKey} / ${roleKey}`,
      );

      if (dryRun) {
        // Write the prompt for human review without firing the API call.
        fs.writeFileSync(
          path.join(outDir, styleParams.slug, `${roleKey}.prompt.txt`),
          prompt,
        );
        continue;
      }

      try {
        const gen = await generateVectorSvg({
          prompt,
          style: 'vector_illustration',
          // substyle dropped — recraftv4_1_vector rejected 'flat_2' as
          // "doesn't support style 'vector_illustration_flat_2'". V4.1
          // renamed/removed V3 substyles. Letting Recraft pick the default
          // substyle for vector_illustration; we can re-add a valid V4.1
          // substyle after inspecting the default output quality.
          size: '1024x1024',
        });
        totalUsCost += 0.08;
        const svgBytes = decodeBase64Svg(gen.b64Svg);

        // Always write to /tmp for local review.
        const localPath = path.join(outDir, styleParams.slug, `${roleKey}.svg`);
        fs.writeFileSync(localPath, svgBytes);

        // Upload to R2 if configured; otherwise stash the /tmp path as the
        // storage_path so the operator can manually upload + then edit the
        // seed SQL.
        let storagePath: string;
        if (r2) {
          const r2Key = `moodboard-library/figure_attire/${styleParams.slug}/${roleKey}.svg`;
          storagePath = await uploadSvgToR2(r2, r2Key, svgBytes);
        } else {
          storagePath = `file://${localPath}`;
        }

        results.push({
          role: roleKey,
          style: styleKey,
          storagePath,
          sampledHex: roleParams.defaultTint,
          label: `${roleParams.label} · ${styleParams.label} (Recraft V3 vector)`,
        });
      } catch (err) {
        console.error(
          `[recraft-generate] ${styleKey} / ${roleKey} FAILED:`,
          (err as Error).message,
        );
        // Continue — don't abort the whole batch on a single failure.
      }

      // Rate-limit: Recraft free tier ~30 req/min · 2 sec spacing keeps us
      // well below the cap with headroom for the retry path.
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log(
    `[recraft-generate] done · ${results.length}/${totalJobs} succeeded · ` +
      `est. cost $${totalUsCost.toFixed(2)} USD`,
  );

  // Emit seed SQL for migration commit. Wrap in BEGIN/COMMIT + idempotent
  // INSERT-WHERE-NOT-EXISTS gating (matches the pattern from 20260611000000).
  const seedSqlLines: string[] = [
    '-- Auto-generated by apps/web/scripts/generate-attire-guide-figures.ts',
    `-- Generated at ${new Date().toISOString()}`,
    `-- ${results.length} figure_attire rows · 5-style × 10-role library`,
    '',
    'BEGIN;',
    '',
  ];
  for (const r of results) {
    const labelEsc = r.label.replace(/'/g, "''");
    const storageEsc = r.storagePath.replace(/'/g, "''");
    seedSqlLines.push(
      `INSERT INTO public.moodboard_library_assets`,
      `  (asset_type, asset_subtype, label, storage_path, source, style_theme, approved_at)`,
      `SELECT 'figure_attire', '${r.role}', '${labelEsc}',`,
      `       '${storageEsc}', 'higgsfield_generated', '${r.style}', NOW()`,
      `WHERE NOT EXISTS (`,
      `  SELECT 1 FROM public.moodboard_library_assets`,
      `  WHERE asset_subtype = '${r.role}' AND style_theme = '${r.style}'`,
      `);`,
      '',
      `INSERT INTO public.moodboard_asset_color_ranges`,
      `  (asset_id, slot_id, sampled_hex, tolerance_de, region_label)`,
      `SELECT a.asset_id, 1, '${r.sampledHex}', 15, 'attire'`,
      `FROM public.moodboard_library_assets a`,
      `WHERE a.asset_subtype = '${r.role}'`,
      `  AND a.style_theme = '${r.style}'`,
      `  AND NOT EXISTS (`,
      `    SELECT 1 FROM public.moodboard_asset_color_ranges rg`,
      `    WHERE rg.asset_id = a.asset_id AND rg.slot_id = 1`,
      `  );`,
      '',
    );
  }
  seedSqlLines.push('COMMIT;');
  const seedSqlPath = path.join(outDir, 'seed.sql');
  fs.writeFileSync(seedSqlPath, seedSqlLines.join('\n'));
  console.log(`[recraft-generate] seed SQL written to ${seedSqlPath}`);

  // Preview HTML — visual review surface. Lays out all 50 SVGs in a 5×10
  // grid (5 styles down rows, 10 roles across cols) so the operator can
  // spot quality issues + mark regeneration targets before committing.
  const previewLines: string[] = [
    '<!DOCTYPE html>',
    '<html lang="en"><head><meta charset="utf-8"><title>Recraft attire-guide preview</title>',
    '<style>',
    '  body { font-family: system-ui; background: #FAF7F2; color: #1A1A1A; padding: 2rem; }',
    '  h1 { font-size: 1.5rem; margin-bottom: 1rem; }',
    '  .grid { display: grid; grid-template-columns: 200px repeat(10, 120px); gap: 1rem; align-items: end; }',
    '  .header { font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; }',
    '  .style-label { writing-mode: horizontal-tb; padding: 1rem 0; }',
    '  .figure { width: 120px; height: 192px; border: 1px solid #E5E5E5; border-radius: 4px; background: white; padding: 4px; }',
    '  .figure img { width: 100%; height: 100%; object-fit: contain; }',
    '  .role-label { font-size: 0.7rem; text-align: center; padding-top: 4px; color: #666; }',
    '  .missing { display: flex; align-items: center; justify-content: center; color: #999; font-size: 0.7rem; }',
    '</style></head><body>',
    '<h1>Recraft attire-guide preview · 5 styles × 10 roles</h1>',
    `<p>Generated ${new Date().toISOString()} · ${results.length}/${totalJobs} succeeded · est. cost $${totalUsCost.toFixed(2)}</p>`,
    '<div class="grid">',
    '<div></div>',
    ...roleKeys.map((r) => `<div class="header role-label">${ROLES[r].label}</div>`),
  ];
  for (const styleKey of styleKeys) {
    const sp = STYLES[styleKey];
    previewLines.push(`<div class="header style-label">${sp.label}</div>`);
    for (const roleKey of roleKeys) {
      const match = results.find((x) => x.style === styleKey && x.role === roleKey);
      if (match) {
        const src = match.storagePath.startsWith('file://')
          ? match.storagePath
          : match.storagePath;
        previewLines.push(
          `<div class="figure"><img src="${src}" alt="${ROLES[roleKey].label} · ${sp.label}"/></div>`,
        );
      } else {
        previewLines.push(
          `<div class="figure missing">(failed)</div>`,
        );
      }
    }
  }
  previewLines.push('</div></body></html>');
  const previewPath = path.join(outDir, 'preview.html');
  fs.writeFileSync(previewPath, previewLines.join('\n'));
  console.log(`[recraft-generate] preview HTML at ${previewPath}`);
  console.log(
    `[recraft-generate] open in browser to visually review before applying seed SQL`,
  );
}

main().catch((err) => {
  console.error('[recraft-generate] fatal:', err);
  process.exit(1);
});
