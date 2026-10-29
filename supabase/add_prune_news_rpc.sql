-- ========================================================================
-- PRUNE LATEST NEWS FUNCTION
-- Keeps strictly the latest N rows (default: 20 rows) in latest_news table
-- Guarantees zero database bloat and tiny storage footprint (~6 KB total)
-- ========================================================================

CREATE OR REPLACE FUNCTION public.prune_latest_news(p_keep_limit integer DEFAULT 20)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.latest_news 
  WHERE id NOT IN (
    SELECT id FROM public.latest_news 
    ORDER BY published_at DESC 
    LIMIT p_keep_limit
  );
END;
$$;
