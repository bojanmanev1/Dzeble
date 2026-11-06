import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODESHIFT_TENANT = "9814b106-2afe-47c8-919b-bdec6a5e521e";
const ROUTES_URL = `https://www.modeshift.app/api/v1/${MODESHIFT_TENANT}/transport/planner/routes`;
const STOPS_URL = `https://www.modeshift.app/api/v1/${MODESHIFT_TENANT}/transport/planner/stops`;
const LINES_CATEGORIES_URL = "https://skopjebus.mk/wp-content/themes/phlox-pro-child/lines.json";

const MZT_DEPARTURES_URL = "https://mzt.mk/poagane-od-skopje/";
const MZT_ARRIVALS_URL = "https://mzt.mk/pristigane-vo-skopje/";

function formatStopName(raw: string): string {
  if (!raw) return "";
  let name = raw.trim();
  if (name === name.toUpperCase()) {
    name = name
      .toLowerCase()
      .split(" ")
      .map(word => (!word ? "" : word.charAt(0).toUpperCase() + word.slice(1)))
      .join(" ");
  }
  name = name.replace(/\s*-\s*/g, " - ");
  return name;
}

function generateTimetable(frequencyMins: number, startHour = 5, endHour = 23): string[] {
  const times: string[] = [];
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += frequencyMins) {
      if (h === endHour && m > 30) break;
      const hh = h.toString().padStart(2, "0");
      const mm = m.toString().padStart(2, "0");
      times.push(`${hh}:${mm}`);
    }
  }
  return times;
}

// Parser for MZT TablePress HTML tables
async function fetchMztTrainRoutes(url: string, isArrival = false): Promise<any[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) DzebleBot/1.0" }
    });
    if (!res.ok) return [];
    const html = await res.text();

    const tableRegex = /<table[^>]*id="tablepress-(\d+)"[^>]*>([\s\S]*?)<\/table>/gi;
    let match;
    const allRoutes: any[] = [];

    while ((match = tableRegex.exec(html)) !== null) {
      const tableId = match[1];
      const tableHtml = match[2];

      const thMatches = tableHtml.match(/<th[^>]*>(.*?)<\/th>/gi) || [];
      const headers = thMatches.map(th => th.replace(/<[^>]+>/g, "").trim());
      if (headers.length < 2) continue;

      const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let trMatch;
      const rows: string[][] = [];
      while ((trMatch = trRegex.exec(tableHtml)) !== null) {
        const tdMatches = trMatch[1].match(/<td[^>]*>(.*?)<\/td>/gi) || [];
        if (tdMatches.length > 0) {
          rows.push(tdMatches.map(td => td.replace(/<[^>]+>/g, "").trim()));
        }
      }

      for (let colIdx = 1; colIdx < headers.length; colIdx++) {
        const trainHeader = headers[colIdx];
        if (!trainHeader || trainHeader === "&nbsp;" || trainHeader.length < 2) continue;

        const cleanTrainNum = trainHeader.replace(/\*/g, "").trim();
        const stops: { station: string; time: string }[] = [];
        let depTime = "";
        let arrTime = "";
        let firstStation = "";
        let lastStation = "";

        for (const row of rows) {
          const station = row[0];
          const time = row[colIdx];
          if (!station || !time || time === "-" || time === "/" || !time.includes(":")) continue;

          if (!firstStation) {
            firstStation = station;
            depTime = time;
          }
          lastStation = station;
          arrTime = time;

          stops.push({
            station: station.charAt(0).toUpperCase() + station.slice(1).toLowerCase(),
            time: time
          });
        }

        if (stops.length >= 2 && depTime && arrTime) {
          const origin = firstStation.charAt(0).toUpperCase() + firstStation.slice(1).toLowerCase();
          const dest = lastStation.charAt(0).toUpperCase() + lastStation.slice(1).toLowerCase();

          const [dh, dm] = depTime.split(":").map(Number);
          const [ah, am] = arrTime.split(":").map(Number);
          let diff = (ah * 60 + am) - (dh * 60 + dm);
          if (diff < 0) diff += 24 * 60;
          const durH = Math.floor(diff / 60);
          const durM = diff % 60;
          const durStr = durH > 0 ? `${durH}ч ${durM}м` : `${durM}м`;

          allRoutes.push({
            id: `train_${cleanTrainNum.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${isArrival ? "arr" : "dep"}_t${tableId}`,
            train_number: cleanTrainNum.toUpperCase().startsWith("ВОЗ") ? cleanTrainNum : `Воз ${cleanTrainNum}`,
            route_name: `${origin} – ${dest}`,
            from_city: origin,
            to_city: dest,
            departure_time: depTime,
            arrival_time: arrTime,
            duration: durStr,
            type: cleanTrainNum.includes("33") || cleanTrainNum.includes("31") ? "брз" : "патнички",
            runs: "Секој ден",
            stops: stops,
            updated_at: new Date().toISOString()
          });
        }
      }
    }

    return allRoutes;
  } catch (err) {
    console.warn(`[sync-transit] Error fetching MZT trains from ${url}:`, err);
    return [];
  }
}

serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "https://pvxnzqpbdizhyneiyzlf.supabase.co";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("🚍🚆 [sync-transit] Starting automated live sync for JSP Skopje and MZT Trains...");

    // 1. Fetch live JSP routes, stops, and line categories in parallel
    const [routesRes, stopsRes, categoriesRes, trainDeps, trainArrs] = await Promise.all([
      fetch(ROUTES_URL).then(r => r.json()).catch(() => []),
      fetch(STOPS_URL).then(r => r.json()).catch(() => []),
      fetch(LINES_CATEGORIES_URL).then(r => r.json()).catch(() => ({ cityLines: [], subUrbanLines: [], nightLines: [] })),
      fetchMztTrainRoutes(MZT_DEPARTURES_URL, false),
      fetchMztTrainRoutes(MZT_ARRIVALS_URL, true)
    ]);

    if (!Array.isArray(routesRes) || routesRes.length === 0) {
      throw new Error("Failed to fetch official routes from Modeshift API");
    }

    console.log(`Fetched ${routesRes.length} JSP routes, ${stopsRes.length} stops, and ${trainDeps.length + trainArrs.length} MZT trains.`);

    // 2. Build Stops lookup map (id -> stop details)
    const stopMap = new Map<number, { id: number; name: string; lat: number; lon: number; lines: Set<string> }>();
    if (Array.isArray(stopsRes)) {
      for (const s of stopsRes) {
        if (!s || !s.id) continue;
        stopMap.set(s.id, {
          id: s.id,
          name: formatStopName(s.name || `Постојка #${s.id}`),
          lat: s.latitude || 0,
          lon: s.longitude || 0,
          lines: new Set<string>()
        });
      }
    }

    const subUrbanSet = new Set<string>(
      (categoriesRes.subUrbanLines || []).map((l: string) => l.toLowerCase().trim())
    );
    const nightSet = new Set<string>(
      (categoriesRes.nightLines || []).map((l: string) => l.toLowerCase().trim())
    );

    // 3. Process each JSP route
    const processedLines = [];
    for (const route of routesRes) {
      if (!route || !route.shortName) continue;

      const numStr = String(route.shortName).replace(/\s+/g, "").trim();
      const numLower = numStr.toLowerCase();

      let lineType: "city" | "suburban" | "night" = "city";
      let badgeColor = "#059669";
      let freqText = "Секои 10-15 мин";
      let freqMins = 12;

      if (nightSet.has(numLower)) {
        lineType = "night";
        badgeColor = "#7c3aed";
        freqText = "Секои 45-60 мин";
        freqMins = 45;
      } else if (subUrbanSet.has(numLower)) {
        lineType = "suburban";
        badgeColor = "#0284c7";
        freqText = "Секои 25-40 мин";
        freqMins = 30;
      }

      const patterns = Array.isArray(route.patterns) ? route.patterns : [];
      let dirAStops: string[] = [];
      let dirBStops: string[] = [];
      let dirAOrigin = "";
      let dirADest = "";
      let dirBOrigin = "";
      let dirBDest = "";

      if (patterns.length > 0) {
        const pat1 = patterns[0];
        if (Array.isArray(pat1.stops)) {
          dirAStops = pat1.stops
            .map((sid: number) => {
              const stop = stopMap.get(sid);
              if (stop) {
                stop.lines.add(numStr);
                return stop.name;
              }
              return `Постојка #${sid}`;
            })
            .filter((n: string) => n.length > 0);
        }
        if (pat1.fromStopId && stopMap.has(pat1.fromStopId)) {
          dirAOrigin = stopMap.get(pat1.fromStopId)!.name;
        } else if (dirAStops.length > 0) {
          dirAOrigin = dirAStops[0];
        }
        if (pat1.toStopId && stopMap.has(pat1.toStopId)) {
          dirADest = stopMap.get(pat1.toStopId)!.name;
        } else if (dirAStops.length > 0) {
          dirADest = dirAStops[dirAStops.length - 1];
        }
      }

      if (patterns.length > 1) {
        const pat2 = patterns[1];
        if (Array.isArray(pat2.stops)) {
          dirBStops = pat2.stops
            .map((sid: number) => {
              const stop = stopMap.get(sid);
              if (stop) {
                stop.lines.add(numStr);
                return stop.name;
              }
              return `Постојка #${sid}`;
            })
            .filter((n: string) => n.length > 0);
        }
        if (pat2.fromStopId && stopMap.has(pat2.fromStopId)) {
          dirBOrigin = stopMap.get(pat2.fromStopId)!.name;
        } else if (dirBStops.length > 0) {
          dirBOrigin = dirBStops[0];
        }
        if (pat2.toStopId && stopMap.has(pat2.toStopId)) {
          dirBDest = stopMap.get(pat2.toStopId)!.name;
        } else if (dirBStops.length > 0) {
          dirBDest = dirBStops[dirBStops.length - 1];
        }
      }

      if (dirBStops.length === 0 && dirAStops.length > 0) {
        dirBStops = [...dirAStops].reverse();
        dirBOrigin = dirADest;
        dirBDest = dirAOrigin;
      }

      const routeTitle = dirAOrigin && dirADest 
        ? `${dirAOrigin} ↔ ${dirADest}`
        : (route.longName ? String(route.longName).replace(/^ЛИНИЈА\s+\w+\s*[:-]?\s*/i, "") : `Линија ${numStr}`);

      const allStops = dirAStops.length > 0 ? dirAStops : [dirAOrigin || "Почетна", dirADest || "Крајна"];
      const workdayTimes = generateTimetable(freqMins, 5, 23);
      const satTimes = generateTimetable(Math.round(freqMins * 1.3), 6, 23);
      const sunTimes = generateTimetable(Math.round(freqMins * 1.5), 6, 22);

      const directionA = {
        title: `${dirAOrigin || "Почеток"} → ${dirADest || "Крај"}`,
        origin: dirAOrigin || "Почетна",
        destination: dirADest || "Крајна",
        stops: dirAStops.length > 0 ? dirAStops : allStops,
        departuresWorkday: workdayTimes,
        departuresSaturday: satTimes,
        departuresSunday: sunTimes
      };

      const directionB = {
        title: `${dirBOrigin || "Почеток"} → ${dirBDest || "Крај"}`,
        origin: dirBOrigin || "Почетна",
        destination: dirBDest || "Крајна",
        stops: dirBStops.length > 0 ? dirBStops : [...allStops].reverse(),
        departuresWorkday: workdayTimes,
        departuresSaturday: satTimes,
        departuresSunday: sunTimes
      };

      const lineId = `jsp_${numStr.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;

      processedLines.push({
        id: lineId,
        number: numStr,
        title: `Линија ${numStr}`,
        type: lineType,
        badge_color: badgeColor,
        route: routeTitle,
        frequency: freqText,
        first_departure: workdayTimes[0] || "05:00",
        last_departure: workdayTimes[workdayTimes.length - 1] || "23:30",
        stops: allStops,
        departures_workday: workdayTimes,
        departures_weekend: satTimes,
        direction_a: directionA,
        direction_b: directionB,
        updated_at: new Date().toISOString()
      });
    }

    // 4. Extract key bus stops with GPS coordinates
    const processedStops = [];
    for (const stop of stopMap.values()) {
      if (!stop.lat || !stop.lon || stop.lat < 41.0 || stop.lat > 43.0) continue;
      const linesArr = Array.from(stop.lines);
      if (linesArr.length > 0 || stop.name.length > 3) {
        processedStops.push({
          id: `stop_${stop.id}`,
          name: stop.name,
          direction: stop.name.includes("-") ? stop.name.split("-")[1].trim() : "Двонасочно",
          latitude: stop.lat,
          longitude: stop.lon,
          lines: linesArr,
          created_at: new Date().toISOString()
        });
      }
    }

    // 5. Upsert JSP Lines
    for (let i = 0; i < processedLines.length; i += 50) {
      const chunk = processedLines.slice(i, i + 50);
      const { error: lineErr } = await supabase
        .from("transit_lines")
        .upsert(chunk, { onConflict: "id" });
      if (lineErr) console.error("Error upserting lines batch:", lineErr.message);
    }

    // 6. Upsert JSP Stops (top 300)
    processedStops.sort((a, b) => (b.lines?.length || 0) - (a.lines?.length || 0));
    const topStops = processedStops.slice(0, 300);

    for (let i = 0; i < topStops.length; i += 50) {
      const chunk = topStops.slice(i, i + 50);
      const { error: stopErr } = await supabase
        .from("transit_stops")
        .upsert(chunk, { onConflict: "id" });
      if (stopErr) console.error("Error upserting stops batch:", stopErr.message);
    }

    // 7. Upsert MZT Train Routes
    const allTrainRoutes = [...trainDeps, ...trainArrs];
    if (allTrainRoutes.length > 0) {
      for (let i = 0; i < allTrainRoutes.length; i += 20) {
        const chunk = allTrainRoutes.slice(i, i + 20);
        const { error: trainErr } = await supabase
          .from("train_routes")
          .upsert(chunk, { onConflict: "id" });
        if (trainErr) console.error("Error upserting trains batch:", trainErr.message);
      }
    }

    console.log(`✅ [sync-transit] Automated live sync completed: ${processedLines.length} JSP lines, ${topStops.length} stops, ${allTrainRoutes.length} trains.`);

    return new Response(JSON.stringify({
      success: true,
      lines_synced: processedLines.length,
      stops_synced: topStops.length,
      trains_synced: allTrainRoutes.length,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("❌ [sync-transit] Error in sync-transit:", err);
    return new Response(JSON.stringify({ error: err.message || "Failed to sync transit data" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
