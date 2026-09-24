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
    // Calculate date and hour in Europe/Skopje time zone
    const now = new Date();
    const skopjeDateFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Skopje",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const todayStr = skopjeDateFormatter.format(now); // e.g., "2026-09-24"

    const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = skopjeDateFormatter.format(tomorrowDate);

    const localHour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Skopje",
        hour: "numeric",
        hour12: false,
      }).format(now),
      10
    );

    // Quiet hours (22:00 - 07:00)
    if (localHour >= 22 || localHour < 7) {
      return new Response(
        JSON.stringify({ success: true, message: "Quiet hours active (22:00-07:00). Reminders skipped." }),
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

    // 1. Fetch active devices whose users have calendar notifications enabled
    const { data: devices, error: devError } = await supabase
      .from("user_devices")
      .select("device_id, user_id, push_token")
      .not("push_token", "is", null)
      .not("user_id", "is", null)
      .eq("notify_calendar", true);

    if (devError || !devices || devices.length === 0) {
      return new Response(JSON.stringify({ message: "No active devices eligible for calendar alerts." }), { status: 200 });
    }

    const userIds = Array.from(new Set(devices.map((d: any) => d.user_id)));

    // 2. Fetch pending reminders for today and tomorrow
    const { data: events, error: eventErr } = await supabase
      .from("user_widgets")
      .select("id, user_id, title, event_date, notified_eve, notified_day")
      .in("user_id", userIds)
      .in("event_date", [todayStr, tomorrowStr]);

    if (eventErr || !events || events.length === 0) {
      return new Response(JSON.stringify({ success: true, sentCount: 0, message: "No upcoming reminders found." }), { status: 200 });
    }

    let sentCount = 0;

    for (const ev of events) {
      // Find device tokens registered to this user
      const userDevices = devices.filter((d: any) => d.user_id === ev.user_id);
      if (userDevices.length === 0) continue;

      let title = "";
      let body = "";
      let updateField: "notified_eve" | "notified_day" | null = null;

      // Condition A: Morning reminder on the day of the event (07:00 - 12:00)
      if (ev.event_date === todayStr && !ev.notified_day && localHour >= 7 && localHour < 13) {
        title = `🔔 Денешен потсетник: ${ev.title}`;
        body = `Имате закажан настан/роденден денес (${ev.title}). Не заборавајте! 📅`;
        updateField = "notified_day";
      }
      // Condition B: Evening heads-up on the day before the event (18:00 - 21:00)
      else if (ev.event_date === tomorrowStr && !ev.notified_eve && localHour >= 18 && localHour < 22) {
        title = `⏰ Потсетник за утре: ${ev.title}`;
        body = `Утре имате настан: "${ev.title}". Подгответе се навреме! 🎁`;
        updateField = "notified_eve";
      }

      if (!updateField) continue;

      for (const dev of userDevices) {
        const ok = await sendFcmPush(
          dev.push_token,
          title,
          body,
          { widgetId: "holidays", eventId: ev.id },
          fcmAccessToken,
          projectId
        );
        if (ok) sentCount++;
      }

      // Mark event as notified so subsequent runs don't duplicate
      await supabase
        .from("user_widgets")
        .update({ [updateField]: true })
        .eq("id", ev.id);
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