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

function extractDevicePairs(dev: any): string[] {
  const result: string[] = [];
  if (Array.isArray(dev.crypto_alert_pairs) && dev.crypto_alert_pairs.length > 0) {
    for (const p of dev.crypto_alert_pairs) {
      if (typeof p === "string" && p.trim()) {
        result.push(p.trim().toUpperCase());
      }
    }
  } else if (typeof dev.crypto_alert_pairs === "string" && dev.crypto_alert_pairs.trim()) {
    try {
      const parsed = JSON.parse(dev.crypto_alert_pairs);
      if (Array.isArray(parsed)) {
        for (const p of parsed) {
          if (typeof p === "string" && p.trim()) {
            result.push(p.trim().toUpperCase());
          }
        }
      }
    } catch {
      result.push(dev.crypto_alert_pairs.trim().toUpperCase());
    }
  }

  if (result.length === 0 && dev.crypto_alert_pair) {
    result.push(String(dev.crypto_alert_pair).trim().toUpperCase());
  }

  if (result.length === 0) {
    result.push("BTCUSDT");
  }

  // Normalize (ensure USDT suffix if missing) and remove duplicates
  return Array.from(
    new Set(
      result.map((p) => (p.endsWith("USDT") ? p : `${p}USDT`))
    )
  );
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

    // Fetch active devices with tokens and per-coin alert history
    const { data: devices, error: devError } = await supabase
      .from("user_devices")
      .select("device_id, user_id, push_token, crypto_alert_pair, crypto_alert_pairs, last_crypto_alert_at, last_crypto_alerts_per_coin, notify_crypto, language")
      .not("push_token", "is", null)
      .not("user_id", "is", null);

    if (devError) throw devError;
    if (!devices || devices.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No devices found." }), { status: 200 });
    }

    // Filter devices where user explicitly disabled crypto notifications
    const activeDevices = devices.filter((d: any) => d.notify_crypto !== false);
    if (activeDevices.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No devices with crypto alerts enabled." }), { status: 200 });
    }

    // Collect ALL unique pairs across all active users' favorites
    const allUniquePairs = new Set<string>();
    for (const dev of activeDevices) {
      const pairs = extractDevicePairs(dev);
      for (const p of pairs) {
        allUniquePairs.add(p);
      }
    }

    // Fetch 24-hr ticker for all requested pairs from Binance
    const tickerMap = new Map<string, { price: number; change24h: number; high24h: number; low24h: number }>();

    await Promise.all(
      Array.from(allUniquePairs).map(async (pair) => {
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
      })
    );

    const COOLDOWN_HOURS = 8;
    const SIGNIFICANT_CHANGE_THRESHOLD = 4.5;
    const now = new Date();
    let sentCount = 0;

    for (const dev of activeDevices) {
      const userPairs = extractDevicePairs(dev);
      const perCoinHistory: Record<string, string> =
        dev.last_crypto_alerts_per_coin && typeof dev.last_crypto_alerts_per_coin === "object"
          ? { ...dev.last_crypto_alerts_per_coin }
          : {};

      // Check which favorite pairs qualify independently based on their OWN individual cooldown
      const qualifyingPairs: { pair: string; ticker: any }[] = [];

      for (const pair of userPairs) {
        const ticker = tickerMap.get(pair);
        if (!ticker) continue;

        // Individual coin timestamp check
        const coinLastAlert = perCoinHistory[pair];
        const coinHoursDiff = coinLastAlert
          ? (now.getTime() - new Date(coinLastAlert).getTime()) / (1000 * 60 * 60)
          : 999;

        const isPeriodic = coinHoursDiff >= COOLDOWN_HOURS;
        const isBigMoveWindow = coinHoursDiff >= 3;

        if (isPeriodic) {
          // In periodic 8-hour cycle for this specific coin
          qualifyingPairs.push({ pair, ticker });
        } else if (isBigMoveWindow && Math.abs(ticker.change24h) >= SIGNIFICANT_CHANGE_THRESHOLD) {
          // Significant market move on this coin and its own 3-hour cooldown passed
          qualifyingPairs.push({ pair, ticker });
        }
      }

      if (qualifyingPairs.length === 0) continue;

      let devSentAny = false;
      const lang = dev.language || "mk";

      // Cap at top 4 pairs if user has a large number of favorites
      const pairsToAlert = qualifyingPairs.slice(0, 4);

      for (const { pair, ticker } of pairsToAlert) {
        const symbol = pair.replace("USDT", "");
        const isUp = ticker.change24h >= 0;
        const emoji = isUp ? "📈" : "📉";
        const sign = isUp ? "+" : "";
        const priceStr = ticker.price >= 1
          ? ticker.price.toLocaleString("en-US", { maximumFractionDigits: 2 })
          : ticker.price.toFixed(4);

        let title = `${emoji} ${symbol} ${sign}${ticker.change24h.toFixed(2)}% ($${priceStr})`;
        let body = "";

        if (lang === "en") {
          body = isUp
            ? `${symbol} is up by ${sign}${ticker.change24h.toFixed(2)}% in the past 24 hours. 24h High: $${ticker.high24h.toLocaleString("en-US")}.`
            : `${symbol} is down by ${ticker.change24h.toFixed(2)}% in the past 24 hours. 24h Low: $${ticker.low24h.toLocaleString("en-US")}.`;
        } else if (lang === "al") {
          body = isUp
            ? `${symbol} shënon rritje prej ${sign}${ticker.change24h.toFixed(2)}% gjatë 24 orëve të fundit. 24h High: $${ticker.high24h.toLocaleString("en-US")}.`
            : `${symbol} shënon rënie prej ${ticker.change24h.toFixed(2)}% gjatë 24 orëve të fundit. 24h Low: $${ticker.low24h.toLocaleString("en-US")}.`;
        } else {
          body = isUp
            ? `${symbol} бележи раст од ${sign}${ticker.change24h.toFixed(2)}% во изминатите 24 часа. 24h High: $${ticker.high24h.toLocaleString("en-US")}.`
            : `${symbol} бележи пад од ${ticker.change24h.toFixed(2)}% во изминатите 24 часа. 24h Low: $${ticker.low24h.toLocaleString("en-US")}.`;
        }

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
          devSentAny = true;
          // Track per-coin alert time individually
          perCoinHistory[pair] = now.toISOString();
        }
      }

      if (devSentAny) {
        await supabase
          .from("user_devices")
          .update({
            last_crypto_alert_at: now.toISOString(),
            last_crypto_alerts_per_coin: perCoinHistory,
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