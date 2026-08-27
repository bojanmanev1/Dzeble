import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Helper: Convert Service Account JSON into Google OAuth Token
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

  // Clean PEM key
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

serve(async (req) => {
  try {
    // 1. Check secrets
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const rawSecret = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");

    if (!rawSecret) {
      return new Response(JSON.stringify({ error: "Secret FIREBASE_SERVICE_ACCOUNT_JSON is missing" }), { status: 400 });
    }

    const serviceAccount = JSON.parse(rawSecret);
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    // 2. Get Access Token
    const fcmAccessToken = await getFcmAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;

    // 3. Fetch active devices
    const { data: devices, error: devError } = await supabase
      .from("user_devices")
      .select("device_id, push_token, city_preference, last_aqi_alert_at, last_weather_alert_at")
      .not("push_token", "is", null);

    if (devError) {
      return new Response(JSON.stringify({ error: "Database error", details: devError }), { status: 500 });
    }

    // 4. Fetch latest metrics
    const { data: metrics } = await supabase.from("cached_weather_metrics").select("*");
    const metricsMap = new Map(metrics?.map((m) => [m.city_name, m]));

    let sentCount = 0;
    const now = new Date();

    for (const dev of devices || []) {
      const userCity = dev.city_preference || "Скопје";
      const cityMetric = metricsMap.get(userCity);

      if (!cityMetric) continue;

      // Force trigger condition check
      const isHighAqi = cityMetric.aqi_value > 100;
      const isRainOrSnow = cityMetric.weather_code >= 200 && cityMetric.weather_code < 700;

      if (isHighAqi || isRainOrSnow) {
        const title = isHighAqi ? `🚨 Штетен воздух во ${userCity}` : `🌧️ Врнежи од дожд во ${userCity}`;
        const body = isHighAqi ? `AQI достигна ${cityMetric.aqi_value}` : `Температура: ${Math.round(cityMetric.current_temp)}°C`;

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
              data: { widgetId: isHighAqi ? "aqi" : "weather", city: userCity },
            },
          }),
        });

        if (fcmRes.ok) {
          sentCount++;
        } else {
          const errData = await fcmRes.json();
          console.error("FCM Send Error:", errData);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, sentCount }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("CRITICAL ERROR:", err);
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});