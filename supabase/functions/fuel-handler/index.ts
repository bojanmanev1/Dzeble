import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.info("ERC Direct POST Scraper Engine with Date Tracker initialized");

export default {
  async fetch(req: Request) {
    try {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return Response.json({ error: "Missing or invalid authorization header" }, { status: 401 });
      }

      console.info("[SCRAPE START] Querying live fuel matrix & effective dates...");

      // State holders for prices and dates
      let p95: number | null = null, p95Date: string | null = null;
      let p98: number | null = null, p98Date: string | null = null;
      let diesel: number | null = null, dieselDate: string | null = null;
      let ekstraLesno: number | null = null, ekstraDate: string | null = null;
      let mazut: number | null = null, mazutDate: string | null = null;
      let scrapeSuccessful = false;

      try {
        const formData = new URLSearchParams();
        formData.append("e", "1");

        const response = await fetch("https://www.erc.org.mk/ceni.aspx", {
          method: "POST",
          headers: { 
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: formData.toString()
        });

        if (response.ok) {
          const html = await response.text();
          
          // Updated regex lookups to capture BOTH the price span and the date td cell that follows it
          const p95Match = html.match(/ЕУРОСУПЕР\s+БС\s*-\s*95[\s\S]*?<span[^>]*?>\s*([0-9\.,]+)[\s\S]*?<\/td>[\s\S]*?<td[^>]*?>.*?<\/td>[\s\S]*?<td[^>]*?>\s*([0-9\.]+)\s*<\/td>/i);
          const p98Match = html.match(/ЕУРОСУПЕР\s+БС\s*-\s*98[\s\S]*?<span[^>]*?>\s*([0-9\.,]+)[\s\S]*?<\/td>[\s\S]*?<td[^>]*?>.*?<\/td>[\s\S]*?<td[^>]*?>\s*([0-9\.]+)\s*<\/td>/i);
          const dieselMatch = html.match(/ЕУРОДИЗЕЛ[\s\S]*?<span[^>]*?>\s*([0-9\.,]+)[\s\S]*?<\/td>[\s\S]*?<td[^>]*?>.*?<\/td>[\s\S]*?<td[^>]*?>\s*([0-9\.]+)\s*<\/td>/i);
          const ekstraMatch = html.match(/ЕКСТРА\s+ЛЕСНО[\s\S]*?<span[^>]*?>\s*([0-9\.,]+)[\s\S]*?<\/td>[\s\S]*?<td[^>]*?>.*?<\/td>[\s\S]*?<td[^>]*?>\s*([0-9\.]+)\s*<\/td>/i);
          const mazutMatch = html.match(/МАЗУТ[\s\S]*?<span[^>]*?>\s*([0-9\.,]+)[\s\S]*?<\/td>[\s\S]*?<td[^>]*?>.*?<\/td>[\s\S]*?<td[^>]*?>\s*([0-9\.]+)\s*<\/td>/i);

          if (p95Match) { p95 = parseFloat(p95Match[1].replace(",", ".")); p95Date = p95Match[2].trim(); }
          if (p98Match) { p98 = parseFloat(p98Match[1].replace(",", ".")); p98Date = p98Match[2].trim(); }
          if (dieselMatch) { diesel = parseFloat(dieselMatch[1].replace(",", ".")); dieselDate = dieselMatch[2].trim(); }
          if (ekstraMatch) { ekstraLesno = parseFloat(ekstraMatch[1].replace(",", ".")); ekstraDate = ekstraMatch[2].trim(); }
          if (mazutMatch) { mazut = parseFloat(mazutMatch[1].replace(",", ".")); mazutDate = mazutMatch[2].trim(); }

          if (p95 && p98 && diesel && ekstraLesno && mazut && p95Date && p98Date && dieselDate && ekstraDate && mazutDate) {
            scrapeSuccessful = true;
          }

          console.info(`[PARSER METRICS] Success: ${scrapeSuccessful} | 95: ${p95} (${p95Date}), Diesel: ${diesel} (${dieselDate})`);
        }
      } catch (scrapeErr: any) {
        console.warn("POST link error:", scrapeErr.message);
      }

      // 🛑 PROTECTION LAYER: Abort if anything missed
      if (!scrapeSuccessful) {
        console.warn("[SYNC ABORTED] Scraper failed to validate live metrics or dates.");
        return Response.json({ success: false, message: "Scrape validation failed." }, { status: 502 });
      }

      // 2. Connect to database
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Query existing prices to accurately preserve previous_price_mkd and price_changed_at
      const { data: existingPrices } = await supabase
        .from('fuel_prices')
        .select('fuel_type, price_mkd, previous_price_mkd, effective_from, price_changed_at');

      const existingMap = new Map((existingPrices || []).map(p => [p.fuel_type, p]));

      const fuelRecords = [
        { fuel_type: 'Бензин 95', price_mkd: p95, effective_from: p95Date },
        { fuel_type: 'Бензин 98+', price_mkd: p98, effective_from: p98Date },
        { fuel_type: 'Дизел', price_mkd: diesel, effective_from: dieselDate },
        { fuel_type: 'Екстра Лесно', price_mkd: ekstraLesno, effective_from: ekstraDate },
        { fuel_type: 'Мазут', price_mkd: mazut, effective_from: mazutDate }
      ];

      let anyPriceChanged = false;
      const nowIso = new Date().toISOString();

      for (const record of fuelRecords) {
        const existing = existingMap.get(record.fuel_type);
        const priceDiff = existing ? Math.abs((existing.price_mkd || 0) - (record.price_mkd || 0)) : 0;
        const isNewChange = existing && priceDiff >= 0.05;
        const isDateChanged = existing && existing.effective_from !== record.effective_from;

        // Only write to DB if the row is new, prices changed, or effective date changed
        if (!existing || isNewChange || isDateChanged) {
          const updatePayload: any = {
            fuel_type: record.fuel_type,
            price_mkd: record.price_mkd,
            effective_from: record.effective_from,
          };

          if (isNewChange) {
            anyPriceChanged = true;
            updatePayload.previous_price_mkd = existing.price_mkd;
            updatePayload.price_changed_at = nowIso;
            updatePayload.updated_at = nowIso;
          } else if (existing) {
            updatePayload.previous_price_mkd = existing.previous_price_mkd;
            if (existing.price_changed_at) {
              updatePayload.price_changed_at = existing.price_changed_at;
            }
          }

          await supabase
            .from('fuel_prices')
            .upsert(updatePayload, { onConflict: 'fuel_type' });
        }
      }

      // If price change was detected, immediately trigger the alert dispatcher!
      if (anyPriceChanged) {
        console.info("[PRICE CHANGE DETECTED] Triggering dispatch-fuel-alerts...");
        try {
          await fetch(`${supabaseUrl}/functions/v1/dispatch-fuel-alerts`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ trigger: "price_changed" }),
          });
        } catch (alertErr: any) {
          console.warn("Failed to trigger dispatch-fuel-alerts:", alertErr.message);
        }
      }

      return Response.json({ success: true, liveScrape: true, updatedCount: fuelRecords.length, anyPriceChanged });

    } catch (err: any) {
      console.error("[GLOBAL CRASH]:", err.message);
      return Response.json({ error: err.message }, { status: 500 });
    }
  },
};