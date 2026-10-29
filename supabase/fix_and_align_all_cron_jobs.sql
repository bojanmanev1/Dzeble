-- 1. Align Morning Weather Briefing to 7:00 AM Skopje Time (CET / UTC+1 -> 06:00 UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'morning-weather-briefing-7am') THEN
    PERFORM cron.unschedule('morning-weather-briefing-7am');
  END IF;
END $$;

SELECT cron.schedule(
  'morning-weather-briefing-7am',
  '0 6 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://pvxnzqpbdizhyneiyzlf.supabase.co/functions/v1/dispatch-aqi-weather-alerts?mode=morning',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2eG56cXBiZGl6aHluZWl5emxmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzg2Njk1MCwiZXhwIjoyMDk5NDQyOTUwfQ.1ysqRDZdtV0EYkt4fiDq16DSyQDZiMaO6At1QkMVIUU'
    )
  );
  $cron$
);

-- 2. Fix Stock Alerts Cron Key (was using literal YOUR_SERVICE_ROLE_KEY)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-stock-alerts-job') THEN
    PERFORM cron.unschedule('dispatch-stock-alerts-job');
  END IF;
END $$;

SELECT cron.schedule(
  'dispatch-stock-alerts-job',
  '45 15,22 * * 1-5',
  $cron$
  SELECT net.http_post(
    url := 'https://pvxnzqpbdizhyneiyzlf.supabase.co/functions/v1/dispatch-stock-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2eG56cXBiZGl6aHluZWl5emxmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzg2Njk1MCwiZXhwIjoyMDk5NDQyOTUwfQ.1ysqRDZdtV0EYkt4fiDq16DSyQDZiMaO6At1QkMVIUU'
    )
  );
  $cron$
);

-- 3. Add Crypto Alerts Cron Job (was missing from pg_cron)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-crypto-alerts-job') THEN
    PERFORM cron.unschedule('dispatch-crypto-alerts-job');
  END IF;
END $$;

SELECT cron.schedule(
  'dispatch-crypto-alerts-job',
  '20,50 7-21 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://pvxnzqpbdizhyneiyzlf.supabase.co/functions/v1/dispatch-crypto-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2eG56cXBiZGl6aHluZWl5emxmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzg2Njk1MCwiZXhwIjoyMDk5NDQyOTUwfQ.1ysqRDZdtV0EYkt4fiDq16DSyQDZiMaO6At1QkMVIUU'
    )
  );
  $cron$
);
