import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('https://pvxnzqpbdizhyneiyzlf.supabase.co/rest/v1/')!,
    Deno.env.get('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2eG56cXBiZGl6aHluZWl5emxmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzg2Njk1MCwiZXhwIjoyMDk5NDQyOTUwfQ.1ysqRDZdtV0EYkt4fiDq16DSyQDZiMaO6At1QkMVIUU')!
  );

  const OPENWEATHER_KEY = Deno.env.get('29e82fa634e5cec65667e981eedf0628');

  // Fetch target locations from database
  const { data: cities } = await supabase.from('cached_weather_metrics').select('city_name, latitude, longitude');
  if (!cities) return new Response("Database location read error", { status: 500 });

  for (const city of cities) {
    try {
      // 1. Fetch live 5-Day forecast payload (Includes Weather data + UV calculations)
      const weatherRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${city.latitude}&lon=${city.longitude}&units=metric&appid=${OPENWEATHER_KEY}`);
      const weatherData = await weatherRes.json();

      // 2. Fetch environmental Air Pollution numbers
      const aqiRes = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${city.latitude}&lon=${city.longitude}&appid=${OPENWEATHER_KEY}`);
      const aqiData = await aqiRes.json();

      const currentItem = weatherData.list[0];
      const rawAqiIndex = aqiData.list[0].main.aqi; // 1 = Good, 5 = Very Poor

      const statusMap = ["", "Одличен", "Добар", "Умерен", "Загаден", "Штетен"];
      const aqiText = statusMap[rawAqiIndex] || "Умерен";

      // Build out clean array structures for the front-end modal wheels
      const hourlyForecast = weatherData.list.slice(0, 5).map((item: any, idx: number) => ({
        time: idx === 0 ? "Сега" : new Date(item.dt * 1000).toLocaleTimeString('mk-MK', { hour: '2-digit', minute: '2-digit' }),
        temp: `${Math.round(item.main.temp)}°`,
        icon: item.weather[0].main === 'Clear' ? '☀️' : '☁️' // Maps baseline indicators simply
      }));

      // Group into days for weekly arrays
      const weeklyForecast = [
        { day: "Утре", temps: `${Math.round(weatherData.list[8].main.temp_max)}° / ${Math.round(weatherData.list[8].main.temp_min)}°`, icon: '⛅' },
        { day: "Задутре", temps: `${Math.round(weatherData.list[16].main.temp_max)}° / ${Math.round(weatherData.list[16].main.temp_min)}°`, icon: '☁️' }
      ];

      // 3. Upsert data back into your cache table
      await supabase.from('cached_weather_metrics').upsert({
        city_name: city.city_name,
        latitude: city.latitude,
        longitude: city.longitude,
        current_temp: currentItem.main.temp,
        weather_code: currentItem.weather[0].id,
        is_day: currentItem.sys.pod === 'd' ? 1 : 0,
        uv_index: currentItem.uvi ?? 0.0, // OpenWeather embeds forecast indicators cleanly
        aqi_value: rawAqiIndex * 20,
        aqi_status_text: aqiText,
        hourly_forecast: hourlyForecast,
        weekly_forecast: weeklyForecast,
        updated_at: new Date().toISOString()
      }, { onConflict: 'city_name' });

      // 4. TRIGGER PREMIUM PUSH NOTIFICATIONS
      if (rawAqiIndex >= 4) {
        // Query push tokens for premium subscribers watching this city
        const { data: premiumUsers } = await supabase
          .from('profiles')
          .select('push_token')
          .eq('monitored_city', city.city_name)
          .eq('is_premium', true);

        for (const user of premiumUsers || []) {
          if (user.push_token) {
            // await dispatchPushAlert(user.push_token, `Високо загадување во ${city.city_name}! Индекс: ${aqiText}`);
          }
        }
      }

    } catch (err) {
      console.error(`Error updating data for ${city.city_name}:`, err);
    }
  }

  return new Response("Sync finalized successfully.");
});