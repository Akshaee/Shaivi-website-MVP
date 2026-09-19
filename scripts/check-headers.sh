#!/usr/bin/env bash
# Verifies the security headers on a deployed URL.
#
#   bash scripts/check-headers.sh https://shaivi-website.vercel.app
#
# Run this after every deploy: the headers come from vercel.json, so a
# misconfigured project or a missed redeploy is invisible until you look.
set -uo pipefail

URL="${1:-}"
if [[ -z "$URL" ]]; then
  echo "usage: bash scripts/check-headers.sh <url>" >&2
  exit 64
fi

URL="${URL%/}/"
echo "Checking $URL"
echo

HEADERS=$(curl -sSIL --max-time 20 "$URL") || {
  echo "Could not reach $URL" >&2
  exit 1
}

failures=0

expect() {
  local name="$1" pattern="$2"
  local value
  value=$(printf '%s\n' "$HEADERS" | grep -i "^${name}:" | tail -1 | cut -d: -f2- | tr -d '\r' | sed 's/^ *//')

  if [[ -z "$value" ]]; then
    printf '  MISSING  %-34s\n' "$name"
    failures=$((failures + 1))
  elif [[ "$value" =~ $pattern ]]; then
    printf '  ok       %-34s %s\n' "$name" "$value"
  else
    printf '  WRONG    %-34s %s\n' "$name" "$value"
    printf '           expected to match: %s\n' "$pattern"
    failures=$((failures + 1))
  fi
}

reject() {
  local name="$1"
  if printf '%s\n' "$HEADERS" | grep -qi "^${name}:"; then
    printf '  LEAKED   %-34s should not be sent\n' "$name"
    failures=$((failures + 1))
  else
    printf '  ok       %-34s absent\n' "$name"
  fi
}

echo "Security headers"
expect "strict-transport-security" "max-age=[0-9]+"
expect "content-security-policy" "frame-ancestors 'none'"
expect "x-frame-options" "DENY"
expect "x-content-type-options" "nosniff"
expect "referrer-policy" "strict-origin-when-cross-origin"
expect "permissions-policy" "camera=\(\)"
expect "cross-origin-opener-policy" "same-origin"
expect "cross-origin-resource-policy" "same-origin"
reject "x-powered-by"
reject "server-timing"

echo
echo "Content security policy in the page"
BODY=$(curl -sSL --max-time 20 "$URL")
if grep -qi 'http-equiv="content-security-policy"' <<<"$BODY"; then
  if grep -qi "unsafe-inline\|unsafe-eval" <<<"$BODY"; then
    echo "  FAIL     meta CSP contains an unsafe directive"
    failures=$((failures + 1))
  else
    echo "  ok       meta CSP present, no unsafe directives"
  fi
else
  echo "  MISSING  meta CSP tag"
  failures=$((failures + 1))
fi

echo
echo "Crawl controls"
ROBOTS=$(curl -sSL --max-time 20 "${URL}robots.txt")
if grep -qi "disallow: /" <<<"$ROBOTS"; then
  echo "  ok       robots.txt disallows crawling (pitch mode)"
else
  echo "  note     robots.txt allows crawling — only correct after launch"
fi

if grep -qi 'name="robots" content="noindex' <<<"$BODY"; then
  echo "  ok       pages carry noindex (pitch mode)"
else
  echo "  note     pages are indexable — only correct after launch"
fi

echo
echo "Cache headers on hashed assets"
ASSET=$(grep -o '/_astro/[A-Za-z0-9._-]*\.css' <<<"$BODY" | head -1)
if [[ -n "$ASSET" ]]; then
  ASSET_HEADERS=$(curl -sSI --max-time 20 "${URL%/}${ASSET}")
  if grep -qi "cache-control:.*immutable" <<<"$ASSET_HEADERS"; then
    echo "  ok       $ASSET is cached immutably"
  else
    echo "  FAIL     $ASSET is not cached immutably"
    failures=$((failures + 1))
  fi
else
  echo "  note     no external stylesheet found (it may be inlined)"
fi

echo
echo "Contact endpoint"
API_HEADERS=$(curl -sSI --max-time 20 -X GET "${URL}api/contact/")
if grep -qi "cache-control:.*no-store" <<<"$API_HEADERS"; then
  echo "  ok       /api/contact/ is never cached"
else
  echo "  FAIL     /api/contact/ is missing Cache-Control: no-store"
  failures=$((failures + 1))
fi

STATUS=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 20 -X GET "${URL}api/contact/")
if [[ "$STATUS" == "405" ]]; then
  echo "  ok       GET /api/contact/ returns 405"
else
  echo "  FAIL     GET /api/contact/ returned $STATUS, expected 405"
  failures=$((failures + 1))
fi

echo
if (( failures > 0 )); then
  echo "$failures check(s) failed."
  exit 1
fi
echo "All header checks passed."
