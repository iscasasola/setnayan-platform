-- Deactivate the stray STD_VIDEO_UPLOAD ₱100 SKU (owner 2026-07-10). Video on the
-- Save-the-Date is now bundled into the Cinematic Reveal (STD_PREMIUM_OPENINGS),
-- so the standalone ₱100 video add-on is retired. Idempotent (already inactive in
-- prod; this pins it in repo history). The homepage "STD video upload" display row
-- is removed in the same PR.
UPDATE platform_retail_catalog_v2 SET is_active = false, updated_at = now() WHERE service_code = 'STD_VIDEO_UPLOAD';
