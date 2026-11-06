-- ========================================================
-- AUTOMATED WEEKLY PUBLIC TRANSIT SYNC (JSP SKOPJE)
-- Runs every Monday at 03:00 UTC via pg_cron
-- Fetches live real routes and stops from Modeshift & Skopjebus
-- ========================================================

SELECT cron.unschedule('sync-transit-weekly') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-transit-weekly');

SELECT cron.schedule(
  'sync-transit-weekly',
  '0 3 * * 1', -- Every Monday at 03:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://pvxnzqpbdizhyneiyzlf.supabase.co/functions/v1/sync-transit',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2eG56cXBiZGl6aHluZWl5emxmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzg2Njk1MCwiZXhwIjoyMDk5NDQyOTUwfQ.1ysqRDZdtV0EYkt4fiDq16DSyQDZiMaO6At1QkMVIUU'
    ),
    body := '{}'::jsonb
  );
  $$
);
