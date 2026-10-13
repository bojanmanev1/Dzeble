import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Helper: Maps standard WMO Weather interpretation codes to visual indicators
function getWmoIcon(code: number, isDay: number = 1): string {
  const dayTime = isDay === 1;
  if (code === 0) return dayTime ? "☀️" : "🌙"; // Clear sky
  if (code === 1) return dayTime ? "🌤️" : "🌙"; // Mainly clear
  if (code === 2) return dayTime ? "⛅" : "☁️"; // Partly cloudy
  if (code === 3) return "☁️"; // Overcast
  if (code === 45 || code === 48) return "🌫️"; // Fog
  if (code >= 51 && code <= 57) return "🌦️"; // Drizzle
  if (code >= 61 && code <= 67) return "🌧️"; // Rain
  if (code >= 71 && code <= 77) return "❄️"; // Snow fall / grains
  if (code >= 80 && code <= 82) return "🌧️"; // Rain showers
  if (code >= 85 && code <= 86) return "🌨️"; // Snow showers
  if (code >= 95 && code <= 99) return "⛈️"; // Thunderstorm
  return "☁️";
}

// Helper: Standard US EPA AQI bracket classification (0 - 500 scale)
function getAqiStatus(usAqi: number): string {
  if (usAqi <= 50) return "Одличен";
  if (usAqi <= 100) return "Умерен";
  if (usAqi <= 150) return "Чувствителен";
  if (usAqi <= 200) return "Загаден";
  if (usAqi <= 300) return "Многу Загаден";
  return "Опасно Загаден";
}

const dayNamesMk = ["Недела", "Понеделник", "Вторник", "Среда", "Четврток", "Петок", "Сабота"];

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://pvxnzqpbdizhyneiyzlf.supabase.co";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2eG56cXBiZGl6aHluZWl5emxmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzg2Njk1MCwiZXhwIjoyMDk5NDQyOTUwfQ.1ysqRDZdtV0EYkt4fiDq16DSyQDZiMaO6At1QkMVIUU";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch target cities from database
    const { data: cities, error: citiesErr } = await supabase
      .from("cached_weather_metrics")
      .select("city_name, latitude, longitude");

    if (citiesErr || !cities || cities.length === 0) {
      return new Response(JSON.stringify({ error: "Database location read error", details: citiesErr }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.info(`[OPEN-METEO SYNC START] Syncing ${cities.length} cities...`);

    for (const city of cities) {
      try {
        // 1. Fetch Open-Meteo European Weather & Forecast
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,precipitation_probability,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max&timezone=Europe/Skopje`;
        const weatherRes = await fetch(weatherUrl);
        const weatherData = await weatherRes.json();

        // 2. Fetch Open-Meteo High-Resolution Air Quality (CAMS/SILAM)
        const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${city.latitude}&longitude=${city.longitude}&current=european_aqi,us_aqi,pm10,pm2_5&timezone=Europe/Skopje`;
        const aqiRes = await fetch(aqiUrl);
        const aqiData = await aqiRes.json();

        const currentItem = weatherData.current;
        if (!currentItem) {
          console.warn(`No current weather data returned for ${city.city_name}`);
          continue;
        }

        // AQI resolution: standard 0 - 500 scale + real pollutant measurements
        const usAqi = Math.round(aqiData.current?.us_aqi ?? aqiData.current?.european_aqi ?? 0);
        const pm25 = parseFloat((aqiData.current?.pm2_5 ?? 0).toFixed(1));
        const pm10 = parseFloat((aqiData.current?.pm10 ?? 0).toFixed(1));
        const aqiText = getAqiStatus(usAqi);

        // Build 24-hour hourly forecast timeline aligned to Europe/Skopje local time
        const skopjeFormatter = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Skopje",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          hourCycle: "h23"
        });
        const skopjeParts = Object.fromEntries(
          skopjeFormatter.formatToParts(new Date()).map(p => [p.type, p.value])
        );
        const nowSkopjeIsoHour = `${skopjeParts.year}-${skopjeParts.month}-${skopjeParts.day}T${skopjeParts.hour}`;

        let startIndex = (weatherData.hourly?.time || []).findIndex((t: string) => t.startsWith(nowSkopjeIsoHour));
        if (startIndex === -1) {
          const curHourNum = parseInt(skopjeParts.hour, 10);
          startIndex = (weatherData.hourly?.time || []).findIndex((t: string) => {
            const h = t.includes("T") ? parseInt(t.split("T")[1].substring(0, 2), 10) : -1;
            return h === curHourNum;
          });
          if (startIndex === -1) startIndex = 0;
        }

        const hourlyForecast = [];
        const hourlyTotal = weatherData.hourly?.time?.length || 0;
        const count = Math.min(24, hourlyTotal - startIndex);

        for (let i = 0; i < count; i++) {
          const idx = startIndex + i;
          const timeStr = weatherData.hourly.time[idx];
          const hourPart = timeStr.includes("T") ? timeStr.split("T")[1].substring(0, 5) : timeStr;
          const code = weatherData.hourly.weather_code[idx];
          const hourNum = parseInt(hourPart.split(":")[0], 10);
          const isDayHour = hourNum >= 6 && hourNum < 20 ? 1 : 0;

          hourlyForecast.push({
            time: i === 0 ? "Сега" : hourPart,
            rawTime: timeStr,
            hour: hourNum,
            temp: `${Math.round(weatherData.hourly.temperature_2m[idx])}°`,
            icon: getWmoIcon(code, isDayHour),
            humidity: Math.round(weatherData.hourly.relative_humidity_2m?.[idx] ?? currentItem.relative_humidity_2m),
            wind: Math.round(weatherData.hourly.wind_speed_10m?.[idx] ?? currentItem.wind_speed_10m),
            apparent_temp: Math.round(weatherData.hourly.apparent_temperature?.[idx] ?? currentItem.apparent_temperature)
          });
        }

        // Build 7-day weekly forecast
        const weeklyForecast = [];
        const dailyCount = weatherData.daily?.time?.length || 0;
        for (let i = 0; i < dailyCount; i++) {
          const dateStr = weatherData.daily.time[i];
          const maxTemp = Math.round(weatherData.daily.temperature_2m_max[i]);
          const minTemp = Math.round(weatherData.daily.temperature_2m_min[i]);
          const code = weatherData.daily.weather_code[i];

          let dayLabel = "";
          if (i === 0) dayLabel = "Денес";
          else if (i === 1) dayLabel = "Утре";
          else if (i === 2) dayLabel = "Задутре";
          else {
            const d = new Date(dateStr);
            dayLabel = dayNamesMk[d.getDay()] || dateStr;
          }

          weeklyForecast.push({
            day: dayLabel,
            temps: `${maxTemp}° / ${minTemp}°`,
            max: maxTemp,
            min: minTemp,
            icon: getWmoIcon(code, 1)
          });
        }

        // 3. If Skopje, fetch localized municipality AQI in a single batch call (Centar, Karposh, Aerodrom, etc.)
        let skopjeMunicipalities: any = null;
        if (city.city_name === "Скопје") {
          try {
            const muniDefs = [
              { name: "Центар", nameEn: "Centar", nameAl: "Qendër", lat: 41.9960, lng: 21.4316 },
              { name: "Карпош", nameEn: "Karposh", nameAl: "Karposh", lat: 42.0050, lng: 21.3900 },
              { name: "Аеродром", nameEn: "Aerodrom", nameAl: "Aerodrom", lat: 41.9833, lng: 21.4667 },
              { name: "Кисела Вода", nameEn: "Kisela Voda", nameAl: "Kisela Vodë", lat: 41.9680, lng: 21.4420 },
              { name: "Гази Баба", nameEn: "Gazi Baba", nameAl: "Gazi Babë", lat: 42.0120, lng: 21.4650 },
              { name: "Ѓорче Петров", nameEn: "Gjorche Petrov", nameAl: "Gjorçe Petrov", lat: 42.0110, lng: 21.3550 },
              { name: "Чаир", nameEn: "Chair", nameAl: "Çair", lat: 42.0150, lng: 21.4380 },
              { name: "Бутел", nameEn: "Butel", nameAl: "Butel", lat: 42.0320, lng: 21.4460 }
            ];

            const lats = muniDefs.map((m) => m.lat).join(",");
            const lngs = muniDefs.map((m) => m.lng).join(",");
            const munisAqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lngs}&current=european_aqi,us_aqi,pm10,pm2_5&timezone=Europe/Skopje`;

            const munisRes = await fetch(munisAqiUrl);
            if (munisRes.ok) {
              const munisData = await munisRes.json();
              if (Array.isArray(munisData)) {
                skopjeMunicipalities = muniDefs.map((def, idx) => {
                  const item = munisData[idx]?.current;
                  const val = Math.round(item?.us_aqi ?? item?.european_aqi ?? 0);
                  return {
                    name: def.name,
                    nameEn: def.nameEn,
                    nameAl: def.nameAl,
                    aqi_value: val,
                    aqi_status_text: getAqiStatus(val),
                    pm10: parseFloat((item?.pm10 ?? 0).toFixed(1)),
                    pm2_5: parseFloat((item?.pm2_5 ?? 0).toFixed(1))
                  };
                });
              }
            }
          } catch (muniErr: any) {
            console.warn("Failed to fetch Skopje municipalities AQI:", muniErr.message);
          }
        }

        // 4. Upsert data cleanly back into cached_weather_metrics
        const upsertPayload: any = {
          city_name: city.city_name,
          latitude: city.latitude,
          longitude: city.longitude,
          current_temp: currentItem.temperature_2m,
          weather_code: currentItem.weather_code,
          is_day: currentItem.is_day,
          uv_index: weatherData.daily?.uv_index_max?.[0] ?? 0.0,
          aqi_value: usAqi,
          aqi_status_text: aqiText,
          pm25_value: pm25,
          pm10_value: pm10,
          hourly_forecast: hourlyForecast,
          weekly_forecast: weeklyForecast,
          updated_at: new Date().toISOString()
        };

        if (skopjeMunicipalities) {
          upsertPayload.skopje_municipalities = skopjeMunicipalities;
        }

        const { error: upsertErr } = await supabase
          .from("cached_weather_metrics")
          .upsert(upsertPayload, { onConflict: "city_name" });

        if (upsertErr) {
          console.error(`Failed to upsert weather for ${city.city_name}:`, upsertErr);
        } else {
          console.info(`✓ Successfully synced ${city.city_name}: ${currentItem.temperature_2m}°C, AQI: ${usAqi} (${aqiText})${skopjeMunicipalities ? ` [with ${skopjeMunicipalities.length} municipalities]` : ""}`);
        }

      } catch (err: any) {
        console.error(`Error updating data for ${city.city_name}:`, err.message);
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Open-Meteo sync finalized successfully." }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("Critical error in sync-weather-metrics:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});