-- Schedule periodic sync of real RSS news every 30 minutes
SELECT cron.unschedule('sync-news-periodic') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-news-periodic');

SELECT cron.schedule(
  'sync-news-periodic',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pvxnzqpbdizhyneiyzlf.supabase.co/functions/v1/sync-news',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2eG56cXBiZGl6aHluZWl5emxmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzg2Njk1MCwiZXhwIjoyMDk5NDQyOTUwfQ.1ysqRDZdtV0EYkt4fiDq16DSyQDZiMaO6At1QkMVIUU'
    ),
    body := '{}'::jsonb
  );
  $$
);
