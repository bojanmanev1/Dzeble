-- 1. Purge obsolete outages that ended more than 24 hours ago
DELETE FROM public.utility_alerts
WHERE end_time < (now() - interval '24 hours');

-- 2. Deduplicate utility_alerts: keep only the newest single record for each unique outage
DELETE FROM public.utility_alerts a
WHERE a.id NOT IN (
  SELECT DISTINCT ON (type, source, city, COALESCE(address, location_name), start_time) id
  FROM public.utility_alerts
  ORDER BY type, source, city, COALESCE(address, location_name), start_time, updated_at DESC
);

-- 3. Re-index to ensure rapid lookups
REINDEX TABLE public.utility_alerts;
