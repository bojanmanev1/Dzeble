-- ========================================================================
-- LATEST REAL RSS NEWS TABLE FOR DZEBLE
-- Sources: MIA (Македонска Информативна Агенција), Faktor, Nova Makedonija
-- ========================================================================

CREATE TABLE IF NOT EXISTS public.latest_news (
  id text PRIMARY KEY,
  title text NOT NULL,
  link_url text NOT NULL,
  source_name text NOT NULL DEFAULT 'МИА',
  source_id text NOT NULL DEFAULT 'mia',
  summary text,
  published_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_latest_news_published ON public.latest_news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_latest_news_source ON public.latest_news(source_id);

-- Enable Row Level Security
ALTER TABLE public.latest_news ENABLE ROW LEVEL SECURITY;

-- Allow public read access to anyone (authenticated or anonymous mobile app users)
DROP POLICY IF EXISTS "Allow public read access to latest_news" ON public.latest_news;
CREATE POLICY "Allow public read access to latest_news" 
  ON public.latest_news FOR SELECT 
  USING (true);

-- Allow service_role to insert/update/delete
DROP POLICY IF EXISTS "Allow service_role full access to latest_news" ON public.latest_news;
CREATE POLICY "Allow service_role full access to latest_news" 
  ON public.latest_news FOR ALL 
  USING (auth.role() = 'service_role');

-- Grant table-level permissions to Supabase roles
GRANT ALL ON public.latest_news TO service_role;
GRANT SELECT ON public.latest_news TO anon, authenticated;

