CREATE TABLE IF NOT EXISTS duty_pharmacies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  chain text DEFAULT 'other',
  city text NOT NULL,
  city_slug text NOT NULL,
  municipality text,
  address text NOT NULL,
  phone text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  is_24_7 boolean DEFAULT true,
  working_hours text DEFAULT '24/7',
  google_maps_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT duty_pharmacies_name_city_unique UNIQUE (name, city)
);

ALTER TABLE duty_pharmacies ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'duty_pharmacies' AND policyname = 'Allow public read for duty_pharmacies'
  ) THEN
    CREATE POLICY "Allow public read for duty_pharmacies" ON duty_pharmacies FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'duty_pharmacies' AND policyname = 'Allow service role write for duty_pharmacies'
  ) THEN
    CREATE POLICY "Allow service role write for duty_pharmacies" ON duty_pharmacies FOR ALL USING (true);
  END IF;
END $$;

GRANT ALL ON public.duty_pharmacies TO service_role;
GRANT SELECT ON public.duty_pharmacies TO anon, authenticated;

