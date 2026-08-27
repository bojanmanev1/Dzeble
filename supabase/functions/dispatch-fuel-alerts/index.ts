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

    // 3. Query fuel prices from DB
    const { data: prices, error: priceErr } = await supabase
      .from("fuel_prices")
      .select("fuel_type, price_mkd, previous_price_mkd");

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
    const dieselDiff = diesel.previous_price_mkd ? diesel.price_mkd - diesel.previous_price_mkd : 0;
    const p95Diff = p95.previous_price_mkd ? p95.price_mkd - p95.previous_price_mkd : 0;

    // Build notification text
    let emoji = "⛽";
    if (dieselDiff > 0 || p95Diff > 0) emoji = "📈";
    if (dieselDiff < 0 || p95Diff < 0) emoji = "📉";

    const formatDiff = (diff: number) => (diff > 0 ? `+${diff.toFixed(1)}` : `${diff.toFixed(1)}`);
    
    const title = `${emoji} Промена на цените на горивата`;
    const body = `Дизел: ${diesel.price_mkd} ден (${formatDiff(dieselDiff)}) | BS-95: ${p95.price_mkd} ден (${formatDiff(p95Diff)}).`;

    // 4. Query devices ready for alerts (24-hour cooldown)
    const { data: devices, error: devError } = await supabase
      .from("user_devices")
      .select("device_id, push_token, last_fuel_alert_at")
      .not("push_token", "is", null);

    if (devError) {
      return new Response(
        JSON.stringify({ error: "Failed to query devices", details: devError }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const COOLDOWN_HOURS = 24;
    const now = new Date();
    let sentCount = 0;

    for (const dev of devices || []) {
      const hoursDiff = dev.last_fuel_alert_at
        ? (now.getTime() - new Date(dev.last_fuel_alert_at).getTime()) / (1000 * 60 * 60)
        : 999;

      if (hoursDiff < COOLDOWN_HOURS) continue;

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
      JSON.stringify({ success: true, sentCount, title, body }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Unknown error", stack: err.stack }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});