-- OMNW P2 deterministic read-only audit.
-- This file must remain SELECT-only. It is safe to run against omnw-production.

-- 1) Retired Harvest pipeline must remain absent from tables/views.
select table_schema, table_name, table_type
from information_schema.tables
where table_schema not in ('pg_catalog', 'information_schema')
  and table_name ilike '%harvest%'
order by table_schema, table_name;

-- 2) Discovery / Master / Consumer ownership surface.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'discovery_sources', 'discovery_runs', 'discovery_candidates',
    'wineries', 'wines', 'vintages', 'winery_aliases', 'wine_aliases',
    'user_profiles', 'wine_experiences', 'unknown_wine_submissions'
  )
order by table_name;

-- 3) Consumer tables must not depend directly on Discovery tables.
select
  tc.table_name,
  kcu.column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and tc.table_name in ('user_profiles', 'wine_experiences', 'unknown_wine_submissions')
  and ccu.table_name in ('discovery_sources', 'discovery_runs', 'discovery_candidates')
order by tc.table_name, kcu.column_name;
