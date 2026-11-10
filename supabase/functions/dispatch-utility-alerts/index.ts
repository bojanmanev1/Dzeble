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

    // 2. Query active/upcoming utility outages that have not yet ended
    const nowIso = new Date().toISOString();
    const { data: recentAlerts, error: alertsErr } = await supabase
      .from("utility_alerts")
      .select("id, type, title, city, municipality, address, start_time, end_time, status, latitude, longitude")
      .in("status", ["active", "upcoming"])
      .gte("end_time", nowIso)
      .limit(200);

    if (alertsErr || !recentAlerts || recentAlerts.length === 0) {
      return new Response(
        JSON.stringify({ message: "No new active/upcoming utility alerts to process", count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    let totalDispatched = 0;
    const dispatchDetails: any[] = [];

    // 3. Collect pending alerts per device
    interface DeviceBatch {
      deviceId: string;
      pushToken: string;
      userId?: string;
      language: string;
      alerts: Array<{
        alertId: string;
        alertType: string;
        alertTitle: string;
        alertCity: string;
        alertMunicipality?: string;
        alertAddress?: string;
        alertStart?: string;
        alertEnd?: string;
        distanceKm?: number;
        notificationTitle: string;
        notificationBody: string;
      }>;
    }

    const deviceBatches = new Map<string, DeviceBatch>();

    for (const alert of recentAlerts) {
      const { data: targetDevices, error: rpcErr } = await supabase.rpc(
        "get_devices_for_utility_alert",
        { p_alert_id: alert.id, p_radius_km: 3.0 }
      );

      if (rpcErr || !targetDevices || targetDevices.length === 0) {
        continue;
      }

      for (const dev of targetDevices) {
        let batch = deviceBatches.get(dev.device_id);
        if (!batch) {
          batch = {
            deviceId: dev.device_id,
            pushToken: dev.push_token,
            userId: dev.user_id,
            language: dev.language || "mk",
            alerts: [],
          };
          deviceBatches.set(dev.device_id, batch);
        }

        batch.alerts.push({
          alertId: alert.id,
          alertType: alert.type,
          alertTitle: alert.title,
          alertCity: alert.city,
          alertMunicipality: alert.municipality,
          alertAddress: alert.address,
          alertStart: alert.start_time,
          alertEnd: alert.end_time,
          distanceKm: dev.distance_km,
          notificationTitle: dev.notification_title,
          notificationBody: dev.notification_body,
        });
      }
    }

    // 4. Dispatch per device (single or digest, maximum 1 utility push per device!)
    for (const [deviceId, batch] of deviceBatches.entries()) {
      const lang = batch.language || "mk";
      const alerts = batch.alerts;
      if (!alerts || alerts.length === 0) continue;

      // Earthquakes are emergency alerts and sent immediately
      const earthquakes = alerts.filter(a => a.alertType === "earthquake");
      const utilities = alerts.filter(a => a.alertType !== "earthquake");

      for (const eq of earthquakes) {
        const success = await sendFcmPush(
          batch.pushToken,
          eq.notificationTitle,
          eq.notificationBody,
          {
            widgetId: "alerts",
            alertId: eq.alertId,
            alertType: "earthquake",
          },
          fcmAccessToken,
          projectId
        );

        if (success) {
          totalDispatched++;
          await supabase.rpc("record_utility_alert_dispatched", {
            p_alert_id: eq.alertId,
            p_device_id: deviceId,
            p_user_id: batch.userId,
            p_push_token: batch.pushToken,
            p_distance_km: eq.distanceKm,
          });
          dispatchDetails.push({ device_id: deviceId, alert_id: eq.alertId, type: "earthquake" });
        }
      }

      // Utility Outages: EXACTLY ONE PUSH (Single or Digest)
      if (utilities.length === 1) {
        const item = utilities[0];
        const success = await sendFcmPush(
          batch.pushToken,
          item.notificationTitle,
          item.notificationBody,
          {
            widgetId: "alerts",
            alertId: item.alertId,
            alertType: item.alertType,
            distanceKm: item.distanceKm != null ? String(item.distanceKm) : "",
          },
          fcmAccessToken,
          projectId
        );

        if (success) {
          totalDispatched++;
          await supabase.rpc("record_utility_alert_dispatched", {
            p_alert_id: item.alertId,
            p_device_id: deviceId,
            p_user_id: batch.userId,
            p_push_token: batch.pushToken,
            p_distance_km: item.distanceKm,
          });
          dispatchDetails.push({ device_id: deviceId, alert_id: item.alertId, type: item.alertType });
        }
      } else if (utilities.length > 1) {
        const count = utilities.length;
        const hasPower = utilities.some(a => a.alertType === "power");
        const hasWater = utilities.some(a => a.alertType === "water");
        const hasRoad = utilities.some(a => a.alertType === "road");

        let digestTitle = "";
        if (hasPower && !hasWater && !hasRoad) {
          digestTitle = lang === "en"
            ? `⚡ ${count} power outages scheduled near you`
            : lang === "al"
            ? `⚡ ${count} ndërprerje të rrymës afër jush`
            : `⚡ Најавени ${count} прекини на струја во ваша близина`;
        } else if (hasWater && !hasPower && !hasRoad) {
          digestTitle = lang === "en"
            ? `💧 ${count} water outages scheduled near you`
            : lang === "al"
            ? `💧 ${count} ndërprerje të ujit afër jush`
            : `💧 Најавени ${count} прекини на вода во ваша близина`;
        } else {
          digestTitle = lang === "en"
            ? `⚠️ ${count} utility alerts in your area`
            : lang === "al"
            ? `⚠️ ${count} njoftime komunale afër jush`
            : `⚠️ Најавени ${count} комунални прекини во ваша близина`;
        }

        const primaryLoc = utilities[0].alertMunicipality || utilities[0].alertCity || "";
        const streetSamples = utilities
          .map(a => {
            const raw = a.alertAddress || a.alertTitle;
            return raw.replace(/^(?:потрошувачите\s+на\s+дел\s+од\s+)?(?:ул\.|улица)?\s*/i, "").substring(0, 30).trim();
          })
          .filter(Boolean)
          .slice(0, 2)
          .join(", ");

        let digestBody = "";
        if (lang === "en") {
          digestBody = primaryLoc
            ? `In ${primaryLoc}: ${streetSamples}${count > 2 ? ` and ${count - 2} more` : ""}. Tap to view schedule.`
            : `${count} utility alerts nearby (${streetSamples}). Tap to view schedule.`;
        } else if (lang === "al") {
          digestBody = primaryLoc
            ? `Në ${primaryLoc}: ${streetSamples}${count > 2 ? ` dhe ${count - 2} të tjera` : ""}. Prekni për orarin.`
            : `${count} ndërprerje afër jush (${streetSamples}). Prekni për orarin.`;
        } else {
          digestBody = primaryLoc
            ? `Во ${primaryLoc}: ${streetSamples}${count > 2 ? ` и уште ${count - 2}` : ""}. Допрете за детален распоред.`
            : `${count} прекини во близина (${streetSamples}). Допрете за детален распоред.`;
        }

        const success = await sendFcmPush(
          batch.pushToken,
          digestTitle,
          digestBody,
          {
            widgetId: "alerts",
            alertCount: String(count),
            alertType: utilities[0].alertType,
          },
          fcmAccessToken,
          projectId
        );

        if (success) {
          totalDispatched++;
          // Mark all grouped alerts as dispatched for this device
          for (const item of utilities) {
            await supabase.rpc("record_utility_alert_dispatched", {
              p_alert_id: item.alertId,
              p_device_id: deviceId,
              p_user_id: batch.userId,
              p_push_token: batch.pushToken,
              p_distance_km: item.distanceKm,
            });
          }
          dispatchDetails.push({
            device_id: deviceId,
            digest: true,
            count: count,
            alert_ids: utilities.map(a => a.alertId),
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
