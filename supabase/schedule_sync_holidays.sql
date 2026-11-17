-- Scheduled Cron Job to ensure Macedonian Holidays are synced automatically
-- Runs on the 1st of every month at 03:00 AM UTC
SELECT cron.schedule(
  'auto-sync-macedonian-holidays',
  '0 3 1 * *',
  $$
  SELECT net.http_get(
    url := 'https://pvxnzqpbdizhyneiyzlf.supabase.co/functions/v1/sync-macedonian-holidays',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    )
  );
  $$
);
