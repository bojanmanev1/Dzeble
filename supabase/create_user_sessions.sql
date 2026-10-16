-- ==============================================================================
-- DZEBLE APP: USER SESSIONS & ANALYTICS TRACKING
-- Tracks session count, duration, active users, daily/monthly aggregations
-- ==============================================================================

-- 1. Create user_sessions table
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    email TEXT,
    platform TEXT NOT NULL DEFAULT 'web',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_started_at ON public.user_sessions (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_device_id ON public.user_sessions (device_id);

-- 3. Row Level Security (RLS)
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Allow devices to record session start
DROP POLICY IF EXISTS "Allow public insert user_sessions" ON public.user_sessions;
CREATE POLICY "Allow public insert user_sessions" 
    ON public.user_sessions FOR INSERT 
    WITH CHECK (true);

-- Allow devices to update session duration/ended_at
DROP POLICY IF EXISTS "Allow public update user_sessions" ON public.user_sessions;
CREATE POLICY "Allow public update user_sessions" 
    ON public.user_sessions FOR UPDATE 
    USING (true)
    WITH CHECK (true);

-- Allow reading sessions (Mandatory in PostgreSQL for UPDATE ... WHERE id to find and update the row)
DROP POLICY IF EXISTS "Allow public select user_sessions" ON public.user_sessions;
CREATE POLICY "Allow public select user_sessions" 
    ON public.user_sessions FOR SELECT 
    USING (true);

-- 4. Table-level Permissions (Grants for Anon & Authenticated roles)
GRANT ALL ON TABLE public.user_sessions TO anon, authenticated, service_role;


-- ==============================================================================
-- 4. ANALYTIC VIEWS FOR ADMIN (Daily, Monthly, All-Time Leaderboard)
-- ==============================================================================

-- A. DAILY SUMMARY VIEW (Дневен приказ)
CREATE OR REPLACE VIEW public.v_sessions_daily AS
SELECT 
    DATE(started_at) AS session_date,
    COUNT(*) AS total_sessions,
    COUNT(DISTINCT device_id) AS unique_devices_dau,
    COUNT(DISTINCT user_id) AS registered_users_dau,
    ROUND(SUM(duration_seconds)::numeric / 60, 1) AS total_minutes_spent,
    ROUND(SUM(duration_seconds)::numeric / 3600, 2) AS total_hours_spent,
    ROUND(AVG(duration_seconds)::numeric, 0) AS avg_duration_seconds,
    TO_CHAR((AVG(duration_seconds) || ' second')::interval, 'MI:SS') AS avg_duration_formatted
FROM public.user_sessions
GROUP BY DATE(started_at)
ORDER BY session_date DESC;

-- B. MONTHLY SUMMARY VIEW (Месечен приказ)
CREATE OR REPLACE VIEW public.v_sessions_monthly AS
SELECT 
    TO_CHAR(started_at, 'YYYY-MM') AS session_month,
    COUNT(*) AS total_sessions,
    COUNT(DISTINCT device_id) AS unique_devices_mau,
    COUNT(DISTINCT user_id) AS registered_users_mau,
    ROUND(SUM(duration_seconds)::numeric / 3600, 2) AS total_hours_spent,
    ROUND(AVG(duration_seconds)::numeric, 0) AS avg_duration_seconds,
    TO_CHAR((AVG(duration_seconds) || ' second')::interval, 'MI:SS') AS avg_duration_formatted
FROM public.user_sessions
GROUP BY TO_CHAR(started_at, 'YYYY-MM')
ORDER BY session_month DESC;

-- C. ALL-TIME LEADERBOARD BY USER (Вкупно време и сесии по корисник)
CREATE OR REPLACE VIEW public.v_sessions_all_time_users AS
SELECT 
    COALESCE(u.email, s.email, 'Гостин (' || s.platform || ')') AS user_or_guest,
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', p.full_name, '-') AS full_name,
    COUNT(s.id) AS total_sessions_count,
    ROUND(SUM(s.duration_seconds)::numeric / 60, 1) AS total_minutes_spent,
    ROUND(SUM(s.duration_seconds)::numeric / 3600, 2) AS total_hours_spent,
    ROUND(AVG(s.duration_seconds)::numeric, 0) AS avg_session_seconds,
    MIN(s.started_at) AS first_seen_at,
    MAX(s.ended_at) AS last_active_at
FROM public.user_sessions s
LEFT JOIN auth.users u ON u.id = s.user_id
LEFT JOIN public.profiles p ON p.id = s.user_id
GROUP BY 
    COALESCE(u.email, s.email, 'Гостин (' || s.platform || ')'),
    u.raw_user_meta_data,
    p.full_name
ORDER BY total_sessions_count DESC;

-- Grant access on views to authenticated & anon roles
GRANT SELECT ON public.v_sessions_daily TO anon, authenticated, service_role;
GRANT SELECT ON public.v_sessions_monthly TO anon, authenticated, service_role;
GRANT SELECT ON public.v_sessions_all_time_users TO anon, authenticated, service_role;

