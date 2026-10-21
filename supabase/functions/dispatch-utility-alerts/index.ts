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
  try {
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
  } catch {
    return false;
  }
}

serve(async (req) => {
  try {
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

    // 1. Fetch fresh FCM OAuth access token
    const fcmAccessToken = await getFcmAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;

    // 2. Query recent active/upcoming utility outages from the last 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentAlerts, error: alertsErr } = await supabase
      .from("utility_alerts")
      .select("id, type, title, city, municipality, address, start_time, end_time, status, latitude, longitude")
      .in("status", ["active", "upcoming"])
      .gte("updated_at", cutoff)
      .limit(200);

    if (alertsErr || !recentAlerts || recentAlerts.length === 0) {
      return new Response(
        JSON.stringify({ message: "No new active/upcoming utility alerts to process", count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    let totalDispatched = 0;
    const dispatchDetails: any[] = [];

    // 3. For each alert, resolve only nearby users (within 2.5 km)
    for (const alert of recentAlerts) {
      const { data: targetDevices, error: rpcErr } = await supabase.rpc(
        "get_devices_for_utility_alert",
        { p_alert_id: alert.id, p_radius_km: 2.5 }
      );

      if (rpcErr || !targetDevices || targetDevices.length === 0) {
        continue;
      }

      for (const dev of targetDevices) {
        const success = await sendFcmPush(
          dev.push_token,
          dev.notification_title,
          dev.notification_body,
          {
            widgetId: "alerts",
            alertId: alert.id,
            alertType: alert.type,
            distanceKm: dev.distance_km != null ? String(dev.distance_km) : "",
          },
          fcmAccessToken,
          projectId
        );

        if (success) {
          totalDispatched++;
          // Record dispatch to prevent duplicate pushes
          await supabase.rpc("record_utility_alert_dispatched", {
            p_alert_id: alert.id,
            p_device_id: dev.device_id,
            p_user_id: dev.user_id,
            p_push_token: dev.push_token,
            p_distance_km: dev.distance_km,
          });

          dispatchDetails.push({
            device_id: dev.device_id,
            alert_id: alert.id,
            distance_km: dev.distance_km,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dispatched_count: totalDispatched,
        dispatched: dispatchDetails,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to dispatch utility alerts" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
