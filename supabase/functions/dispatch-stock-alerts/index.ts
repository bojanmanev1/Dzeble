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

function extractDeviceSymbols(dev: any): string[] {
  const result: string[] = [];
  if (Array.isArray(dev.stock_alert_symbols) && dev.stock_alert_symbols.length > 0) {
    for (const s of dev.stock_alert_symbols) {
      if (typeof s === "string" && s.trim()) {
        result.push(s.trim().toUpperCase());
      }
    }
  } else if (typeof dev.stock_alert_symbols === "string" && dev.stock_alert_symbols.trim()) {
    try {
      const parsed = JSON.parse(dev.stock_alert_symbols);
      if (Array.isArray(parsed)) {
        for (const s of parsed) {
          if (typeof s === "string" && s.trim()) {
            result.push(s.trim().toUpperCase());
          }
        }
      }
    } catch {
      result.push(dev.stock_alert_symbols.trim().toUpperCase());
    }
  }

  if (result.length === 0 && dev.stock_alert_symbol) {
    result.push(String(dev.stock_alert_symbol).trim().toUpperCase());
  }

  if (result.length === 0) {
    result.push("AAPL");
  }

  return Array.from(new Set(result));
}

serve(async (req) => {
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
        JSON.stringify({ success: true, message: "Quiet hours active (22:00-08:00). Stock alerts muted." }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

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
      .select("device_id, user_id, push_token, stock_alert_symbol, stock_alert_symbols, stock_alert_threshold, last_stock_alert_at, last_stock_alerts_per_symbol, notify_stock, language")
      .not("push_token", "is", null)
      .not("user_id", "is", null);

    if (devError || !devices || devices.length === 0) {
      return new Response(JSON.stringify({ message: "No active devices to notify." }), { status: 200 });
    }

    // Filter devices where user explicitly disabled stock notifications
    const activeDevices = devices.filter((d: any) => d.notify_stock !== false);
    if (activeDevices.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No devices with stock alerts enabled." }), { status: 200 });
    }

    // 2. Group devices by requested stock symbols to batch fetch Finnhub API
    const allUniqueSymbols = new Set<string>();
    for (const dev of activeDevices) {
      const syms = extractDeviceSymbols(dev);
      for (const s of syms) {
        allUniqueSymbols.add(s);
      }
    }

    const symbolDataMap = new Map<string, any>();

    await Promise.all(
      Array.from(allUniqueSymbols).map(async (symbol) => {
        try {
          const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubApiKey}`);
          if (res.ok) {
            const quote = await res.json();
            if (quote && typeof quote.c === "number") {
              symbolDataMap.set(symbol, quote);
            }
          }
        } catch (err) {
          console.warn(`Failed to fetch Finnhub quote for ${symbol}:`, err);
        }
      })
    );

    const COOLDOWN_HOURS = 6; // 6-hour cooldown per individual stock
    const now = new Date();
    let sentCount = 0;

    // 3. Process each device with per-stock cooldown tracking
    for (const dev of activeDevices) {
      const userSymbols = extractDeviceSymbols(dev);
      const threshold = dev.stock_alert_threshold ? Number(dev.stock_alert_threshold) : 2.0;
      const perSymbolHistory: Record<string, string> =
        dev.last_stock_alerts_per_symbol && typeof dev.last_stock_alerts_per_symbol === "object"
          ? { ...dev.last_stock_alerts_per_symbol }
          : {};

      const qualifyingSymbols: { symbol: string; quote: any }[] = [];

      for (const symbol of userSymbols) {
        const quote = symbolDataMap.get(symbol);
        if (!quote || quote.dp == null) continue;

        const changePercent = Math.abs(quote.dp);
        const symbolLastAlert = perSymbolHistory[symbol];
        const symbolHoursDiff = symbolLastAlert
          ? (now.getTime() - new Date(symbolLastAlert).getTime()) / (1000 * 60 * 60)
          : 999;

        // Check if movement exceeds threshold and individual stock cooldown has elapsed
        if (changePercent >= threshold && symbolHoursDiff >= COOLDOWN_HOURS) {
          qualifyingSymbols.push({ symbol, quote });
        }
      }

      if (qualifyingSymbols.length === 0) continue;

      let devSentAny = false;
      const lang = dev.language || "mk";

      // Cap at top 4 stocks per run to avoid tray flooding
      const symbolsToAlert = qualifyingSymbols.slice(0, 4);

      for (const { symbol, quote } of symbolsToAlert) {
        const emoji = quote.dp >= 0 ? "📈" : "📉";
        const sign = quote.dp >= 0 ? "+" : "";
        let title = "";
        let body = "";

        if (lang === "en") {
          title = `${emoji} ${symbol} Significant Movement (${sign}${quote.dp.toFixed(2)}%)`;
          body = `Current price: $${quote.c.toFixed(2)} (Day range: $${quote.l.toFixed(2)} - $${quote.h.toFixed(2)}).`;
        } else if (lang === "al") {
          title = `${emoji} ${symbol} Lëvizje e çmimit (${sign}${quote.dp.toFixed(2)}%)`;
          body = `Çmimi aktual: $${quote.c.toFixed(2)} (Diapazoni ditor: $${quote.l.toFixed(2)} - $${quote.h.toFixed(2)}).`;
        } else {
          title = `${emoji} ${symbol} Значителна промена (${sign}${quote.dp.toFixed(2)}%)`;
          body = `Моментална цена: $${quote.c.toFixed(2)} (Дневен опсег: $${quote.l.toFixed(2)} - $${quote.h.toFixed(2)}).`;
        }

        const ok = await sendFcmPush(
          dev.push_token,
          title,
          body,
          { widgetId: "stock", symbol },
          fcmAccessToken,
          projectId
        );

        if (ok) {
          sentCount++;
          devSentAny = true;
          perSymbolHistory[symbol] = now.toISOString();
        }
      }

      if (devSentAny) {
        await supabase
          .from("user_devices")
          .update({
            last_stock_alert_at: now.toISOString(),
            last_stock_alerts_per_symbol: perSymbolHistory,
          })
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