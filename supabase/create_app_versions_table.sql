-- Table to manage application versions and prompt users to update
CREATE TABLE IF NOT EXISTS public.app_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL UNIQUE DEFAULT 'android', -- 'android' or 'ios'
    latest_version_code INTEGER NOT NULL DEFAULT 1,
    latest_version_name TEXT NOT NULL DEFAULT '1.0',
    min_supported_version_code INTEGER NOT NULL DEFAULT 1,
    force_update BOOLEAN NOT NULL DEFAULT false,
    title TEXT NOT NULL DEFAULT 'Достапна е нова верзија! 🚀',
    message TEXT NOT NULL DEFAULT 'Нова верзија на Dzeble е достапна на Google Play Store. Ве молиме ажурирајте за најновите функционалности и подобрувања.',
    release_notes TEXT DEFAULT '• Подобрени перформанси и брзина\n• Нови функционалности',
    store_url TEXT NOT NULL DEFAULT 'https://play.google.com/store/apps/details?id=com.dzeble.app',
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

-- Grant table-level access to anon and authenticated roles
GRANT SELECT ON TABLE public.app_versions TO anon, authenticated;
GRANT ALL ON TABLE public.app_versions TO service_role;

-- Allow public read access (for anon and authenticated users)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'app_versions' AND policyname = 'Allow public read access to app_versions'
    ) THEN
        CREATE POLICY "Allow public read access to app_versions"
        ON public.app_versions
        FOR SELECT
        TO anon, authenticated
        USING (true);
    END IF;
END $$;

-- Insert initial Android config (matching current build)
INSERT INTO public.app_versions (
    platform, 
    latest_version_code, 
    latest_version_name, 
    min_supported_version_code, 
    force_update, 
    title, 
    message, 
    release_notes,
    store_url, 
    is_active
) VALUES (
    'android',
    1,
    '1.0',
    1,
    false,
    'Достапна е нова верзија! 🚀',
    'Нова верзија на Dzeble е достапна на Google Play Store. Ве молиме ажурирајте ја апликацијата за најновите функционалности.',
    '• Подобрени перформанси и брзина\n• Навремени известувања и оптимизација',
    'https://play.google.com/store/apps/details?id=com.dzeble.app',
    true
)
ON CONFLICT (platform) DO UPDATE SET
    store_url = EXCLUDED.store_url,
    updated_at = now();
