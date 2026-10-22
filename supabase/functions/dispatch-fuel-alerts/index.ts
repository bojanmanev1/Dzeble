import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";

// Helper: Obtain Google FCM V1 OAuth Token using jose
async function getFcmAccessToken(serviceAccount: any): Promise<string> {
  const privateKeyPem = serviceAccount.private_key;
  const clientEmail = serviceAccount.client_email;

  const importKey = await jose.importPKCS8(privateKeyPem, "RS256");

  const jwt = await new jose.SignJWT({
    iss: clientEmail,
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
  if (!res.ok) {
    throw new Error(`Google OAuth error: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

// Helper: Send FCM Push Request
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
        },
      }),
    }
  );

  return fcmRes.ok;
}

serve(async (req) => {
  try {
    // 1. Fetch Environment Variables & Firebase Secret
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const rawSecret = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");

    if (!rawSecret) {
      return new Response(
        JSON.stringify({ error: "Missing FIREBASE_SERVICE_ACCOUNT_JSON secret" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const serviceAccount = JSON.parse(rawSecret);
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    // 2. Fetch FCM Token
    const fcmAccessToken = await getFcmAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;

    // 3. Query fuel prices from DB (attempt with price_changed_at, fallback if missing)
    let prices: any[] | null = null;
    let priceErr: any = null;

    const resWithChangedAt = await supabase
      .from("fuel_prices")
      .select("fuel_type, price_mkd, previous_price_mkd, effective_from, updated_at, price_changed_at");

    if (!resWithChangedAt.error && resWithChangedAt.data && resWithChangedAt.data.length > 0) {
      prices = resWithChangedAt.data;
    } else {
      const fallbackRes = await supabase
        .from("fuel_prices")
        .select("fuel_type, price_mkd, previous_price_mkd, effective_from, updated_at");
      prices = fallbackRes.data;
      priceErr = fallbackRes.error;
    }

    if (priceErr || !prices || prices.length === 0) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch fuel prices", details: priceErr }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const diesel = prices.find((p) => p.fuel_type === "Дизел");
    const p95 = prices.find((p) => p.fuel_type === "Бензин 95");

    if (!diesel || !p95) {
      return new Response(
        JSON.stringify({ error: "Missing core fuel types (Diesel / Gasoline 95)" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Calculate deltas
    const dieselDiff = (diesel.previous_price_mkd !== null && diesel.previous_price_mkd !== undefined)
      ? diesel.price_mkd - diesel.previous_price_mkd 
      : 0;
    const p95Diff = (p95.previous_price_mkd !== null && p95.previous_price_mkd !== undefined)
      ? p95.price_mkd - p95.previous_price_mkd 
      : 0;

    // 🛑 CRITICAL CHECK 1: ONLY proceed if there is an ACTUAL non-zero price change
    const hasPriceChange = Math.abs(dieselDiff) >= 0.05 || Math.abs(p95Diff) >= 0.05;
    if (!hasPriceChange) {
      console.log("No fuel price change detected (diff is 0.0). Skipping alert dispatch.");
      return new Response(
        JSON.stringify({ success: true, message: "No price change detected (diff is 0.0). Skipped.", sentCount: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Determine when this price change occurred
    const priceChangedAtMs = prices.reduce((latest, p) => {
      const dateStr = p.price_changed_at || p.updated_at;
      if (!dateStr) return latest;
      const t = new Date(dateStr).getTime();
      return t > latest ? t : latest;
    }, 0);

    const now = new Date();
    const nowMs = now.getTime();

    // 🛑 CRITICAL CHECK 2: If the price change happened more than 36 hours ago, it's stale!
    // Never dispatch repeat alerts days after the price change.
    if (priceChangedAtMs > 0) {
      const hoursSinceChange = (nowMs - priceChangedAtMs) / (1000 * 60 * 60);
      if (hoursSinceChange > 36) {
        console.log(`Fuel price change is ${hoursSinceChange.toFixed(1)}h old (stale). Skipping alert dispatch.`);
        return new Response(
          JSON.stringify({ success: true, message: `Price change is older than 36h (${hoursSinceChange.toFixed(1)}h). Skipped stale dispatch.`, sentCount: 0 }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Build notification helper
    let emoji = "⛽";
    if (dieselDiff > 0 || p95Diff > 0) emoji = "📈";
    if (dieselDiff < 0 || p95Diff < 0) emoji = "📉";

    const getFuelNotificationText = (lang: string) => {
      const formatDiff = (diff: number) => (diff > 0 ? `+${diff.toFixed(1)}` : `${diff.toFixed(1)}`);
      if (lang === 'en') {
        return {
          title: `${emoji} Fuel Price Update`,
          body: `Diesel: ${diesel.price_mkd} MKD (${formatDiff(dieselDiff)}) | BS-95: ${p95.price_mkd} MKD (${formatDiff(p95Diff)}).`
        };
      } else if (lang === 'al') {
        return {
          title: `${emoji} Ndryshim i çmimeve të karburantit`,
          body: `Dizel: ${diesel.price_mkd} den (${formatDiff(dieselDiff)}) | BS-95: ${p95.price_mkd} den (${formatDiff(p95Diff)}).`
        };
      }
      return {
        title: `${emoji} Промена на цените на горивата`,
        body: `Дизел: ${diesel.price_mkd} ден (${formatDiff(dieselDiff)}) | BS-95: ${p95.price_mkd} ден (${formatDiff(p95Diff)}).`
      };
    };

    // 4. Query devices ready for alerts (filtering disabled devices)
    const { data: devices, error: devError } = await supabase
      .from("user_devices")
      .select("device_id, user_id, push_token, last_fuel_alert_at, notify_fuel, language")
      .not("push_token", "is", null)
      .not("user_id", "is", null)
      .neq("notify_fuel", false);

    if (devError) {
      return new Response(
        JSON.stringify({ error: "Failed to query devices", details: devError }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    let sentCount = 0;
    let sampleTitle = "";
    let sampleBody = "";

    for (const dev of devices || []) {
      if (dev.last_fuel_alert_at) {
        const lastAlertTime = new Date(dev.last_fuel_alert_at).getTime();

        // 🛑 CRITICAL CHECK 3: If the device was ALREADY notified AT OR AFTER this price change,
        // NEVER notify it again! A device receives exactly ONE notification per price change.
        if (priceChangedAtMs > 0 && lastAlertTime >= priceChangedAtMs) {
          continue;
        }

        // Safety: If notified in the last 6 hours (e.g. concurrent webhook triggers), skip
        const hoursSinceLastAlert = (nowMs - lastAlertTime) / (1000 * 60 * 60);
        if (hoursSinceLastAlert < 6) {
          continue;
        }
      }

      const { title, body } = getFuelNotificationText(dev.language || 'mk');
      sampleTitle = title;
      sampleBody = body;

      const ok = await sendFcmPush(
        dev.push_token,
        title,
        body,
        { widgetId: "fuel" },
        fcmAccessToken,
        projectId
      );

      if (ok) {
        sentCount++;
        await supabase
          .from("user_devices")
          .update({ last_fuel_alert_at: now.toISOString() })
          .eq("device_id", dev.device_id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sentCount, title: sampleTitle, body: sampleBody }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Unknown error", stack: err.stack }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});