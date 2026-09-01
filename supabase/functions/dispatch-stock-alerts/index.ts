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
  return data.access_token;
}

async function sendFcmPush(
  fcmToken: string,
  title: string,
  body: string,
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
          data: { widgetId: "stock" },
        },
      }),
    }
  );
  return fcmRes.ok;
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const rawSecret = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")!;
    const finnhubApiKey = "da402nhr01qual4s09agda402nhr01qual4s09b0";

    const serviceAccount = JSON.parse(rawSecret);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const fcmAccessToken = await getFcmAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;

    // 1. Fetch active devices subscribed to stock updates
    const { data: devices, error: devError } = await supabase
      .from("user_devices")
      .select("device_id, push_token, stock_alert_symbol, stock_alert_threshold, last_stock_alert_at")
      .not("push_token", "is", null);

    if (devError || !devices || devices.length === 0) {
      return new Response(JSON.stringify({ message: "No active devices to notify." }), { status: 200 });
    }

    const COOLDOWN_HOURS = 12;
    const now = new Date();
    let sentCount = 0;

    // 2. Group devices by requested stock symbol to optimize Finnhub HTTP calls
    const uniqueSymbols = Array.from(new Set(devices.map((d) => d.stock_alert_symbol || "AAPL")));
    const symbolDataMap = new Map<string, any>();

    for (const symbol of uniqueSymbols) {
      const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubApiKey}`);
      if (res.ok) {
        const quote = await res.json();
        if (quote && typeof quote.c === "number") {
          symbolDataMap.set(symbol, quote);
        }
      }
    }

    // 3. Process each device
    for (const dev of devices) {
      const symbol = dev.stock_alert_symbol || "AAPL";
      const threshold = dev.stock_alert_threshold || 2.0;
      const quote = symbolDataMap.get(symbol);

      if (!quote || !quote.dp) continue;

      const changePercent = Math.abs(quote.dp);
      const hoursDiff = dev.last_stock_alert_at
        ? (now.getTime() - new Date(dev.last_stock_alert_at).getTime()) / (1000 * 60 * 60)
        : 999;

      // Notify if price movement exceeds threshold and cooldown has elapsed
      if (changePercent >= threshold && hoursDiff >= COOLDOWN_HOURS) {
        const emoji = quote.dp >= 0 ? "📈" : "📉";
        const sign = quote.dp >= 0 ? "+" : "";
        const title = `${emoji} ${symbol} Значителна промена (${sign}${quote.dp.toFixed(2)}%)`;
        const body = `Моментална цена: $${quote.c.toFixed(2)} (Дневен опсег: $${quote.l.toFixed(2)} - $${quote.h.toFixed(2)}).`;

        const ok = await sendFcmPush(dev.push_token, title, body, fcmAccessToken, projectId);

        if (ok) {
          sentCount++;
          await supabase
            .from("user_devices")
            .update({ last_stock_alert_at: now.toISOString() })
            .eq("device_id", dev.device_id);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, sentCount }), { status: 200 });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});