-- ========================================================================
-- FIX MISCLASSIFIED OUTAGE LOCATIONS & DEDUPLICATE
-- Resolves Debar, Negotino, Brvenica, Zelino, Mavrovo, Kratovo, etc.
-- ========================================================================

-- 1. Fix Debar alerts (including the HEC Spilje / Centar Zupa alert)
UPDATE public.utility_alerts
SET 
  city = 'Дебар',
  municipality = NULL,
  latitude = 41.5250,
  longitude = 20.5272
WHERE location_name LIKE '%ДЕБАР%' OR address LIKE '%ШПИЉЕ%';

-- 2. Fix Negotino
UPDATE public.utility_alerts
SET 
  city = 'Неготино',
  municipality = NULL,
  latitude = 41.4839,
  longitude = 22.0917
WHERE location_name LIKE '%НЕГОТИНО%';

-- 3. Fix Brvenica
UPDATE public.utility_alerts
SET 
  city = 'Брвеница',
  municipality = NULL,
  latitude = 41.9683,
  longitude = 20.9819
WHERE location_name LIKE '%БРВЕНИЦА%';

-- 4. Fix Zelino
UPDATE public.utility_alerts
SET 
  city = 'Желино',
  municipality = NULL,
  latitude = 41.9806,
  longitude = 21.0600
WHERE location_name LIKE '%ЖЕЛИНО%';

-- 5. Fix Mavrovo & Rostuse
UPDATE public.utility_alerts
SET 
  city = 'Маврово',
  municipality = NULL,
  latitude = 41.7028,
  longitude = 20.7350
WHERE location_name LIKE '%МАВРОВО%' OR location_name LIKE '%РОСТУШЕ%';

-- 6. Fix Dojran
UPDATE public.utility_alerts
SET 
  city = 'Дојран',
  municipality = NULL,
  latitude = 41.1789,
  longitude = 22.7247
WHERE location_name LIKE '%ДОЈРАН%';

-- 7. Fix Kratovo
UPDATE public.utility_alerts
SET 
  city = 'Кратово',
  municipality = NULL,
  latitude = 42.0786,
  longitude = 22.1750
WHERE location_name LIKE '%КРАТОВО%';

-- 8. Fix Jegunovce
UPDATE public.utility_alerts
SET 
  city = 'Јегуновце',
  municipality = NULL,
  latitude = 42.0736,
  longitude = 21.1233
WHERE location_name LIKE '%ЈЕГУНОВЦЕ%';

-- 9. Fix Tearce
UPDATE public.utility_alerts
SET 
  city = 'Теарце',
  municipality = NULL,
  latitude = 42.0767,
  longitude = 21.0528
WHERE location_name LIKE '%ТЕАРЦЕ%';

-- 10. Fix Staro Nagoricane
UPDATE public.utility_alerts
SET 
  city = 'Старо Нагоричане',
  municipality = NULL,
  latitude = 42.1983,
  longitude = 21.8286
WHERE location_name LIKE '%СТАРО НАГОРИЧАНЕ%';

-- 11. Fix Novaci
UPDATE public.utility_alerts
SET 
  city = 'Новаци',
  municipality = NULL,
  latitude = 41.0417,
  longitude = 21.4567
WHERE location_name LIKE '%НОВАЦИ%';

-- 12. Fix Novo Selo
UPDATE public.utility_alerts
SET 
  city = 'Ново Село',
  municipality = NULL,
  latitude = 41.4139,
  longitude = 22.8833
WHERE location_name LIKE '%НОВО СЕЛО%';

-- 13. Fix Rosoman
UPDATE public.utility_alerts
SET 
  city = 'Росоман',
  municipality = NULL,
  latitude = 41.5161,
  longitude = 21.9458
WHERE location_name LIKE '%РОСОМАН%';

-- 14. Deduplicate any duplicate rows with same address and start_time
DELETE FROM public.utility_alerts a
USING public.utility_alerts b
WHERE a.ctid < b.ctid
  AND a.address = b.address
  AND a.start_time = b.start_time
  AND a.type = b.type;
