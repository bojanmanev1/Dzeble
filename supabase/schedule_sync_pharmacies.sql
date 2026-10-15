DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-duty-pharmacies-daily') THEN
    PERFORM cron.unschedule('sync-duty-pharmacies-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'sync-duty-pharmacies-daily',
  '0 5 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://pvxnzqpbdizhyneiyzlf.supabase.co/functions/v1/sync-duty-pharmacies',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2eG56cXBiZGl6aHluZWl5emxmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzg2Njk1MCwiZXhwIjoyMDk5NDQyOTUwfQ.1ysqRDZdtV0EYkt4fiDq16DSyQDZiMaO6At1QkMVIUU'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
