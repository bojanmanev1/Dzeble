import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";

async function getFcmAccessToken(serviceAccount: any): Promise<string> {
  const importKey = await jose.importPKCS8(serviceAccount.private_key, "RS256");

  const jwt = await new jose.SignJWT({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(importKey);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Google OAuth error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function sendFcmPush(
  fcmToken: string,
  title: string,
  body: string,
  dataPayload: Record<string, string>,
  accessToken: string,
  projectId: string
): Promise<boolean> {
  const fcmRes = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: { title, body },
          data: dataPayload,
          android: {
            priority: "high",
            notification: {
              channel_id: "default",
              sound: "default",
              default_sound: true,
              default_vibrate_timings: true,
            },
          },
        },
      }),
    }
  );

  return fcmRes.ok;
}

serve(async (_req) => {
  try {
    const localHour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Skopje",
        hour: "numeric",
        hour12: false,
      }).format(new Date()),
      10
    );

    // Quiet hours (22:00 - 08:00 Skopje time)
    if (localHour >= 22 || localHour < 8) {
      return new Response(
        JSON.stringify({ success: true, message: "Quiet hours active (22:00-08:00). Crypto alerts muted." }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const rawSecret = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")!;

    const serviceAccount = JSON.parse(rawSecret);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const fcmAccessToken = await getFcmAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;

    const { data: devices, error: devError } = await supabase
      .from("user_devices")
      .select("device_id, push_token, crypto_alert_pair, last_crypto_alert_at")
      .not("push_token", "is", null);

    if (devError) throw devError;
    if (!devices || devices.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No devices found." }), { status: 200 });
    }

    const pairsToFetch = Array.from(
      new Set(devices.map((d: any) => (d.crypto_alert_pair || "BTCUSDT").toUpperCase()))
    );

    const tickerMap = new Map<string, { price: number; change24h: number; high24h: number; low24h: number }>();

    for (const pair of pairsToFetch) {
      try {
        const binanceRes = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`);
        if (binanceRes.ok) {
          const t = await binanceRes.json();
          tickerMap.set(pair, {
            price: parseFloat(t.lastPrice),
            change24h: parseFloat(t.priceChangePercent),
            high24h: parseFloat(t.highPrice),
            low24h: parseFloat(t.lowPrice),
          });
        }
      } catch (err) {
        console.warn(`Failed to fetch Binance ticker for ${pair}:`, err);
      }
    }

    const COOLDOWN_HOURS = 8;
    const SIGNIFICANT_CHANGE_THRESHOLD = 4.5;
    const now = new Date();
    let sentCount = 0;

    for (const dev of devices) {
      const pair = (dev.crypto_alert_pair || "BTCUSDT").toUpperCase();
      const ticker = tickerMap.get(pair);
      if (!ticker) continue;

      const hoursDiff = dev.last_crypto_alert_at
        ? (now.getTime() - new Date(dev.last_crypto_alert_at).getTime()) / (1000 * 60 * 60)
        : 999;

      const symbol = pair.replace("USDT", "");
      const isUp = ticker.change24h >= 0;
      const emoji = isUp ? "📈" : "📉";
      const sign = isUp ? "+" : "";
      const priceStr = ticker.price >= 1 ? ticker.price.toLocaleString("en-US", { maximumFractionDigits: 2 }) : ticker.price.toFixed(4);

      const isCooldownPassed = hoursDiff >= COOLDOWN_HOURS;
      const isBigMove = Math.abs(ticker.change24h) >= SIGNIFICANT_CHANGE_THRESHOLD && hoursDiff >= 3;

      if (!isCooldownPassed && !isBigMove) continue;

      const title = `${emoji} ${symbol} ${sign}${ticker.change24h.toFixed(2)}% ($${priceStr})`;
      const body = isUp
        ? `${symbol} бележи раст од ${sign}${ticker.change24h.toFixed(2)}% во изминатите 24 часа. 24h High: $${ticker.high24h.toLocaleString("en-US")}.`
        : `${symbol} бележи пад од ${ticker.change24h.toFixed(2)}% во изминатите 24 часа. 24h Low: $${ticker.low24h.toLocaleString("en-US")}.`;

      const ok = await sendFcmPush(
        dev.push_token,
        title,
        body,
        { widgetId: "crypto", pair },
        fcmAccessToken,
        projectId
      );

      if (ok) {
        sentCount++;
        await supabase
          .from("user_devices")
          .update({ last_crypto_alert_at: now.toISOString() })
          .eq("device_id", dev.device_id);
      }
    }

    return new Response(JSON.stringify({ success: true, sentCount }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});