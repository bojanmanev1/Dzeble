-- ========================================================================
-- TARGETED OUTAGE DISPATCH LOGIC (STRICT 3KM RADIUS FOR POWER & WATER)
-- Dzeble App - Updated Targeting Rules:
-- 1. ROADS (АМСМ): Стига на СИТЕ корисници (Nationwide Broadcast)
-- 2. EARTHQUAKE (EMSC): Стига на СИТЕ корисници (Nationwide Broadcast)
-- 3. POWER & WATER (ЕВН & Водовод): САМО ВО БЛИЗИНА <= 3.0 km (Хипер-локално за да нема премногу нотификации)
-- 4. DEDUPLICATION: Преку dispatched_utility_alert_logs - секој прекин стига САМО ЕДНАШ на даден уред
-- ========================================================================

-- Ensure deduplication log table exists with unique constraint
CREATE TABLE IF NOT EXISTS public.dispatched_utility_alert_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id text NOT NULL,
  device_id text NOT NULL,
  user_id uuid,
  push_token text NOT NULL,
  distance_km double precision,
  dispatched_at timestamptz DEFAULT now(),
  CONSTRAINT unique_alert_device UNIQUE(alert_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_alert_logs_alert ON public.dispatched_utility_alert_logs(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_logs_device ON public.dispatched_utility_alert_logs(device_id);

-- Updated target resolver function
CREATE OR REPLACE FUNCTION public.get_devices_for_utility_alert(
  p_alert_id text,
  p_radius_km double precision DEFAULT 3.0
)
RETURNS TABLE (
  device_id text,
  push_token text,
  user_id uuid,
  language text,
  distance_km double precision,
  alert_id text,
  alert_type text,
  alert_title text,
  alert_city text,
  alert_address text,
  alert_start timestamptz,
  alert_end timestamptz,
  notification_title text,
  notification_body text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_alert record;
BEGIN
  -- 1. Fetch the target outage/alert record
  SELECT * INTO v_alert FROM public.utility_alerts WHERE id = p_alert_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- 2. Select eligible devices based on alert type rules
  RETURN QUERY
  SELECT 
    d.device_id,
    d.push_token,
    d.user_id,
    COALESCE(d.language, 'mk') AS language,
    CASE 
      WHEN v_alert.latitude IS NOT NULL AND d.latitude IS NOT NULL THEN
        ROUND(public.haversine_distance_km(v_alert.latitude, v_alert.longitude, d.latitude, d.longitude)::numeric, 1)::double precision
      ELSE NULL
    END AS distance_km,
    v_alert.id AS alert_id,
    v_alert.type AS alert_type,
    v_alert.title AS alert_title,
    v_alert.city AS alert_city,
    v_alert.address AS alert_address,
    v_alert.start_time AS alert_start,
    v_alert.end_time AS alert_end,

    -- ========================================================
    -- MULTILINGUAL NOTIFICATION TITLE
    -- ========================================================
    CASE 
      -- A. ЗЕМЈОТРЕС (Earthquake)
      WHEN v_alert.type = 'earthquake' THEN
        CASE 
          WHEN COALESCE(d.language, 'mk') = 'en' THEN '🔴 Earthquake Detected ' || COALESCE(v_alert.voltage, '')
          WHEN COALESCE(d.language, 'mk') = 'al' THEN '🔴 Tërmet i regjistruar ' || COALESCE(v_alert.voltage, '')
          ELSE '🔴 Регистриран земјотрес ' || COALESCE(v_alert.voltage, '')
        END

      -- B. БЛОКИРАНИ ПАТИШТА / СООБРАЌАЈ (Roads - AMSM)
      WHEN v_alert.type = 'road' THEN
        CASE 
          WHEN COALESCE(d.language, 'mk') = 'en' THEN '🚧 Road Alert: ' || COALESCE(v_alert.city, 'Macedonia')
          WHEN COALESCE(d.language, 'mk') = 'al' THEN '🚧 Njoftim rrugor: ' || COALESCE(v_alert.city, 'Maqedoni')
          ELSE '🚧 Состојба на патишта: ' || COALESCE(v_alert.city, 'Македонија')
        END

      -- C. СТРУЈА (Power Outage - EVN)
      WHEN v_alert.type = 'power' THEN
        CASE 
          WHEN COALESCE(d.language, 'mk') = 'en' THEN '⚡ Power Outage Nearby'
          WHEN COALESCE(d.language, 'mk') = 'al' THEN '⚡ Ndërprerje e rrymës afër jush'
          ELSE '⚡ Прекин на струја во ваша близина'
        END

      -- D. ВОДА (Water Outage - Vodovod)
      WHEN v_alert.type = 'water' THEN
        CASE 
          WHEN COALESCE(d.language, 'mk') = 'en' THEN '💧 Water Outage Nearby'
          WHEN COALESCE(d.language, 'mk') = 'al' THEN '💧 Ndërprerje e ujit afër jush'
          ELSE '💧 Прекин на вода во ваша близина'
        END

      -- E. ОСТАНАТО (Other)
      ELSE
        CASE 
          WHEN COALESCE(d.language, 'mk') = 'en' THEN '⚠️ Utility Notice'
          WHEN COALESCE(d.language, 'mk') = 'al' THEN '⚠️ Njoftim komunal'
          ELSE '⚠️ Комунално соопштение'
        END
    END AS notification_title,

    -- ========================================================
    -- MULTILINGUAL NOTIFICATION BODY
    -- ========================================================
    CASE 
      -- A. ЗЕМЈОТРЕС: Title + City + Approximate distance
      WHEN v_alert.type = 'earthquake' THEN
        CASE 
          WHEN COALESCE(d.language, 'mk') = 'en' THEN
            v_alert.title || ' (' || v_alert.city || ')' ||
            CASE WHEN d.latitude IS NOT NULL THEN ' • ' || ROUND(public.haversine_distance_km(v_alert.latitude, v_alert.longitude, d.latitude, d.longitude)::numeric, 0) || ' km from you' ELSE '' END
          WHEN COALESCE(d.language, 'mk') = 'al' THEN
            v_alert.title || ' (' || v_alert.city || ')' ||
            CASE WHEN d.latitude IS NOT NULL THEN ' • ' || ROUND(public.haversine_distance_km(v_alert.latitude, v_alert.longitude, d.latitude, d.longitude)::numeric, 0) || ' km larg jush' ELSE '' END
          ELSE
            v_alert.title || ' (' || v_alert.city || ')' ||
            CASE WHEN d.latitude IS NOT NULL THEN ' • ' || ROUND(public.haversine_distance_km(v_alert.latitude, v_alert.longitude, d.latitude, d.longitude)::numeric, 0) || ' km од вас' ELSE '' END
        END

      -- B. БЛОКИРАНИ ПАТИШТА: Address or description
      WHEN v_alert.type = 'road' THEN
        COALESCE(v_alert.address, v_alert.description, v_alert.title)

      -- C. СТРУЈА И ВОДА: Address + Time
      ELSE
        CASE 
          WHEN COALESCE(d.language, 'mk') = 'en' THEN
            COALESCE(v_alert.address, v_alert.city) || ' (starts ' || to_char(v_alert.start_time AT TIME ZONE 'Europe/Skopje', 'DD.MM at HH24:MI') || ')'
          WHEN COALESCE(d.language, 'mk') = 'al' THEN
            COALESCE(v_alert.address, v_alert.city) || ' (nga ' || to_char(v_alert.start_time AT TIME ZONE 'Europe/Skopje', 'DD.MM në HH24:MI') || ')'
          ELSE
            COALESCE(v_alert.address, v_alert.city) || ' (од ' || to_char(v_alert.start_time AT TIME ZONE 'Europe/Skopje', 'DD.MM во HH24:MI') || ')'
        END
    END AS notification_body

  FROM public.user_devices d
  LEFT JOIN public.dispatched_utility_alert_logs log 
    ON log.alert_id = v_alert.id AND log.device_id = d.device_id
  WHERE 
    d.push_token IS NOT NULL
    AND d.push_token <> ''
    AND COALESCE(d.notify_utility, true) = true
    AND log.id IS NULL -- GUARANTEE: Never send duplicate push notification for the same alert
    AND (
      -- ========================================================
      -- TIER 1: ЗЕМЈОТРЕС -> СИТЕ ВО МАКЕДОНИЈА (Nationwide)
      -- ========================================================
      (
        v_alert.type = 'earthquake'
      )

      -- ========================================================
      -- TIER 2: ПАТИШТА / СООБРАЌАЈ (Roads - AMSM)
      -- Локално за градот на корисникот (или во радиус од 15 km), 
      -- или вонреден nationwide прекин на сообраќај
      -- ========================================================
      OR (
        v_alert.type = 'road'
        AND (
          -- Корисникот е во близина (радиус <= 15 km за патишта)
          (
            v_alert.latitude IS NOT NULL 
            AND d.latitude IS NOT NULL 
            AND public.haversine_distance_km(v_alert.latitude, v_alert.longitude, d.latitude, d.longitude) <= 15.0
          )
          -- Истиот град
          OR (
            v_alert.city IS NOT NULL 
            AND v_alert.city <> 'Македонија'
            AND LOWER(TRIM(COALESCE(d.city_preference, ''))) = LOWER(TRIM(v_alert.city))
          )
          -- Вонредна национална блокада на патишта
          OR (
            v_alert.city = 'Македонија' 
            AND (
              LOWER(v_alert.title) LIKE '%затворен%' 
              OR LOWER(v_alert.title) LIKE '%свлечиште%'
              OR LOWER(v_alert.title) LIKE '%одрони%'
            )
          )
        )
      )

      -- ========================================================
      -- TIER 3: СТРУЈА И ВОДА -> ХИПЕР-ЛОКАЛНО (Радиус <= 3 km)
      -- Барање: "namali go radiusot na 3km za struja i voda zatoa sto stigaat premnogu notifikacii vaka"
      -- ========================================================
      OR (
        v_alert.type IN ('power', 'water')
        AND (
          -- 1. Корисникот има GPS координати и се наоѓа во радиус од максимум 3 km
          (
            v_alert.latitude IS NOT NULL 
            AND d.latitude IS NOT NULL 
            AND public.haversine_distance_km(v_alert.latitude, v_alert.longitude, d.latitude, d.longitude) <= p_radius_km
          )
          -- 2. Fallback: САМО ако корисникот нема дадено GPS локација,
          -- строго совпаѓање по општина (на пр. корисник од Аеродром добива само за Аеродром, а НЕ за цело Скопје)
          OR (
            d.latitude IS NULL 
            AND v_alert.municipality IS NOT NULL 
            AND v_alert.municipality <> '' 
            AND LOWER(TRIM(COALESCE(d.municipality_preference, ''))) = LOWER(TRIM(v_alert.municipality))
          )
        )
      )

      -- ========================================================
      -- TIER 4: ДРУГИ СООПШТЕНИЈА (Other)
      -- ========================================================
      OR (
        v_alert.type NOT IN ('earthquake', 'road', 'power', 'water')
        AND (
          (v_alert.latitude IS NOT NULL AND d.latitude IS NOT NULL AND public.haversine_distance_km(v_alert.latitude, v_alert.longitude, d.latitude, d.longitude) <= p_radius_km)
          OR (d.latitude IS NULL AND LOWER(TRIM(COALESCE(d.city_preference, ''))) = LOWER(TRIM(v_alert.city)))
        )
      )
    );
END;
$$;

-- Helper function to record dispatched push
CREATE OR REPLACE FUNCTION public.record_utility_alert_dispatched(
  p_alert_id text,
  p_device_id text,
  p_user_id uuid,
  p_push_token text,
  p_distance_km double precision DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.dispatched_utility_alert_logs (
    alert_id, device_id, user_id, push_token, distance_km
  ) VALUES (
    p_alert_id, p_device_id, p_user_id, p_push_token, p_distance_km
  )
  ON CONFLICT (alert_id, device_id) DO NOTHING;
END;
$$;
