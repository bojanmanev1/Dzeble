-- 1. Create a function that uses PostgreSQL's native 'Europe/Skopje' timezone
CREATE OR REPLACE FUNCTION dispatch_morning_weather_if_7am()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_skopje_hour integer;
BEGIN
  -- Extract current hour in Europe/Skopje (automatically handles summer UTC+2 and winter UTC+1)
  v_skopje_hour := EXTRACT(HOUR FROM now() AT TIME ZONE 'Europe/Skopje');

  -- Only dispatch if it is exactly 7:00 AM in Macedonia
  IF v_skopje_hour = 7 THEN
    PERFORM net.http_post(
      url := 'https://pvxnzqpbdizhyneiyzlf.supabase.co/functions/v1/dispatch-aqi-weather-alerts?mode=morning',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2eG56cXBiZGl6aHluZWl5emxmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzg2Njk1MCwiZXhwIjoyMDk5NDQyOTUwfQ.1ysqRDZdtV0EYkt4fiDq16DSyQDZiMaO6At1QkMVIUU'
      )
    );
  END IF;
END;
$func$;

-- 2. Reschedule morning-weather-briefing-7am to run at 05:00 and 06:00 UTC
-- One of these will ALWAYS be exactly 07:00 AM Skopje time (summer or winter)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'morning-weather-briefing-7am') THEN
    PERFORM cron.unschedule('morning-weather-briefing-7am');
  END IF;
END $$;

SELECT cron.schedule(
  'morning-weather-briefing-7am',
  '0 5,6 * * *',
  'SELECT dispatch_morning_weather_if_7am();'
);
