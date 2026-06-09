#!/usr/bin/env bash
#
# r2-cors.sh — apply the browser-direct-upload CORS policy to every R2 bucket
# that <FileUpload> (apps/web/app/_components/file-upload.tsx) PUTs to via the
# /api/upload presign route.
#
# WHY THIS EXISTS
# ---------------
# Uploads from the browser go: client → POST /api/upload (presign, same-origin)
# → XHR PUT straight to the R2 bucket endpoint (CROSS-origin). R2 only attaches
# `Access-Control-Allow-Origin` to a response when the bucket's CORS policy
# matches the request's origin + method. With no matching rule, the browser
# masks even a clean 200 as a network error: the XHR fires `onerror` and the
# uploader shows "Upload failed … Check your connection and retry." — with no
# HTTP status, because the browser never let JS see the response.
#
# So a *presign success + upload onerror* (not "R2 rejected (status N)") is the
# signature of a missing/mismatched bucket CORS policy. R2 credentials being
# set (presign works) does NOT imply CORS is set — they're separate config.
#
# Gotcha that bit us: R2 matches `AllowedOrigins` EXACTLY. The live site is
# served from https://www.setnayan.com, so a policy that only lists
# https://setnayan.com (no `www`) still blocks every upload.
#
# IDEMPOTENT: put-bucket-cors REPLACES the policy, so re-running is safe.
#
# REQUIREMENTS
# ------------
#   - AWS CLI (R2 is S3-compatible).  brew install awscli
#   - R2 credentials in the environment — the SAME vars the app reads in
#     apps/web/lib/r2.ts:
#       R2_ACCOUNT_ID  R2_ACCESS_KEY_ID  R2_SECRET_ACCESS_KEY
#
# USAGE
# -----
#   R2_ACCOUNT_ID=…  R2_ACCESS_KEY_ID=…  R2_SECRET_ACCESS_KEY=… \
#     apps/web/scripts/r2-cors.sh
#
#   # Override the allowed origins (comma-separated) if your domains differ:
#   R2_CORS_ORIGINS="https://www.setnayan.com,https://setnayan.com" \
#     apps/web/scripts/r2-cors.sh
#
# WRANGLER / DASHBOARD ALTERNATIVE (no AWS CLI)
# ---------------------------------------------
# Paste this BARE-ARRAY JSON into Cloudflare dash → R2 → <bucket> → Settings →
# CORS Policy (repeat for all 5 buckets):
#
#   [
#     {
#       "AllowedOrigins": ["https://www.setnayan.com","https://setnayan.com",
#                          "https://*.vercel.app","http://localhost:3000"],
#       "AllowedMethods": ["GET","PUT","HEAD"],
#       "AllowedHeaders": ["*"],
#       "ExposeHeaders":  ["ETag"],
#       "MaxAgeSeconds":  3600
#     }
#   ]
#
set -euo pipefail

: "${R2_ACCOUNT_ID:?set R2_ACCOUNT_ID (same value the app uses in Vercel)}"
: "${R2_ACCESS_KEY_ID:?set R2_ACCESS_KEY_ID}"
: "${R2_SECRET_ACCESS_KEY:?set R2_SECRET_ACCESS_KEY}"

if ! command -v aws >/dev/null 2>&1; then
  echo "error: AWS CLI not found. Install it (brew install awscli) or use the" >&2
  echo "       dashboard/wrangler path documented in this script's header." >&2
  exit 1
fi

ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# Comma-separated origins. Defaults cover prod (apex + www, .com + .ph), the
# Vercel production alias, all Vercel preview deploys, and local dev.
DEFAULT_ORIGINS="https://www.setnayan.com,https://setnayan.com,https://www.setnayan.ph,https://setnayan.ph,https://setnayan-platform-web.vercel.app,https://*.vercel.app,http://localhost:3000"
ORIGINS="${R2_CORS_ORIGINS:-$DEFAULT_ORIGINS}"

# Turn the comma list into a JSON array fragment: a,b → "a","b"
origins_json=$(printf '%s' "$ORIGINS" | awk -F',' '{
  for (i = 1; i <= NF; i++) printf "%s\"%s\"", (i > 1 ? "," : ""), $i
}')

CORS_JSON="{\"CORSRules\":[{\"AllowedOrigins\":[${origins_json}],\"AllowedMethods\":[\"GET\",\"PUT\",\"HEAD\"],\"AllowedHeaders\":[\"*\"],\"ExposeHeaders\":[\"ETag\"],\"MaxAgeSeconds\":3600}]}"

# Every bucket <FileUpload> can target (see R2_BUCKETS in apps/web/lib/r2.ts).
BUCKETS=(
  setnayan-media
  setnayan-thread-files
  setnayan-vendor-contracts
  setnayan-samples
  setnayan-vendor-verification
)

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="auto"

echo "Endpoint: $ENDPOINT"
echo "Origins:  $ORIGINS"
echo

for b in "${BUCKETS[@]}"; do
  echo "→ ${b}"
  aws s3api put-bucket-cors \
    --bucket "$b" \
    --endpoint-url "$ENDPOINT" \
    --cors-configuration "$CORS_JSON"
  echo "  ✓ applied"
done

echo
echo "Done — CORS is live immediately, no redeploy. Hard-refresh the page"
echo "(to drop a cached failed preflight) and retry the upload."
echo
echo "Verify a bucket with:"
echo "  AWS_DEFAULT_REGION=auto AWS_ACCESS_KEY_ID=\$R2_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY=\$R2_SECRET_ACCESS_KEY \\"
echo "    aws s3api get-bucket-cors --bucket setnayan-media --endpoint-url $ENDPOINT"
