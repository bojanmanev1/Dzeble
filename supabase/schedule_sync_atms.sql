DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-bank-atms-weekly') THEN
    PERFORM cron.unschedule('sync-bank-atms-weekly');
  END IF;
END $$;

-- Run weekly every Monday at 04:00 AM UTC
SELECT cron.schedule(
  'sync-bank-atms-weekly',
  '0 4 * * 1',
  $cron$
  SELECT net.http_post(
    url := 'https://pvxnzqpbdizhyneiyzlf.supabase.co/functions/v1/sync-atms',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2eG56cXBiZGl6aHluZWl5emxmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzg2Njk1MCwiZXhwIjoyMDk5NDQyOTUwfQ.1ysqRDZdtV0EYkt4fiDq16DSyQDZiMaO6At1QkMVIUU'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
