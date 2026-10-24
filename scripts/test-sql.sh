#!/usr/bin/env bash
# Runs supabase/tests/*.sql against the linked project. Each file ends by raising its results, which rolls
# everything back; this prints the results and fails when any line says FAIL.
set -euo pipefail
set -a; . ./.env.supabase; set +a
status=0
for f in supabase/tests/*.sql; do
  out=$(supabase db query --linked -f "$f" 2>&1 | grep -oE 'RESULTS:[^"]*' | sed 's/\\nCONTEXT.*//' || true)
  echo "$f: ${out:-no results}"
  if [[ -z "$out" || "$out" == *FAIL* ]]; then status=1; fi
done
exit $status
