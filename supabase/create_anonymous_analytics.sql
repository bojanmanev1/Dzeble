-- ========================================================================
-- ANONYMOUS CONSUMER INTELLIGENCE & WIDGET ANALYTICS
-- Dzeble App - Commercial Monetization Schema & Aggregated Views
-- ========================================================================

-- 1. Table for Anonymized Aggregated Analytics Events
CREATE TABLE IF NOT EXISTS public.anonymous_analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id text NOT NULL,              -- 'loyalty', 'fuel', 'gas_stations', 'pharmacy', 'alerts', etc.
  event_name text NOT NULL,             -- 'widget_open', 'brand_selected', 'card_added', 'route_click', etc.
  entity_name text,                     -- 'Vero', 'Makpetrol', 'EUR', 'BTCUSDT', 'Zegin'
  city text,                            -- 'Скопје', 'Битола', 'Прилеп'
  municipality text,                    -- 'Аеродром', 'Карпош', 'Центар'
  metadata jsonb DEFAULT '{}'::jsonb,   -- Flexible extras (e.g. {"fuel_type": "Дизел", "magnitude": 2.5})
  platform text DEFAULT 'android',      -- 'android', 'ios', 'web'
  hour_of_day smallint,                 -- 0 - 23 (Peak hour analysis)
  day_of_week smallint,                 -- 0 - 6 (Sunday to Saturday)
  created_at timestamptz DEFAULT now()
);

-- Indexes for lightning-fast aggregation queries
CREATE INDEX IF NOT EXISTS idx_analytics_widget ON public.anonymous_analytics_events(widget_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event ON public.anonymous_analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_entity ON public.anonymous_analytics_events(entity_name);
CREATE INDEX IF NOT EXISTS idx_analytics_city ON public.anonymous_analytics_events(city);
CREATE INDEX IF NOT EXISTS idx_analytics_time ON public.anonymous_analytics_events(created_at);

-- Row Level Security
ALTER TABLE public.anonymous_analytics_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'anonymous_analytics_events' AND policyname = 'Allow public insert for analytics'
  ) THEN
    CREATE POLICY "Allow public insert for analytics" ON public.anonymous_analytics_events FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'anonymous_analytics_events' AND policyname = 'Allow service role read for analytics'
  ) THEN
    CREATE POLICY "Allow service role read for analytics" ON public.anonymous_analytics_events FOR SELECT USING (true);
  END IF;
END $$;

GRANT ALL ON public.anonymous_analytics_events TO service_role;
GRANT INSERT ON public.anonymous_analytics_events TO anon, authenticated;

-- ========================================================================
-- READY-TO-USE BUSINESS INTELLIGENCE VIEWS (WHAT AND WHERE TO SEE THE DATA)
-- ========================================================================

-- VIEW 1: SUPERMARKET & RETAIL LOYALTY CARD WALLET SHARE
-- (High commercial value for FMCG, Vero, Tinex, DM, Neptun)
CREATE OR REPLACE VIEW public.view_loyalty_market_share AS
SELECT 
  COALESCE(entity_name, 'Other') AS brand_name,
  COUNT(*) AS total_wallet_additions,
  ROUND(COUNT(*)::numeric * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) AS market_share_pct
FROM public.anonymous_analytics_events
WHERE widget_id = 'loyalty' AND event_name IN ('card_added', 'card_scanned')
GROUP BY entity_name
ORDER BY total_wallet_additions DESC;

-- VIEW 2: GAS STATION BRAND POPULARITY & NAVIGATION INTENT
-- (High commercial value for Makpetrol, Lukoil, OKTA, Detoil)
CREATE OR REPLACE VIEW public.view_fuel_brand_engagement AS
SELECT 
  COALESCE(city, 'All') AS city,
  entity_name AS fuel_brand,
  COUNT(*) AS total_interactions,
  COUNT(*) FILTER (WHERE event_name = 'route_clicked') AS navigations_requested,
  COUNT(*) FILTER (WHERE event_name = 'brand_filtered') AS brand_filter_clicks
FROM public.anonymous_analytics_events
WHERE widget_id IN ('fuel', 'gas_stations')
  AND entity_name IS NOT NULL
GROUP BY city, entity_name
ORDER BY city, total_interactions DESC;

-- VIEW 3: NIGHTTIME 24/7 PHARMACY DEMAND BY MUNICIPALITY
-- (High value for Zegin, Eurofarm, Benu deciding 24/7 shifts and new pharmacy branches)
CREATE OR REPLACE VIEW public.view_night_pharmacy_demand AS
SELECT 
  COALESCE(city, 'General') AS city,
  COALESCE(municipality, 'City Center') AS municipality,
  COUNT(*) AS total_searches,
  COUNT(*) FILTER (WHERE hour_of_day >= 22 OR hour_of_day <= 6) AS late_night_searches
FROM public.anonymous_analytics_events
WHERE widget_id = 'pharmacy'
GROUP BY city, municipality
ORDER BY late_night_searches DESC;

-- VIEW 4: FINANCIAL & INVESTMENT INTEREST RANKING (CRYPTO, STOCKS, CURRENCIES)
-- (High value for Banks, Fintechs, Crypto Exchanges)
CREATE OR REPLACE VIEW public.view_financial_interest_ranking AS
SELECT 
  widget_id AS asset_class,
  entity_name AS asset_symbol,
  COUNT(*) AS lookups_count
FROM public.anonymous_analytics_events
WHERE widget_id IN ('crypto', 'stock', 'currency')
  AND entity_name IS NOT NULL
GROUP BY widget_id, entity_name
ORDER BY lookups_count DESC;

-- VIEW 5: HOURLY CONSUMER HABITS ACROSS MACEDONIA
-- (Shows exact hours when users check fuel, weather, utilities, or pharmacy)
CREATE OR REPLACE VIEW public.view_hourly_habits AS
SELECT 
  hour_of_day,
  widget_id,
  COUNT(*) AS interactions_count
FROM public.anonymous_analytics_events
WHERE hour_of_day IS NOT NULL
GROUP BY hour_of_day, widget_id
ORDER BY hour_of_day ASC, interactions_count DESC;

-- VIEW 6: MUNICIPALITY OUTAGE CONCERN INDEX
-- (High value for home insurance, solar panel vendors, battery backups)
CREATE OR REPLACE VIEW public.view_outage_sensitivity AS
SELECT 
  city,
  COALESCE(municipality, city) AS municipality,
  entity_name AS outage_type, -- 'power', 'water', 'road', 'earthquake'
  COUNT(*) AS user_interest_count
FROM public.anonymous_analytics_events
WHERE widget_id = 'alerts'
GROUP BY city, municipality, entity_name
ORDER BY user_interest_count DESC;
