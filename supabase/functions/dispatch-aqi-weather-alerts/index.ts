import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Helper: Convert Service Account JSON into Google OAuth Token for FCM v1
async function getFcmAccessToken(serviceAccount: any): Promise<string> {
  const jwtHeader = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const jwtClaim = btoa(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );

  const unsignedToken = `${jwtHeader}.${jwtClaim}`;

  let pem = serviceAccount.private_key || "";
  pem = pem.replace(/\\n/g, "\n");
  pem = pem.replace("-----BEGIN PRIVATE KEY-----", "")
           .replace("-----END PRIVATE KEY-----", "")
           .replace(/\s/g, "");

  const binaryDerString = atob(pem);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${unsignedToken}.${base64Signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`OAuth failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

// Helper: Classify WMO weather codes into categories
type WeatherCategory = "SUNNY" | "RAIN" | "SNOW" | "THUNDER" | "CLOUDY";

function classifyWeatherCode(code: number): WeatherCategory {
  if (code >= 95 && code <= 99) return "THUNDER";
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86) || (code >= 600 && code < 700)) return "SNOW";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 200 && code < 600)) return "RAIN";
  if (code >= 0 && code <= 2) return "SUNNY";
  return "CLOUDY";
}

function getLocalizedCityName(city: string, lang: string): string {
  const cityMap: Record<string, { mk: string; en: string; al: string }> = {
    "Скопје": { mk: "Скопје", en: "Skopje", al: "Shkup" },
    "Skopje": { mk: "Скопје", en: "Skopje", al: "Shkup" },
    "Битола": { mk: "Битола", en: "Bitola", al: "Manastir" },
    "Bitola": { mk: "Битола", en: "Bitola", al: "Manastir" },
    "Куманово": { mk: "Куманово", en: "Kumanovo", al: "Kumanovë" },
    "Kumanovo": { mk: "Куманово", en: "Kumanovo", al: "Kumanovë" },
    "Прилеп": { mk: "Прилеп", en: "Prilep", al: "Prilep" },
    "Prilep": { mk: "Прилеп", en: "Prilep", al: "Prilep" },
    "Тетово": { mk: "Тетово", en: "Tetovo", al: "Tetovë" },
    "Tetovo": { mk: "Тетово", en: "Tetovo", al: "Tetovë" },
    "Велес": { mk: "Велес", en: "Veles", al: "Veles" },
    "Veles": { mk: "Велес", en: "Veles", al: "Veles" },
    "Штип": { mk: "Штип", en: "Shtip", al: "Shtip" },
    "Stip": { mk: "Штип", en: "Shtip", al: "Shtip" },
    "Охрид": { mk: "Охрид", en: "Ohrid", al: "Ohër" },
    "Ohrid": { mk: "Охрид", en: "Ohrid", al: "Ohër" },
    "Гостивар": { mk: "Гостивар", en: "Gostivar", al: "Gostivar" },
    "Gostivar": { mk: "Гостивар", en: "Gostivar", al: "Gostivar" },
    "Струмица": { mk: "Струмица", en: "Strumica", al: "Strumicë" },
    "Strumica": { mk: "Струмица", en: "Strumica", al: "Strumicë" },
    "Кавадарци": { mk: "Кавадарци", en: "Kavadarci", al: "Kavadar" },
    "Kavadarci": { mk: "Кавадарци", en: "Kavadarci", al: "Kavadar" },
    "Кочани": { mk: "Кочани", en: "Kochani", al: "Koçan" },
    "Kocani": { mk: "Кочани", en: "Kochani", al: "Koçan" },
    "Кичево": { mk: "Кичево", en: "Kichevo", al: "Kërçovë" },
    "Kicevo": { mk: "Кичево", en: "Kichevo", al: "Kërçovë" },
    "Струга": { mk: "Струга", en: "Struga", al: "Strugë" },
    "Struga": { mk: "Струга", en: "Struga", al: "Strugë" },
    "Радовиш": { mk: "Радовиш", en: "Radovish", al: "Radovisht" },
    "Гевгелија": { mk: "Гевгелија", en: "Gevgelija", al: "Gjevgjeli" },
    "Крива Паланка": { mk: "Крива Паланка", en: "Kriva Palanka", al: "Kriva Pallankë" },
    "Дебар": { mk: "Дебар", en: "Debar", al: "Dibër" },
    "Свети Николе": { mk: "Свети Николе", en: "Sveti Nikole", al: "Sveti Nikollë" },
    "Неготино": { mk: "Неготино", en: "Negotino", al: "Negotinë" },
    "Делчево": { mk: "Делчево", en: "Delchevo", al: "Dellçevë" },
    "Виница": { mk: "Виница", en: "Vinica", al: "Vinicë" },
    "Ресен": { mk: "Ресен", en: "Resen", al: "Resnjë" },
    "Пробиштип": { mk: "Пробиштип", en: "Probistip", al: "Probishtip" },
    "Берово": { mk: "Берово", en: "Berovo", al: "Berovë" },
    "Кратово": { mk: "Кратово", en: "Kratovo", al: "Kratovë" },
    "Богданци": { mk: "Богданци", en: "Bogdanci", al: "Bogdancë" },
    "Крушево": { mk: "Крушево", en: "Krushevo", al: "Krushevë" },
    "Македонска Каменица": { mk: "Македонска Каменица", en: "Makedonska Kamenica", al: "Kamenicë" },
    "Валандово": { mk: "Валандово", en: "Valandovo", al: "Valandovë" },
    "Македонски Брод": { mk: "Македонски Брод", en: "Makedonski Brod", al: "Brod" },
    "Демир Капија": { mk: "Демир Капија", en: "Demir Kapija", al: "Demir Kapi" },
    "Пехчево": { mk: "Пехчево", en: "Pehcevo", al: "Pehçevë" },
    "Демир Хисар": { mk: "Демир Хисар", en: "Demir Hisar", al: "Demir Hisar" },
    "Дојран": { mk: "Дојран", en: "Dojran", al: "Dojran" }
  };
  const match = cityMap[city];
  if (!match) return city;
  return match[lang as 'mk' | 'en' | 'al'] || match.mk || city;
}

function getWeatherConditionText(code: number, lang: string): string {
  if (lang === "en") {
    if (code === 0) return "Sunny and clear";
    if (code === 1) return "Mostly sunny";
    if (code === 2) return "Partly cloudy";
    if (code === 3) return "Overcast";
    if (code === 45 || code === 48) return "Foggy";
    if (code >= 51 && code <= 57) return "Light rain";
    if (code >= 61 && code <= 67) return "Rainfall";
    if (code >= 71 && code <= 77) return "Snowfall";
    if (code >= 80 && code <= 82) return "Heavy rain";
    if (code >= 85 && code <= 86) return "Heavy snow";
    if (code >= 95 && code <= 99) return "Thunderstorms";
    return "Partly cloudy";
  } else if (lang === "al") {
    if (code === 0) return "Me diell dhe kthjellët";
    if (code === 1) return "Kryesisht me diell";
    if (code === 2) return "Pjesërisht me re";
    if (code === 3) return "Me vranësira";
    if (code === 45 || code === 48) return "Mjegull";
    if (code >= 51 && code <= 57) return "Shi i lehtë";
    if (code >= 61 && code <= 67) return "Reshje shiu";
    if (code >= 71 && code <= 77) return "Reshje bore";
    if (code >= 80 && code <= 82) return "Shi i rrëmbyeshëm";
    if (code >= 85 && code <= 86) return "Borë e dendur";
    if (code >= 95 && code <= 99) return "Stuhi me rrufe";
    return "Pjesërisht me re";
  }
  // Default Macedonian
  if (code === 0) return "Сончево и ведро";
  if (code === 1) return "Претежно сончево";
  if (code === 2) return "Делумно облачно";
  if (code === 3) return "Облачно";
  if (code === 45 || code === 48) return "Магла";
  if (code >= 51 && code <= 57) return "Слаб дожд";
  if (code >= 61 && code <= 67) return "Врнежи од дожд";
  if (code >= 71 && code <= 77) return "Врнежи од снег";
  if (code >= 80 && code <= 82) return "Пороен дожд";
  if (code >= 85 && code <= 86) return "Пороен снег";
  if (code >= 95 && code <= 99) return "Грмотевици";
  return "Умерено облачно";
}

function getAqiStatusText(aqi: number, lang: string): string {
  if (lang === "en") {
    if (aqi <= 50) return "Good";
    if (aqi <= 100) return "Moderate";
    if (aqi <= 150) return "Unhealthy for Sensitive";
    if (aqi <= 200) return "Unhealthy";
    return "Hazardous";
  } else if (lang === "al") {
    if (aqi <= 50) return "Mirë";
    if (aqi <= 100) return "Mesatar";
    if (aqi <= 150) return "E dëmshme";
    if (aqi <= 200) return "Shumë e dëmshme";
    return "E rrezikshme";
  }
  if (aqi <= 50) return "Одличен";
  if (aqi <= 100) return "Умерен";
  if (aqi <= 150) return "Загаден";
  if (aqi <= 200) return "Многу загаден";
  return "Опасно";
}

function getUvStatusText(uv: number, lang: string): string {
  if (lang === "en") {
    if (uv <= 2) return "Low";
    if (uv <= 5) return "Moderate";
    if (uv <= 7) return "High";
    if (uv <= 10) return "Very High";
    return "Extreme";
  } else if (lang === "al") {
    if (uv <= 2) return "I ulët";
    if (uv <= 5) return "Mesatar";
    if (uv <= 7) return "I lartë";
    if (uv <= 10) return "Shumë i lartë";
    return "Ekstrem";
  }
  if (uv <= 2) return "Низок";
  if (uv <= 5) return "Умерен";
  if (uv <= 7) return "Висок";
  if (uv <= 10) return "Многу висок";
  return "Екстремен";
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const modeParam = url.searchParams.get("mode"); // "morning" | "change" | null

    // 1. Check secrets & initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const rawSecret = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");

    if (!rawSecret) {
      return new Response(JSON.stringify({ error: "Secret FIREBASE_SERVICE_ACCOUNT_JSON is missing" }), { status: 400 });
    }

    const serviceAccount = JSON.parse(rawSecret);
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    // 2. Determine current time in Europe/Skopje
    const now = new Date();
    const skopjeTimeFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Skopje",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = skopjeTimeFormatter.formatToParts(now);
    const skopjeHour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
    const skopjeMinute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
    const skopjeDateStr = `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`;

    // Auto-detect morning mode around 7:00 AM Skopje time (e.g. 06:45 - 07:45 AM) if no mode specified
    const isMorningRun = modeParam === "morning" || (!modeParam && skopjeHour === 7 && skopjeMinute <= 45);

    // 3. Fetch OAuth Token for FCM
    const fcmAccessToken = await getFcmAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;

    // 4. Fetch active devices (excluding devices where push_token or user_id is null)
    const { data: devices, error: devError } = await supabase
      .from("user_devices")
      .select("device_id, user_id, push_token, city_preference, last_aqi_alert_at, last_uv_alert_at, last_weather_alert_at, last_weather_category, notify_weather, notify_aqi, language")
      .not("push_token", "is", null)
      .not("user_id", "is", null);

    if (devError) {
      return new Response(JSON.stringify({ error: "Database error", details: devError }), { status: 500 });
    }

    // 5. Fetch latest cached weather metrics for Macedonian cities
    const { data: metrics } = await supabase.from("cached_weather_metrics").select("*");
    const metricsMap = new Map(metrics?.map((m) => [m.city_name, m]));

    let sentCount = 0;

    for (const dev of devices || []) {
      const allowWeather = (dev as any).notify_weather !== false;
      const allowAqi = (dev as any).notify_aqi !== false;

      // Skip device if both weather and AQI alerts are disabled
      if (!allowWeather && !allowAqi) continue;

      const devLang = dev.language || "mk";
      const userCity = dev.city_preference || "Скопје";
      const localizedCity = getLocalizedCityName(userCity, devLang);
      const cityMetric = metricsMap.get(userCity) || metricsMap.get("Скопје");
      if (!cityMetric) continue;

      const currentTemp = Math.round(cityMetric.current_temp);
      const weatherCode = Number(cityMetric.weather_code ?? 0);
      const category = classifyWeatherCode(weatherCode);
      const conditionText = getWeatherConditionText(weatherCode, devLang);
      const aqiText = getAqiStatusText(Number(cityMetric.aqi_value || 40), devLang);

      // Extract daily maximum temperature from weekly forecast
      let maxTemp: number | null = null;
      if (Array.isArray(cityMetric.weekly_forecast) && cityMetric.weekly_forecast.length > 0) {
        const todayEntry = cityMetric.weekly_forecast.find((f: any) => f.day === "Денес" || f.isToday) || cityMetric.weekly_forecast[0];
        if (todayEntry?.max != null && !isNaN(todayEntry.max)) {
          maxTemp = Math.round(todayEntry.max);
        } else if (typeof todayEntry?.temps === "string") {
          const match = todayEntry.temps.match(/([0-9.-]+)°/);
          match && (maxTemp = Math.round(parseFloat(match[1])));
        }
      }

      let shouldSend = false;
      let title = "";
      let body = "";
      let alertType: "weather" | "aqi" | "uv" = "weather";

      if (isMorningRun) {
        // --- 🌅 MORNING DAILY BRIEFING (~7:00 AM) ---
        // Morning daily briefing is a weather forecast: only send if allowWeather is enabled
        if (!allowWeather) continue;

        // Check if already sent today in Skopje date
        if (dev.last_weather_alert_at) {
          const lastAlertSkopje = new Intl.DateTimeFormat("en-US", {
            timeZone: "Europe/Skopje",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date(dev.last_weather_alert_at));
          const todayFormatted = new Intl.DateTimeFormat("en-US", {
            timeZone: "Europe/Skopje",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(now);

          if (lastAlertSkopje === todayFormatted) {
            continue; // Already received morning briefing today
          }
        }

        let morningEmoji = "☀️";
        if (category === "RAIN") morningEmoji = "🌧️";
        else if (category === "SNOW") morningEmoji = "❄️";
        else if (category === "THUNDER") morningEmoji = "⛈️";
        else if (category === "CLOUDY") morningEmoji = "⛅";

        if (devLang === "en") {
          title = `${morningEmoji} Daily Forecast for ${localizedCity}`;
          body = maxTemp != null
            ? `Morning: ${currentTemp}°C | Today up to: ${maxTemp}°C. ${conditionText}. Air quality: ${aqiText} (${cityMetric.aqi_value || 40} AQI).`
            : `Morning: ${currentTemp}°C. ${conditionText}. Air quality: ${aqiText} (${cityMetric.aqi_value || 40} AQI).`;
        } else if (devLang === "al") {
          title = `${morningEmoji} Parashikimi ditor për ${localizedCity}`;
          body = maxTemp != null
            ? `Mëngjes: ${currentTemp}°C | Sot deri në: ${maxTemp}°C. ${conditionText}. Cilësia e ajrit: ${aqiText} (${cityMetric.aqi_value || 40} AQI).`
            : `Mëngjes: ${currentTemp}°C. ${conditionText}. Cilësia e ajrit: ${aqiText} (${cityMetric.aqi_value || 40} AQI).`;
        } else {
          title = `${morningEmoji} Денешна прогноза за ${localizedCity}`;
          body = maxTemp != null
            ? `Утрово: ${currentTemp}°C | Денес до: ${maxTemp}°C. ${conditionText}. Воздух: ${aqiText} (${cityMetric.aqi_value || 40} AQI).`
            : `Утрово: ${currentTemp}°C. ${conditionText}. Воздух: ${aqiText} (${cityMetric.aqi_value || 40} AQI).`;
        }

        shouldSend = true;

      } else {
        // --- ⚡ WEATHER CHANGE & UV DETECTION (CONTROLLED BY allowWeather) ---
        if (allowWeather) {
          const previousCategory = dev.last_weather_category;

          // If the device has no recorded previous category, initialize it
          if (!previousCategory) {
            await supabase
              .from("user_devices")
              .update({ last_weather_category: category })
              .eq("device_id", dev.device_id);
            if (category === "RAIN" || category === "SNOW" || category === "THUNDER") {
              if (category === "RAIN") {
                title = devLang === "en" ? `🌧️ Rainfall in ${localizedCity}` : (devLang === "al" ? `🌧️ Reshje shiu në ${localizedCity}` : `🌧️ Врнежи од дожд во ${localizedCity}`);
                body = devLang === "en" ? `Rainfall is active (${conditionText}). Current temperature: ${currentTemp}°C.` : (devLang === "al" ? `Reshjet e shiut janë aktive (${conditionText}). Temperatura aktuale: ${currentTemp}°C.` : `Врнежи од дожд се активни (${conditionText}). Моментална температура: ${currentTemp}°C.`);
                shouldSend = true;
              }
            }
          } else if (previousCategory !== category) {
            // Category CHANGED!
            if (category === "RAIN") {
              if (devLang === "en") {
                title = `🌧️ Rainfall in ${localizedCity}`;
                body = `Rainfall is starting (${conditionText}). Current temperature: ${currentTemp}°C.`;
              } else if (devLang === "al") {
                title = `🌧️ Reshje shiu në ${localizedCity}`;
                body = `Fillojnë reshjet e shiut (${conditionText}). Temperatura aktuale: ${currentTemp}°C.`;
              } else {
                title = `🌧️ Врнежи од дожд во ${localizedCity}`;
                body = `Започнуваат врнежи од дожд (${conditionText}). Моментална температура: ${currentTemp}°C.`;
              }
              shouldSend = true;
            } else if (category === "SNOW") {
              if (devLang === "en") {
                title = `❄️ Snowfall in ${localizedCity}`;
                body = `Snowfall expected (${conditionText}). Current temperature: ${currentTemp}°C.`;
              } else if (devLang === "al") {
                title = `❄️ Reshje bore në ${localizedCity}`;
                body = `Priten reshje bore (${conditionText}). Temperatura aktuale: ${currentTemp}°C.`;
              } else {
                title = `❄️ Врнежи од снег во ${localizedCity}`;
                body = `Очекувајте врнежи од снег (${conditionText}). Моментална температура: ${currentTemp}°C.`;
              }
              shouldSend = true;
            } else if (category === "THUNDER") {
              if (devLang === "en") {
                title = `⛈️ Thunderstorms in ${localizedCity}`;
                body = `Thunderstorms expected. Current temperature: ${currentTemp}°C.`;
              } else if (devLang === "al") {
                title = `⛈️ Stuhi me rrufe në ${localizedCity}`;
                body = `Parashikohet stuhi me rrufe. Temperatura aktuale: ${currentTemp}°C.`;
              } else {
                title = `⛈️ Грмотевици во ${localizedCity}`;
                body = `Најавено е невреме со грмотевици. Моментална температура: ${currentTemp}°C.`;
              }
              shouldSend = true;
            } else if (category === "SUNNY" && cityMetric.is_day === 1) {
              if (devLang === "en") {
                title = `☀️ Clearing up in ${localizedCity}`;
                body = `Weather is clearing up with sunshine. Current temperature: ${currentTemp}°C.`;
              } else if (devLang === "al") {
                title = `☀️ Qartësim i motit në ${localizedCity}`;
                body = `Moti po qetësohet dhe dielli po shkëlqen. Temperatura aktuale: ${currentTemp}°C.`;
              } else {
                title = `☀️ Разведрување во ${localizedCity}`;
                body = `Времето се смирува и изгрева сонце. Моментална температура: ${currentTemp}°C.`;
              }
              shouldSend = true;
            } else {
              // Transitioned to cloudy or similar: silently update category
              await supabase
                .from("user_devices")
                .update({ last_weather_category: category })
                .eq("device_id", dev.device_id);
            }
          }

          // UV Index Alert Check (Trigger if no weather alert and UV >= 7 during daytime)
          if (!shouldSend) {
            const currentUv = Math.round(Number(cityMetric.uv_index || 0));
            const isHighUv = currentUv >= 7 && cityMetric.is_day === 1 && skopjeHour >= 10 && skopjeHour <= 17;
            if (isHighUv) {
              const uvHoursSince = (dev as any).last_uv_alert_at
                ? (now.getTime() - new Date((dev as any).last_uv_alert_at).getTime()) / (1000 * 60 * 60)
                : 999;

              if (uvHoursSince >= 12) {
                const uvStatus = getUvStatusText(currentUv, devLang);
                if (devLang === "en") {
                  title = `☀️ High UV Index in ${localizedCity}`;
                  body = `UV index reached ${currentUv} (${uvStatus}). Use sunscreen and avoid direct sun exposure.`;
                } else if (devLang === "al") {
                  title = `☀️ Indeks i lartë UV në ${localizedCity}`;
                  body = `Indeksi UV arriti në ${currentUv} (${uvStatus}). Përdorni krem mbrojtës dhe shmangni diellin direkt.`;
                } else {
                  title = `☀️ Висок UV индекс во ${localizedCity}`;
                  body = `UV индексот достигна ${currentUv} (${uvStatus}). Користете заштитен фактор и избегнувајте директно сонце.`;
                }
                alertType = "uv";
                shouldSend = true;
              }
            }
          }
        } else {
          // allowWeather is false: silently update last_weather_category
          await supabase
            .from("user_devices")
            .update({ last_weather_category: category })
            .eq("device_id", dev.device_id);
        }

        // --- 💨 HIGH AQI POLLUTION DETECTION (CONTROLLED BY allowAqi) ---
        if (allowAqi && !shouldSend) {
          const isHighAqi = Number(cityMetric.aqi_value) > 100;
          if (isHighAqi) {
            const aqiHoursSince = dev.last_aqi_alert_at
              ? (now.getTime() - new Date(dev.last_aqi_alert_at).getTime()) / (1000 * 60 * 60)
              : 999;

            if (aqiHoursSince >= 12) {
              if (devLang === "en") {
                title = `🚨 High Air Pollution in ${localizedCity}`;
                body = `AQI index reached ${cityMetric.aqi_value} (${aqiText}). Avoid prolonged outdoor exposure.`;
              } else if (devLang === "al") {
                title = `🚨 Ndotje e lartë e ajrit në ${localizedCity}`;
                body = `Indeksi AQI arriti në ${cityMetric.aqi_value} (${aqiText}). Shmangni qëndrimin e gjatë jashtë.`;
              } else {
                title = `🚨 Загаден воздух во ${localizedCity}`;
                body = `AQI индексот достигна ${cityMetric.aqi_value} (${aqiText}). Избегнувајте продолжен престој на отворено.`;
              }
              alertType = "aqi";
              shouldSend = true;
            }
          }
        }
      }

      if (shouldSend && title && body) {
        const fcmRes = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${fcmAccessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: dev.push_token,
              notification: { title, body },
              data: { widgetId: alertType, city: userCity },
            },
          }),
        });

        if (fcmRes.ok) {
          sentCount++;
          const updatePayload: Record<string, string> = {};
          if (alertType === "aqi") {
            updatePayload.last_aqi_alert_at = now.toISOString();
          } else if (alertType === "uv") {
            updatePayload.last_uv_alert_at = now.toISOString();
          } else {
            updatePayload.last_weather_alert_at = now.toISOString();
            updatePayload.last_weather_category = category;
          }
          await supabase
            .from("user_devices")
            .update(updatePayload)
            .eq("device_id", dev.device_id);
        } else {
          const errData = await fcmRes.json();
          console.error("FCM Send Error:", errData);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, mode: isMorningRun ? "morning" : "change", sentCount }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("CRITICAL ERROR in dispatch-aqi-weather-alerts:", err);
    return new Response(
      JSON.stringify({ error: err.message, stack: err.stack }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});