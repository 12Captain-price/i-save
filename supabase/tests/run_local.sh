#!/usr/bin/env bash
# Runs every migration plus every SQL test against a throwaway local database.
# Usage: PGHOST=localhost PGUSER=postgres ./supabase/tests/run_local.sh
# Needs a local Postgres 15+ you can create databases in. Never point it at Supabase.
set -euo pipefail
cd "$(dirname "$0")"
DB="${ISAVE_TEST_DB:-isave_test}"

psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f 00_supabase_stub.sql

for f in ../migrations/*.sql; do
  echo "== migration: $(basename "$f")"
  psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f"
done

for f in [1-9][0-9]_*.sql; do
  echo "== test: $f"
  psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f"
done
echo "ALL TESTS PASSED"
